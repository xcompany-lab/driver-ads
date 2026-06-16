// Public checkout by staff-generated token.
// Body:
// - { action: "state", checkout_token }
// - { action: "pix", checkout_token }
// - { action: "card", checkout_token, card_token, card_brand?, card_last4?, exp_month?, exp_year? }
import {
  adminClient,
  corsHeaders,
  json,
  PAGOU_ENV,
  PAGOU_PUBLIC_KEY,
  PAGOU_WEBHOOK_URL,
  pagouRequest,
} from "../_shared/pagou-client.ts";
import { generateDriverEarnings } from "../pagou-webhook/_lib/earnings.ts";

type AdminClient = ReturnType<typeof adminClient>;

interface Input {
  action: "state" | "pix" | "card";
  checkout_token: string;
  card_token?: string;
  card_brand?: string | null;
  card_last4?: string | null;
  exp_month?: string | null;
  exp_year?: string | null;
}

function validate(raw: unknown): Input | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;
  if (!["state", "pix", "card"].includes(String(r.action))) return null;
  if (typeof r.checkout_token !== "string" || r.checkout_token.length < 24 || r.checkout_token.length > 160) return null;
  if (r.action === "card" && (typeof r.card_token !== "string" || r.card_token.length < 10 || r.card_token.length > 400)) {
    return null;
  }
  return {
    action: r.action as Input["action"],
    checkout_token: r.checkout_token,
    card_token: typeof r.card_token === "string" ? r.card_token : undefined,
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
  return digits.length >= 10 && digits.length <= 15 ? digits : null;
}

function normalizeDocument(raw: unknown, rawType: unknown) {
  const number = String(raw ?? "").replace(/\D/g, "");
  if (number.length === 11 && !isValidCpf(number)) return null;
  if (number.length === 14 && !isValidCnpj(number)) return null;
  if (number.length !== 11 && number.length !== 14) return null;
  const type =
    typeof rawType === "string" && rawType.trim()
      ? rawType.toUpperCase()
      : number.length === 11
        ? "CPF"
        : "CNPJ";
  return { type, number };
}

function isValidCpf(value: string) {
  if (!/^\d{11}$/.test(value) || /^(\d)\1+$/.test(value)) return false;
  const calc = (factor: number) => {
    let total = 0;
    for (let i = 0; i < factor - 1; i++) total += Number(value[i]) * (factor - i);
    const digit = (total * 10) % 11;
    return digit === 10 ? 0 : digit;
  };
  return calc(10) === Number(value[9]) && calc(11) === Number(value[10]);
}

function isValidCnpj(value: string) {
  if (!/^\d{14}$/.test(value) || /^(\d)\1+$/.test(value)) return false;
  const calc = (weights: number[]) => {
    const sum = weights.reduce((acc, weight, index) => acc + Number(value[index]) * weight, 0);
    const rest = sum % 11;
    return rest < 2 ? 0 : 11 - rest;
  };
  const firstWeights = [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
  const secondWeights = [6, ...firstWeights];
  return calc(firstWeights) === Number(value[12]) && calc(secondWeights) === Number(value[13]);
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
  return candidates.find((value) => value && value.trim())?.trim() ?? null;
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

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "method_not_allowed" }, 405);

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return json({ error: "invalid_json" }, 400);
  }
  const input = validate(body);
  if (!input) return json({ error: "invalid_input" }, 400);

  const admin = adminClient();
  const context = await loadContext(admin, input.checkout_token, input.action === "state");
  if ("error" in context) return json({ error: context.error }, context.status);

  if (input.action === "state") return json(await checkoutState(admin, context));
  if (input.action === "pix") return createPix(admin, req, context);
  return createCard(admin, req, context, input);
});

