// POST /functions/v1/pagou-create-pix
// Body: { campaign_id, plan_id }
// Cria uma cobrança Pix (one-shot, mensal) na Pagou para a campanha do anunciante.
// Persiste em billing_transactions, marca a campaign como billing_status='pending'.
// O webhook transaction.paid ativa a campanha no período pago.
import {
  adminClient,
  corsHeaders,
  getAuthedUser,
  json,
  PAGOU_ENV,
  PAGOU_WEBHOOK_URL,
  pagouRequest,
} from "../_shared/pagou-client.ts";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

interface Input {
  campaign_id: string;
  plan_id: string;
}
function validate(raw: unknown): Input | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;
  if (typeof r.campaign_id !== "string" || !UUID_RE.test(r.campaign_id)) return null;
  if (typeof r.plan_id !== "string" || !UUID_RE.test(r.plan_id)) return null;
  return { campaign_id: r.campaign_id, plan_id: r.plan_id };
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

function normalizeEmail(raw: unknown) {
  const email = typeof raw === "string" ? raw.trim().toLowerCase() : "";
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ? email : null;
}

function normalizePhone(raw: unknown) {
  const digits = String(raw ?? "").replace(/\D/g, "");
  return digits.length >= 10 && digits.length <= 15 ? digits : null;
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
  const ip = candidates.find((value) => value && value.trim());
  return ip?.trim() ?? null;
}

