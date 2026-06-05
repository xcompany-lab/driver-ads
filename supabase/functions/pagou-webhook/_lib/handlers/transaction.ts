// Transaction event handler — Pagou.ai
// deno-lint-ignore-file no-explicit-any
import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

export async function handleTransactionEvent(
  supabase: SupabaseClient,
  data: any,
  eventType: string | null,
) {
  if (!data?.id) return;

  const { data: tx } = await supabase
    .from("billing_transactions")
    .select("id, advertiser_id, campaign_id, subscription_id, status, billing_period_end")
    .eq("pagou_transaction_id", data.id)
    .maybeSingle();

  const update: Record<string, unknown> = {
    status: data.status ?? "pending",
    paid_at: data.paid_at ?? null,
    paid_amount_cents: data.paid_amount ?? (data.status === "paid" ? data.amount : 0),
    refunded_amount_cents: data.refunded_amount ?? 0,
    failure_reason: data.failure_reason ?? null,
    raw_payload: data,
  };

  if (tx) {
    await supabase.from("billing_transactions").update(update).eq("id", tx.id);
  }

  switch (eventType) {
    case "transaction.paid":
      if (tx) {
        await supabase.from("ledger_entries").insert({
          entry_type: "advertiser_payment",
          direction: "credit",
          amount_cents: data.amount ?? 0,
          advertiser_id: tx.advertiser_id,
          campaign_id: tx.campaign_id,
          billing_transaction_id: tx.id,
          subscription_id: tx.subscription_id,
          description: "Pagamento confirmado",
          external_ref: `tx_paid_${data.id}`,
        });
        // For Pix prepaid: activate period on the campaign
        if (data.method === "pix" && tx.campaign_id && tx.billing_period_end) {
          await supabase
            .from("campaigns")
            .update({
              billing_status: "paid",
              current_period_end: tx.billing_period_end,
            })
            .eq("id", tx.campaign_id);
        }
      }
      break;

    case "transaction.refunded":
    case "transaction.partially_refunded":
      if (tx) {
        await supabase.from("ledger_entries").insert({
          entry_type: "advertiser_refund",
          direction: "debit",
          amount_cents: data.refunded_amount ?? data.amount ?? 0,
          advertiser_id: tx.advertiser_id,
          campaign_id: tx.campaign_id,
          billing_transaction_id: tx.id,
          description: "Reembolso",
          external_ref: `tx_refund_${data.id}`,
        });
      }
      break;

    case "transaction.chargedback":
      if (tx) {
        await supabase.from("ledger_entries").insert({
          entry_type: "chargeback_lock",
          direction: "debit",
          amount_cents: data.amount ?? 0,
          advertiser_id: tx.advertiser_id,
          campaign_id: tx.campaign_id,
          billing_transaction_id: tx.id,
          description: "Chargeback recebido",
          external_ref: `tx_chargeback_${data.id}`,
        });
        if (tx.campaign_id) {
          await supabase
            .from("campaigns")
            .update({ billing_status: "chargedback" })
            .eq("id", tx.campaign_id);
          await supabase
            .from("driver_earnings")
            .update({ status: "locked", locked_reason: "chargeback" })
            .eq("campaign_id", tx.campaign_id)
            .in("status", ["estimated", "accrued", "available"]);
          await supabase.from("operational_tasks").insert({
            task_type: "review_chargeback",
            title: "Revisar chargeback de transação",
            description: `Transação ${data.id} sofreu chargeback.`,
            campaign_id: tx.campaign_id,
            priority: "urgent",
          });
        }
      }
      break;
  }
}
