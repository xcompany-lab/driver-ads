// Subscription event handler — Pagou.ai
// deno-lint-ignore-file no-explicit-any
import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { generateDriverEarnings } from "../earnings.ts";

function mapStatus(pagouStatus?: string): string {
  return pagouStatus ?? "incomplete";
}

function mapBillingStatus(pagouStatus?: string):
  | "active" | "trialing" | "past_due" | "payment_failed"
  | "cancel_scheduled" | "canceled" | "chargedback" | "pending" {
  switch (pagouStatus) {
    case "active": return "active";
    case "trialing": return "trialing";
    case "past_due": return "past_due";
    case "cancel_scheduled": return "cancel_scheduled";
    case "canceled": return "canceled";
    case "incomplete": return "pending";
    default: return "pending";
  }
}

export async function handleSubscriptionEvent(
  supabase: SupabaseClient,
  data: any,
  eventType: string | null,
) {
  if (!data?.id) return;

  // Sync subscription row by pagou_subscription_id
  const { data: sub } = await supabase
    .from("subscriptions")
    .select("id, campaign_id, advertiser_id, status")
    .eq("pagou_subscription_id", data.id)
    .maybeSingle();

  if (!sub) {
    // Subscription unknown locally — log and exit; reconciliation will pick up
    console.warn("[subscription] unknown pagou_subscription_id", data.id);
    return;
  }

  const update: Record<string, unknown> = {
    status: mapStatus(data.status),
    current_period_start: data.current_period_start ?? null,
    current_period_end: data.current_period_end ?? null,
    cancel_at_period_end: data.cancel_at_period_end ?? false,
    canceled_at: data.canceled_at ?? null,
    cancellation_reason: data.cancellation_reason ?? null,
    card_brand: data.card_brand ?? data.payment_method?.card?.brand ?? null,
    card_last4: data.card_last4 ?? data.payment_method?.card?.last4 ?? null,
    latest_transaction_id: data.latest_transaction?.id ?? null,
  };
  await supabase.from("subscriptions").update(update).eq("id", sub.id);

  // Update campaign billing/operational status
  const billing = mapBillingStatus(data.status);
  const campUpdate: Record<string, unknown> = {
    billing_status: billing,
    current_period_start: data.current_period_start ?? null,
    current_period_end: data.current_period_end ?? null,
  };

  switch (eventType) {
    case "subscription.payment_failed":
      campUpdate.billing_status = "payment_failed";
      campUpdate.payment_grace_until = new Date(Date.now() + 5 * 24 * 60 * 60 * 1000).toISOString();
      break;
    case "subscription.past_due":
      campUpdate.billing_status = "past_due";
      campUpdate.operational_status = "removal_pending";
      campUpdate.removal_required_at = new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString();
      await supabase.from("operational_tasks").insert({
        task_type: "remove_ad_due_to_past_due",
        title: "Remover anúncio — assinatura inadimplente",
        description: `Campanha ${sub.campaign_id} entrou em past_due. Coordene remoção/troca do material com o motorista.`,
        campaign_id: sub.campaign_id,
        priority: "high",
      });
      break;
    case "subscription.canceled":
      campUpdate.billing_status = "canceled";
      break;
    case "subscription.chargeback_received":
      campUpdate.billing_status = "chargedback";
      await supabase.from("operational_tasks").insert({
        task_type: "review_chargeback",
        title: "Revisar chargeback",
        description: `Chargeback recebido para assinatura ${data.id}. Congelar repasses pendentes.`,
        campaign_id: sub.campaign_id,
        priority: "urgent",
      });
      // Lock pending earnings
      await supabase
        .from("driver_earnings")
        .update({ status: "locked", locked_reason: "chargeback" })
        .eq("campaign_id", sub.campaign_id)
        .in("status", ["estimated", "accrued", "available"]);
      break;
  }
  await supabase.from("campaigns").update(campUpdate).eq("id", sub.campaign_id);

  // Register billing transaction on renewal
  if (eventType === "subscription.renewed" && data.latest_transaction?.id) {
    const tx = data.latest_transaction;
    await supabase.from("billing_transactions").upsert(
      {
        advertiser_id: sub.advertiser_id,
        campaign_id: sub.campaign_id,
        subscription_id: sub.id,
        pagou_transaction_id: tx.id,
        pagou_subscription_id: data.id,
        external_ref: `sub_renewal_${data.id}_${tx.id}`,
        method: "credit_card",
        status: tx.status ?? "paid",
        amount_cents: tx.amount ?? 0,
        paid_amount_cents: tx.status === "paid" ? tx.amount ?? 0 : 0,
        currency: tx.currency ?? "BRL",
        billing_period_start: data.current_period_start,
        billing_period_end: data.current_period_end,
        paid_at: tx.paid_at ?? null,
        raw_payload: tx,
      },
      { onConflict: "pagou_transaction_id" },
    );

    // Ledger
    if (tx.status === "paid") {
      await supabase.from("ledger_entries").insert({
        entry_type: "advertiser_payment",
        direction: "credit",
        amount_cents: tx.amount ?? 0,
        advertiser_id: sub.advertiser_id,
        campaign_id: sub.campaign_id,
        subscription_id: sub.id,
        description: "Renovação de assinatura",
        external_ref: `sub_renewal_${data.id}_${tx.id}`,
      });
    }
  }
}
