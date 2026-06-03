import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";

export type Driver = Database["public"]["Tables"]["drivers"]["Row"];
export type DriverInsert = Database["public"]["Tables"]["drivers"]["Insert"];
export type DriverUpdate = Database["public"]["Tables"]["drivers"]["Update"];
export type Vehicle = Database["public"]["Tables"]["vehicles"]["Row"];
export type VehicleInsert = Database["public"]["Tables"]["vehicles"]["Insert"];
export type VehicleUpdate = Database["public"]["Tables"]["vehicles"]["Update"];

export async function getMyDriver(userId: string): Promise<Driver | null> {
  const { data, error } = await supabase
    .from("drivers")
    .select("*")
    .eq("user_id", userId)
    .maybeSingle();
  if (error) throw error;
  return data;
}

export async function createMyDriver(payload: DriverInsert) {
  const { data, error } = await supabase
    .from("drivers")
    .insert(payload)
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function updateMyDriver(id: string, patch: DriverUpdate) {
  const { data, error } = await supabase
    .from("drivers")
    .update(patch)
    .eq("id", id)
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function listMyVehicles(driverId: string): Promise<Vehicle[]> {
  const { data, error } = await supabase
    .from("vehicles")
    .select("*")
    .eq("driver_id", driverId)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return data ?? [];
}

export async function createVehicle(payload: VehicleInsert) {
  const { data, error } = await supabase
    .from("vehicles")
    .insert(payload)
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function updateVehicle(id: string, patch: VehicleUpdate) {
  const { data, error } = await supabase
    .from("vehicles")
    .update(patch)
    .eq("id", id)
    .select()
    .single();
  if (error) throw error;
  return data;
}
