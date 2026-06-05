import { createFileRoute } from "@tanstack/react-router";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { logEmailDiagnostic } from "@/lib/email/diagnostics.server";
import { renderEmail } from "@/lib/email/templates.server";

const GATEWAY_URL = "https://connector-gateway.lovable.dev/resend";
const FROM = "Driver Ads <suporte@driverads.com.br>";
const MAX_ATTEMPTS = 5;
const BATCH_SIZE = 20;

async function sendViaResend(to: string, toName: string | null, subject: string, html: string) {
  const lovableKey = process.env.LOVABLE_API_KEY;
  const resendKey = process.env.RESEND_API_KEY;
  if (!lovableKey || !resendKey) throw new Error("Missing LOVABLE_API_KEY or RESEND_API_KEY");
  const recipient = toName ? `${toName} <${to}>` : to;
  const res = await fetch(`${GATEWAY_URL}/emails`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${lovableKey}`,
      "X-Connection-Api-Key": resendKey,
    },
    body: JSON.stringify({ from: FROM, to: [recipient], subject, html }),
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Resend ${res.status}: ${body.slice(0, 500)}`);
  }
}

export const Route = createFileRoute("/api/public/process-email-outbox")({
  server: {
    handlers: {
      POST: async () => processOutbox(),
      GET: async () => processOutbox(),
    },
  },
});

async function processOutbox() {
  await logEmailDiagnostic({ flow: "email-outbox", step: "process-start", status: "started" });
  const { data: rows, error } = await supabaseAdmin
    .from("email_outbox")
    .select("*")
    .eq("status", "pending")
    .lt("attempts", MAX_ATTEMPTS)
    .order("created_at", { ascending: true })
    .limit(BATCH_SIZE);

  if (error) {
    await logEmailDiagnostic({ flow: "email-outbox", step: "load-pending", status: "failed", errorMessage: error.message });
    return Response.json({ ok: false, error: error.message }, { status: 500 });
  }

  let sent = 0;
  let failed = 0;

  for (const row of rows ?? []) {
    try {
      const rendered = renderEmail(row.template, (row.payload as Record<string, unknown>) ?? {});
      if (!rendered) {
        await logEmailDiagnostic({
          flow: "email-outbox",
          step: "render-template",
          status: "failed",
          recipientEmail: row.to_email,
          errorMessage: `Unknown template: ${row.template}`,
          metadata: { outboxId: row.id, template: row.template },
        });
        await supabaseAdmin
          .from("email_outbox")
          .update({ status: "failed", last_error: `Unknown template: ${row.template}`, attempts: (row.attempts ?? 0) + 1 })
          .eq("id", row.id);
        failed++;
        continue;
      }
      await sendViaResend(row.to_email, row.to_name ?? null, rendered.subject, rendered.html);
      await logEmailDiagnostic({
        flow: "email-outbox",
        step: "send-email",
        status: "success",
        recipientEmail: row.to_email,
        metadata: { outboxId: row.id, template: row.template },
      });
      await supabaseAdmin
        .from("email_outbox")
        .update({ status: "sent", sent_at: new Date().toISOString(), subject: rendered.subject, attempts: (row.attempts ?? 0) + 1, last_error: null })
        .eq("id", row.id);
      sent++;
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      const attempts = (row.attempts ?? 0) + 1;
      await logEmailDiagnostic({
        flow: "email-outbox",
        step: "send-email",
        status: "failed",
        recipientEmail: row.to_email,
        errorMessage: message,
        metadata: { outboxId: row.id, template: row.template, attempts },
      });
      await supabaseAdmin
        .from("email_outbox")
        .update({
          status: attempts >= MAX_ATTEMPTS ? "failed" : "pending",
          attempts,
          last_error: message.slice(0, 1000),
        })
        .eq("id", row.id);
      failed++;
    }
  }

  return Response.json({ ok: true, sent, failed, scanned: rows?.length ?? 0 });
}
