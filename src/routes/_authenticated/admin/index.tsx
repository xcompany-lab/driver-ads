import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Building2, Users, Car, Megaphone, ClipboardCheck, ArrowRight } from "lucide-react";
import { getAdminKPIs } from "@/lib/admin";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

export const Route = createFileRoute("/_authenticated/admin/")({
  component: AdminDashboard,
});

function AdminDashboard() {
  const { data: kpis, isLoading } = useQuery({ queryKey: ["admin", "kpis"], queryFn: getAdminKPIs });

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Visão geral</h1>
        <p className="mt-1 text-muted-foreground">Indicadores operacionais e itens que precisam da sua atenção.</p>
      </div>

      {isLoading || !kpis ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-32 rounded-xl" />)}
        </div>
      ) : (
        <>
          <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <KpiCard
              to="/admin/anunciantes"
              icon={Building2}
              title="Anunciantes"
              total={kpis.advertisers.total}
              pending={kpis.advertisers.pending}
              approved={kpis.advertisers.approved}
            />
            <KpiCard
              to="/admin/motoristas"
              icon={Users}
              title="Motoristas"
              total={kpis.drivers.total}
              pending={kpis.drivers.pending}
              approved={kpis.drivers.approved}
            />
            <KpiCard
              to="/admin/veiculos"
              icon={Car}
              title="Veículos"
              total={kpis.vehicles.total}
              pending={kpis.vehicles.pending}
              approved={kpis.vehicles.approved}
            />
            <Link to="/admin/campanhas" className="block group">
              <Card className="transition hover:border-primary/40 hover:shadow-brand">
                <CardHeader className="flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Campanhas</CardTitle>
                  <Megaphone className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-3xl font-bold">{kpis.campaigns.total}</div>
                  <p className="text-xs text-muted-foreground mt-1">
                    {kpis.campaigns.pendingReview} aguardando análise · {kpis.campaigns.active} ativas
                  </p>
                  <p className="mt-3 inline-flex items-center text-xs font-medium text-primary opacity-0 group-hover:opacity-100 transition">
                    Gerenciar <ArrowRight className="ml-1 h-3 w-3" />
                  </p>
                </CardContent>
              </Card>
            </Link>
          </section>

          <section className="grid gap-4 md:grid-cols-2">
            <Card className="border-warning/40 bg-warning/5">
              <CardHeader>
                <div className="flex items-center gap-2">
                  <ClipboardCheck className="h-5 w-5 text-warning-foreground" />
                  <CardTitle className="text-base">Comprovações pendentes</CardTitle>
                </div>
                <CardDescription>Fotos de instalação aguardando revisão.</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold">{kpis.proofsPending}</div>
                <p className="text-xs text-muted-foreground mt-2">Fila de aprovação será habilitada na Fase 12.</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-base">Próximas fases</CardTitle>
                <CardDescription>Roadmap operacional</CardDescription>
              </CardHeader>
              <CardContent className="space-y-1 text-sm text-muted-foreground">
                <p>Fase 11 — Gestão de campanhas e vínculos manuais.</p>
                <p>Fase 12 — Fila de comprovações de instalação.</p>
                <p>Fase 13 — Pagamentos e repasses.</p>
              </CardContent>
            </Card>
          </section>
        </>
      )}
    </div>
  );
}

function KpiCard({
  to, icon: Icon, title, total, pending, approved,
}: {
  to: "/admin/anunciantes" | "/admin/motoristas" | "/admin/veiculos";
  icon: typeof Building2;
  title: string;
  total: number;
  pending: number;
  approved: number;
}) {
  return (
    <Link to={to} className="block group">
      <Card className="transition hover:border-primary/40 hover:shadow-brand">
        <CardHeader className="flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">{title}</CardTitle>
          <Icon className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-3xl font-bold">{total}</div>
          <p className="text-xs text-muted-foreground mt-1">
            {pending} em análise · {approved} aprovados
          </p>
          <p className="mt-3 inline-flex items-center text-xs font-medium text-primary opacity-0 group-hover:opacity-100 transition">
            Gerenciar <ArrowRight className="ml-1 h-3 w-3" />
          </p>
        </CardContent>
      </Card>
    </Link>
  );
}
