// POST /functions/v1/pagou-create-subscription
// Body: { campaign_id, plan_id, token, card_brand?, card_last4?, exp_month?, exp_year? }
// 1) Validates ownership of advertiser/campaign.
// 2) Ensures Pagou customer exists (creating if needed).
// 3) Creates Pagou subscription with idempotency.
// 4) Persists subscription + audit + campaign.billing_status='pending'.
import {
  adminClient,
  corsHeaders,
  getAuthedUser,
  json,
  PAGOU_ENV,
  pagouRequest,
} from "../_shared/pagou-client.ts";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

interface Input {
  campaign_id: string;
  plan_id: string;
  token: string;
  card_brand?: string | null;
  card_last4?: string | null;
  exp_month?: string | null;
  exp_year?: string | null;
}

function validate(raw: unknown): Input | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;
  if (typeof r.campaign_id !== "string" || !UUID_RE.test(r.campaign_id)) return null;
  if (typeof r.plan_id !== "string" || !UUID_RE.test(r.plan_id)) return null;
  if (typeof r.token !== "string" || r.token.length < 10 || r.token.length > 400) return null;
  return {
    campaign_id: r.campaign_id,
    plan_id: r.plan_id,
    token: r.token,
    card_brand: typeof r.card_brand === "string" ? r.card_brand.slice(0, 40) : null,
    card_last4: typeof r.card_last4 === "string" ? r.card_last4.slice(0, 4) : null,
    exp_month: typeof r.exp_month === "string" ? r.exp_month.slice(0, 2) : null,
    exp_year: typeof r.exp_year === "string" ? r.exp_year.slice(0, 4) : null,
  };
}

