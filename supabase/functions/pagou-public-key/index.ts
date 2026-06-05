// GET /functions/v1/pagou-public-key
// Returns the Pagou publishable key + environment for the checkout UI.
import {
  corsHeaders,
  getAuthedUser,
  json,
  PAGOU_ENV,
  PAGOU_PUBLIC_KEY,
} from "../_shared/pagou-client.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders });
  }
  if (req.method !== "GET" && req.method !== "POST") {
    return json({ error: "method_not_allowed" }, 405);
  }
  const user = await getAuthedUser(req);
  if (!user) return json({ error: "unauthorized" }, 401);

  const key = PAGOU_PUBLIC_KEY();
  if (!key) return json({ error: "PAGOU_PUBLIC_KEY missing" }, 500);

  return json({ public_key: key, environment: PAGOU_ENV() });
});
