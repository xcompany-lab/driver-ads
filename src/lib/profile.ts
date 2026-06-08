import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";

export type Profile = Database["public"]["Tables"]["profiles"]["Row"];

const AVATAR_BUCKET = "avatars";

function ext(file: File) {
  const m = file.name.match(/\.([^.]+)$/);
  return m ? m[1].toLowerCase() : "jpg";
}

export async function getMyProfile(userId: string): Promise<Profile | null> {
  const { data, error } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", userId)
    .maybeSingle();
  if (error) throw error;
  return data;
}

export async function uploadAvatar(userId: string, file: File): Promise<string> {
  if (!file.type.startsWith("image/")) {
    throw new Error("Envie uma imagem para o avatar.");
  }
  if (file.size > 5 * 1024 * 1024) {
    throw new Error("A imagem deve ter no maximo 5MB.");
  }

  const unique = typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : `${Date.now()}`;
  const path = `${userId}/avatar-${unique}.${ext(file)}`;
  const { error } = await supabase.storage.from(AVATAR_BUCKET).upload(path, file, {
    upsert: true,
    contentType: file.type || undefined,
  });
  if (error) throw error;

  const { data } = supabase.storage.from(AVATAR_BUCKET).getPublicUrl(path);
  return data.publicUrl;
}

export async function updateMyAvatar(userId: string, avatarUrl: string) {
  const { error } = await supabase
    .from("profiles")
    .upsert({ id: userId, avatar_url: avatarUrl }, { onConflict: "id" });
  if (error) throw error;
}
