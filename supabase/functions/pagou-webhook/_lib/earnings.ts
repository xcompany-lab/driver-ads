// Generate driver_earnings rows for every active assignment of a campaign
// when a billing period is paid (Pix charge or subscription renewal/first
// charge). Idempotent: skips assignments that already have an earning row
// for the same billing_transaction_id.
// deno-lint-ignore-file no-explicit-any
import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

// Chargeback hold window (days). Earnings stay 'accrued' until then.
const HOLD_DAYS = 7;

export interface GenerateEarningsInput {
  campaignId: string;
  billingTransactionId: string;
  subscriptionId?: string | null;
  periodStart: string | null;
  periodEnd: string | null;
}

export async function generateDriverEarnings(
  supabase: SupabaseClient,
  input: GenerateEarningsInput,
): Promise<{ created: number; skipped: number }> {
  const { campaignId, billingTransactionId, subscriptionId, periodStart, periodEnd } =
    input;

  // Active (or installation-ready) assignments are the ones that earn.
  const { data: assignments, error } = await supabase
    .from("campaign_driver_assignments")
    .select("id, driver_id, monthly_payout, status")
    .eq("campaign_id", campaignId)
    .in("status", ["active", "awaiting_installation"]);

  if (error) {
    console.error("[earnings] load assignments failed", error);
    return { created: 0, skipped: 0 };
  }
  if (!assignments?.length) return { created: 0, skipped: 0 };

  const ps =
    periodStart ?? new Date().toISOString();
  const pe =
    periodEnd ??
    new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();
  const availableAt = new Date(
    Date.now() + HOLD_DAYS * 24 * 60 * 60 * 1000,
  ).toISOString();

  let created = 0;
  let skipped = 0;

  for (const a of assignments) {
    // Idempotency: one earning per (assignment, billing_transaction).
    const { data: existing } = await supabase
      .from("driver_earnings")
      .select("id")
      .eq("assignment_id", a.id)
      .eq("billing_transaction_id", billingTransactionId)
      .maybeSingle();
    if (existing) {
      skipped++;
      continue;
    }

    const amountCents = Math.round(Number(a.monthly_payout ?? 0) * 100);
    if (amountCents <= 0) {
      skipped++;
      continue;
    }

    const { error: insErr } = await supabase.from("driver_earnings").insert({
      driver_id: a.driver_id,
      campaign_id: campaignId,
      assignment_id: a.id,
      subscription_id: subscriptionId ?? null,
      billing_transaction_id: billingTransactionId,
      period_start: ps,
      period_end: pe,
      amount_cents: amountCents,
      status: "accrued",
      available_at: availableAt,
      metadata: { source: "webhook", hold_days: HOLD_DAYS },
    });
    if (insErr) {
      console.error("[earnings] insert failed", insErr);
      skipped++;
    } else {
      created++;
    }
  }

  return { created, skipped };
}
