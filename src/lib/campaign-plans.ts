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

export function formatPlanPrice(plan: Pick<CampaignPlan, "monthly_price_cents" | "currency">) {
  return (plan.monthly_price_cents / 100).toLocaleString("pt-BR", {
    style: "currency",
    currency: plan.currency || "BRL",
  });
}
