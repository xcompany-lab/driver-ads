import type { DriverAssignment, TrackingStatus } from "./types";
import { supabase } from "./supabase";

const TRACKABLE_STATUSES = ["accepted", "awaiting_installation", "active"];

export async function signIn(email: string, password: string) {
  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) throw error;
}

export async function signOut() {
  await supabase.auth.signOut();
}

export async function listMyTrackableAssignments(): Promise<DriverAssignment[]> {
  const { data: userData, error: userError } = await supabase.auth.getUser();
  if (userError) throw userError;
  const userId = userData.user?.id;
  if (!userId) return [];

  const { data: driver, error: driverError } = await supabase
    .from("drivers")
    .select("id")
    .eq("user_id", userId)
    .maybeSingle();
  if (driverError) throw driverError;
  if (!driver?.id) return [];

  const { data, error } = await supabase
    .from("campaign_driver_assignments")
    .select(`
      id,
      status,
      monthly_payout,
      campaign:campaigns(id, name, city, period_start, period_end),
      vehicle:vehicles(id, plate, model)
    `)
    .eq("driver_id", driver.id)
    .in("status", TRACKABLE_STATUSES)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data ?? []) as unknown as DriverAssignment[];
}

export async function getTrackingStatus(assignmentId: string): Promise<TrackingStatus> {
  const { data, error } = await supabase.rpc("get_my_tracking_status", {
    _assignment_id: assignmentId,
  });
  if (error) throw error;
  return {
    has_consent: Boolean((data as any)?.has_consent),
    active_session_id: (data as any)?.active_session_id ?? null,
    total_distance_m: Number((data as any)?.total_distance_m ?? 0),
    duration_seconds: Number((data as any)?.duration_seconds ?? 0),
    points_count: Number((data as any)?.points_count ?? 0),
  };
}

export async function startTrackingSession(assignmentId: string) {
  const { data, error } = await supabase.rpc("start_driver_tracking_session", {
    _assignment_id: assignmentId,
    _terms_version: "driver-location-native-v1",
  });
  if (error) throw error;
  return String(data);
}

export async function endTrackingSession(sessionId: string) {
  const { error } = await supabase.rpc("end_driver_tracking_session", {
    _session_id: sessionId,
  });
  if (error) throw error;
}

export async function ingestLocationPoint(input: {
  sessionId: string;
  lat: number;
  lng: number;
  accuracyM?: number | null;
  speedMps?: number | null;
  heading?: number | null;
  recordedAt?: string;
}) {
  const { error } = await supabase.rpc("ingest_driver_location_point", {
    _session_id: input.sessionId,
    _lat: input.lat,
    _lng: input.lng,
    _accuracy_m: input.accuracyM ?? null,
    _speed_mps: input.speedMps ?? null,
    _heading: input.heading ?? null,
    _recorded_at: input.recordedAt ?? new Date().toISOString(),
    _metadata: { source: "driver_mobile_background_location" },
  });
  if (error) throw error;
}