async function loadContext(admin: AdminClient, token: string, markAccess: boolean) {
  const { data: link } = await admin
    .from("campaign_checkout_links")
    .select("*")
    .eq("token", token)
    .is("revoked_at", null)
    .maybeSingle();

  if (!link) return { error: "checkout_link_not_found", status: 404 } as const;
  if (link.expires_at && new Date(link.expires_at).getTime() < Date.now()) {
    return { error: "checkout_link_expired", status: 410 } as const;
  }

  if (markAccess) {
    await admin
      .from("campaign_checkout_links")
      .update({
        last_accessed_at: new Date().toISOString(),
        access_count: Number(link.access_count ?? 0) + 1,
      })
      .eq("id", link.id);
  }

  const { data: campaign } = await admin
    .from("campaigns")
    .select("id, advertiser_id, name, city, period_start, period_end, billing_status, status, plan_id, vehicles_qty")
    .eq("id", link.campaign_id)
    .single();
  if (!campaign) return { error: "campaign_not_found", status: 404 } as const;

  const { data: advertiser } = await admin
    .from("advertisers")
    .select("id, company_name, cnpj, document_type, responsible, email, phone")
    .eq("id", campaign.advertiser_id)
    .single();
  if (!advertiser) return { error: "advertiser_not_found", status: 404 } as const;

  let plan = null;
  if (campaign.plan_id) {
    const { data } = await admin
      .from("campaign_plans")
      .select("id, name, monthly_price_cents, currency, billing_interval, billing_interval_count")
      .eq("id", campaign.plan_id)
      .single();
    plan = data;
  }
  if (!plan) {
    const { data } = await admin
      .from("campaign_plans")
      .select("id, name, monthly_price_cents, currency, billing_interval, billing_interval_count")
      .eq("is_active", true)
      .order("monthly_price_cents", { ascending: true })
      .limit(1)
      .maybeSingle();
    plan = data;
  }
  if (!plan) return { error: "plan_not_found", status: 404 } as const;

  return { link, campaign, advertiser, plan };
}

async function checkoutState(admin: AdminClient, context: Awaited<ReturnType<typeof loadContext>> & Record<string, unknown>) {
  const key = PAGOU_PUBLIC_KEY();
  const campaign = context.campaign as Record<string, unknown>;
  const plan = context.plan as Record<string, unknown>;
  const vehiclesQty = Math.min(Math.max(Number(campaign.vehicles_qty ?? 1), 1), 40);
  const { data: txs } = await admin
    .from("billing_transactions")
    .select("id, pagou_transaction_id, status, method, amount_cents, pix_qr_code, pix_qr_code_image, expires_at, paid_at, billing_period_end")
    .eq("campaign_id", campaign.id)
    .order("created_at", { ascending: false })
    .limit(10);

  return {
    public_key: key,
    environment: PAGOU_ENV(),
    campaign,
    advertiser: context.advertiser,
    plan,
    vehicles_qty: vehiclesQty,
    total_cents: Number(plan.monthly_price_cents ?? 0) * vehiclesQty,
    pix_transaction: (txs ?? []).find((tx) => tx.method === "pix") ?? null,
    card_transaction: (txs ?? []).find((tx) => tx.method === "credit_card") ?? null,
  };
}

