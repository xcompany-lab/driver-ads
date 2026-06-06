// Transaction event handler - Pagou.ai
// deno-lint-ignore-file no-explicit-any
import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { generateDriverEarnings } from "../earnings.ts";

function isPaidTransaction(data: any, eventType: string | null) {
  return (
    eventType === "transaction.paid" ||
    ["paid", "succeeded", "approved"].includes(String(data?.status ?? "").toLowerCase())
  );
}

async function insertLedgerOnce(
  supabase: SupabaseClient,
  externalRef: string,
  row: Record<string, unknown>,
) {
  const { data: existing } = await supabase
    .from("ledger_entries")
    .select("id")
    .eq("external_ref", externalRef)
    .maybeSingle();
  if (existing) return;

  await supabase.from("ledger_entries").insert({
    ...row,
    external_ref: externalRef,
  });
}

export async function handleTransactionEvent(
  supabase: SupabaseClient,
  data: any,
  eventType: string | null,
) {
  if (!data?.id) return;

  const { data: tx } = await supabase
    .from("billing_transactions")
    .select(
      "id, advertiser_id, campaign_id, subscription_id, status, billing_period_start, billing_period_end",
    )
    .eq("pagou_transaction_id", data.id)
    .maybeSingle();

  const paid = isPaidTransaction(data, eventType);
  const update: Record<string, unknown> = {
    status: data.status ?? "pending",
    paid_at: data.paid_at ?? (paid ? new Date().toISOString() : null),
    paid_amount_cents: data.paid_amount ?? (paid ? data.amount : 0),
    refunded_amount_cents: data.refunded_amount ?? 0,
    failure_reason: data.failure_reason ?? null,
    raw_payload: data,
  };

  if (tx) {
    await supabase.from("billing_transactions").update(update).eq("id", tx.id);
  }

  if (paid) {
    if (!tx) return;

    await insertLedgerOnce(supabase, `tx_paid_${data.id}`, {
      entry_type: "advertiser_payment",
      direction: "credit",
      amount_cents: data.amount ?? 0,
      advertiser_id: tx.advertiser_id,
      campaign_id: tx.campaign_id,
      billing_transaction_id: tx.id,
      subscription_id: tx.subscription_id,
      description: "Pagamento confirmado",
    });

    if (tx.campaign_id && tx.billing_period_end) {
      await supabase
        .from("campaigns")
        .update({
          billing_status: "paid",
          current_period_start: tx.billing_period_start,
          current_period_end: tx.billing_period_end,
        })
        .eq("id", tx.campaign_id);
    }

    if (tx.campaign_id) {
      await generateDriverEarnings(supabase, {
        campaignId: tx.campaign_id,
        billingTransactionId: tx.id,
        subscriptionId: tx.subscription_id ?? null,
        periodStart: tx.billing_period_start ?? null,
        periodEnd: tx.billing_period_end ?? null,
      });
    }
    return;
  }

  switch (eventType) {
    case "transaction.refunded":
    case "transaction.partially_refunded":
      if (tx) {
        await insertLedgerOnce(supabase, `tx_refund_${data.id}`, {
          entry_type: "advertiser_refund",
          direction: "debit",
          amount_cents: data.refunded_amount ?? data.amount ?? 0,
          advertiser_id: tx.advertiser_id,
          campaign_id: tx.campaign_id,
          billing_transaction_id: tx.id,
          description: "Reembolso",
        });
      }
      break;

    case "transaction.chargedback":
      if (tx) {
        await insertLedgerOnce(supabase, `tx_chargeback_${data.id}`, {
          entry_type: "chargeback_lock",
          direction: "debit",
          amount_cents: data.amount ?? 0,
          advertiser_id: tx.advertiser_id,
          campaign_id: tx.campaign_id,
          billing_transaction_id: tx.id,
          description: "Chargeback recebido",
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
            title: "Revisar chargeback de transacao",
            description: `Transacao ${data.id} sofreu chargeback.`,
            campaign_id: tx.campaign_id,
            priority: "urgent",
          });
        }
      }
      break;
  }
}
