import { createFileRoute } from "@tanstack/react-router";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

async function sha256(value: string) {
  const bytes = new TextEncoder().encode(value);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

function firstIp(value: string | null) {
  return value?.split(",")[0]?.trim() ?? "";
}

export const Route = createFileRoute("/q/$code")({
  server: {
    handlers: {
      GET: async ({ params, request }) => {
        const code = String(params.code ?? "").trim().toLowerCase();
        if (!/^[a-z0-9]{6,32}$/.test(code)) {
          return new Response("QR Code invalido", { status: 404 });
        }

        const { data: qrCode, error } = await supabaseAdmin
          .from("campaign_qr_codes")
          .select("id,campaign_id,advertiser_id,destination_url,is_active")
          .eq("short_code", code)
          .maybeSingle();

        if (error || !qrCode || !qrCode.is_active) {
          return new Response("QR Code nao encontrado", { status: 404 });
        }

        const forwardedIp = firstIp(request.headers.get("x-forwarded-for"));
        const userAgent = request.headers.get("user-agent") ?? null;
        const referrer = request.headers.get("referer") ?? null;
        const ipHash = forwardedIp ? await sha256(forwardedIp) : null;

        await supabaseAdmin.from("campaign_qr_scans").insert({
          qr_code_id: qrCode.id,
          campaign_id: qrCode.campaign_id,
          advertiser_id: qrCode.advertiser_id,
          user_agent: userAgent,
          referrer,
          ip_hash: ipHash,
          metadata: {
            accept_language: request.headers.get("accept-language"),
          },
        });

        return Response.redirect(qrCode.destination_url, 302);
      },
    },
  },
});
