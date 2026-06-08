import { supabase } from "@/integrations/supabase/client";

export type DriverDocKey = "cnh_front_url" | "selfie_doc_url" | "address_proof_url";
export type DriverDocStatusKey = "cnh_front_status" | "selfie_doc_status" | "address_proof_status";
export type DocReviewStatus = "pending" | "approved" | "rejected";

export const DRIVER_DOC_LABELS: Record<DriverDocKey, string> = {
  cnh_front_url: "CNH",
  selfie_doc_url: "Selfie com documento",
  address_proof_url: "Comprovante de residência",
};

export const DRIVER_DOC_STATUS_KEY: Record<DriverDocKey, DriverDocStatusKey> = {
  cnh_front_url: "cnh_front_status",
  selfie_doc_url: "selfie_doc_status",
  address_proof_url: "address_proof_status",
};

export const DRIVER_DOC_ORDER: DriverDocKey[] = [
  "cnh_front_url",
  "selfie_doc_url",
  "address_proof_url",
];

export async function setDriverDocStatus(driverId: string, statusKey: DriverDocStatusKey, status: DocReviewStatus) {
  const { error } = await supabase
    .from("drivers")
    .update({ [statusKey]: status } as never)
    .eq("id", driverId);
  if (error) throw error;
}

export async function setVehicleCrlvStatus(vehicleId: string, status: DocReviewStatus) {
  const { error } = await supabase
    .from("vehicles")
    .update({ crlv_status: status } as never)
    .eq("id", vehicleId);
  if (error) throw error;
}


const BUCKET = "installation-proofs";

function ext(file: File) {
  const m = file.name.match(/\.([^.]+)$/);
  return m ? m[1].toLowerCase() : "bin";
}

export async function uploadDriverDoc(opts: {
  userId: string;
  driverId: string;
  key: DriverDocKey | "crlv";
  file: File;
  vehicleId?: string;
}): Promise<string> {
  const safeKey = opts.key === "crlv" ? `vehicle-${opts.vehicleId}-crlv` : opts.key;
  const unique = typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : `${Date.now()}`;
  const path = `${opts.userId}/${safeKey}-${unique}.${ext(opts.file)}`;
  const { error } = await supabase.storage.from(BUCKET).upload(path, opts.file, {
    upsert: true,
    contentType: opts.file.type || undefined,
  });
  if (error) throw error;
  return path;
}

export async function updateDriverDoc(driverId: string, key: DriverDocKey, path: string) {
  const { error } = await supabase
    .from("drivers")
    .update({ [key]: path, [DRIVER_DOC_STATUS_KEY[key]]: "pending" } as never)
    .eq("id", driverId);
  if (error) throw error;
}

export async function updateVehicleCrlv(vehicleId: string, path: string) {
  const { error } = await supabase
    .from("vehicles")
    .update({ crlv_url: path, crlv_status: "pending" } as never)
    .eq("id", vehicleId);
  if (error) throw error;
}

export async function getSignedDocUrl(path: string, ttl = 60 * 60): Promise<string | null> {
  if (!path) return null;
  const { data, error } = await supabase.storage.from(BUCKET).createSignedUrl(path, ttl);
  if (error) {
    console.error("[getSignedDocUrl] failed", { path, error });
    return null;
  }
  return data.signedUrl;
}

export function missingDriverDocs(driver: Record<string, unknown>): DriverDocKey[] {
  return DRIVER_DOC_ORDER.filter((k) => !driver[k]);
}
