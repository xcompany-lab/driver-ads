import { supabase } from "@/integrations/supabase/client";

export type DriverDocKey = "cnh_front_url" | "cnh_back_url" | "selfie_doc_url" | "address_proof_url";

export const DRIVER_DOC_LABELS: Record<DriverDocKey, string> = {
  cnh_front_url: "CNH (frente)",
  cnh_back_url: "CNH (verso)",
  selfie_doc_url: "Selfie com documento",
  address_proof_url: "Comprovante de residência",
};

export const DRIVER_DOC_ORDER: DriverDocKey[] = [
  "cnh_front_url",
  "cnh_back_url",
  "selfie_doc_url",
  "address_proof_url",
];

const BUCKET = "driver-documents";

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
  const path = `${opts.userId}/${safeKey}-${Date.now()}.${ext(opts.file)}`;
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
    .update({ [key]: path } as never)
    .eq("id", driverId);
  if (error) throw error;
}

export async function updateVehicleCrlv(vehicleId: string, path: string) {
  const { error } = await supabase
    .from("vehicles")
    .update({ crlv_url: path } as never)
    .eq("id", vehicleId);
  if (error) throw error;
}

export async function getSignedDocUrl(path: string, ttl = 60 * 60): Promise<string | null> {
  if (!path) return null;
  const { data, error } = await supabase.storage.from(BUCKET).createSignedUrl(path, ttl);
  if (error) return null;
  return data.signedUrl;
}

export function missingDriverDocs(driver: Record<string, unknown>): DriverDocKey[] {
  return DRIVER_DOC_ORDER.filter((k) => !driver[k]);
}
