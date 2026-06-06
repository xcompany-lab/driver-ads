// Trigger Pix Out (transfer) at Pagou.ai for a payout row.
// Admin-only. Body: { payout_id: string }
// On success: marks payouts row processing, persists pagou_transfer_id + request_id.
// Webhook (payout.* events) drives the final paid/failed transitions.
import {
  adminClient,
  corsHeaders,
  getAuthedUser,
  json,
  pagouRequest,
} from "../_shared/pagou-client.ts";

interface Body {
  payout_id?: string;
}

interface PagouTransferResp {
  id?: string;
  status?: string;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders });
  }
  if (req.method !== "POST") return json({ error: "method_not_allowed" }, 405);

  const user = await getAuthedUser(req);
  if (!user) return json({ error: "unauthorized" }, 401);

  const supabase = adminClient();

  // Admin check
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
  if (!body.payout_id) return json({ error: "missing_payout_id" }, 400);

  // Load payout + driver + method
  const { data: payout, error: payErr } = await supabase
    .from("payouts")
    .select(
      "id, driver_id, payout_method_id, amount_cents, status, external_ref, pagou_transfer_id, description",
    )
    .eq("id", body.payout_id)
    .maybeSingle();
  if (payErr || !payout) return json({ error: "payout_not_found" }, 404);

  if (!["draft", "approved", "failed", "rejected", "error"].includes(payout.status)) {
    return json(
      { error: "invalid_state", detail: `Payout em status "${payout.status}" não pode ser executado.` },
      409,
    );
  }
  if (payout.pagou_transfer_id) {
    return json(
      { error: "already_dispatched", pagou_transfer_id: payout.pagou_transfer_id },
      409,
    );
  }
  if (!payout.payout_method_id) {
    return json({ error: "missing_payout_method" }, 422);
  }

  const { data: method } = await supabase
    .from("driver_payout_methods")
    .select(
      "id, pix_key_type, pix_key_value, legal_name, document_number, document_type, status",
    )
    .eq("id", payout.payout_method_id)
    .maybeSingle();
  if (!method) return json({ error: "payout_method_not_found" }, 404);
  if (method.status !== "approved") {
    return json({ error: "payout_method_not_approved", detail: method.status }, 422);
  }

  const { data: driver } = await supabase
    .from("drivers")
    .select("id, full_name, email, cpf")
    .eq("id", payout.driver_id)
    .maybeSingle();
  if (!driver) return json({ error: "driver_not_found" }, 404);

  const externalRef = payout.external_ref ?? `payout_${payout.id}`;

  const pagouBody = {
    amount: payout.amount_cents,
    description: payout.description ?? `Repasse Driver Ads — ${driver.full_name}`,
    external_id: externalRef,
    pix: {
      key_type: method.pix_key_type, // cpf | cnpj | email | phone | random
      key: method.pix_key_value,
    },
    receiver: {
      name: method.legal_name ?? driver.full_name,
      document: method.document_number ?? driver.cpf,
      document_type: method.document_type ?? "cpf",
    },
  };

  // Mark as processing BEFORE calling so a duplicate concurrent run is blocked
  await supabase
    .from("payouts")
    .update({
      status: "processing",
      external_ref: externalRef,
      approved_by: user.id,
      approved_at: new Date().toISOString(),
    })
    .eq("id", payout.id);

  const resp = await pagouRequest<PagouTransferResp>(
    "/v2/payouts",
    {
      method: "POST",
      headers: { "Idempotency-Key": externalRef },
      body: JSON.stringify(pagouBody),
    },
    { entity_type: "payout", entity_id: payout.id },
  );

  if (!resp.ok) {
    await supabase
      .from("payouts")
      .update({
        status: "failed",
        failed_at: new Date().toISOString(),
        failure_reason: resp.error ?? `HTTP ${resp.status}`,
        request_id: resp.requestId,
        raw_payload: resp.data as unknown as Record<string, unknown> | null,
      })
      .eq("id", payout.id);
    // Return earnings to accrued so admin can retry
    await supabase
      .from("driver_earnings")
      .update({ status: "accrued", payout_id: null })
      .eq("payout_id", payout.id);
    return json(
      { error: "pagou_failed", detail: resp.error, status: resp.status, request_id: resp.requestId },
      502,
    );
  }

  const transferId = resp.data?.id ?? null;
  await supabase
    .from("payouts")
    .update({
      pagou_transfer_id: transferId,
      request_id: resp.requestId,
      raw_payload: resp.data as unknown as Record<string, unknown> | null,
    })
    .eq("id", payout.id);

  return json({ ok: true, payout_id: payout.id, pagou_transfer_id: transferId, request_id: resp.requestId });
});