function getPaymentIp(req: Request) {
  return getClientIp(req) ?? (PAGOU_ENV() === "sandbox" ? "127.0.0.1" : null);
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

  const { data: campaign } = await admin
    .from("campaigns")
    .select("id, advertiser_id, billing_status")
    .eq("id", data.campaign_id)
    .single();
  if (!campaign) return json({ error: "campaign_not_found" }, 404);

  const { data: adv } = await admin
    .from("advertisers")
    .select("id, user_id, company_name, cnpj, document_type, email, phone")
    .eq("id", campaign.advertiser_id)
    .single();
  if (!adv) return json({ error: "advertiser_not_found" }, 404);

  const { data: staff } = await admin
    .from("user_roles")
    .select("role")
    .eq("user_id", user.id)
    .in("role", ["admin", "operator"]);
  const isStaff = (staff?.length ?? 0) > 0;
  if (!isStaff && adv.user_id !== user.id) return json({ error: "forbidden" }, 403);

  const { data: plan } = await admin
    .from("campaign_plans")
    .select("id, name, monthly_price_cents, currency")
    .eq("id", data.plan_id)
    .single();
  if (!plan) return json({ error: "plan_not_found" }, 404);

  // Idempotência: se há um Pix pendente ainda válido, devolve ele
  const { data: existingTx } = await admin
    .from("billing_transactions")
    .select(
      "id, pagou_transaction_id, status, pix_qr_code, pix_qr_code_image, expires_at, amount_cents",
    )
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
    });
  }

  // Período de 30 dias a partir de agora (cobrança Pix mensal)
  const periodStart = new Date();
  const periodEnd = new Date(periodStart.getTime() + 30 * 24 * 60 * 60 * 1000);
  const externalRef = `pix_campaign_${campaign.id}_${periodStart.getTime()}`;

  const buyerEmail = normalizeEmail(adv.email);
  if (!buyerEmail) {
    return json(
      {
        error:
          "O email cadastrado no perfil do anunciante e invalido ou esta ausente. Atualize o email antes de gerar o Pix.",
        code: "email_invalid",
      },
      400,
    );
  }

  const buyer: Record<string, unknown> = {
    name: String(adv.company_name || buyerEmail).trim(),
    email: buyerEmail,
  };
  const buyerPhone = normalizePhone(adv.phone);
  if (buyerPhone) buyer.phone = buyerPhone;
  const buyerDocument = normalizeDocument(adv.cnpj, adv.document_type);
  if (!buyerDocument) {
    return json(
      {
        error:
          "O CNPJ/CPF cadastrado no perfil do anunciante é inválido ou está ausente. Atualize o documento no perfil antes de gerar o Pix.",
        code: "document_invalid",
      },
      400,
    );
  }
  buyer.document = buyerDocument;

  const txBody: Record<string, unknown> = {
    external_ref: externalRef,
    amount: plan.monthly_price_cents,
    currency: plan.currency ?? "BRL",
    method: "pix",
    description: "Driver Ads Publicidade",
    notify_url: PAGOU_WEBHOOK_URL(),
    buyer,
    metadata: JSON.stringify({
      driver_ads_env: PAGOU_ENV(),
      advertiser_id: adv.id,
      campaign_id: campaign.id,
      plan_id: plan.id,
      source: "driver_ads_checkout_pix",
      period_start: periodStart.toISOString(),
      period_end: periodEnd.toISOString(),
    }),
    products: [
      {
        name: `Driver Ads - ${plan.name} (Pix mensal)`,
        price: plan.monthly_price_cents,
        quantity: 1,
        tangible: false,
        sku: `DRIVER_ADS_PIX_${plan.id}`,
      },
    ],
  };
  const paymentIp = getPaymentIp(req);
  if (paymentIp) txBody.ip_address = paymentIp;

  const res = await pagouRequest<{
    id: string;
    status?: string;
    pix?: { qr_code?: string; qr_code_image?: string; expires_at?: string; expiration_date?: string };
    qr_code?: string;
    qr_code_image?: string;
    expires_at?: string;
    expiration_date?: string;
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
    const rawError = res.error ?? "unknown";
    const bodyMatch = rawError.match(/body=(.+)$/s);
    let parsedBody: {
      title?: string;
      detail?: string;
      requestId?: string;
      errors?: Array<{ field?: string; message?: string; code?: string }>;
    } = {};
    if (bodyMatch) {
      try {
        parsedBody = JSON.parse(bodyMatch[1]);
      } catch {
        /* ignore */
      }
    }
    const title = parsedBody.title ?? "";
    const detail = parsedBody.detail ?? "";
    const validationErrors = Array.isArray(parsedBody.errors)
      ? parsedBody.errors
          .map((item) => [item.field, item.message ?? item.code].filter(Boolean).join(": "))
          .filter(Boolean)
      : [];
    const reqId = parsedBody.requestId ?? res.requestId ?? null;

    let friendly = rawError;
    let code = "pagou_error";
    if (res.code === "pagou_network_dns") {
      friendly =
        "A Edge Function nao conseguiu conectar ao endpoint Pagou. Use PAGOU_BASE_URL=https://api.sandbox.pagou.ai ou api.sandbox.pagou.ai nas secrets e redeploye a funcao.";
      code = "pagou_network_dns";
    } else if (res.code === "pagou_token_missing") {
      friendly =
        "A secret do token da Pagou nao esta disponivel para esta Edge Function. Configure PAGOU_API_TOKEN ou PAGOU_SECRET_TOKEN no Supabase e redeploye a funcao.";
      code = "pagou_token_missing";
    } else if (title === "PAYMENT_BLOCKED" || /ticket limit exceeded/i.test(detail)) {
      friendly =
        "A Pagou bloqueou esta cobrança porque o valor excede o limite de ticket configurado na conta recebedora da DRIVER ADS. Solicite à Pagou o aumento do limite (payment policy) para esta conta ou ajuste o plano para um valor permitido.";
      code = "payment_blocked_ticket_limit";
    } else if (title === "DOCUMENT_REQUIRED" || /Document is required/i.test(detail)) {
      friendly =
        "A Pagou exige um documento válido do pagador. Atualize o CNPJ/CPF no perfil do anunciante e tente novamente.";
      code = "document_required";
    } else if (title || detail) {
      friendly = `Pagou recusou a cobrança: ${title}${detail ? ` — ${detail}` : ""}${validationErrors.length ? ` - ${validationErrors.join("; ")}` : ""}`;
    }

    return json(
      { error: friendly, code, pagou_request_id: reqId, status: res.status },
      502,
    );
  }


  const qrCode = res.data.pix?.qr_code ?? res.data.qr_code ?? null;
  const qrImage = res.data.pix?.qr_code_image ?? res.data.qr_code_image ?? null;
  const expiresAt =
    res.data.pix?.expires_at ??
    res.data.pix?.expiration_date ??
    res.data.expires_at ??
    res.data.expiration_date ??
    null;

  const { data: insRow, error: insErr } = await admin
    .from("billing_transactions")
    .insert({
      advertiser_id: adv.id,
      campaign_id: campaign.id,
      pagou_transaction_id: res.data.id,
      external_ref: externalRef,
      request_id: res.requestId,
      method: "pix",
      status: res.data.status ?? "pending",
      amount_cents: plan.monthly_price_cents,
      currency: plan.currency ?? "BRL",
      billing_period_start: periodStart.toISOString(),
      billing_period_end: periodEnd.toISOString(),
      expires_at: expiresAt,
      pix_qr_code: qrCode,
      pix_qr_code_image: qrImage,
      raw_payload: res.data,
    })
    .select("id")
    .single();
  if (insErr) return json({ error: insErr.message }, 500);

  await admin
    .from("campaigns")
    .update({ plan_id: plan.id, billing_status: "pending" })
    .eq("id", campaign.id);

  await admin.from("audit_logs").insert({
    actor_id: user.id,
    action: "pagou.pix.created",
    entity_type: "billing_transaction",
    entity_id: insRow.id,
    after_data: { pagou_transaction_id: res.data.id, amount_cents: plan.monthly_price_cents },
    metadata: { request_id: res.requestId, campaign_id: campaign.id },
  });

  return json({
    transaction_id: insRow.id,
    pagou_transaction_id: res.data.id,
    pix_qr_code: qrCode,
    pix_qr_code_image: qrImage,
    expires_at: expiresAt,
    amount_cents: plan.monthly_price_cents,
    status: res.data.status ?? "pending",
  });
});
