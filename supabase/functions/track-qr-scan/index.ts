import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

type ScanInput = {
  short_code?: string;
  user_agent?: string | null;
  referrer?: string | null;
  metadata?: Record<string, unknown> | null;
};

type GeoInfo = {
  city: string | null;
  region: string | null;
  country: string | null;
  latitude: number | null;
  longitude: number | null;
  source: string;
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", ...corsHeaders },
  });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return json({ error: "method_not_allowed" }, 405);
  }

  const input = await safeJson<ScanInput>(req);
  const shortCode = String(input?.short_code ?? "").trim().toLowerCase();

  if (!/^[a-z0-9]{6,32}$/.test(shortCode)) {
    return json({ error: "invalid_short_code" }, 400);
  }

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { data: qr, error: qrError } = await supabase
    .from("campaign_qr_codes")
    .select("id,campaign_id,advertiser_id,destination_url,is_active")
    .eq("short_code", shortCode)
    .eq("is_active", true)
    .maybeSingle();

  if (qrError) {
    console.error("[track-qr-scan] QR lookup failed", qrError);
    return json({ error: "qr_lookup_failed" }, 500);
  }

  if (!qr) {
    return json({ error: "qr_not_found" }, 404);
  }

  const userAgent = left(input?.user_agent || req.headers.get("user-agent") || "", 500);
  const referrer = left(input?.referrer || req.headers.get("referer") || "", 500);
  const ip = getClientIp(req);
  const ipHash = ip ? await sha256(ip) : null;
  const scanKey = await sha256(`${shortCode}|${ipHash ?? "no-ip"}|${userAgent}|${new Date().toISOString().slice(0, 10)}`);
  const parsedUa = parseUserAgent(userAgent);
  const geo = await resolveGeo(ip);

  const { error: insertError } = await supabase.from("campaign_qr_scans").insert({
    qr_code_id: qr.id,
    campaign_id: qr.campaign_id,
    advertiser_id: qr.advertiser_id,
    user_agent: userAgent || null,
    referrer: referrer || null,
    ip_hash: ipHash,
    scan_key: scanKey,
    device_type: parsedUa.deviceType,
    browser_name: parsedUa.browserName,
    os_name: parsedUa.osName,
    city: geo.city,
    region: geo.region,
    country: geo.country,
    latitude: geo.latitude,
    longitude: geo.longitude,
    geo_source: geo.source,
    destination_url: qr.destination_url,
    metadata: {
      ...(input?.metadata ?? {}),
      source: "track_qr_scan_edge",
      has_ip: Boolean(ip),
    },
  });

  if (insertError) {
    console.error("[track-qr-scan] Scan insert failed", insertError);
    return json({ error: "scan_insert_failed" }, 500);
  }

  return json({ destination_url: qr.destination_url });
});

async function safeJson<T>(req: Request): Promise<T | null> {
  try {
    return (await req.json()) as T;
  } catch {
    return null;
  }
}

function left(value: string, max: number) {
  return value.trim().slice(0, max);
}

function getClientIp(req: Request) {
  const forwarded = req.headers.get("forwarded")?.match(/for="?([^;,"]+)/i)?.[1];
  const candidates = [
    req.headers.get("cf-connecting-ip"),
    req.headers.get("x-real-ip"),
    req.headers.get("x-forwarded-for")?.split(",")[0],
    forwarded,
  ];
  const ip = candidates.find((value) => value && value.trim());
  return ip?.trim().replace(/^"|"$/g, "") ?? null;
}

async function sha256(value: string) {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return Array.from(new Uint8Array(digest))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

function parseUserAgent(userAgent: string) {
  const ua = userAgent.toLowerCase();
  const deviceType = /ipad|tablet/.test(ua) ? "tablet" : /mobile|iphone|android/.test(ua) ? "mobile" : "desktop";
  const browserName = /edg\//.test(ua)
    ? "Edge"
    : /chrome|crios/.test(ua)
      ? "Chrome"
      : /safari/.test(ua)
        ? "Safari"
        : /firefox|fxios/.test(ua)
          ? "Firefox"
          : "Desconhecido";
  const osName = /iphone|ipad|ios/.test(ua)
    ? "iOS"
    : /android/.test(ua)
      ? "Android"
      : /windows/.test(ua)
        ? "Windows"
        : /mac os|macintosh/.test(ua)
          ? "macOS"
          : /linux/.test(ua)
            ? "Linux"
            : "Desconhecido";
  return { deviceType, browserName, osName };
}

async function resolveGeo(ip: string | null): Promise<GeoInfo> {
  if (!ip || isPrivateIp(ip)) {
    return unavailableGeo("unavailable");
  }

  const provider = (Deno.env.get("QR_GEOIP_PROVIDER") ?? "ipinfo").toLowerCase();
  const token = Deno.env.get("QR_GEOIP_TOKEN") ?? "";

  if (provider === "ipinfo" && token) {
    try {
      const res = await fetch(`https://ipinfo.io/${encodeURIComponent(ip)}/json?token=${encodeURIComponent(token)}`, {
        headers: { Accept: "application/json" },
      });
      if (!res.ok) return unavailableGeo("ipinfo_error");
      const data = await res.json() as { city?: string; region?: string; country?: string; loc?: string };
      const [latRaw, lngRaw] = String(data.loc ?? "").split(",");
      return {
        city: data.city ?? null,
        region: data.region ?? null,
        country: data.country ?? null,
        latitude: Number.isFinite(Number(latRaw)) ? Number(latRaw) : null,
        longitude: Number.isFinite(Number(lngRaw)) ? Number(lngRaw) : null,
        source: "ipinfo",
      };
    } catch (error) {
      console.warn("[track-qr-scan] GeoIP lookup failed", error);
      return unavailableGeo("ipinfo_exception");
    }
  }

  return unavailableGeo("unavailable");
}

function unavailableGeo(source: string): GeoInfo {
  return { city: null, region: null, country: null, latitude: null, longitude: null, source };
}

function isPrivateIp(ip: string) {
  return (
    ip === "127.0.0.1" ||
    ip === "::1" ||
    ip.startsWith("10.") ||
    ip.startsWith("192.168.") ||
    /^172\.(1[6-9]|2\d|3[0-1])\./.test(ip)
  );
}
