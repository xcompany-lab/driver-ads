import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Megaphone, Settings, Clock, XCircle, Ban, Wallet } from "lucide-react";
import { useSession } from "@/hooks/useSession";
import { getMyAdvertiser } from "@/lib/advertiser";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { StatusBadge } from "@/components/brand/StatusBadge";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/_authenticated/anunciante/")({
  component: AdvertiserHome,
});

function AdvertiserHome() {
  const { user } = useSession();
  const { data: advertiser, isLoading } = useQuery({
    queryKey: ["my-advertiser", user?.id],
    queryFn: () => getMyAdvertiser(user!.id),
    enabled: !!user,
  });

  if (isLoading) {
    return <p className="text-muted-foreground">Carregando seu cadastro...</p>;
  }

  if (!advertiser) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Complete seu cadastro</CardTitle>
          <CardDescription>Nao encontramos os dados da sua empresa. Preencha o cadastro para continuar.</CardDescription>
        </CardHeader>
        <CardContent>
          <Button asChild variant="hero"><Link to="/anunciante/perfil">Cadastrar empresa</Link></Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="font-display text-3xl font-bold tracking-tight">Ola, {advertiser.company_name}</h1>
          <p className="mt-1 text-muted-foreground">Bem-vindo ao Portal do Anunciante.</p>
        </div>
        <StatusBadge status={advertiser.status} />
      </div>

      {advertiser.status !== "approved" && advertiser.status !== "active" && (
        <StatusPanel status={advertiser.status} />
      )}

      <div className="grid gap-4 md:grid-cols-3">
        <DashCard
          icon={<Megaphone className="h-5 w-5" />}
          title="Campanhas"
          description="Solicite e acompanhe suas campanhas publicitarias."
          actionLabel="Abrir campanhas"
          to="/anunciante/campanhas"
        />
        <DashCard
          icon={<Wallet className="h-5 w-5" />}
          title="Financeiro"
          description="Veja suas faturas e comprovantes de pagamento."
          actionLabel="Abrir financeiro"
          to="/anunciante/financeiro"
        />
        <DashCard
          icon={<Settings className="h-5 w-5" />}
          title="Dados da empresa"
          description="Atualize CNPJ, contato e segmento."
          actionLabel="Editar perfil"
          to="/anunciante/perfil"
        />
      </div>
    </div>
  );
}

function StatusPanel({ status }: { status: string }) {
  if (status === "pending_review") {
    return (
      <Card className="border-warning/40 bg-warning/5">
        <CardHeader className="flex-row items-center gap-3 space-y-0">
          <Clock className="h-5 w-5 text-warning-foreground" />
          <div>
            <CardTitle className="text-base">Cadastro em analise</CardTitle>
            <CardDescription>Nossa equipe esta validando seus dados. Voce recebera um aviso assim que for aprovado.</CardDescription>
          </div>
        </CardHeader>
      </Card>
    );
  }
  if (status === "rejected") {
    return (
      <Card className="border-destructive/40 bg-destructive/5">
        <CardHeader className="flex-row items-center gap-3 space-y-0">
          <XCircle className="h-5 w-5 text-destructive" />
          <div>
            <CardTitle className="text-base">Cadastro reprovado</CardTitle>
            <CardDescription>Entre em contato com o suporte para entender os proximos passos.</CardDescription>
          </div>
        </CardHeader>
      </Card>
    );
  }
  if (status === "suspended") {
    return (
      <Card className="border-destructive/40 bg-destructive/5">
        <CardHeader className="flex-row items-center gap-3 space-y-0">
          <Ban className="h-5 w-5 text-destructive" />
          <div>
            <CardTitle className="text-base">Conta suspensa</CardTitle>
            <CardDescription>Sua conta foi suspensa. Fale com o suporte para regularizar.</CardDescription>
          </div>
        </CardHeader>
      </Card>
    );
  }
  return null;
}

function DashCard({
  icon, title, description, actionLabel, to, disabled,
}: { icon: React.ReactNode; title: string; description: string; actionLabel: string; to?: string; disabled?: boolean }) {
  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2 text-primary">{icon}<CardTitle className="text-base">{title}</CardTitle></div>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent>
        {disabled || !to
          ? <Button variant="outline" disabled>{actionLabel}</Button>
          : <Button asChild variant="outline-brand"><Link to={to}>{actionLabel}</Link></Button>}
      </CardContent>
    </Card>
  );
}
