import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Plus, Calendar, MapPin, ArrowRight, Megaphone } from "lucide-react";
import { useSession } from "@/hooks/useSession";
import { getMyAdvertiser } from "@/lib/advertiser";
import { listMyCampaigns } from "@/lib/campaigns";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { StatusBadge } from "@/components/brand/StatusBadge";

export const Route = createFileRoute("/_authenticated/anunciante/campanhas")({
  component: AdvertiserCampaignsPage,
});

function fmt(d: string) {
  return new Date(d).toLocaleDateString("pt-BR");
}

function AdvertiserCampaignsPage() {
  const { user } = useSession();
  const { data: advertiser } = useQuery({
    queryKey: ["my-advertiser", user?.id],
    queryFn: () => getMyAdvertiser(user!.id),
    enabled: !!user,
  });

  const { data: campaigns, isLoading } = useQuery({
    queryKey: ["my-campaigns", advertiser?.id],
    queryFn: () => listMyCampaigns(advertiser!.id),
    enabled: !!advertiser?.id,
  });

  const canCreate = advertiser?.status === "approved" || advertiser?.status === "active";

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="font-display text-3xl font-bold tracking-tight">Minhas campanhas</h1>
          <p className="mt-1 text-muted-foreground">
            Solicite, acompanhe e gerencie suas campanhas publicitárias.
          </p>
        </div>
        {canCreate && (
          <Button asChild variant="hero">
            <Link to="/anunciante/campanhas/nova">
              <Plus className="mr-2 h-4 w-4" /> Nova campanha
            </Link>
          </Button>
        )}
      </div>

      {!canCreate && (
        <Card className="border-warning/40 bg-warning/5">
          <CardHeader>
            <CardTitle className="text-base">Cadastro pendente</CardTitle>
            <CardDescription>
              Você poderá criar campanhas assim que seu cadastro de empresa for aprovado.
            </CardDescription>
          </CardHeader>
        </Card>
      )}

      {isLoading ? (
        <div className="space-y-3">
          {Array.from({ length: 2 }).map((_, i) => (
            <Skeleton key={i} className="h-28 rounded-xl" />
          ))}
        </div>
      ) : !campaigns?.length ? (
        <Card>
          <CardContent className="flex flex-col items-center gap-3 py-16 text-center">
            <Megaphone className="h-10 w-10 text-muted-foreground" />
            <div>
              <p className="font-medium">Nenhuma campanha ainda</p>
              <p className="text-sm text-muted-foreground">
                Crie sua primeira campanha para começar a divulgar sua marca.
              </p>
            </div>
            {canCreate && (
              <Button asChild variant="hero" className="mt-2">
                <Link to="/anunciante/campanhas/nova">
                  <Plus className="mr-2 h-4 w-4" /> Criar campanha
                </Link>
              </Button>
            )}
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {campaigns.map((c) => (
            <Link
              key={c.id}
              to="/anunciante/campanhas/$id"
              params={{ id: c.id }}
              className="block group"
            >
              <Card className="transition hover:border-primary/40 hover:shadow-brand">
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <CardTitle className="text-base truncate">{c.name}</CardTitle>
                      <CardDescription className="truncate">
                        {c.vehicles_qty} veículo(s) · R${" "}
                        {Number(c.plan_value).toLocaleString("pt-BR", {
                          minimumFractionDigits: 2,
                        })}
                      </CardDescription>
                    </div>
                    <StatusBadge status={c.status} />
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="grid gap-2 text-sm text-muted-foreground sm:grid-cols-2">
                    <span className="inline-flex items-center gap-1.5">
                      <MapPin className="h-3.5 w-3.5" />
                      {c.city}
                    </span>
                    <span className="inline-flex items-center gap-1.5">
                      <Calendar className="h-3.5 w-3.5" />
                      {fmt(c.period_start)} → {fmt(c.period_end)}
                    </span>
                  </div>
                  <p className="mt-3 inline-flex items-center text-xs font-medium text-primary opacity-0 group-hover:opacity-100 transition">
                    Ver detalhes <ArrowRight className="ml-1 h-3 w-3" />
                  </p>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
