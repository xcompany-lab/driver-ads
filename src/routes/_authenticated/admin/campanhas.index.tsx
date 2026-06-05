import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Search, ArrowRight, Calendar, MapPin } from "lucide-react";
import { listCampaignsAdmin, type CampaignStatus } from "@/lib/campaigns-admin";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { StatusBadge } from "@/components/brand/StatusBadge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

export const Route = createFileRoute("/_authenticated/admin/campanhas/")({
  component: CampaignsAdmin,
});

const STATUS_OPTIONS: { value: CampaignStatus | "all"; label: string }[] = [
  { value: "all", label: "Todos os status" },
  { value: "pending_review", label: "Em análise" },
  { value: "approved", label: "Aprovadas" },
  { value: "active", label: "Ativas" },
  { value: "paused", label: "Pausadas" },
  { value: "rejected", label: "Reprovadas" },
  { value: "completed", label: "Encerradas" },
  { value: "cancelled", label: "Canceladas" },
  { value: "draft", label: "Rascunho" },
];

function fmt(d: string) {
  return new Date(d).toLocaleDateString("pt-BR");
}

function CampaignsAdmin() {
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<CampaignStatus | "all">("all");

  const { data, isLoading } = useQuery({
    queryKey: ["admin", "campaigns", search, status],
    queryFn: () => listCampaignsAdmin({ search, status }),
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Campanhas</h1>
        <p className="mt-1 text-muted-foreground">Aprove, monitore e vincule motoristas às campanhas.</p>
      </div>

      <div className="flex flex-col gap-3 sm:flex-row">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar por nome ou cidade…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        <Select value={status} onValueChange={(v) => setStatus(v as CampaignStatus | "all")}>
          <SelectTrigger className="sm:w-56"><SelectValue /></SelectTrigger>
          <SelectContent>
            {STATUS_OPTIONS.map((o) => (
              <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {isLoading ? (
        <div className="space-y-3">{Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-28 rounded-xl" />)}</div>
      ) : !data?.length ? (
        <Card><CardContent className="py-12 text-center text-muted-foreground">Nenhuma campanha encontrada.</CardContent></Card>
      ) : (
        <div className="space-y-3">
          {data.map((c) => (
            <Link
              key={c.id}
              to="/admin/campanhas/$id"
              params={{ id: c.id }}
              className="block group"
            >
              <Card className="transition hover:border-primary/40 hover:shadow-brand">
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <CardTitle className="text-base truncate">{c.name}</CardTitle>
                      <CardDescription className="truncate">
                        {c.advertiser?.company_name ?? "—"}
                      </CardDescription>
                    </div>
                    <StatusBadge status={c.status} />
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="grid gap-2 text-sm text-muted-foreground sm:grid-cols-3">
                    <span className="inline-flex items-center gap-1.5"><MapPin className="h-3.5 w-3.5" />{c.city}</span>
                    <span className="inline-flex items-center gap-1.5"><Calendar className="h-3.5 w-3.5" />{fmt(c.period_start)} → {fmt(c.period_end)}</span>
                    <span>{c.vehicles_qty} veículo(s) · R$ {Number(c.plan_value).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</span>
                  </div>
                  <p className="mt-3 inline-flex items-center text-xs font-medium text-primary opacity-0 group-hover:opacity-100 transition">
                    Gerenciar <ArrowRight className="ml-1 h-3 w-3" />
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
