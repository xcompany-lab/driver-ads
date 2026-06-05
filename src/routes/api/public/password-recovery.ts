import { createFileRoute } from "@tanstack/react-router";
import { createClient } from "@supabase/supabase-js";
import { logEmailDiagnostic } from "@/lib/email/diagnostics.server";

const PUBLIC_SITE_URL = "https://driverads.com.br";

function isValidEmail(email: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) && email.length <= 254;
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

        const SUPABASE_URL = process.env.SUPABASE_URL || import.meta.env.VITE_SUPABASE_URL;
        const SUPABASE_PUBLISHABLE_KEY =
          process.env.SUPABASE_PUBLISHABLE_KEY || import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

        await logEmailDiagnostic({
          flow: "password-recovery",
          step: "request-received",
          status: "started",
          recipientEmail: email,
          metadata: {
            hasSupabaseUrl: Boolean(SUPABASE_URL),
            hasPublishableKey: Boolean(SUPABASE_PUBLISHABLE_KEY),
            hasServiceRoleKey: Boolean(process.env.SUPABASE_SERVICE_ROLE_KEY),
          },
        });

        if (!SUPABASE_URL || !SUPABASE_PUBLISHABLE_KEY) {
          await logEmailDiagnostic({
            flow: "password-recovery",
            step: "create-client",
            status: "failed",
            recipientEmail: email,
            errorMessage: "Missing Supabase public config",
          });
          return Response.json({ ok: true });
        }

        try {
          const client = createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
            auth: { persistSession: false, autoRefreshToken: false },
          });

          const { error } = await client.auth.resetPasswordForEmail(email, {
            redirectTo: `${PUBLIC_SITE_URL}/auth/reset-password`,
          });

          if (error) {
            await logEmailDiagnostic({
              flow: "password-recovery",
              step: "reset-password-for-email",
              status: "failed",
              recipientEmail: email,
              errorMessage: error.message,
            });
          } else {
            await logEmailDiagnostic({
              flow: "password-recovery",
              step: "reset-password-for-email",
              status: "success",
              recipientEmail: email,
            });
          }
        } catch (err) {
          const message = err instanceof Error ? err.message : String(err);
          await logEmailDiagnostic({
            flow: "password-recovery",
            step: "reset-password-for-email",
            status: "failed",
            recipientEmail: email,
            errorMessage: message,
          });
        }

        return Response.json({ ok: true });
      },
    },
  },
});
