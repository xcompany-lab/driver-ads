import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Car, UserCircle, ClipboardCheck, Wallet, AlertTriangle, CheckCircle2 } from "lucide-react";
import { useSession } from "@/hooks/useSession";
import { getMyDriver, listMyVehicles } from "@/lib/driver";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/brand/StatusBadge";
import type { Database } from "@/integrations/supabase/types";

export const Route = createFileRoute("/_authenticated/motorista/")({
  component: DriverHome,
});

type DriverStatus = Database["public"]["Enums"]["driver_status"];

function StatusPanel({ status }: { status: DriverStatus }) {
  const map: Record<DriverStatus, { title: string; desc: string; tone: "warning" | "success" | "destructive" | "muted" }> = {
    pending_review: { title: "Cadastro em análise", desc: "Nosso time está revisando seus dados. Avisaremos por e-mail quando estiver aprovado.", tone: "warning" },
    approved: { title: "Cadastro aprovado", desc: "Você já pode receber convites de campanhas compatíveis com seu perfil.", tone: "success" },
    rejected: { title: "Cadastro rejeitado", desc: "Revise seus dados ou entre em contato com o suporte.", tone: "destructive" },
    suspended: { title: "Conta suspensa", desc: "Entre em contato com o suporte para regularizar.", tone: "destructive" },
    inactive: { title: "Conta inativa", desc: "Reative seu cadastro para voltar a receber convites.", tone: "muted" },
  };
  const s = map[status];
  const Icon = s.tone === "success" ? CheckCircle2 : AlertTriangle;
  const cls =
    s.tone === "success" ? "border-green-500/40 bg-green-500/5" :
    s.tone === "destructive" ? "border-destructive/40 bg-destructive/5" :
    s.tone === "warning" ? "border-amber-500/40 bg-amber-500/5" :
    "border-border bg-muted/30";
  return (
    <Card className={cls}>
      <CardHeader className="flex-row items-start gap-3 space-y-0">
        <Icon className="h-5 w-5 mt-0.5" />
        <div className="flex-1">
          <CardTitle className="text-base">{s.title}</CardTitle>
          <CardDescription>{s.desc}</CardDescription>
        </div>
        <StatusBadge status={status} />
      </CardHeader>
    </Card>
  );
}

function DashCard({ to, icon: Icon, title, desc, disabled }: { to: string; icon: typeof Car; title: string; desc: string; disabled?: boolean }) {
  const content = (
    <Card className={`h-full transition-colors ${disabled ? "opacity-50" : "hover:border-primary"}`}>
      <CardHeader>
        <Icon className="h-6 w-6 text-primary" />
        <CardTitle className="text-base">{title}</CardTitle>
        <CardDescription>{desc}</CardDescription>
      </CardHeader>
    </Card>
  );
  if (disabled) return content;
  return <Link to={to}>{content}</Link>;
}

function DriverHome() {
  const { user } = useSession();
  const { data: driver, isLoading } = useQuery({
    queryKey: ["my-driver", user?.id],
    queryFn: () => getMyDriver(user!.id),
    enabled: !!user,
  });
  const { data: vehicles } = useQuery({
    queryKey: ["my-vehicles", driver?.id],
    queryFn: () => listMyVehicles(driver!.id),
    enabled: !!driver,
  });

  if (isLoading) return <p className="text-muted-foreground">Carregando...</p>;

  if (!driver) {
    return (
      <div className="mx-auto max-w-2xl">
        <Card>
          <CardHeader>
            <CardTitle>Bem-vindo ao Portal do Motorista</CardTitle>
            <CardDescription>
              Para começar a receber convites de campanhas, complete seu cadastro com seus dados pessoais, cidade de atuação e chave PIX.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button asChild variant="hero">
              <Link to="/motorista/perfil">Completar cadastro</Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const canAct = driver.status === "approved";
  const hasVehicle = (vehicles?.length ?? 0) > 0;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Olá, {driver.full_name.split(" ")[0]}</h1>
        <p className="mt-1 text-muted-foreground">Gerencie seus dados, veículos e campanhas.</p>
      </div>

      <StatusPanel status={driver.status} />

      {driver.status === "approved" && !hasVehicle && (
        <Card className="border-amber-500/40 bg-amber-500/5">
          <CardHeader className="flex-row items-start gap-3 space-y-0">
            <AlertTriangle className="h-5 w-5 mt-0.5" />
            <div>
              <CardTitle className="text-base">Cadastre seu veículo</CardTitle>
              <CardDescription>Você precisa cadastrar pelo menos um veículo para receber convites.</CardDescription>
            </div>
          </CardHeader>
        </Card>
      )}

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <DashCard to="/motorista/perfil" icon={UserCircle} title="Meu perfil" desc="Dados pessoais, PIX e cidade." />
        <DashCard to="/motorista/veiculos" icon={Car} title="Meus veículos" desc={`${vehicles?.length ?? 0} cadastrado(s)`} />
        <DashCard to="/motorista" icon={ClipboardCheck} title="Convites" desc="Em breve" disabled={!canAct} />
        <DashCard to="/motorista" icon={Wallet} title="Repasses" desc="Em breve" disabled={!canAct} />
      </div>
    </div>
  );
}
