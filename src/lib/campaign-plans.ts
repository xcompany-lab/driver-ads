import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";

export type CampaignPlan = Database["public"]["Tables"]["campaign_plans"]["Row"];

export async function listActiveCampaignPlans(): Promise<CampaignPlan[]> {
  const { data, error } = await supabase
    .from("campaign_plans")
    .select("*")
    .eq("is_active", true)
    .order("monthly_price_cents", { ascending: true });
  if (error) throw error;
  return data ?? [];
}

export async function getCampaignPlanById(id: string): Promise<CampaignPlan | null> {
  const { data, error } = await supabase
    .from("campaign_plans")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (error) throw error;
  return data;
}

/** Extrai a categoria de veículo do plano (metadata.vehicle_tier). Default 'standard'. */
export function planVehicleTier(plan: Pick<CampaignPlan, "metadata"> | null | undefined): string {
  return (plan?.metadata as { vehicle_tier?: string } | null)?.vehicle_tier ?? "standard";
}

export function formatPlanPrice(plan: Pick<CampaignPlan, "monthly_price_cents" | "currency">) {
  return (plan.monthly_price_cents / 100).toLocaleString("pt-BR", {
    style: "currency",
    currency: plan.currency || "BRL",
  });
}
