// Refund a Pagou transaction. Admin-only.
// Body: { transaction_id: string (local id), amount_cents?: number, reason?: string }
import {
  adminClient,
  corsHeaders,
  getAuthedUser,
  json,
  pagouRequest,
} from "../_shared/pagou-client.ts";

interface Body {
  transaction_id?: string;
  amount_cents?: number;
  reason?: string;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "method_not_allowed" }, 405);

  const user = await getAuthedUser(req);
  if (!user) return json({ error: "unauthorized" }, 401);

  const supabase = adminClient();
  const { data: rolesRows } = await supabase
    .from("user_roles")
    .select("role")
    .eq("user_id", user.id);
  const isAdmin = (rolesRows ?? []).some((r) => r.role === "admin");
  if (!isAdmin) return json({ error: "forbidden" }, 403);

  let body: Body;
  try {
    body = await req.json();
  } catch {
    return json({ error: "invalid_json" }, 400);
  }
  if (!body.transaction_id) return json({ error: "missing_transaction_id" }, 400);

  const { data: tx, error: txErr } = await supabase
    .from("billing_transactions")
    .select("id, campaign_id, pagou_transaction_id, amount_cents, refunded_amount_cents, status")
    .eq("id", body.transaction_id)
    .maybeSingle();
  if (txErr || !tx) return json({ error: "transaction_not_found" }, 404);
  if (!tx.pagou_transaction_id) return json({ error: "missing_pagou_transaction_id" }, 422);
  if (tx.status !== "paid" && tx.status !== "partially_refunded") {
    return json({ error: "invalid_state", detail: `Status atual: ${tx.status}` }, 409);
  }

  const maxRefundable = (tx.amount_cents ?? 0) - (tx.refunded_amount_cents ?? 0);
  const refundAmount = body.amount_cents ?? maxRefundable;
  if (refundAmount <= 0 || refundAmount > maxRefundable) {
    return json({ error: "invalid_amount", max: maxRefundable }, 422);
  }

  const idempotencyKey = `refund_${tx.id}_${refundAmount}`;
  const resp = await pagouRequest(
    `/v2/transactions/${tx.pagou_transaction_id}/refund`,
    {
      method: "POST",
      headers: { "Idempotency-Key": idempotencyKey },
      body: JSON.stringify({
        amount: refundAmount,
        reason: body.reason ?? null,
      }),
    },
    { entity_type: "transaction", entity_id: tx.id },
  );

  if (!resp.ok) {
    return json(
      { error: "pagou_failed", detail: resp.error, status: resp.status, request_id: resp.requestId },
      502,
    );
  }

  // Webhook (transaction.refunded / transaction.partially_refunded) finalizes the local row.
  // Optimistically reflect the new totals so the UI updates immediately.
  const newRefunded = (tx.refunded_amount_cents ?? 0) + refundAmount;
  const newStatus = newRefunded >= (tx.amount_cents ?? 0) ? "refunded" : "partially_refunded";
  await supabase
    .from("billing_transactions")
    .update({
      refunded_amount_cents: newRefunded,
      status: newStatus,
    })
    .eq("id", tx.id);

  await supabase.from("audit_logs").insert({
    actor_id: user.id,
    actor_role: "admin",
    action: newStatus === "refunded" ? "transaction.refunded" : "transaction.partially_refunded",
    entity_type: "billing_transaction",
    entity_id: tx.id,
    metadata: {
      amount_cents: refundAmount,
      reason: body.reason ?? null,
      pagou_transaction_id: tx.pagou_transaction_id,
    },
  });

  return json({ ok: true, request_id: resp.requestId, refunded_amount_cents: newRefunded });
});
