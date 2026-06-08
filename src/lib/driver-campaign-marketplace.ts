import { supabase } from "@/integrations/supabase/client";

export interface AvailableDriverCampaign {
  id: string;
  name: string;
  city: string;
  period_start: string;
  period_end: string;
  description: string | null;
  art_url: string | null;
  plan_value: number;
  monthly_payout: number;
  available_slots: number;
}

type SupabaseWithRpc = typeof supabase & {
  rpc: (fn: string, args?: Record<string, unknown>) => Promise<{ data: unknown; error: Error | null }>;
};

export async function listAvailableCampaignsForDriver(driverId: string): Promise<AvailableDriverCampaign[]> {
  const { data, error } = await (supabase as SupabaseWithRpc).rpc("list_available_campaigns_for_driver", {
    _driver_id: driverId,
  });
  if (error) throw error;
  return (data ?? []) as AvailableDriverCampaign[];
}

export async function applyToAvailableCampaign(input: {
  campaignId: string;
  driverId: string;
  vehicleId: string;
}) {
  const { error } = await (supabase as SupabaseWithRpc).rpc("apply_driver_to_campaign", {
    _campaign_id: input.campaignId,
    _driver_id: input.driverId,
    _vehicle_id: input.vehicleId,
  });
  if (error) throw error;
}
