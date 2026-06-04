import { createFileRoute } from "@tanstack/react-router";
import { createHmac, timingSafeEqual } from "node:crypto";
import { renderEmail } from "@/lib/email/templates.server";

const GATEWAY_URL = "https://connector-gateway.lovable.dev/resend";
const FROM = "Driver Ads <suporte@driverads.com.br>";

// Supabase Send Email Hook uses the Standard Webhooks signature scheme.
// Secret format stored in Supabase: "v1,whsec_<base64>". We strip the prefix.
function verifySignature(secret: string, headers: Headers, body: string): boolean {
  const id = headers.get("webhook-id");
  const timestamp = headers.get("webhook-timestamp");
  const sigHeader = headers.get("webhook-signature");
  if (!id || !timestamp || !sigHeader) return false;

  const cleanSecret = secret.startsWith("v1,whsec_")
    ? secret.slice("v1,whsec_".length)
    : secret.startsWith("whsec_")
      ? secret.slice("whsec_".length)
      : secret;

  let keyBytes: Buffer;
  try {
    keyBytes = Buffer.from(cleanSecret, "base64");
  } catch {
    return false;
  }

  const signedPayload = `${id}.${timestamp}.${body}`;
  const expected = createHmac("sha256", keyBytes).update(signedPayload).digest("base64");

  // Header may contain multiple space-separated "v1,<sig>" pairs.
  const provided = sigHeader.split(" ").map((s) => s.trim());
  for (const part of provided) {
    const [version, sig] = part.split(",");
    if (version !== "v1" || !sig) continue;
    const a = Buffer.from(sig);
    const b = Buffer.from(expected);
    if (a.length === b.length && timingSafeEqual(a, b)) return true;
  }
  return false;
}

function actionTypeToTemplate(t: string): string | null {
  switch (t) {
    case "signup":
      return "auth-signup";
    case "magiclink":
      return "auth-magiclink";
    case "recovery":
      return "auth-recovery";
    case "email_change":
    case "email_change_new":
      return "auth-email-change";
    case "invite":
      return "auth-invite";
    default:
      return null;
  }
}

async function sendViaResend(to: string, subject: string, html: string) {
  const lovableKey = process.env.LOVABLE_API_KEY;
  const resendKey = process.env.RESEND_API_KEY;
  if (!lovableKey || !resendKey) throw new Error("Missing LOVABLE_API_KEY or RESEND_API_KEY");
  const res = await fetch(`${GATEWAY_URL}/emails`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${lovableKey}`,
      "X-Connection-Api-Key": resendKey,
    },
    body: JSON.stringify({ from: FROM, to: [to], subject, html }),
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Resend ${res.status}: ${body.slice(0, 500)}`);
  }
}

export const Route = createFileRoute("/api/public/auth-email-hook")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const secret = process.env.SEND_EMAIL_HOOK_SECRET;
        if (!secret) {
          return new Response("Hook secret not configured", { status: 500 });
        }

        const body = await request.text();
        if (!verifySignature(secret, request.headers, body)) {
          return new Response("Invalid signature", { status: 401 });
        }

        let payload: {
          user?: { email?: string; new_email?: string };
          email_data?: {
            token_hash?: string;
            token_hash_new?: string;
            redirect_to?: string;
            email_action_type?: string;
            site_url?: string;
          };
        };
        try {
          payload = JSON.parse(body);
        } catch {
          return new Response("Invalid JSON", { status: 400 });
        }

        const actionType = payload.email_data?.email_action_type ?? "";
        const template = actionTypeToTemplate(actionType);
        const to = payload.user?.email;
        if (!template || !to) {
          return Response.json({ skipped: true, actionType });
        }

        const siteUrl = (payload.email_data?.site_url ?? "https://driverads.com.br").replace(/\/$/, "");
        const tokenHash =
          actionType === "email_change_new"
            ? (payload.email_data?.token_hash_new ?? payload.email_data?.token_hash ?? "")
            : (payload.email_data?.token_hash ?? "");
        const redirectTo = payload.email_data?.redirect_to ?? "https://driverads.com.br/login";
        const actionUrl = `${siteUrl}/auth/v1/verify?token=${encodeURIComponent(tokenHash)}&type=${encodeURIComponent(actionType)}&redirect_to=${encodeURIComponent(redirectTo)}`;

        const rendered = renderEmail(template, {
          action_url: actionUrl,
          new_email: payload.user?.new_email,
        });
        if (!rendered) {
          return Response.json({ skipped: true, reason: "no_template" });
        }

        try {
          await sendViaResend(to, rendered.subject, rendered.html);
          return Response.json({ ok: true });
        } catch (err) {
          const message = err instanceof Error ? err.message : String(err);
          return new Response(`Send failed: ${message}`, { status: 500 });
        }
      },
    },
  },
});
