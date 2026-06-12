// Pagou.ai webhook receiver — handles transactions, subscriptions, payouts
// URL: https://<project-ref>.supabase.co/functions/v1/pagou-webhook
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { handleSubscriptionEvent } from "./_lib/handlers/subscription.ts";
import { handleTransactionEvent } from "./_lib/handlers/transaction.ts";
import { handlePayoutEvent } from "./_lib/handlers/payout.ts";
import { pagouRequest } from "../_shared/pagou-client.ts";

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

  // A Pagou v2 nao assina o webhook (nao envia header de assinatura/segredo).
  // Em vez de rejeitar por um segredo que nunca chega (causava 401), registramos
  // o evento e validamos a autenticidade reconsultando o recurso na API da Pagou
  // antes de mutar a cobranca. Se um segredo estiver configurado e bater, e' fast-path.
  const trustedBySecret = WEBHOOK_SECRET ? extractSecret(req) === WEBHOOK_SECRET : false;

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
      let data = payload?.data ?? payload;

      const isSub = family === "subscription" || /^subscription\./.test(eventType ?? "");
      const isTx = family === "transaction" || /^transaction\./.test(eventType ?? "");
      const isPayout =
        family === "payout" || family === "transfer" || /^(payout|transfer)\./.test(eventType ?? "");

      // Anti-forja: para eventos de TRANSACAO (confirmacao de pagamento), quando
      // nao veio de fonte confiavel (segredo), confirma o estado real direto na
      // API da Pagou (GET /v2/transactions/{id}) antes de marcar como pago.
      if (!trustedBySecret && isTx && resourceId) {
        const verified = await pagouRequest(`/v2/transactions/${resourceId}`, { method: "GET" });
        if (!verified.ok || !verified.data) {
          await supabase
            .from("pagou_webhook_events")
            .update({
              processing_status: "ignored",
              error_message: "unverified_against_pagou",
              processed_at: new Date().toISOString(),
            })
            .eq("id", inserted.id);
          return;
        }
        data = verified.data as typeof data;
      }

      if (isSub) {
        await handleSubscriptionEvent(supabase, data, eventType);
        status = "processed";
      } else if (isTx) {
        await handleTransactionEvent(supabase, data, eventType);
        status = "processed";
      } else if (isPayout) {
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
