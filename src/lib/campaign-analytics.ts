import { supabase } from "@/integrations/supabase/client";

export interface QrAnalytics {
  summary: {
    total_scans: number;
    unique_scans: number;
    last_scan_at: string | null;
  };
  by_day: Array<{ day: string; scans: number; unique_scans: number }>;
  by_hour: Array<{ hour: number; scans: number }>;
  by_city: Array<{ city: string; region: string; country: string; scans: number }>;
  by_device: Array<{ device_type: string; scans: number }>;
  latest_scans: Array<{
    scanned_at: string;
    city: string;
    region: string;
    country: string;
    device_type: string;
    browser_name: string;
    os_name: string;
    referrer: string | null;
    approx_source?: string | null;
    approx_radius_m?: number | null;
    approx_confidence?: number | null;
    vehicle_label?: string | null;
    driver_name?: string | null;
  }>;
  approx_locations: QrApproxLocation[];
}

export interface QrApproxLocation {
  scanned_at: string;
  lat: number;
  lng: number;
  radius_m: number;
  confidence: number | null;
  source: "driver_track_crossref" | "geoip_fallback" | "unavailable" | string;
  device_type: string;
  vehicle_label: string | null;
  driver_name: string | null;
}

export interface DriverTrackingAnalytics {
  summary: {
    distance_m: number;
    driving_seconds: number;
    active_drivers: number;
    sessions_count: number;
    points_count: number;
  };
  by_day: Array<{ day: string; distance_m: number; driving_seconds: number }>;
  by_hour: Array<{ hour: number; points: number; distance_m: number }>;
  by_city: Array<{ city: string; distance_m: number; driving_seconds: number }>;
}

export interface DriverRanking {
  driver_id: string;
  full_name: string;
  city: string | null;
  campaigns_count: number;
  distance_m: number;
  driving_seconds: number;
  sessions_count: number;
  last_seen_at: string | null;
}

export async function getCampaignQrAnalytics(campaignId: string): Promise<QrAnalytics> {
  const { data, error } = await (supabase.rpc as any)("get_campaign_qr_analytics", {
    _campaign_id: campaignId,
  });
  if (error) throw error;
  return normalizeQrAnalytics(data);
}

export async function getCampaignTrackingAnalytics(campaignId: string): Promise<DriverTrackingAnalytics> {
  const { data, error } = await (supabase.rpc as any)("get_driver_tracking_analytics", {
    _campaign_id: campaignId,
  });
  if (error) throw error;
  return normalizeTrackingAnalytics(data);
}

export async function getAdminDriverRankings(limit = 20): Promise<DriverRanking[]> {
  const { data, error } = await (supabase.rpc as any)("get_admin_driver_rankings", {
    _limit: limit,
  });
  if (error) throw error;
  return Array.isArray(data) ? (data as DriverRanking[]) : [];
}

function normalizeQrAnalytics(value: any): QrAnalytics {
  return {
    summary: {
      total_scans: Number(value?.summary?.total_scans ?? 0),
      unique_scans: Number(value?.summary?.unique_scans ?? 0),
      last_scan_at: value?.summary?.last_scan_at ?? null,
    },
    by_day: Array.isArray(value?.by_day) ? value.by_day : [],
    by_hour: Array.isArray(value?.by_hour) ? value.by_hour : [],
    by_city: Array.isArray(value?.by_city) ? value.by_city : [],
    by_device: Array.isArray(value?.by_device) ? value.by_device : [],
    latest_scans: Array.isArray(value?.latest_scans) ? value.latest_scans : [],
    approx_locations: Array.isArray(value?.approx_locations)
      ? value.approx_locations
          .map((item: any) => ({
            scanned_at: String(item?.scanned_at ?? ""),
            lat: Number(item?.lat),
            lng: Number(item?.lng),
            radius_m: Number(item?.radius_m ?? 0),
            confidence: item?.confidence === null || item?.confidence === undefined ? null : Number(item.confidence),
            source: String(item?.source ?? "unavailable"),
            device_type: String(item?.device_type ?? "Desconhecido"),
            vehicle_label: item?.vehicle_label ?? null,
            driver_name: item?.driver_name ?? null,
          }))
          .filter((item: QrApproxLocation) => Number.isFinite(item.lat) && Number.isFinite(item.lng))
      : [],
  };
}

function normalizeTrackingAnalytics(value: any): DriverTrackingAnalytics {
  return {
    summary: {
      distance_m: Number(value?.summary?.distance_m ?? 0),
      driving_seconds: Number(value?.summary?.driving_seconds ?? 0),
      active_drivers: Number(value?.summary?.active_drivers ?? 0),
      sessions_count: Number(value?.summary?.sessions_count ?? 0),
      points_count: Number(value?.summary?.points_count ?? 0),
    },
    by_day: Array.isArray(value?.by_day) ? value.by_day : [],
    by_hour: Array.isArray(value?.by_hour) ? value.by_hour : [],
    by_city: Array.isArray(value?.by_city) ? value.by_city : [],
  };
}

export function formatDistance(meters: number) {
  if (!Number.isFinite(meters) || meters <= 0) return "0 km";
  return `${(meters / 1000).toLocaleString("pt-BR", { maximumFractionDigits: 1 })} km`;
}

export function formatDuration(seconds: number) {
  if (!Number.isFinite(seconds) || seconds <= 0) return "0h";
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.round((seconds % 3600) / 60);
  if (hours <= 0) return `${minutes}min`;
  return `${hours}h${minutes ? ` ${minutes}min` : ""}`;
}
