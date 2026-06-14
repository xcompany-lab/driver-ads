import type {
  AvailableCampaign,
  Driver,
  DriverAssignment,
  DriverPayout,
  DriverPayoutMethod,
  InstallationProof,
  PixKeyType,
  SignupInput,
  TrackingStatus,
  Vehicle,
} from "./types";
import { supabase } from "./supabase";

const TRACKABLE_STATUSES = ["accepted", "awaiting_installation", "active"];
const DOC_BUCKET = "installation-proofs";
const AVATAR_BUCKET = "avatars";

type DriverDocKey = "cnh_front_url" | "selfie_doc_url" | "address_proof_url";

const DRIVER_DOC_STATUS_KEY: Record<DriverDocKey, keyof Driver> = {
  cnh_front_url: "cnh_front_status",
  selfie_doc_url: "selfie_doc_status",
  address_proof_url: "address_proof_status",
};

const DB_PIX_KEY_TYPES: Record<PixKeyType, string> = {
  cpf: "CPF",
  cnpj: "CNPJ",
  email: "EMAIL",
  phone: "PHONE",
  random: "EVP",
};

export async function signUpDriver(input: SignupInput) {
  const { data, error } = await supabase.functions.invoke("public-signup", {
    body: {
      role: "driver",
      email: input.email.trim().toLowerCase(),
      password: input.password,
      full_name: input.fullName.trim(),
      phone: onlyDigits(input.phone),
      cpf: onlyDigits(input.cpf),
      city: input.city.trim(),
    },
  });

  if (error) throw functionError(error, data);
  await signIn(input.email.trim().toLowerCase(), input.password);
}

export async function signIn(email: string, password: string) {
  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) throw error;
}

export async function signOut() {
  await supabase.auth.signOut();
}

export async function getCurrentUserId() {
  const { data, error } = await supabase.auth.getUser();
  if (error) throw error;
  return data.user?.id ?? null;
}

export async function getMyDriver(): Promise<Driver | null> {
  const userId = await getCurrentUserId();
  if (!userId) return null;
  const { data, error } = await supabase
    .from("drivers")
    .select("*")
    .eq("user_id", userId)
    .maybeSingle();
  if (error) throw error;
  return data as Driver | null;
}

export async function updateMyDriver(driverId: string, patch: Partial<Driver>) {
  const { data, error } = await supabase
    .from("drivers")
    .update(patch as Record<string, unknown>)
    .eq("id", driverId)
    .select()
    .single();
  if (error) throw error;
  return data as Driver;
}

export async function listMyVehicles(driverId: string): Promise<Vehicle[]> {
  const { data, error } = await supabase
    .from("vehicles")
    .select("*")
    .eq("driver_id", driverId)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data ?? []) as Vehicle[];
}

export async function saveVehicle(input: Partial<Vehicle> & { driver_id: string; plate: string; model: string }) {
  const patch = {
    driver_id: input.driver_id,
    plate: input.plate.trim().toUpperCase(),
    model: input.model.trim(),
    brand: input.brand?.trim() || null,
    year: input.year ? Number(input.year) : null,
    color: input.color?.trim() || null,
    vehicle_type: input.vehicle_type?.trim() || null,
  };

  if (input.id) {
    const { data, error } = await supabase
      .from("vehicles")
      .update(patch)
      .eq("id", input.id)
      .select()
      .single();
    if (error) throw error;
    return data as Vehicle;
  }

  const { data, error } = await supabase.from("vehicles").insert(patch).select().single();
  if (error) throw error;
  return data as Vehicle;
}

export async function uploadAvatar(userId: string, file: LocalUploadFile) {
  const path = `${userId}/avatar-${Date.now()}.${file.ext}`;
  await uploadBlob(AVATAR_BUCKET, path, file);
  const { data } = supabase.storage.from(AVATAR_BUCKET).getPublicUrl(path);
  return data.publicUrl;
}

export async function uploadDriverDoc(input: {
  userId: string;
  driverId: string;
  key: DriverDocKey;
  file: LocalUploadFile;
}) {
  const path = `${input.userId}/${input.key}-${Date.now()}.${input.file.ext}`;
  await uploadBlob(DOC_BUCKET, path, input.file);
  const patch = {
    [input.key]: path,
    [DRIVER_DOC_STATUS_KEY[input.key]]: "pending",
  };
  await updateMyDriver(input.driverId, patch as Partial<Driver>);
  return path;
}