async function createPix(admin: AdminClient, req: Request, context: Awaited<ReturnType<typeof loadContext>> & Record<string, unknown>) {
  const campaign = context.campaign as Record<string, unknown>;
  const advertiser = context.advertiser as Record<string, unknown>;
  const plan = context.plan as Record<string, unknown>;
  const vehiclesQty = Math.min(Math.max(Number(campaign.vehicles_qty ?? 1), 1), 40);
  const amountCents = Number(plan.monthly_price_cents ?? 0) * vehiclesQty;

  const { data: existingTx } = await admin
    .from("billing_transactions")
    .select("id, pagou_transaction_id, status, pix_qr_code, pix_qr_code_image, expires_at, amount_cents, paid_at")
    .eq("campaign_id", campaign.id)
    .eq("method", "pix")
    .in("status", ["pending", "waiting_payment", "processing"])
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (
    existingTx?.pix_qr_code &&
    existingTx.expires_at &&
    new Date(existingTx.expires_at).getTime() > Date.now() + 60_000
  ) {
    return json({
      transaction_id: existingTx.id,
      pagou_transaction_id: existingTx.pagou_transaction_id,
      pix_qr_code: existingTx.pix_qr_code,
      pix_qr_code_image: existingTx.pix_qr_code_image,
      expires_at: existingTx.expires_at,
      amount_cents: existingTx.amount_cents,
      status: existingTx.status,
      paid_at: existingTx.paid_at ?? null,
    });
  }

  const buyer = buildBuyer(advertiser);
  if ("error" in buyer) return json(buyer, 400);

  const periodStart = new Date();
  const periodEnd = new Date(periodStart.getTime() + 30 * 24 * 60 * 60 * 1000);
  const externalRef = `public_pix_campaign_${campaign.id}_${periodStart.getTime()}`;
  const txBody: Record<string, unknown> = {
    external_ref: externalRef,
    amount: amountCents,
    currency: plan.currency ?? "BRL",
    method: "pix",
    notify_url: PAGOU_WEBHOOK_URL(),
    buyer,
    metadata: JSON.stringify({
      driver_ads_env: PAGOU_ENV(),
      advertiser_id: advertiser.id,
      campaign_id: campaign.id,
      plan_id: plan.id,
      source: "driver_ads_public_checkout_pix",
      period_start: periodStart.toISOString(),
      period_end: periodEnd.toISOString(),
    }),
    products: [
      {
        name: `Driver Ads - ${plan.name} (Pix mensal) - ${vehiclesQty} veiculo(s)`,
        price: amountCents,
        quantity: 1,
        tangible: false,
        sku: `DRIVER_ADS_PUBLIC_PIX_${plan.id}`,
      },
    ],
  };
  const paymentIp = getPaymentIp(req);
  if (paymentIp) txBody.ip_address = paymentIp;

  const res = await pagouRequest<Record<string, unknown>>(
    "/v2/transactions",
    {
      method: "POST",
      body: JSON.stringify(txBody),
      headers: { "X-Idempotency-Key": externalRef },
    },
    { entity_type: "campaign", entity_id: campaign.id as string },
  );
  if (!res.ok || !res.data?.id) {
    return json({ error: friendlyPagouError(res.error, res.code), code: res.code, status: res.status, pagou_request_id: res.requestId }, 502);
  }

  const data = res.data as {
    id: string;
    status?: string;
    pix?: { qr_code?: string; qr_code_image?: string; expires_at?: string; expiration_date?: string };
    qr_code?: string;
    qr_code_image?: string;
    expires_at?: string;
    expiration_date?: string;
  };
  const qrCode = data.pix?.qr_code ?? data.qr_code ?? null;
  const qrImage = data.pix?.qr_code_image ?? data.qr_code_image ?? null;
  const expiresAt = data.pix?.expires_at ?? data.pix?.expiration_date ?? data.expires_at ?? data.expiration_date ?? null;

  const { data: insRow, error: insErr } = await admin
    .from("billing_transactions")
    .insert({
      advertiser_id: advertiser.id,
      campaign_id: campaign.id,
      pagou_transaction_id: data.id,
      external_ref: externalRef,
      request_id: res.requestId,
      method: "pix",
      status: data.status ?? "pending",
      amount_cents: amountCents,
      currency: plan.currency ?? "BRL",
      billing_period_start: periodStart.toISOString(),
      billing_period_end: periodEnd.toISOString(),
      expires_at: expiresAt,
      pix_qr_code: qrCode,
      pix_qr_code_image: qrImage,
      raw_payload: data,
    })
    .select("id")
    .single();
  if (insErr) return json({ error: insErr.message }, 500);

  await admin.from("campaigns").update({ plan_id: plan.id, billing_status: "pending" }).eq("id", campaign.id);
  await admin.from("audit_logs").insert({
    action: "pagou.public_checkout.pix.created",
    entity_type: "billing_transaction",
    entity_id: insRow.id,
    after_data: { pagou_transaction_id: data.id, amount_cents: amountCents },
    metadata: { request_id: res.requestId, campaign_id: campaign.id },
  });

  return json({
    transaction_id: insRow.id,
    pagou_transaction_id: data.id,
    pix_qr_code: qrCode,
    pix_qr_code_image: qrImage,
    expires_at: expiresAt,
    amount_cents: amountCents,
    status: data.status ?? "pending",
  });
}

