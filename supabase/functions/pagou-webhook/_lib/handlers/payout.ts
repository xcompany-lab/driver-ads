// Payout (Pix Out / transfer) event handler — Pagou.ai
// deno-lint-ignore-file no-explicit-any
import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

export async function handlePayoutEvent(
  supabase: SupabaseClient,
  data: any,
  eventType: string | null,
) {
  if (!data?.id) return;

  const { data: payout } = await supabase
    .from("payouts")
    .select("id, driver_id, amount_cents, status")
    .eq("pagou_transfer_id", data.id)
    .maybeSingle();

  if (!payout) {
    console.warn("[payout] unknown pagou_transfer_id", data.id);
    return;
  }

  const update: Record<string, unknown> = { raw_payload: data };

  switch (eventType) {
    case "payout.created":
    case "payout.in_analysis":
    case "payout.processing":
      update.status = eventType === "payout.in_analysis" ? "in_analysis" : "processing";
      break;

    case "payout.transferred":
      update.status = "paid";
      update.paid_at = data.paid_at ?? new Date().toISOString();
      await supabase
        .from("driver_earnings")
        .update({ status: "paid", paid_at: new Date().toISOString() })
        .eq("payout_id", payout.id);
      await supabase.from("ledger_entries").insert({
        entry_type: "driver_payout",
        direction: "debit",
        amount_cents: payout.amount_cents,
        driver_id: payout.driver_id,
        payout_id: payout.id,
        description: "Pix Out para motorista",
        external_ref: `payout_paid_${data.id}`,
      });
      break;

    case "payout.failed":
    case "payout.rejected":
      update.status = eventType === "payout.failed" ? "failed" : "rejected";
      update.failed_at = new Date().toISOString();
      update.failure_reason = data.failure_reason ?? data.message ?? null;
      // Return earnings to available
      await supabase
        .from("driver_earnings")
        .update({ status: "available", payout_id: null })
        .eq("payout_id", payout.id);
      await supabase.from("operational_tasks").insert({
        task_type: "review_failed_payout",
        title: "Pix Out falhou — revisar",
        description: `Payout ${payout.id} (${eventType}). Motivo: ${data.failure_reason ?? "n/a"}`,
        driver_id: payout.driver_id,
        priority: "high",
      });
      break;

    case "payout.canceled":
      update.status = "cancelled";
      await supabase
        .from("driver_earnings")
        .update({ status: "available", payout_id: null })
        .eq("payout_id", payout.id);
      break;
  }

  await supabase.from("payouts").update(update).eq("id", payout.id);
}
