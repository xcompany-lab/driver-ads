import { supabase } from "@/integrations/supabase/client";

type SupabaseWithRpc = typeof supabase & {
  rpc: (fn: string, args?: Record<string, unknown>) => Promise<{ data: unknown; error: Error | null }>;
};

export interface ServiceCity {
  city_key: string;
  display_name: string;
  drivers: number;
}

/**
 * Cidades atendidas que emergem do volume de cadastros de motorista aprovado.
 * Usadas como sugestao (datalist) nos formularios — nao limitam o cadastro.
 */
export async function listServiceCities(): Promise<ServiceCity[]> {
  const { data, error } = await (supabase as SupabaseWithRpc).rpc("list_service_cities");
  if (error) throw error;
  return (data ?? []) as ServiceCity[];
}