async function createCard(admin: AdminClient, req: Request, context: Awaited<ReturnType<typeof loadContext>> & Record<string, unknown>, input: Input) {
  const campaign = context.campaign as Record<string, unknown>;
  const advertiser = context.advertiser as Record<string, unknown>;
  const plan = context.plan as Record<string, unknown>;
  const vehiclesQty = Math.min(Math.max(Number(campaign.vehicles_qty ?? 1), 1), 40);
  const amountCents = Number(plan.monthly_price_cents ?? 0) * vehiclesQty;
  const paymentIp = getPaymentIp(req);
  if (!paymentIp) return json({ error: "IP address is required for credit card payments", code: "ip_address_missing" }, 400);

  const buyer = buildBuyer(advertiser, { requireDocument: false });
  if ("error" in buyer) return json(buyer, 400);

  const periodStart = new Date();
  const periodEnd = new Date(periodStart.getTime() + 30 * 24 * 60 * 60 * 1000);
  const externalRef = `public_card_campaign_${campaign.id}_${periodStart.getTime()}`;
  const txBody: Record<string, unknown> = {
    external_ref: externalRef,
    amount: amountCents,
    currency: plan.currency ?? "BRL",
    method: "credit_card",
    token: input.card_token,
    installments: 1,
    notify_url: PAGOU_WEBHOOK_URL(),
    buyer,
    ip_address: paymentIp,
    metadata: JSON.stringify({
      driver_ads_env: PAGOU_ENV(),
      advertiser_id: advertiser.id,
      campaign_id: campaign.id,
      plan_id: plan.id,
      source: "driver_ads_public_checkout_card",
      period_start: periodStart.toISOString(),
      period_end: periodEnd.toISOString(),
    }),
    products: [
      {
        name: `Driver Ads - ${plan.name}`,
        price: amountCents,
        quantity: 1,
        tangible: false,
        sku: `DRIVER_ADS_PUBLIC_${plan.id}`,
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
    return json({ error: friendlyPagouError(res.error, res.code), code: res.code, status: res.status, pagou_request_id: res.requestId });
  }

  const paid = isPaidStatus(res.data.status);
  const paidAt = paid ? (res.data.paid_at ?? new Date().toISOString()) : null;
  const { data: insRow, error: insErr } = await admin
    .from("billing_transactions")
    .insert({
      advertiser_id: advertiser.id,
      campaign_id: campaign.id,
      pagou_transaction_id: res.data.id,
      external_ref: externalRef,
      request_id: res.requestId,
      method: "credit_card",
      status: res.data.status ?? "pending",
      amount_cents: amountCents,
      currency: plan.currency ?? "BRL",
      billing_period_start: periodStart.toISOString(),
      billing_period_end: periodEnd.toISOString(),
      paid_at: paidAt,
      paid_amount_cents: paid ? (res.data.paid_amount ?? amountCents) : 0,
      raw_payload: {
        ...res.data,
        card_brand: res.data.card_brand ?? input.card_brand ?? null,
        card_last4: res.data.card_last4 ?? input.card_last4 ?? null,
        card_exp_month: input.exp_month ?? null,
        card_exp_year: input.exp_year ?? null,
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
    const { data: existingLedger } = await admin.from("ledger_entries").select("id").eq("external_ref", ledgerRef).maybeSingle();
    if (!existingLedger) {
      await admin.from("ledger_entries").insert({
        entry_type: "advertiser_payment",
        direction: "credit",
        amount_cents: amountCents,
        advertiser_id: advertiser.id,
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
    await admin.from("campaigns").update({ plan_id: plan.id, billing_status: "payment_failed" }).eq("id", campaign.id);
  } else {
    await admin.from("campaigns").update({ plan_id: plan.id, billing_status: "pending" }).eq("id", campaign.id);
  }

  await admin.from("audit_logs").insert({
    action: "pagou.public_checkout.card_transaction.created",
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
}

function buildBuyer(advertiser: Record<string, unknown>, opts: { requireDocument?: boolean } = {}) {
  const email = normalizeEmail(advertiser.email);
  if (!email) return { error: "O email cadastrado no anunciante e invalido ou esta ausente.", code: "email_invalid" };
  const buyer: Record<string, unknown> = {
    name: String(advertiser.company_name || advertiser.responsible || email).trim(),
    email,
  };
  const phone = normalizePhone(advertiser.phone);
  if (phone) buyer.phone = phone;
  const document = normalizeDocument(advertiser.cnpj, advertiser.document_type);
  if (document) {
    buyer.document = document;
  } else if (opts.requireDocument !== false) {
    return { error: "O CNPJ/CPF cadastrado no anunciante e invalido ou esta ausente.", code: "document_invalid" };
  }
  return buyer;
}

function friendlyPagouError(error: string | null, code?: string | null) {
  const raw = error ?? "unknown";
  const details = parsePagouBody(raw);
  if (code === "pagou_network_dns") {
    return "A Edge Function nao conseguiu conectar ao endpoint Pagou. Confira a secret PAGOU_BASE_URL e redeploye a funcao.";
  }
  if (code === "pagou_token_missing") {
    return "A secret do token da Pagou nao esta disponivel para esta Edge Function.";
  }
  if (details.title || details.detail || details.errors?.length) {
    return `Pagou recusou o pagamento: ${details.title ?? "erro"}${details.detail ? ` - ${details.detail}` : ""}${details.errors?.length ? ` - ${details.errors.join("; ")}` : ""}`;
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
      ? parsed.errors.map((item) => [item.field, item.message ?? item.code].filter(Boolean).join(": ")).filter(Boolean)
      : [];
    return { title: parsed.title ?? parsed.message, detail: parsed.detail, errors };
  } catch {
    return {} as { title?: string; detail?: string; errors?: string[] };
  }
}
