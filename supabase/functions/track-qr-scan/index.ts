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
  provider: string | null;
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
      client_source: typeof input?.metadata?.source === "string" ? input.metadata.source : null,
      source: "track_qr_scan_edge",
      has_ip: Boolean(ip),
      geo_provider: geo.provider,
      geo_source: geo.source,
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
  return normalizeClientIp(ip);
}

function normalizeClientIp(value: string | null | undefined) {
  if (!value) return null;

  let ip = value.trim().replace(/^"|"$/g, "");
  if (!ip) return null;

  if (ip.startsWith("[") && ip.includes("]")) {
    return ip.slice(1, ip.indexOf("]"));
  }

  const ipv4WithPort = ip.match(/^(\d{1,3}(?:\.\d{1,3}){3})(?::\d+)?$/);
  if (ipv4WithPort) return ipv4WithPort[1];

  if (ip.startsWith("::ffff:")) {
    return ip.slice("::ffff:".length);
  }

  return ip;
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
    return unavailableGeo("unavailable", null);
  }

  const provider = (Deno.env.get("QR_GEOIP_PROVIDER") ?? "ipinfo").toLowerCase();
  const token = Deno.env.get("QR_GEOIP_TOKEN") ?? "";

  if (provider === "ipinfo" && token) {
    const geo = await resolveGeoViaIpInfo(ip, token);
    if (geo.source === "ipinfo") return geo;
  }

  const fallbackProviders = provider === "ipapi" ? ["ipapi", "ipwhois"] : ["ipwhois", "ipapi"];
  for (const fallbackProvider of fallbackProviders) {
    const geo = fallbackProvider === "ipwhois" ? await resolveGeoViaIpWhoIs(ip) : await resolveGeoViaIpApi(ip);
    if (geo.city || geo.region || geo.country || geo.latitude || geo.longitude) {
      return geo;
    }
  }

  return unavailableGeo("unavailable", provider);
}

async function resolveGeoViaIpInfo(ip: string, token: string): Promise<GeoInfo> {
  try {
    const res = await fetch(`https://ipinfo.io/${encodeURIComponent(ip)}/json?token=${encodeURIComponent(token)}`, {
      headers: { Accept: "application/json" },
    });
    if (!res.ok) return unavailableGeo("ipinfo_error", "ipinfo");
    const data = await res.json() as { city?: string; region?: string; country?: string; loc?: string };
    const [latRaw, lngRaw] = String(data.loc ?? "").split(",");
    return {
      city: data.city ?? null,
      region: data.region ?? null,
      country: data.country ?? null,
      latitude: Number.isFinite(Number(latRaw)) ? Number(latRaw) : null,
      longitude: Number.isFinite(Number(lngRaw)) ? Number(lngRaw) : null,
      source: "ipinfo",
      provider: "ipinfo",
    };
  } catch (error) {
    console.warn("[track-qr-scan] ipinfo lookup failed", error);
    return unavailableGeo("ipinfo_exception", "ipinfo");
  }
}

async function resolveGeoViaIpWhoIs(ip: string): Promise<GeoInfo> {
  try {
    const res = await fetch(`https://ipwho.is/${encodeURIComponent(ip)}`, {
      headers: { Accept: "application/json" },
    });
    if (!res.ok) return unavailableGeo("ipwhois_error", "ipwhois");
    const data = await res.json() as {
      success?: boolean;
      city?: string;
      region?: string;
      country_code?: string;
      latitude?: number;
      longitude?: number;
    };
    if (data.success === false) return unavailableGeo("ipwhois_not_found", "ipwhois");
    return {
      city: data.city ?? null,
      region: data.region ?? null,
      country: data.country_code ?? null,
      latitude: Number.isFinite(Number(data.latitude)) ? Number(data.latitude) : null,
      longitude: Number.isFinite(Number(data.longitude)) ? Number(data.longitude) : null,
      source: "ipwhois",
      provider: "ipwhois",
    };
  } catch (error) {
    console.warn("[track-qr-scan] ipwhois lookup failed", error);
    return unavailableGeo("ipwhois_exception", "ipwhois");
  }
}

async function resolveGeoViaIpApi(ip: string): Promise<GeoInfo> {
  try {
    const res = await fetch(`https://ipapi.co/${encodeURIComponent(ip)}/json/`, {
      headers: { Accept: "application/json" },
    });
    if (!res.ok) return unavailableGeo("ipapi_error", "ipapi");
    const data = await res.json() as {
      error?: boolean;
      city?: string;
      region?: string;
      country_code?: string;
      latitude?: number;
      longitude?: number;
    };
    if (data.error) return unavailableGeo("ipapi_not_found", "ipapi");
    return {
      city: data.city ?? null,
      region: data.region ?? null,
      country: data.country_code ?? null,
      latitude: Number.isFinite(Number(data.latitude)) ? Number(data.latitude) : null,
      longitude: Number.isFinite(Number(data.longitude)) ? Number(data.longitude) : null,
      source: "ipapi",
      provider: "ipapi",
    };
  } catch (error) {
    console.warn("[track-qr-scan] ipapi lookup failed", error);
    return unavailableGeo("ipapi_exception", "ipapi");
  }
}

function unavailableGeo(source: string, provider: string | null): GeoInfo {
  return { city: null, region: null, country: null, latitude: null, longitude: null, source, provider };
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
