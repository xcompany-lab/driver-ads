// GET /functions/v1/pagou-billing-state?campaign_id=<uuid>
// Returns campaign billing status + latest subscription.
import {
  adminClient,
  corsHeaders,
  getAuthedUser,
  json,
} from "../_shared/pagou-client.ts";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders });
  }
  if (req.method !== "GET" && req.method !== "POST") {
    return json({ error: "method_not_allowed" }, 405);
  }

  const user = await getAuthedUser(req);
  if (!user) return json({ error: "unauthorized" }, 401);

  let campaign_id: string | null = null;
  if (req.method === "GET") {
    campaign_id = new URL(req.url).searchParams.get("campaign_id");
  } else {
    try {
      const body = await req.json();
      campaign_id = body?.campaign_id ?? null;
    } catch {
      return json({ error: "invalid_json" }, 400);
    }
  }
  if (!campaign_id || !UUID_RE.test(campaign_id)) {
    return json({ error: "invalid_campaign_id" }, 400);
  }

  const admin = adminClient();

  // Ownership check: campaign → advertiser.user_id === user.id, OR staff
  const { data: ownership } = await admin
    .from("campaigns")
    .select("id, advertiser:advertisers!inner(user_id)")
    .eq("id", campaign_id)
    .maybeSingle();

  const advUser = (ownership as { advertiser?: { user_id?: string } } | null)?.advertiser?.user_id;
  const { data: staff } = await admin
    .from("user_roles")
    .select("role")
    .eq("user_id", user.id)
    .in("role", ["admin", "operator"]);
  const isStaff = (staff?.length ?? 0) > 0;
  if (!ownership || (!isStaff && advUser !== user.id)) {
    return json({ error: "forbidden" }, 403);
  }

  const { data: campaign } = await admin
    .from("campaigns")
    .select(
      "id, billing_status, operational_status, current_period_start, current_period_end",
    )
    .eq("id", campaign_id)
    .single();

  const { data: subscription } = await admin
    .from("subscriptions")
    .select("id, status, card_brand, card_last4, current_period_end")
    .eq("campaign_id", campaign_id)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  const { data: pixTx } = await admin
    .from("billing_transactions")
    .select(
      "id, pagou_transaction_id, status, amount_cents, pix_qr_code, pix_qr_code_image, expires_at, paid_at, billing_period_end",
    )
    .eq("campaign_id", campaign_id)
    .eq("method", "pix")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  const { data: cardTx } = await admin
    .from("billing_transactions")
    .select(
      "id, pagou_transaction_id, status, amount_cents, paid_at, billing_period_end",
    )
    .eq("campaign_id", campaign_id)
    .eq("method", "credit_card")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  return json({ campaign, subscription, pix_transaction: pixTx, card_transaction: cardTx });
});