async function ensureCustomer(
  admin: ReturnType<typeof adminClient>,
  advertiserId: string,
): Promise<string> {
  const { data: adv, error } = await admin
    .from("advertisers")
    .select(
      "id, user_id, company_name, cnpj, document_type, responsible, email, phone, address, city, segment, pagou_customer_id",
    )
    .eq("id", advertiserId)
    .single();
  if (error || !adv) throw new Error("advertiser_not_found");
  if (adv.pagou_customer_id) return adv.pagou_customer_id as string;

  const document_number = String(adv.cnpj ?? "").replace(/\D/g, "");
  const document_type =
    (adv.document_type as string | null) ??
    (document_number.length === 11 ? "CPF" : "CNPJ");

  const body = {
    name: adv.company_name,
    email: adv.email,
    phone: adv.phone,
    document: { type: document_type, number: document_number },
    externalRef: `advertiser_${adv.id}`,
    address: adv.address ?? { city: adv.city, country: "BR" },
  };

  const res = await pagouRequest<{ id: string }>(
    "/v2/customers",
    { method: "POST", body: JSON.stringify(body) },
    { entity_type: "advertiser", entity_id: adv.id as string },
  );
  if (!res.ok || !res.data?.id) {
    throw new Error(`pagou_customer_error: ${friendlyPagouError(res.error, res.code)}`);
  }

  await admin
    .from("advertisers")
    .update({ pagou_customer_id: res.data.id })
    .eq("id", adv.id);

  await admin.from("audit_logs").insert({
    action: "pagou.customer.created",
    entity_type: "advertiser",
    entity_id: adv.id,
    after_data: { pagou_customer_id: res.data.id },
    metadata: { request_id: res.requestId },
  });

  return res.data.id;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders });
  }
  if (req.method !== "POST") return json({ error: "method_not_allowed" }, 405);

  const user = await getAuthedUser(req);
  if (!user) return json({ error: "unauthorized" }, 401);

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return json({ error: "invalid_json" }, 400);
  }
  const data = validate(body);
  if (!data) return json({ error: "invalid_input" }, 400);

  const admin = adminClient();

  // Load campaign + ownership
  const { data: campaign, error: ce } = await admin
    .from("campaigns")
    .select("id, advertiser_id, name, billing_status")
    .eq("id", data.campaign_id)
    .single();
  if (ce || !campaign) return json({ error: "campaign_not_found" }, 404);

  const { data: adv, error: ae } = await admin
    .from("advertisers")
    .select("id, user_id, pagou_customer_id")
    .eq("id", campaign.advertiser_id)
    .single();
  if (ae || !adv) return json({ error: "advertiser_not_found" }, 404);

  const { data: staff } = await admin
    .from("user_roles")
    .select("role")
    .eq("user_id", user.id)
    .in("role", ["admin", "operator"]);
  const isStaff = (staff?.length ?? 0) > 0;
  if (!isStaff && adv.user_id !== user.id) return json({ error: "forbidden" }, 403);

  const { data: plan, error: pe } = await admin
    .from("campaign_plans")
    .select(
      "id, name, monthly_price_cents, currency, billing_interval, billing_interval_count",
    )
    .eq("id", data.plan_id)
    .single();
  if (pe || !plan) return json({ error: "plan_not_found" }, 404);

  const externalRef = `sub_campaign_${campaign.id}_v1`;

  // Idempotency: existing live subscription for this campaign?
  const { data: existing } = await admin
    .from("subscriptions")
    .select("id, pagou_subscription_id, status")
    .eq("external_ref", externalRef)
    .maybeSingle();
  if (existing?.pagou_subscription_id && existing.status !== "canceled") {
    return json({
      subscription_id: existing.id,
      pagou_subscription_id: existing.pagou_subscription_id,
      status: existing.status,
      next_action: null,
    });
  }

  let customerId: string;
  try {
    customerId = await ensureCustomer(admin, adv.id as string);
  } catch (e) {
    return json({
      error: (e as Error).message,
      code: "pagou_customer_error",
      edge_status: 502,
    });
  }

  const subBody = {
    customer_id: customerId,
    token: data.token,
    interval: plan.billing_interval ?? "month",
    interval_count: plan.billing_interval_count ?? 1,
    failure_policy: "retry_then_cancel",
    retry_offsets_days: [1, 3, 5],
    amount: plan.monthly_price_cents,
    currency: plan.currency ?? "BRL",
    metadata: {
      driver_ads_env: PAGOU_ENV(),
      advertiser_id: adv.id,
      campaign_id: campaign.id,
      plan_id: plan.id,
      source: "driver_ads_checkout",
    },
    idempotency_key: externalRef,
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
  }>(
    "/v2/subscriptions",
    {
      method: "POST",
      body: JSON.stringify(subBody),
      headers: { "X-Idempotency-Key": externalRef },
    },
    { entity_type: "campaign", entity_id: campaign.id as string },
  );

  if (!res.ok || !res.data?.id) {
    return json(
      {
        error: friendlyPagouError(res.error, res.code),
        code: res.code ?? "pagou_subscription_error",
        status: res.status,
        edge_status: 502,
        pagou_request_id: res.requestId,
      },
    );
  }

  const { data: insRow, error: insErr } = await admin
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
  if (insErr) return json({ error: insErr.message }, 500);

  await admin
    .from("campaigns")
    .update({ plan_id: plan.id, billing_status: "pending" })
    .eq("id", campaign.id);

  await admin.from("audit_logs").insert({
    actor_id: user.id,
    action: "pagou.subscription.created",
    entity_type: "subscription",
    entity_id: insRow.id,
    after_data: { pagou_subscription_id: res.data.id, status: res.data.status },
    metadata: { request_id: res.requestId, campaign_id: campaign.id },
  });

  return json({
    subscription_id: insRow.id,
    pagou_subscription_id: res.data.id,
    status: res.data.status,
    next_action: res.data.next_action ?? null,
  });
});

function friendlyPagouError(error: string | null, code?: string | null) {
  const raw = error ?? "unknown";
  const details = parsePagouBody(raw);

  if (code === "pagou_network_dns") {
    return (
      "A Edge Function chegou ao checkout, mas o host sandbox oficial da Pagou.ai nao resolve DNS neste momento. " +
      "A secret PAGOU_BASE_URL ja deve ficar como https://api-sandbox.pagou.ai; solicite a Pagou um endpoint sandbox v2 funcional antes de retestar."
    );
  }

  if (code === "pagou_token_missing") {
    return (
      "A secret do token da Pagou nao esta disponivel para esta Edge Function. " +
      "Configure PAGOU_API_TOKEN ou PAGOU_SECRET_TOKEN no Supabase e redeploye a funcao."
    );
  }

  if (details.title || details.detail) {
    return `Pagou recusou a assinatura: ${details.title ?? "erro"}${details.detail ? ` - ${details.detail}` : ""}`;
  }

  return raw;
}

function parsePagouBody(error: string) {
  const bodyMatch = error.match(/body=(.+)$/s);
  if (!bodyMatch) return {} as { title?: string; detail?: string };
  try {
    const parsed = JSON.parse(bodyMatch[1]) as { title?: string; detail?: string; message?: string };
    return { title: parsed.title ?? parsed.message, detail: parsed.detail };
  } catch {
    return {} as { title?: string; detail?: string };
  }
}
