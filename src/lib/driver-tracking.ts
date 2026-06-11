import { supabase } from "@/integrations/supabase/client";

export interface TrackingStatus {
  has_consent: boolean;
  active_session_id: string | null;
  active_started_at: string | null;
  total_distance_m: number;
  duration_seconds: number;
  points_count: number;
}

export interface IngestPointInput {
  sessionId: string;
  lat: number;
  lng: number;
  accuracyM?: number | null;
  speedMps?: number | null;
  heading?: number | null;
  recordedAt?: string;
  metadata?: Record<string, unknown>;
}

export async function getMyTrackingStatus(assignmentId: string): Promise<TrackingStatus> {
  const { data, error } = await (supabase.rpc as any)("get_my_tracking_status", {
    _assignment_id: assignmentId,
  });
  if (error) throw error;
  return {
    has_consent: Boolean(data?.has_consent),
    active_session_id: data?.active_session_id ?? null,
    active_started_at: data?.active_started_at ?? null,
    total_distance_m: Number(data?.total_distance_m ?? 0),
    duration_seconds: Number(data?.duration_seconds ?? 0),
    points_count: Number(data?.points_count ?? 0),
  };
}

export async function startDriverTrackingSession(assignmentId: string) {
  const { data, error } = await (supabase.rpc as any)("start_driver_tracking_session", {
    _assignment_id: assignmentId,
    _terms_version: "driver-location-v1",
  });
  if (error) throw error;
  return String(data);
}

export async function ingestDriverLocationPoint(input: IngestPointInput) {
  const { data, error } = await (supabase.rpc as any)("ingest_driver_location_point", {
    _session_id: input.sessionId,
    _lat: input.lat,
    _lng: input.lng,
    _accuracy_m: input.accuracyM ?? null,
    _speed_mps: input.speedMps ?? null,
    _heading: input.heading ?? null,
    _recorded_at: input.recordedAt ?? new Date().toISOString(),
    _metadata: input.metadata ?? {},
  });
  if (error) throw error;
  return data as { accepted: boolean; rejection_reason?: string | null; distance_from_prev_m: number };
}

export async function endDriverTrackingSession(sessionId: string) {
  const { data, error } = await (supabase.rpc as any)("end_driver_tracking_session", {
    _session_id: sessionId,
  });
  if (error) throw error;
  return data;
}

export async function revokeDriverLocationConsent() {
  const { data, error } = await (supabase.rpc as any)("revoke_driver_location_consent");
  if (error) throw error;
  return data;
}

export function shouldSendPoint(
  last: { lat: number; lng: number; sentAt: number } | null,
  next: { lat: number; lng: number },
  now = Date.now(),
) {
  if (!last) return true;
  const elapsed = now - last.sentAt;
  const distance = haversineMeters(last.lat, last.lng, next.lat, next.lng);
  return elapsed >= 300_000 || distance >= 150;
}

export function haversineMeters(lat1: number, lng1: number, lat2: number, lng2: number) {
  const toRad = (value: number) => (value * Math.PI) / 180;
  const earth = 6371000;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return earth * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}
