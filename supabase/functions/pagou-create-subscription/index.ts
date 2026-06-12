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
  PAGOU_WEBHOOK_URL,
  pagouRequest,
} from "../_shared/pagou-client.ts";
import { generateDriverEarnings } from "../pagou-webhook/_lib/earnings.ts";

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

function normalizeEmail(raw: unknown) {
  const email = typeof raw === "string" ? raw.trim().toLowerCase() : "";
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ? email : null;
}

function normalizePhone(raw: unknown) {
  const digits = String(raw ?? "").replace(/\D/g, "");
  return digits.length === 11 ? digits : null;
}

function normalizeDocument(raw: unknown, rawType: unknown) {
  const number = String(raw ?? "").replace(/\D/g, "");
  if (number.length !== 11 && number.length !== 14) return null;
  const type =
    typeof rawType === "string" && rawType.trim()
      ? rawType.toUpperCase()
      : number.length === 11
        ? "CPF"
        : "CNPJ";
  return { type, number };
}

function normalizeAddress(rawAddress: unknown) {
  if (!rawAddress || typeof rawAddress !== "object") return null;
  const raw = rawAddress as Record<string, unknown>;
  const street = typeof raw.street === "string" ? raw.street.trim() : "";
  const city = typeof raw.city === "string" ? raw.city.trim() : "";
  if (!street || !city) return null;

  const address: Record<string, unknown> = { street, city };
  for (const key of ["number", "complement", "neighborhood", "state", "zipCode", "country"]) {
    const value = raw[key];
    if (typeof value === "string" && value.trim()) address[key] = value.trim();
  }
  if (!address.country) address.country = "BR";
  return address;
}

function getClientIp(req: Request) {
  const forwarded = req.headers.get("forwarded")?.match(/for="?([^;,"]+)/i)?.[1];
  const candidates = [
    req.headers.get("cf-connecting-ip"),
    req.headers.get("true-client-ip"),
    req.headers.get("x-real-ip"),
    req.headers.get("x-forwarded-for")?.split(",")[0],
    forwarded,
  ];
  const ip = candidates.find((value) => value && value.trim());
  return ip?.trim() ?? null;
}

function getPaymentIp(req: Request) {
  return getClientIp(req) ?? (PAGOU_ENV() === "sandbox" ? "127.0.0.1" : null);
}

function isPaidStatus(status: unknown) {
  return ["paid", "succeeded", "approved"].includes(String(status ?? "").toLowerCase());
}

