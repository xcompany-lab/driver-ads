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

async function ensureCustomer(
  admin: ReturnType<typeof adminClient>,
  advertiserId: string,
): Promise<string> {
  const { data: adv } = await admin
    .from("advertisers")
    .select(
      "id, company_name, cnpj, document_type, email, phone, address, city, pagou_customer_id",
    )
    .eq("id", advertiserId)
    .single();
  if (!adv) throw new Error("advertiser_not_found");
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
    throw new Error(`pagou_customer_error: ${res.error ?? "unknown"}`);
  }
  await admin
    .from("advertisers")
    .update({ pagou_customer_id: res.data.id })
    .eq("id", adv.id);
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

  const { data: campaign } = await admin
    .from("campaigns")
    .select("id, advertiser_id, billing_status")
    .eq("id", data.campaign_id)
    .single();
  if (!campaign) return json({ error: "campaign_not_found" }, 404);

  const { data: adv } = await admin
    .from("advertisers")
    .select("id, user_id")
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

  let customerId: string;
  try {
    customerId = await ensureCustomer(admin, adv.id as string);
  } catch (e) {
    return json({ error: (e as Error).message }, 502);
  }

  // Período de 30 dias a partir de agora (cobrança Pix mensal)
  const periodStart = new Date();
  const periodEnd = new Date(periodStart.getTime() + 30 * 24 * 60 * 60 * 1000);
  const externalRef = `pix_campaign_${campaign.id}_${periodStart.getTime()}`;

  const txBody = {
    amount: plan.monthly_price_cents,
    currency: plan.currency ?? "BRL",
    method: "pix",
    customer_id: customerId,
    expires_in: 60 * 60 * 24, // 24h
    metadata: {
      driver_ads_env: PAGOU_ENV(),
      advertiser_id: adv.id,
      campaign_id: campaign.id,
      plan_id: plan.id,
      source: "driver_ads_checkout_pix",
      period_start: periodStart.toISOString(),
      period_end: periodEnd.toISOString(),
    },
    idempotency_key: externalRef,
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

  const res = await pagouRequest<{
    id: string;
    status?: string;
    pix?: { qr_code?: string; qr_code_image?: string; expires_at?: string };
    qr_code?: string;
    qr_code_image?: string;
    expires_at?: string;
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
    return json({ error: `pagou_pix_error: ${res.error ?? "unknown"}` }, 502);
  }

  const qrCode = res.data.pix?.qr_code ?? res.data.qr_code ?? null;
  const qrImage = res.data.pix?.qr_code_image ?? res.data.qr_code_image ?? null;
  const expiresAt = res.data.pix?.expires_at ?? res.data.expires_at ?? null;

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
