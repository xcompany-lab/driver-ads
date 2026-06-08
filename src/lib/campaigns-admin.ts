import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";

export type Campaign = Database["public"]["Tables"]["campaigns"]["Row"];
export type CampaignStatus = Database["public"]["Enums"]["campaign_status"];
export type Assignment = Database["public"]["Tables"]["campaign_driver_assignments"]["Row"];
export type AssignmentStatus = Database["public"]["Enums"]["assignment_status"];

type SupabaseWithRpc = typeof supabase & {
  rpc: (fn: string, args?: Record<string, unknown>) => Promise<{ data: unknown; error: Error | null }>;
};

export interface CampaignWithAdvertiser extends Campaign {
  advertiser?: { company_name: string; city: string } | null;
}

export interface AssignmentDetailed extends Assignment {
  driver?: { id: string; full_name: string; city: string; phone: string } | null;
  vehicle?: { id: string; plate: string; model: string; brand: string | null } | null;
}

export async function listCampaignsAdmin(opts: { search?: string; status?: CampaignStatus | "all" } = {}) {
  let q = supabase
    .from("campaigns")
    .select("*, advertiser:advertisers(company_name, city)")
    .order("created_at", { ascending: false });
  if (opts.status && opts.status !== "all") q = q.eq("status", opts.status);
  if (opts.search && opts.search.trim()) {
    const s = `%${opts.search.trim()}%`;
    q = q.or(`name.ilike.${s},city.ilike.${s}`);
  }
  const { data, error } = await q;
  if (error) throw error;
  return (data ?? []) as CampaignWithAdvertiser[];
}

export async function getCampaignAdmin(id: string) {
  const { data, error } = await supabase
    .from("campaigns")
    .select("*, advertiser:advertisers(company_name, city, responsible, email, phone)")
    .eq("id", id)
    .single();
  if (error) throw error;
  return data;
}

export async function updateCampaignStatus(id: string, status: CampaignStatus) {
  if (status === "active") {
    const { count, error: countError } = await supabase
      .from("campaign_driver_assignments")
      .select("id", { count: "exact", head: true })
      .eq("campaign_id", id)
      .in("status", ["accepted", "awaiting_installation", "active"]);
    if (countError) throw countError;
    if (!count) {
      throw new Error("Vincule um motorista e aguarde o aceite antes de iniciar a campanha.");
    }
  }

  const patch: Partial<Campaign> = { status };
  if (status === "approved") {
    const { data: userData } = await supabase.auth.getUser();
    patch.approved_at = new Date().toISOString();
    patch.approved_by = userData.user?.id ?? null;
  }
  const { error } = await supabase.from("campaigns").update(patch).eq("id", id);
  if (error) throw error;
}

export async function listAssignmentsForCampaign(campaignId: string): Promise<AssignmentDetailed[]> {
  const { data, error } = await supabase
    .from("campaign_driver_assignments")
    .select("*, driver:drivers(id, full_name, city, phone), vehicle:vehicles(id, plate, model, brand)")
    .eq("campaign_id", campaignId)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data ?? []) as AssignmentDetailed[];
}

export async function listEligibleDriversForCampaign(campaignId: string) {
  const { data, error } = await (supabase as SupabaseWithRpc).rpc("list_eligible_drivers_for_campaign", {
    _campaign_id: campaignId,
  });
  if (error) throw error;
  type Row = {
    id: string;
    full_name: string;
    city: string;
    regions: string[];
    phone: string;
    vehicles: {
      id: string;
      plate: string;
      model: string;
      brand: string | null;
      status: string;
      crlv_status: string | null;
    }[];
  };
  return ((data ?? []) as Row[]).filter((d) => d.vehicles.length > 0);
}

export async function createAssignment(input: {
  campaignId: string;
  driverId: string;
  vehicleId: string;
  monthlyPayout: number;
  notes?: string;
}) {
  const { data: userData } = await supabase.auth.getUser();
  const { error } = await supabase.from("campaign_driver_assignments").insert({
    campaign_id: input.campaignId,
    driver_id: input.driverId,
    vehicle_id: input.vehicleId,
    monthly_payout: input.monthlyPayout,
    notes: input.notes ?? null,
    assigned_by: userData.user?.id ?? null,
    status: "invited",
  });
  if (error) throw error;
}

export async function updateAssignmentStatusAdmin(id: string, status: AssignmentStatus) {
  const { error } = await supabase
    .from("campaign_driver_assignments")
    .update({ status })
    .eq("id", id);
  if (error) throw error;
}

export async function deleteAssignment(id: string) {
  const { error } = await supabase.from("campaign_driver_assignments").delete().eq("id", id);
  if (error) throw error;
}
