import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";

export type Assignment = Database["public"]["Tables"]["campaign_driver_assignments"]["Row"];
export type Proof = Database["public"]["Tables"]["installation_proofs"]["Row"];

export interface AssignmentWithRelations extends Assignment {
  campaign: { id: string; name: string; city: string; period_start: string; period_end: string } | null;
  vehicle: { id: string; plate: string; model: string } | null;
}

export const proofSchema = z.object({
  observation: z.string().trim().max(500, "Máx. 500 caracteres").optional().or(z.literal("")),
  geo_lat: z.number().min(-90).max(90).nullable().optional(),
  geo_lng: z.number().min(-180).max(180).nullable().optional(),
});

const MAX_FILE_BYTES = 8 * 1024 * 1024; // 8MB
const ALLOWED_TYPES = ["image/jpeg", "image/png", "image/webp"];

export function validatePhoto(file: File): string | null {
  if (!ALLOWED_TYPES.includes(file.type)) return "Envie uma imagem JPG, PNG ou WebP.";
  if (file.size > MAX_FILE_BYTES) return "A imagem deve ter no máximo 8MB.";
  return null;
}

export async function listMyAssignments(driverId: string): Promise<AssignmentWithRelations[]> {
  const { data, error } = await supabase
    .from("campaign_driver_assignments")
    .select(`
      *,
      campaign:campaigns(id, name, city, period_start, period_end),
      vehicle:vehicles(id, plate, model)
    `)
    .eq("driver_id", driverId)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data ?? []) as unknown as AssignmentWithRelations[];
}

export async function listProofsForAssignment(assignmentId: string): Promise<Proof[]> {
  const { data, error } = await supabase
    .from("installation_proofs")
    .select("*")
    .eq("assignment_id", assignmentId)
    .order("submitted_at", { ascending: false });
  if (error) throw error;
  return data ?? [];
}

export interface UploadProofInput {
  userId: string;
  assignmentId: string;
  file: File;
  observation?: string;
  geo?: { lat: number; lng: number } | null;
}

export async function uploadInstallationProof(input: UploadProofInput): Promise<Proof> {
  const photoErr = validatePhoto(input.file);
  if (photoErr) throw new Error(photoErr);

  const parsed = proofSchema.parse({
    observation: input.observation ?? "",
    geo_lat: input.geo?.lat ?? null,
    geo_lng: input.geo?.lng ?? null,
  });

  const ext = input.file.name.split(".").pop()?.toLowerCase() ?? "jpg";
  const path = `${input.userId}/${input.assignmentId}/${Date.now()}.${ext}`;

  const { error: upErr } = await supabase.storage
    .from("installation-proofs")
    .upload(path, input.file, { contentType: input.file.type, upsert: false });
  if (upErr) throw upErr;

  const { data, error } = await supabase
    .from("installation_proofs")
    .insert({
      assignment_id: input.assignmentId,
      photo_url: path,
      observation: parsed.observation || null,
      geo_lat: parsed.geo_lat ?? null,
      geo_lng: parsed.geo_lng ?? null,
    })
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function getProofSignedUrl(path: string, expiresIn = 60 * 10): Promise<string> {
  const { data, error } = await supabase.storage
    .from("installation-proofs")
    .createSignedUrl(path, expiresIn);
  if (error) throw error;
  return data.signedUrl;
}

export function getCurrentGeo(): Promise<{ lat: number; lng: number } | null> {
  return new Promise((resolve) => {
    if (typeof navigator === "undefined" || !navigator.geolocation) return resolve(null);
    navigator.geolocation.getCurrentPosition(
      (pos) => resolve({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
      () => resolve(null),
      { enableHighAccuracy: true, timeout: 8000 },
    );
  });
}