export async function uploadVehicleCrlv(input: { userId: string; vehicleId: string; file: LocalUploadFile }) {
  const path = `${input.userId}/vehicle-${input.vehicleId}-crlv-${Date.now()}.${input.file.ext}`;
  await uploadBlob(DOC_BUCKET, path, input.file);
  const { error } = await supabase
    .from("vehicles")
    .update({ crlv_url: path, crlv_status: "pending" })
    .eq("id", input.vehicleId);
  if (error) throw error;
  return path;
}

export async function listMyAssignments(driverId: string): Promise<DriverAssignment[]> {
  const { data, error } = await supabase
    .from("campaign_driver_assignments")
    .select(`
      id,
      status,
      monthly_payout,
      campaign:campaigns(id, name, city, period_start, period_end, art_url),
      vehicle:vehicles(id, plate, model)
    `)
    .eq("driver_id", driverId)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data ?? []) as unknown as DriverAssignment[];
}

export async function listMyTrackableAssignments(): Promise<DriverAssignment[]> {
  const driver = await getMyDriver();
  if (!driver?.id) return [];

  const { data, error } = await supabase
    .from("campaign_driver_assignments")
    .select(`
      id,
      status,
      monthly_payout,
      campaign:campaigns(id, name, city, period_start, period_end, art_url),
      vehicle:vehicles(id, plate, model)
    `)
    .eq("driver_id", driver.id)
    .in("status", TRACKABLE_STATUSES)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data ?? []) as unknown as DriverAssignment[];
}

export async function listAvailableCampaigns(driverId: string): Promise<AvailableCampaign[]> {
  const { data, error } = await supabase.rpc("list_available_campaigns_for_driver", {
    _driver_id: driverId,
  });
  if (error) throw error;
  return (data ?? []) as AvailableCampaign[];
}

export async function resolveVehicleTier(brand?: string | null, model?: string | null) {
  const { data, error } = await supabase.rpc("resolve_vehicle_tier", {
    _brand: brand ?? "",
    _model: model ?? "",
  });
  if (error) throw error;
  return String(data || "standard");
}

export async function resolveVehicleTiers(vehicles: Vehicle[]) {
  const pairs = await Promise.all(
    vehicles.map(async (vehicle) => {
      try {
        return [vehicle.id, await resolveVehicleTier(vehicle.brand, vehicle.model)] as const;
      } catch {
        return [vehicle.id, "standard"] as const;
      }
    }),
  );
  return Object.fromEntries(pairs) as Record<string, string>;
}

export async function applyToCampaign(campaignId: string, driverId: string, vehicleId: string) {
  const { error } = await supabase.rpc("apply_driver_to_campaign", {
    _campaign_id: campaignId,
    _driver_id: driverId,
    _vehicle_id: vehicleId,
  });
  if (error) throw error;
}

export async function respondToAssignment(assignmentId: string, accept: boolean) {
  const { error } = await supabase
    .from("campaign_driver_assignments")
    .update({ status: accept ? "accepted" : "declined", responded_at: new Date().toISOString() })
    .eq("id", assignmentId);
  if (error) throw error;
}

export async function listProofsForAssignment(assignmentId: string): Promise<InstallationProof[]> {
  const { data, error } = await supabase
    .from("installation_proofs")
    .select("*")
    .eq("assignment_id", assignmentId)
    .order("submitted_at", { ascending: false });
  if (error) throw error;
  return (data ?? []) as InstallationProof[];
}

export async function uploadInstallationProof(input: {
  userId: string;
  assignmentId: string;
  file: LocalUploadFile;
  observation?: string;
  geo?: { lat: number; lng: number } | null;
}) {
  const path = `${input.userId}/${input.assignmentId}/${Date.now()}.${input.file.ext}`;
  await uploadBlob(DOC_BUCKET, path, input.file);
  const { data, error } = await supabase
    .from("installation_proofs")
    .insert({
      assignment_id: input.assignmentId,
      photo_url: path,
      observation: input.observation?.trim() || null,
      geo_lat: input.geo?.lat ?? null,
      geo_lng: input.geo?.lng ?? null,
    })
    .select()
    .single();
  if (error) throw error;
  return data as InstallationProof;
}

export async function getMyPayoutMethod(driverId: string): Promise<DriverPayoutMethod | null> {
  const { data, error } = await supabase
    .from("driver_payout_methods")
    .select("*")
    .eq("driver_id", driverId)
    .eq("is_default", true)
    .maybeSingle();
  if (error) throw error;
  return data as DriverPayoutMethod | null;
}

