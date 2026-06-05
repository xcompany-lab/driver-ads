import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const SUPABASE_PUBLISHABLE_KEY =
  import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY || process.env.SUPABASE_PUBLISHABLE_KEY;

type EmailDiagnosticStatus = "started" | "success" | "skipped" | "failed";

let diagnosticClient: ReturnType<typeof createClient> | undefined;

function getDiagnosticClient() {
  if (!SUPABASE_URL || !SUPABASE_PUBLISHABLE_KEY) return null;
  diagnosticClient ??= createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  return diagnosticClient;
}

export async function logEmailDiagnostic(input: {
  flow: string;
  step: string;
  status: EmailDiagnosticStatus;
  recipientEmail?: string | null;
  errorMessage?: string | null;
  metadata?: Record<string, unknown>;
}) {
  const client = getDiagnosticClient();
  if (!client) {
    console.warn("[email-diagnostic] skipped: missing public Supabase config", {
      flow: input.flow,
      step: input.step,
      status: input.status,
    });
    return;
  }

  const { error } = await client.rpc("log_email_diagnostic", {
    _flow: input.flow,
    _step: input.step,
    _status: input.status,
    _recipient_email: input.recipientEmail ?? null,
    _error_message: input.errorMessage ?? null,
    _metadata: input.metadata ?? {},
  });

  if (error) {
    console.warn("[email-diagnostic] persist failed", {
      flow: input.flow,
      step: input.step,
      status: input.status,
      message: error.message,
    });
  }
}
