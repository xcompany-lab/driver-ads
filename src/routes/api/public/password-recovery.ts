import { createFileRoute } from "@tanstack/react-router";
import { logEmailDiagnostic } from "@/lib/email/diagnostics.server";
import { renderEmail } from "@/lib/email/templates.server";

const GATEWAY_URL = "https://connector-gateway.lovable.dev/resend";
const FROM = "Driver Ads <suporte@driverads.com.br>";
const PUBLIC_SITE_URL = "https://driverads.com.br";

function isValidEmail(email: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) && email.length <= 254;
}

async function sendViaResend(to: string, subject: string, html: string) {
  const lovableKey = process.env.LOVABLE_API_KEY;
  const resendKey = process.env.RESEND_API_KEY;
  if (!lovableKey || !resendKey) throw new Error("Missing email credentials");

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
    throw new Error(`Email provider ${res.status}: ${body.slice(0, 500)}`);
  }
}

export const Route = createFileRoute("/api/public/password-recovery")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        let email = "";
        try {
          const body = await request.json();
          email = String(body?.email ?? "").trim().toLowerCase();
        } catch {
          return Response.json({ ok: true });
        }

        if (!isValidEmail(email)) {
          await logEmailDiagnostic({ flow: "password-recovery", step: "validate-email", status: "skipped" });
          return Response.json({ ok: true });
        }

        try {
          await logEmailDiagnostic({ flow: "password-recovery", step: "request-received", status: "started", recipientEmail: email });
          const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
          const redirectTo = `${PUBLIC_SITE_URL}/auth/reset-password`;
          const { data, error } = await supabaseAdmin.auth.admin.generateLink({
            type: "recovery",
            email,
            options: { redirectTo },
          });

          if (error || !data.properties?.action_link) {
            console.warn("[password-recovery] recovery link not generated", { email, message: error?.message });
            await logEmailDiagnostic({
              flow: "password-recovery",
              step: "generate-link",
              status: "skipped",
              recipientEmail: email,
              errorMessage: error?.message ?? "Recovery link was not returned",
            });
            return Response.json({ ok: true });
          }
          await logEmailDiagnostic({ flow: "password-recovery", step: "generate-link", status: "success", recipientEmail: email });

          const rendered = renderEmail("auth-recovery", { action_url: data.properties.action_link });
          if (!rendered) throw new Error("Recovery email template missing");

          await sendViaResend(email, rendered.subject, rendered.html);
          await logEmailDiagnostic({ flow: "password-recovery", step: "send-email", status: "success", recipientEmail: email });
          return Response.json({ ok: true });
        } catch (err) {
          const message = err instanceof Error ? err.message : String(err);
          console.error("[password-recovery] send failed", message);
          await logEmailDiagnostic({
            flow: "password-recovery",
            step: "send-email",
            status: "failed",
            recipientEmail: email,
            errorMessage: message,
            metadata: {
              hasSupabaseUrl: Boolean(process.env.SUPABASE_URL),
              hasSupabaseServiceRoleKey: Boolean(process.env.SUPABASE_SERVICE_ROLE_KEY),
              hasLovableApiKey: Boolean(process.env.LOVABLE_API_KEY),
              hasResendApiKey: Boolean(process.env.RESEND_API_KEY),
            },
          });
          return Response.json({ ok: true });
        }
      },
    },
  },
});