export async function upsertPayoutMethod(input: {
  driverId: string;
  pixKeyType: PixKeyType;
  pixKeyValue: string;
  legalName: string;
  documentType: "cpf" | "cnpj" | null;
  documentNumber: string;
}) {
  const normalizedKey = normalizePixValue(input.pixKeyType, input.pixKeyValue);
  const masked = maskPixKey(input.pixKeyType, input.pixKeyValue);
  const existing = await getMyPayoutMethod(input.driverId);
  const patch = {
    driver_id: input.driverId,
    pix_key_type: DB_PIX_KEY_TYPES[input.pixKeyType],
    pix_key_value: normalizedKey,
    pix_key_value_masked: masked,
    legal_name: input.legalName.trim() || null,
    document_type: input.documentType ? input.documentType.toUpperCase() : null,
    document_number: input.documentNumber ? onlyDigits(input.documentNumber) : null,
    is_default: true,
    status: "pending_review",
    reviewed_at: null,
    reviewed_by: null,
    rejection_reason: null,
  };

  if (existing) {
    const { error } = await supabase.from("driver_payout_methods").update(patch).eq("id", existing.id);
    if (error) throw error;
    return existing.id;
  }

  const { data, error } = await supabase
    .from("driver_payout_methods")
    .insert(patch)
    .select("id")
    .single();
  if (error) throw error;
  return String(data.id);
}

export async function listMyDriverPayouts(driverId: string): Promise<DriverPayout[]> {
  const { data, error } = await supabase
    .from("driver_payouts")
    .select(`
      id,
      reference_month,
      amount,
      status,
      paid_at,
      assignment:campaign_driver_assignments(
        id,
        campaign:campaigns(id, name),
        vehicle:vehicles(id, plate, model)
      )
    `)
    .eq("driver_id", driverId)
    .order("reference_month", { ascending: false });
  if (error) throw error;
  return (data ?? []) as unknown as DriverPayout[];
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

export type LocalUploadFile = {
  uri: string;
  name: string;
  type: string;
  ext: string;
};

async function uploadBlob(bucket: string, path: string, file: LocalUploadFile) {
  const response = await fetch(file.uri);
  const blob = await response.blob();
  const { error } = await supabase.storage.from(bucket).upload(path, blob, {
    upsert: true,
    contentType: file.type,
  });
  if (error) throw error;
}

function onlyDigits(value: string) {
  return value.replace(/\D+/g, "");
}

function normalizePixValue(type: PixKeyType, value: string) {
  return type === "cpf" || type === "cnpj" || type === "phone" ? onlyDigits(value) : value.trim();
}

export function validatePixKey(type: PixKeyType, value: string) {
  const v = value.trim();
  if (!v) return "Informe a chave Pix.";
  if (type === "cpf" && onlyDigits(v).length !== 11) return "CPF invalido.";
  if (type === "cnpj" && onlyDigits(v).length !== 14) return "CNPJ invalido.";
  if (type === "email" && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v)) return "E-mail invalido.";
  if (type === "phone" && onlyDigits(v).length < 10) return "Telefone invalido.";
  if (type === "random" && v.length < 8) return "Chave aleatoria invalida.";
  return null;
}

function maskPixKey(type: PixKeyType, value: string) {
  const v = value.trim();
  if (type === "cpf") {
    const d = onlyDigits(v).padStart(11, "0").slice(-11);
    return `***.${d.slice(3, 6)}.${d.slice(6, 9)}-**`;
  }
  if (type === "cnpj") {
    const d = onlyDigits(v).padStart(14, "0").slice(-14);
    return `**.${d.slice(2, 5)}.${d.slice(5, 8)}/${d.slice(8, 12)}-**`;
  }
  if (type === "email") {
    const [user, domain] = v.split("@");
    return domain ? `${user.slice(0, 1)}***${user.slice(-1)}@${domain}` : v;
  }
  if (type === "phone") return `+** (**) ****-${onlyDigits(v).slice(-4)}`;
  return `${v.slice(0, 4)}...${v.slice(-4)}`;
}

function functionError(error: unknown, data: unknown) {
  const fallback = error instanceof Error ? error.message : "Falha inesperada.";
  const message =
    typeof data === "object" && data && "message" in data ? String((data as { message?: string }).message) : fallback;
  return new Error(message);
}
