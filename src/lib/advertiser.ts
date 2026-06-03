import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";

export type Advertiser = Database["public"]["Tables"]["advertisers"]["Row"];
export type AdvertiserUpdate = Database["public"]["Tables"]["advertisers"]["Update"];

export async function getMyAdvertiser(userId: string): Promise<Advertiser | null> {
  const { data, error } = await supabase
    .from("advertisers")
    .select("*")
    .eq("user_id", userId)
    .maybeSingle();
  if (error) throw error;
  return data;
}

export async function updateMyAdvertiser(id: string, patch: AdvertiserUpdate) {
  const { data, error } = await supabase
    .from("advertisers")
    .update(patch)
    .eq("id", id)
    .select()
    .single();
  if (error) throw error;
  return data;
}
