import { supabase } from "@/integrations/supabase/client";

type SupabaseWithRpc = typeof supabase & {
  rpc: (fn: string, args?: Record<string, unknown>) => Promise<{ data: unknown; error: Error | null }>;
};

export interface CampaignCheckoutLink {
  token: string;
  campaign_id: string;
  advertiser_id: string;
  expires_at: string | null;
}

export async function ensureCampaignCheckoutLink(campaignId: string): Promise<CampaignCheckoutLink> {
  const { data, error } = await (supabase as SupabaseWithRpc).rpc("ensure_campaign_checkout_link", {
    _campaign_id: campaignId,
  });
  if (error) throw error;
  const rows = (Array.isArray(data) ? data : []) as CampaignCheckoutLink[];
  const row = rows[0];
  if (!row?.token) throw new Error("Nao foi possivel gerar o link de checkout.");
  return row;
}
