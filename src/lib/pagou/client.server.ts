// Pagou.ai server-side HTTP client. Server-only — never import from client code.
import { supabaseAdmin } from "@/integrations/supabase/client.server";

const BASE_URL = () => process.env.PAGOU_BASE_URL ?? "https://api-sandbox.pagou.ai";
const TOKEN = () => process.env.PAGOU_API_TOKEN ?? "";

export type PagouResponse<T = unknown> = {
  ok: boolean;
  status: number;
  data: T | null;
  requestId: string | null;
  error: string | null;
};

export async function pagouRequest<T = unknown>(
  path: string,
  init: RequestInit = {},
  meta?: { entity_type?: string; entity_id?: string },
): Promise<PagouResponse<T>> {
  const url = `${BASE_URL()}${path}`;
  const started = Date.now();
  let status = 0;
  let requestId: string | null = null;
  let error: string | null = null;
  let data: T | null = null;

  try {
    if (!TOKEN()) throw new Error("PAGOU_API_TOKEN missing");
    const res = await fetch(url, {
      ...init,
      headers: {
        Authorization: `Bearer ${TOKEN()}`,
        "Content-Type": "application/json",
        Accept: "application/json",
        ...(init.headers ?? {}),
      },
    });
    status = res.status;
    requestId = res.headers.get("x-request-id") ?? res.headers.get("request-id");
    const body = await res.text();
    const parsed = body ? safeJson(body) : null;
    data = parsed as T | null;
    if (!res.ok) {
      error = typeof parsed === "object" && parsed && "message" in (parsed as object)
        ? String((parsed as { message: unknown }).message)
        : `HTTP ${status}`;
    }
  } catch (e) {
    error = (e as Error).message;
  } finally {
    void supabaseAdmin
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
      })
      .then(() => undefined, () => undefined);
  }

  return { ok: !error && status >= 200 && status < 300, status, data, requestId, error };
}

function safeJson(s: string): unknown {
  try {
    return JSON.parse(s);
  } catch {
    return s;
  }
}
