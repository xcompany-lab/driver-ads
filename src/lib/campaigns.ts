import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";

export type Campaign = Database["public"]["Tables"]["campaigns"]["Row"];
export type CampaignInsert = Database["public"]["Tables"]["campaigns"]["Insert"];
export type CampaignUpdate = Database["public"]["Tables"]["campaigns"]["Update"];
export type CampaignStatus = Database["public"]["Enums"]["campaign_status"];

const ART_BUCKET = "campaign-arts";

function ext(file: File) {
  const m = file.name.match(/\.([^.]+)$/);
  return m ? m[1].toLowerCase() : "bin";
}

export async function listMyCampaigns(advertiserId: string) {
  const { data, error } = await supabase
    .from("campaigns")
    .select("*")
    .eq("advertiser_id", advertiserId)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return data ?? [];
}

export async function getMyCampaign(id: string) {
  const { data, error } = await supabase
    .from("campaigns")
    .select("*")
    .eq("id", id)
    .single();
  if (error) throw error;
  return data;
}

export async function createMyCampaign(payload: CampaignInsert) {
  const { data: userData } = await supabase.auth.getUser();
  const { data, error } = await supabase
    .from("campaigns")
    .insert({ ...payload, created_by: userData.user?.id ?? null })
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function updateMyCampaign(id: string, patch: CampaignUpdate) {
  const { data, error } = await supabase
    .from("campaigns")
    .update(patch)
    .eq("id", id)
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function uploadCampaignArt(advertiserId: string, file: File): Promise<string> {
  const unique =
    typeof crypto !== "undefined" && "randomUUID" in crypto
      ? crypto.randomUUID()
      : `${Date.now()}`;
  const path = `${advertiserId}/${unique}.${ext(file)}`;
  const { error } = await supabase.storage.from(ART_BUCKET).upload(path, file, {
    upsert: true,
    contentType: file.type || undefined,
  });
  if (error) throw error;
  return path;
}

export async function getCampaignArtUrl(path: string): Promise<string | null> {
  if (!path) return null;
  // Already an absolute URL (legacy)
  if (path.startsWith("http")) return path;
  const { data, error } = await supabase.storage
    .from(ART_BUCKET)
    .createSignedUrl(path, 60 * 60);
  if (error) return null;
  return data?.signedUrl ?? null;
}
