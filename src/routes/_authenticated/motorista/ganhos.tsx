import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, Wallet, TrendingUp } from "lucide-react";
import { useSession } from "@/hooks/useSession";
import { getMyDriver } from "@/lib/driver";
import { listMyAssignments } from "@/lib/proofs";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/_authenticated/motorista/ganhos")({
  component: EarningsPage,
});

const brl = (v: number) =>
  v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

function EarningsPage() {
  const { user } = useSession();

  const { data: driver } = useQuery({
    queryKey: ["my-driver", user?.id],
    queryFn: () => getMyDriver(user!.id),
    enabled: !!user,
  });

  const { data: assignments } = useQuery({
    queryKey: ["my-assignments", driver?.id],
    queryFn: () => listMyAssignments(driver!.id),
    enabled: !!driver,
  });

  const active = (assignments ?? []).filter((a) =>
    ["accepted", "awaiting_installation", "active"].includes(a.status),
  );
  const monthly = active.reduce((sum, a) => sum + Number(a.monthly_payout || 0), 0);

  return (
    <div className="mx-auto max-w-3xl space-y-4">
      <Button asChild variant="ghost" size="sm">
        <Link to="/motorista"><ArrowLeft className="mr-2 h-4 w-4" />Voltar</Link>
      </Button>

      <div>
        <h1 className="text-2xl font-bold tracking-tight">Meus ganhos</h1>
        <p className="text-sm text-muted-foreground">Acompanhe seus repasses por campanha.</p>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <Card>
          <CardHeader>
            <Wallet className="h-5 w-5 text-primary" />
            <CardDescription>Previsto este mês</CardDescription>
            <CardTitle className="text-2xl">{brl(monthly)}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader>
            <TrendingUp className="h-5 w-5 text-primary" />
            <CardDescription>Campanhas ativas</CardDescription>
            <CardTitle className="text-2xl">{active.length}</CardTitle>
          </CardHeader>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Repasses por campanha</CardTitle>
          <CardDescription>O histórico de pagamentos efetivados aparecerá aqui em breve.</CardDescription>
        </CardHeader>
        <CardContent>
          {active.length === 0 ? (
            <p className="text-sm text-muted-foreground">Você não tem campanhas ativas no momento.</p>
          ) : (
            <ul className="divide-y">
              {active.map((a) => (
                <li key={a.id} className="flex items-center justify-between py-3 text-sm">
                  <div>
                    <div className="font-medium">{a.campaign?.name ?? "—"}</div>
                    <div className="text-xs text-muted-foreground">{a.vehicle?.plate}</div>
                  </div>
                  <div className="font-semibold">{brl(Number(a.monthly_payout || 0))}</div>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
