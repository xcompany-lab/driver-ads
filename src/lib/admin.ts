import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";

export type Advertiser = Database["public"]["Tables"]["advertisers"]["Row"];
export type Driver = Database["public"]["Tables"]["drivers"]["Row"];
export type Vehicle = Database["public"]["Tables"]["vehicles"]["Row"];
export type Campaign = Database["public"]["Tables"]["campaigns"]["Row"];

export type AdvertiserStatus = Database["public"]["Enums"]["advertiser_status"];
export type DriverStatus = Database["public"]["Enums"]["driver_status"];
export type VehicleStatus = Database["public"]["Enums"]["vehicle_status"];
export type CampaignStatus = Database["public"]["Enums"]["campaign_status"];

export interface AdminKPIs {
  advertisers: { total: number; pending: number; approved: number };
  drivers: { total: number; pending: number; approved: number };
  vehicles: { total: number; pending: number; approved: number };
  campaigns: { total: number; pendingReview: number; active: number };
  proofsPending: number;
}

export async function getAdminKPIs(): Promise<AdminKPIs> {
  const [adv, drv, veh, cmp, prf] = await Promise.all([
    supabase.from("advertisers").select("status"),
    supabase.from("drivers").select("status"),
    supabase.from("vehicles").select("status"),
    supabase.from("campaigns").select("status"),
    supabase.from("installation_proofs").select("status").eq("status", "pending_review"),
  ]);

  const count = <T extends { status: string }>(rows: T[] | null | undefined, s: string) =>
    (rows ?? []).filter((r) => r.status === s).length;

  return {
    advertisers: {
      total: adv.data?.length ?? 0,
      pending: count(adv.data, "pending_review"),
      approved: count(adv.data, "approved"),
    },
    drivers: {
      total: drv.data?.length ?? 0,
      pending: count(drv.data, "pending_review"),
      approved: count(drv.data, "approved"),
    },
    vehicles: {
      total: veh.data?.length ?? 0,
      pending: count(veh.data, "pending_review"),
      approved: count(veh.data, "approved"),
    },
    campaigns: {
      total: cmp.data?.length ?? 0,
      pendingReview: count(cmp.data, "pending_review"),
      active: count(cmp.data, "active"),
    },
    proofsPending: prf.data?.length ?? 0,
  };
}

export async function listAdvertisers(search?: string): Promise<Advertiser[]> {
  let q = supabase.from("advertisers").select("*").order("created_at", { ascending: false });
  if (search && search.trim()) {
    const s = `%${search.trim()}%`;
    q = q.or(`company_name.ilike.${s},cnpj.ilike.${s},email.ilike.${s},city.ilike.${s}`);
  }
  const { data, error } = await q;
  if (error) throw error;
  return data ?? [];
}

export async function updateAdvertiserStatus(id: string, status: AdvertiserStatus) {
  const { error } = await supabase.from("advertisers").update({ status }).eq("id", id);
  if (error) throw error;
}

export async function listDrivers(search?: string): Promise<Driver[]> {
  let q = supabase.from("drivers").select("*").order("created_at", { ascending: false });
  if (search && search.trim()) {
    const s = `%${search.trim()}%`;
    q = q.or(`full_name.ilike.${s},cpf.ilike.${s},email.ilike.${s},phone.ilike.${s},city.ilike.${s}`);
  }
  const { data, error } = await q;
  if (error) throw error;
  return data ?? [];
}

export async function updateDriverStatus(id: string, status: DriverStatus) {
  const { error } = await supabase.from("drivers").update({ status }).eq("id", id);
  if (error) throw error;
}

export async function listVehicles(search?: string): Promise<(Vehicle & { driver?: { full_name: string; city: string } | null })[]> {
  let q = supabase
    .from("vehicles")
    .select("*, driver:drivers(full_name, city)")
    .order("created_at", { ascending: false });
  if (search && search.trim()) {
    const s = `%${search.trim()}%`;
    q = q.or(`plate.ilike.${s},model.ilike.${s},brand.ilike.${s}`);
  }
  const { data, error } = await q;
  if (error) throw error;
  return (data ?? []) as (Vehicle & { driver?: { full_name: string; city: string } | null })[];
}

export async function updateVehicleStatus(id: string, status: VehicleStatus) {
  const { error } = await supabase.from("vehicles").update({ status }).eq("id", id);
  if (error) throw error;
}
