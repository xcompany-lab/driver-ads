// Pagou subscription / pix transaction / public key
import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

// --- Public key (exposed to checkout UI; PAGOU_PUBLIC_KEY is a publishable key) ---
export const getPagouPublicKey = createServerFn({ method: "GET" }).handler(async () => {
  return {
    public_key: process.env.PAGOU_PUBLIC_KEY ?? "",
    environment: (process.env.PAGOU_ENV ?? "sandbox") as "sandbox" | "production",
  };
});

// --- Create subscription (card recurring) ---
const SubInput = z.object({
  campaign_id: z.string().uuid(),
  plan_id: z.string().uuid(),
  token: z.string().min(10).max(200),
  card_brand: z.string().max(40).optional().nullable(),
  card_last4: z.string().max(4).optional().nullable(),
  exp_month: z.string().max(2).optional().nullable(),
  exp_year: z.string().max(4).optional().nullable(),
});

export const createPagouSubscription = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => SubInput.parse(d))
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { pagouRequest } = await import("./client.server");

    // Load campaign + plan + advertiser, authz via RLS
    const { data: campaign, error: ce } = await context.supabase
      .from("campaigns")
      .select("id, advertiser_id, name, billing_status")
      .eq("id", data.campaign_id)
      .single();
    if (ce || !campaign) throw new Error("Campanha não encontrada");

    const { data: plan, error: pe } = await context.supabase
      .from("campaign_plans")
      .select("id, name, monthly_price_cents, currency, billing_interval, billing_interval_count")
      .eq("id", data.plan_id)
      .single();
    if (pe || !plan) throw new Error("Plano não encontrado");

    const { data: adv, error: ae } = await context.supabase
      .from("advertisers")
      .select("id, user_id, pagou_customer_id")
      .eq("id", campaign.advertiser_id)
      .single();
    if (ae || !adv) throw new Error("Anunciante não encontrado");

    // Ensure customer
    let customerId = adv.pagou_customer_id;
    if (!customerId) {
      const { getOrCreatePagouCustomer } = await import("./customer.functions");
      const res = await getOrCreatePagouCustomer({ data: { advertiser_id: adv.id } });
      customerId = res.pagou_customer_id;
    }

    const externalRef = `sub_campaign_${campaign.id}_v1`;
    const idempotencyKey = externalRef;

    // Check for existing pending subscription for this campaign
    const { data: existing } = await supabaseAdmin
      .from("subscriptions")
      .select("id, pagou_subscription_id, status")
      .eq("external_ref", externalRef)
      .maybeSingle();
    if (existing?.pagou_subscription_id && existing.status !== "canceled") {
      return {
        subscription_id: existing.id,
        pagou_subscription_id: existing.pagou_subscription_id,
        status: existing.status,
        next_action: null,
      };
    }

    const body = {
      customer_id: customerId,
      token: data.token,
      interval: plan.billing_interval ?? "month",
      interval_count: plan.billing_interval_count ?? 1,
      failure_policy: "retry_then_cancel",
      retry_offsets_days: [1, 3, 5],
      amount: plan.monthly_price_cents,
      currency: plan.currency ?? "BRL",
      metadata: {
        driver_ads_env: process.env.PAGOU_ENV ?? "sandbox",
        advertiser_id: adv.id,
        campaign_id: campaign.id,
        plan_id: plan.id,
        source: "driver_ads_checkout",
      },
      idempotency_key: idempotencyKey,
      products: [
        {
          name: `Driver Ads - ${plan.name}`,
          price: plan.monthly_price_cents,
          quantity: 1,
          tangible: false,
          sku: `DRIVER_ADS_${plan.id}`,
        },
      ],
    };

    const res = await pagouRequest<{
      id: string;
      status: string;
      current_period_start?: string;
      current_period_end?: string;
      card_brand?: string;
      card_last4?: string;
      latest_transaction?: { id: string; status: string };
      next_action?: unknown;
    }>("/v2/subscriptions", {
      method: "POST",
      body: JSON.stringify(body),
      headers: { "X-Idempotency-Key": idempotencyKey },
    }, { entity_type: "campaign", entity_id: campaign.id });

    if (!res.ok || !res.data?.id) {
      throw new Error(`Pagou subscription error: ${res.error ?? "unknown"}`);
    }

    // Persist subscription
    const { data: insRow, error: insErr } = await supabaseAdmin
      .from("subscriptions")
      .upsert(
        {
          advertiser_id: adv.id,
          campaign_id: campaign.id,
          plan_id: plan.id,
          pagou_customer_id: customerId,
          pagou_subscription_id: res.data.id,
          status: res.data.status ?? "incomplete",
          payment_method: "credit_card_subscription",
          amount_cents: plan.monthly_price_cents,
          currency: plan.currency ?? "BRL",
          interval: plan.billing_interval ?? "month",
          interval_count: plan.billing_interval_count ?? 1,
          current_period_start: res.data.current_period_start ?? null,
          current_period_end: res.data.current_period_end ?? null,
          card_brand: res.data.card_brand ?? data.card_brand ?? null,
          card_last4: res.data.card_last4 ?? data.card_last4 ?? null,
          card_exp_month: data.exp_month ?? null,
          card_exp_year: data.exp_year ?? null,
          latest_transaction_id: res.data.latest_transaction?.id ?? null,
          external_ref: externalRef,
        },
        { onConflict: "external_ref" },
      )
      .select("id")
      .single();
    if (insErr) throw new Error(insErr.message);

    await supabaseAdmin
      .from("campaigns")
      .update({ plan_id: plan.id, billing_status: "pending" })
      .eq("id", campaign.id);

    await supabaseAdmin.from("audit_logs").insert({
      actor_id: context.userId,
      action: "pagou.subscription.created",
      entity_type: "subscription",
      entity_id: insRow.id,
      after_data: { pagou_subscription_id: res.data.id, status: res.data.status },
      metadata: { request_id: res.requestId, campaign_id: campaign.id },
    });

    return {
      subscription_id: insRow.id,
      pagou_subscription_id: res.data.id,
      status: res.data.status,
      next_action: res.data.next_action ?? null,
    };
  });

// --- Get subscription state (for polling) ---
export const getCampaignBillingState = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ campaign_id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { data: row } = await context.supabase
      .from("campaigns")
      .select("id, billing_status, operational_status, current_period_start, current_period_end")
      .eq("id", data.campaign_id)
      .single();
    const { data: sub } = await context.supabase
      .from("subscriptions")
      .select("id, status, card_brand, card_last4, current_period_end")
      .eq("campaign_id", data.campaign_id)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    return { campaign: row, subscription: sub };
  });
