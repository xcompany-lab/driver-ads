import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { BarChart3, Clock, Route as RouteIcon, Trophy } from "lucide-react";

import { CampaignAnalyticsPanel } from "@/components/campaigns/CampaignAnalyticsPanel";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { supabase } from "@/integrations/supabase/client";
import { formatDistance, formatDuration, getAdminDriverRankings } from "@/lib/campaign-analytics";

export const Route = createFileRoute("/_authenticated/admin/analytics")({
  component: AdminAnalyticsPage,
});

type CampaignOption = {
  id: string;
  name: string;
  city: string;
  status: string;
};

function AdminAnalyticsPage() {
  const [campaignId, setCampaignId] = useState<string>("");
  const { data: campaigns, isLoading: loadingCampaigns } = useQuery({
    queryKey: ["admin-analytics-campaigns"],
    queryFn: listCampaigns,
  });
  const { data: rankings, isLoading: loadingRankings } = useQuery({
    queryKey: ["admin-driver-rankings"],
    queryFn: () => getAdminDriverRankings(20),
  });

  const options = useMemo(() => campaigns ?? [], [campaigns]);

  useEffect(() => {
    if (!campaignId && options[0]) setCampaignId(options[0].id);
  }, [campaignId, options]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Analytics</h1>
        <p className="mt-1 text-muted-foreground">
          Leitura agregada de QR Codes e rastreamento operacional dos motoristas.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="inline-flex items-center gap-2 text-base">
            <BarChart3 className="h-4 w-4 text-primary" /> Campanha
          </CardTitle>
          <CardDescription>Selecione uma campanha para ver scans, origem aproximada e circulacao.</CardDescription>
        </CardHeader>
        <CardContent>
          {loadingCampaigns ? (
            <Skeleton className="h-10 max-w-md" />
          ) : (
            <Select value={campaignId} onValueChange={setCampaignId}>
              <SelectTrigger className="max-w-md">
                <SelectValue placeholder="Selecione a campanha" />
              </SelectTrigger>
              <SelectContent>
                {options.map((campaign) => (
                  <SelectItem key={campaign.id} value={campaign.id}>
                    {campaign.name} · {campaign.city} · {campaign.status}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        </CardContent>
      </Card>

      {campaignId && <CampaignAnalyticsPanel campaignId={campaignId} />}

      <Card>
        <CardHeader>
          <CardTitle className="inline-flex items-center gap-2 text-base">
            <Trophy className="h-4 w-4 text-primary" /> Ranking de motoristas
          </CardTitle>
          <CardDescription>Ranking interno por km agregado, tempo ativo e campanhas atendidas.</CardDescription>
        </CardHeader>
        <CardContent>
          {loadingRankings ? (
            <Skeleton className="h-40" />
          ) : !rankings || rankings.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nenhum dado de rastreamento registrado ainda.</p>
          ) : (
            <div className="space-y-3">
              {rankings.map((driver, index) => (
                <div key={driver.driver_id} className="grid gap-3 rounded-md border p-3 sm:grid-cols-[40px_1fr_auto_auto] sm:items-center">
                  <div className="flex h-9 w-9 items-center justify-center rounded-full bg-primary/10 font-bold text-primary">
                    {index + 1}
                  </div>
                  <div className="min-w-0">
                    <p className="font-semibold">{driver.full_name}</p>
                    <p className="text-sm text-muted-foreground">
                      {driver.city ?? "Sem cidade"} · {driver.campaigns_count} campanha(s)
                    </p>
                  </div>
                  <span className="inline-flex items-center gap-2 text-sm font-medium">
                    <RouteIcon className="h-4 w-4 text-primary" /> {formatDistance(driver.distance_m)}
                  </span>
                  <span className="inline-flex items-center gap-2 text-sm font-medium">
                    <Clock className="h-4 w-4 text-primary" /> {formatDuration(driver.driving_seconds)}
                  </span>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

async function listCampaigns(): Promise<CampaignOption[]> {
  const { data, error } = await supabase
    .from("campaigns")
    .select("id,name,city,status")
    .order("created_at", { ascending: false })
    .limit(100);
  if (error) throw error;
  return (data ?? []) as CampaignOption[];
}