function isFailedStatus(status: unknown) {
  return [
    "refused",
    "failed",
    "declined",
    "denied",
    "not_authorized",
    "error",
    "canceled",
    "cancelled",
    "voided",
    "chargedback",
    "blocked",
  ].includes(String(status ?? "").toLowerCase());
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

  const email = normalizeEmail(adv.email);
  if (!email) throw new Error("pagou_customer_error: email do anunciante invalido ou ausente");

  const body: Record<string, unknown> = {
    name: String(adv.company_name || adv.responsible || email).trim(),
    email,
    externalRef: `advertiser_${adv.id}`,
  };
  const phone = normalizePhone(adv.phone);
  if (phone) body.phone = phone;
  const document = normalizeDocument(adv.cnpj, adv.document_type);
  if (document) body.document = document;
  const address = normalizeAddress(adv.address);
  if (address) body.address = address;

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
    .select("id, user_id, pagou_customer_id, company_name, cnpj, document_type, responsible, email, phone")
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

  const periodStart = new Date();
  const periodEnd = new Date(periodStart.getTime() + 30 * 24 * 60 * 60 * 1000);
  const externalRef = `card_campaign_${campaign.id}_${periodStart.getTime()}`;
  const buyerEmail = normalizeEmail(adv.email);
  if (!buyerEmail) {
    return json({
      error: "O email cadastrado no perfil do anunciante e invalido ou esta ausente. Atualize o email antes de pagar no cartao.",
      code: "email_invalid",
    });
  }

  const buyer: Record<string, unknown> = {
    name: String(adv.company_name || adv.responsible || buyerEmail).trim(),
    email: buyerEmail,
  };
  const buyerPhone = normalizePhone(adv.phone);
  if (buyerPhone) buyer.phone = buyerPhone;
  const buyerDocument = normalizeDocument(adv.cnpj, adv.document_type);
  if (buyerDocument) buyer.document = buyerDocument;

  const paymentIp = getPaymentIp(req);
  if (!paymentIp) {
    return json(
      {
        error:
          "Nao foi possivel identificar o IP do comprador para o pagamento no cartao. Tente novamente ou acione o suporte.",
        code: "ip_address_missing",
      },
      400,
    );
  }

  const txBody: Record<string, unknown> = {
    external_ref: externalRef,
    amount: plan.monthly_price_cents,
    currency: plan.currency ?? "BRL",
    method: "credit_card",
    token: data.token,
    installments: 1,
    notify_url: PAGOU_WEBHOOK_URL(),
    buyer,
    ip_address: paymentIp,
    metadata: JSON.stringify({
      driver_ads_env: PAGOU_ENV(),
      advertiser_id: adv.id,
      campaign_id: campaign.id,
      plan_id: plan.id,
      source: "driver_ads_checkout",
      period_start: periodStart.toISOString(),
      period_end: periodEnd.toISOString(),
    }),
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
    card_brand?: string;
    card_last4?: string;
    paid_at?: string | null;
    paid_amount?: number | null;
    next_action?: unknown;
  }>(
    "/v2/transactions",
    {
      method: "POST",
      body: JSON.stringify(txBody),
      headers: { "X-Idempotency-Key": externalRef },
    },
    { entity_type: "campaign", entity_id: campaign.id as string },
  );

  if (!res.ok || !res.data?.id) {
    return json(
      {
        error: friendlyPagouError(res.error, res.code),
        code: res.code ?? "pagou_card_transaction_error",
        status: res.status,
        edge_status: 502,
        pagou_request_id: res.requestId,
      },
    );
  }

  const paid = isPaidStatus(res.data.status);
  const paidAt = paid ? (res.data.paid_at ?? new Date().toISOString()) : null;

  const { data: insRow, error: insErr } = await admin
    .from("billing_transactions")
    .insert({
      advertiser_id: adv.id,
      campaign_id: campaign.id,
      pagou_transaction_id: res.data.id,
      external_ref: externalRef,
      request_id: res.requestId,
      method: "credit_card",
      status: res.data.status ?? "pending",
      amount_cents: plan.monthly_price_cents,
      currency: plan.currency ?? "BRL",
      billing_period_start: periodStart.toISOString(),
      billing_period_end: periodEnd.toISOString(),
      paid_at: paidAt,
      paid_amount_cents: paid ? (res.data.paid_amount ?? plan.monthly_price_cents) : 0,
      raw_payload: {
        ...res.data,
        card_brand: res.data.card_brand ?? data.card_brand ?? null,
        card_last4: res.data.card_last4 ?? data.card_last4 ?? null,
        card_exp_month: data.exp_month ?? null,
        card_exp_year: data.exp_year ?? null,
      },
    })
    .select("id")
    .single();
  if (insErr) return json({ error: insErr.message }, 500);

  if (paid) {
    await admin
      .from("campaigns")
      .update({
        plan_id: plan.id,
        billing_status: "paid",
        current_period_start: periodStart.toISOString(),
        current_period_end: periodEnd.toISOString(),
      })
      .eq("id", campaign.id);

    const ledgerRef = `tx_paid_${res.data.id}`;
    const { data: existingLedger } = await admin
      .from("ledger_entries")
      .select("id")
      .eq("external_ref", ledgerRef)
      .maybeSingle();
    if (!existingLedger) {
      await admin.from("ledger_entries").insert({
        entry_type: "advertiser_payment",
        direction: "credit",
        amount_cents: plan.monthly_price_cents,
        advertiser_id: adv.id,
        campaign_id: campaign.id,
        billing_transaction_id: insRow.id,
        description: "Pagamento confirmado",
        external_ref: ledgerRef,
      });
    }

    await generateDriverEarnings(admin, {
      campaignId: campaign.id as string,
      billingTransactionId: insRow.id as string,
      subscriptionId: null,
      periodStart: periodStart.toISOString(),
      periodEnd: periodEnd.toISOString(),
    });
  } else if (isFailedStatus(res.data.status)) {
    // Recusa sincrona da Pagou: marca como falha para o front sair do "aguardando".
    await admin
      .from("campaigns")
      .update({ plan_id: plan.id, billing_status: "payment_failed" })
      .eq("id", campaign.id);
  } else {
    await admin
      .from("campaigns")
      .update({ plan_id: plan.id, billing_status: "pending" })
      .eq("id", campaign.id);
  }

  await admin.from("audit_logs").insert({
    actor_id: user.id,
    action: "pagou.card_transaction.created",
    entity_type: "billing_transaction",
    entity_id: insRow.id,
    after_data: { pagou_transaction_id: res.data.id, status: res.data.status },
    metadata: { request_id: res.requestId, campaign_id: campaign.id },
  });

  return json({
    id: res.data.id,
    transaction_id: insRow.id,
    pagou_transaction_id: res.data.id,
    method: "credit_card",
    status: res.data.status,
    next_action: res.data.next_action ?? null,
  });
});

function friendlyPagouError(error: string | null, code?: string | null) {
  const raw = error ?? "unknown";
  const details = parsePagouBody(raw);

  if (code === "pagou_network_dns") {
    return (
      "A Edge Function nao conseguiu conectar ao endpoint Pagou. " +
      "Use PAGOU_BASE_URL=https://api.sandbox.pagou.ai ou api.sandbox.pagou.ai nas secrets e redeploye a funcao."
    );
  }

  if (code === "pagou_token_missing") {
    return (
      "A secret do token da Pagou nao esta disponivel para esta Edge Function. " +
      "Configure PAGOU_API_TOKEN ou PAGOU_SECRET_TOKEN no Supabase e redeploye a funcao."
    );
  }

  if (details.title || details.detail || details.errors?.length) {
    return `Pagou recusou a assinatura: ${details.title ?? "erro"}${details.detail ? ` - ${details.detail}` : ""}${details.errors?.length ? ` - ${details.errors.join("; ")}` : ""}`;
  }

  return raw;
}

function parsePagouBody(error: string) {
  const bodyMatch = error.match(/body=(.+)$/s);
  if (!bodyMatch) return {} as { title?: string; detail?: string; errors?: string[] };
  try {
    const parsed = JSON.parse(bodyMatch[1]) as {
      title?: string;
      detail?: string;
      message?: string;
      errors?: Array<{ field?: string; message?: string; code?: string }>;
    };
    const errors = Array.isArray(parsed.errors)
      ? parsed.errors
          .map((item) => [item.field, item.message ?? item.code].filter(Boolean).join(": "))
          .filter(Boolean)
      : [];
    return { title: parsed.title ?? parsed.message, detail: parsed.detail, errors };
  } catch {
    return {} as { title?: string; detail?: string; errors?: string[] };
  }
}
