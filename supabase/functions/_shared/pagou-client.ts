// Shared Pagou.ai HTTP client for Supabase Edge Functions (Deno runtime).
// Reads Pagou secrets from Supabase Edge Function environment.
import { createClient, SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

export const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
export const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
export const SUPABASE_PUBLISHABLE_KEY =
  Deno.env.get("SUPABASE_PUBLISHABLE_KEY") ??
  Deno.env.get("SUPABASE_ANON_KEY") ??
  "";

export const PAGOU_BASE_URL = () =>
  normalizeBaseUrl(Deno.env.get("PAGOU_BASE_URL") ?? "https://api.sandbox.pagou.ai");
export const PAGOU_TOKEN = () =>
  Deno.env.get("PAGOU_API_TOKEN") ?? Deno.env.get("PAGOU_SECRET_TOKEN") ?? "";
export const PAGOU_PUBLIC_KEY = () => Deno.env.get("PAGOU_PUBLIC_KEY") ?? "";
export const PAGOU_ENV = () =>
  (Deno.env.get("PAGOU_ENV") ?? "sandbox") as "sandbox" | "production";
export const PAGOU_WEBHOOK_URL = () =>
  Deno.env.get("PAGOU_WEBHOOK_URL") ??
  `${SUPABASE_URL}/functions/v1/pagou-webhook`;

export const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

export const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", ...corsHeaders },
  });

export function adminClient(): SupabaseClient {
  return createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

/** Returns the authenticated user from the request bearer, or null. */
export async function getAuthedUser(req: Request) {
  const auth = req.headers.get("Authorization") ?? "";
  if (!auth) return null;
  const userClient = createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
    global: { headers: { Authorization: auth } },
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data, error } = await userClient.auth.getUser();
  if (error || !data?.user) return null;
  return data.user;
}

export type PagouResponse<T = unknown> = {
  ok: boolean;
  status: number;
  data: T | null;
  requestId: string | null;
  error: string | null;
  code: string | null;
};

export async function pagouRequest<T = unknown>(
  path: string,
  init: RequestInit = {},
  meta?: { entity_type?: string; entity_id?: string },
): Promise<PagouResponse<T>> {
  const url = `${PAGOU_BASE_URL()}${path}`;
  const started = Date.now();
  let status = 0;
  let requestId: string | null = null;
  let error: string | null = null;
  let code: string | null = null;
  let data: T | null = null;

  try {
    if (!PAGOU_TOKEN()) {
      code = "pagou_token_missing";
      throw new Error("PAGOU_API_TOKEN/PAGOU_SECRET_TOKEN missing");
    }
    const res = await fetch(url, {
      ...init,
      headers: {
        Authorization: `Bearer ${PAGOU_TOKEN()}`,
        "Content-Type": "application/json",
        Accept: "application/json",
        ...(init.headers ?? {}),
      },
    });
    status = res.status;
    requestId = res.headers.get("x-request-id") ?? res.headers.get("request-id");
    const body = await res.text();
    const parsed = body ? safeJson(body) : null;
    if (isPagouEnvelope(parsed)) {
      requestId = parsed.requestId ?? requestId;
      data = parsed.data as T | null;
    } else {
      data = parsed as T | null;
    }
    if (!res.ok) {
      const msg =
        typeof parsed === "object" && parsed && "message" in (parsed as object)
          ? String((parsed as { message: unknown }).message)
          : null;
      const title =
        typeof parsed === "object" && parsed && "title" in (parsed as object)
          ? String((parsed as { title: unknown }).title)
          : null;
      // Include raw body (truncated) so 422 validation errors are visible in logs
      error = `HTTP ${status}${msg ? `: ${msg}` : ""} | body=${body.slice(0, 800)}`;
      code = title || `http_${status}`;
    }
  } catch (e) {
    const message = (e as Error).message;
    if (!code && isNetworkDnsError(message)) {
      code = "pagou_network_dns";
      error =
        `Nao foi possivel resolver/conectar ao endpoint Pagou (${PAGOU_BASE_URL()}). ` +
        "Confirme se PAGOU_BASE_URL esta como https://api.sandbox.pagou.ai ou api.sandbox.pagou.ai.";
    } else {
      error = message;
    }
  } finally {
    try {
      await adminClient()
        .from("pagou_api_logs")
        .insert({
          endpoint: path,
          method: (init.method ?? "GET").toUpperCase(),
          request_id: requestId,
          http_status: status || null,
          entity_type: meta?.entity_type ?? null,
          entity_id: meta?.entity_id ?? null,
          error_message: error,
          duration_ms: Date.now() - started,
        });
    } catch {
      /* swallow */
    }
  }

  return { ok: !error && status >= 200 && status < 300, status, data, requestId, error, code };
}

function isPagouEnvelope(value: unknown): value is { requestId?: string; data: unknown } {
  return typeof value === "object" && value !== null && "data" in value;
}

function safeJson(s: string): unknown {
  try {
    return JSON.parse(s);
  } catch {
    return s;
  }
}

function normalizeBaseUrl(value: string) {
  const trimmed = value.trim().replace(/\/+$/, "");
  if (!/^https?:\/\//i.test(trimmed)) return `https://${trimmed}`;
  return trimmed;
}

function isNetworkDnsError(message: string) {
  return /dns|lookup address|name or service not known|failed to lookup|failed to connect|error sending request/i.test(
    message,
  );
}
