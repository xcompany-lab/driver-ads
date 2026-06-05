// Pagou.ai webhook receiver — handles transactions, subscriptions, payouts
// URL: https://<project-ref>.supabase.co/functions/v1/pagou-webhook
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { handleSubscriptionEvent } from "./_lib/handlers/subscription.ts";
import { handleTransactionEvent } from "./_lib/handlers/transaction.ts";
import { handlePayoutEvent } from "./_lib/handlers/payout.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const WEBHOOK_SECRET = Deno.env.get("PAGOU_WEBHOOK_SECRET") ?? "";

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE, {
  auth: { persistSession: false, autoRefreshToken: false },
});

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });

function extractSecret(req: Request): string {
  return (
    req.headers.get("x-pagou-signature") ??
    req.headers.get("x-webhook-secret") ??
    req.headers.get("x-pagou-token") ??
    req.headers.get("authorization")?.replace(/^Bearer\s+/i, "") ??
    ""
  );
}

function captureHeaders(req: Request): Record<string, string> {
  const out: Record<string, string> = {};
  req.headers.forEach((v, k) => {
    if (/auth|secret|token|signature/i.test(k)) out[k] = "***";
    else out[k] = v;
  });
  return out;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, {
      status: 204,
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "POST, OPTIONS",
        "Access-Control-Allow-Headers": "*",
      },
    });
  }
  if (req.method !== "POST") return json({ error: "method_not_allowed" }, 405);

  // Validate secret if configured
  if (WEBHOOK_SECRET) {
    const provided = extractSecret(req);
    if (!provided || provided !== WEBHOOK_SECRET) {
      console.warn("[pagou-webhook] invalid secret");
      return json({ error: "unauthorized" }, 401);
    }
  }

  let payload: any;
  try {
    payload = await req.json();
  } catch {
    return json({ error: "invalid_json" }, 400);
  }

  const eventId: string | undefined =
    payload?.id ?? payload?.event_id ?? payload?.data?.id;
  if (!eventId) {
    return json({ received: true, ignored: "no_event_id" }, 200);
  }

  const family: string | null = payload?.event ?? payload?.type ?? null;
  const eventType: string | null =
    payload?.data?.event_type ?? payload?.event_type ?? payload?.type ?? null;
  const resourceId: string | null =
    payload?.data?.id ?? payload?.resource_id ?? null;

  // Dedup insert
  const { data: inserted, error: insertErr } = await supabase
    .from("pagou_webhook_events")
    .insert({
      pagou_event_id: eventId,
      event: family,
      event_type: eventType,
      api_version: payload?.api_version ?? null,
      pagou_resource_id: resourceId,
      payload,
      headers: captureHeaders(req),
      processing_status: "received",
    })
    .select("id")
    .single();

  if (insertErr) {
    // Unique violation → duplicate
    if (insertErr.code === "23505") {
      return json({ received: true, duplicate: true }, 200);
    }
    console.error("[pagou-webhook] insert error", insertErr);
    return json({ received: true, error: "persist_failed" }, 200);
  }

  // Process async — respond fast
  (async () => {
    try {
      let status: "processed" | "ignored" | "unhandled" | "failed" = "unhandled";
      const data = payload?.data ?? payload;
      if (family === "subscription" || /^subscription\./.test(eventType ?? "")) {
        await handleSubscriptionEvent(supabase, data, eventType);
        status = "processed";
      } else if (family === "transaction" || /^transaction\./.test(eventType ?? "")) {
        await handleTransactionEvent(supabase, data, eventType);
        status = "processed";
      } else if (
        family === "payout" ||
        family === "transfer" ||
        /^(payout|transfer)\./.test(eventType ?? "")
      ) {
        await handlePayoutEvent(supabase, data, eventType);
        status = "processed";
      }
      await supabase
        .from("pagou_webhook_events")
        .update({ processing_status: status, processed_at: new Date().toISOString() })
        .eq("id", inserted.id);
    } catch (err) {
      console.error("[pagou-webhook] handler error", err);
      await supabase
        .from("pagou_webhook_events")
        .update({
          processing_status: "failed",
          error_message: (err as Error)?.message?.slice(0, 1000) ?? "unknown",
          processed_at: new Date().toISOString(),
        })
        .eq("id", inserted.id);
    }
  })();

  return json({ received: true }, 200);
});
