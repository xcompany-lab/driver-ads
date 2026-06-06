// Cancel a Pagou subscription. Admin-only.
// Body: { subscription_id: string (local id), at_period_end?: boolean, reason?: string }
import {
  adminClient,
  corsHeaders,
  getAuthedUser,
  json,
  pagouRequest,
} from "../_shared/pagou-client.ts";

interface Body {
  subscription_id?: string;
  at_period_end?: boolean;
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
  if (!body.subscription_id) return json({ error: "missing_subscription_id" }, 400);

  const { data: sub, error: subErr } = await supabase
    .from("subscriptions")
    .select("id, campaign_id, pagou_subscription_id, status")
    .eq("id", body.subscription_id)
    .maybeSingle();
  if (subErr || !sub) return json({ error: "subscription_not_found" }, 404);
  if (!sub.pagou_subscription_id) return json({ error: "missing_pagou_subscription_id" }, 422);
  if (["canceled", "cancelled"].includes(sub.status)) {
    return json({ error: "already_canceled" }, 409);
  }

  const atPeriodEnd = body.at_period_end !== false; // default true
  const resp = await pagouRequest(
    `/v2/subscriptions/${sub.pagou_subscription_id}`,
    {
      method: "DELETE",
      body: JSON.stringify({
        cancel_at_period_end: atPeriodEnd,
        cancellation_reason: body.reason ?? null,
      }),
    },
    { entity_type: "subscription", entity_id: sub.id },
  );

  if (!resp.ok) {
    return json(
      { error: "pagou_failed", detail: resp.error, status: resp.status, request_id: resp.requestId },
      502,
    );
  }

  const patch: Record<string, unknown> = {
    cancel_at_period_end: atPeriodEnd,
    cancellation_reason: body.reason ?? null,
  };
  if (!atPeriodEnd) {
    patch.status = "canceled";
    patch.canceled_at = new Date().toISOString();
  } else {
    patch.status = "cancel_scheduled";
  }
  await supabase.from("subscriptions").update(patch).eq("id", sub.id);

  await supabase
    .from("campaigns")
    .update({ billing_status: atPeriodEnd ? "cancel_scheduled" : "canceled" })
    .eq("id", sub.campaign_id);

  await supabase.from("audit_logs").insert({
    actor_id: user.id,
    actor_role: "admin",
    action: atPeriodEnd ? "subscription.cancel_scheduled" : "subscription.canceled",
    entity_type: "subscription",
    entity_id: sub.id,
    metadata: { reason: body.reason ?? null, pagou_subscription_id: sub.pagou_subscription_id },
  });

  return json({ ok: true, request_id: resp.requestId });
});
