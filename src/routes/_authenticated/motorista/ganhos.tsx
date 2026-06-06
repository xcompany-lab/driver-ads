import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, Wallet, TrendingUp, ExternalLink, CheckCircle2, KeyRound } from "lucide-react";
import { toast } from "sonner";
import { useSession } from "@/hooks/useSession";
import { getMyDriver } from "@/lib/driver";
import { listMyAssignments } from "@/lib/proofs";
import { listMyDriverPayouts, getReceiptSignedUrl } from "@/lib/finance";
import { getMyPayoutMethod } from "@/lib/driver-payout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/brand/StatusBadge";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Skeleton } from "@/components/ui/skeleton";

export const Route = createFileRoute("/_authenticated/motorista/ganhos")({
  component: EarningsPage,
});

const brl = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const fmtMonth = (s: string) => {
  const [y, m] = s.split("-");
  return new Date(Number(y), Number(m) - 1, 1).toLocaleDateString("pt-BR", { month: "long", year: "numeric" });
};

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

  const { data: payouts, isLoading: loadingPayouts } = useQuery({
    queryKey: ["my-payouts", driver?.id],
    queryFn: () => listMyDriverPayouts(driver!.id),
    enabled: !!driver,
  });

  const { data: pixMethod } = useQuery({
    queryKey: ["my-payout-method", driver?.id],
    queryFn: () => getMyPayoutMethod(driver!.id),
    enabled: !!driver,
  });

  const active = (assignments ?? []).filter((a) =>
    ["accepted", "awaiting_installation", "active"].includes(a.status),
  );
  const monthly = active.reduce((sum, a) => sum + Number(a.monthly_payout || 0), 0);
  const totalPaid = (payouts ?? []).filter((p) => p.status === "paid").reduce((s, p) => s + Number(p.amount), 0);
  const pendingPaid = (payouts ?? []).filter((p) => p.status !== "paid" && p.status !== "cancelled").reduce((s, p) => s + Number(p.amount), 0);

  return (
    <div className="mx-auto max-w-3xl space-y-4">
      <Button asChild variant="ghost" size="sm">
        <Link to="/motorista"><ArrowLeft className="mr-2 h-4 w-4" />Voltar</Link>
      </Button>

      <div>
        <h1 className="text-2xl font-bold tracking-tight">Meus ganhos</h1>
        <p className="text-sm text-muted-foreground">Acompanhe seus repasses por campanha.</p>
      </div>

      {(!pixMethod || pixMethod.status !== "approved") && (
        <Alert>
          <KeyRound className="h-4 w-4" />
          <AlertTitle>
            {!pixMethod
              ? "Cadastre sua chave Pix"
              : pixMethod.status === "pending_review"
                ? "Chave Pix em análise"
                : "Atualize sua chave Pix"}
          </AlertTitle>
          <AlertDescription className="flex flex-wrap items-center justify-between gap-2">
            <span>
              {pixMethod?.status === "pending_review"
                ? "Assim que aprovada, seus repasses serão liberados automaticamente."
                : "Sem chave Pix aprovada não conseguimos enviar seus repasses."}
            </span>
            <Button asChild size="sm" variant="outline">
              <Link to="/motorista/pix">
                {pixMethod ? "Revisar chave" : "Cadastrar chave"}
              </Link>
            </Button>
          </AlertDescription>
        </Alert>
      )}

      <div className="grid gap-3 sm:grid-cols-3">
        <Card>
          <CardHeader>
            <Wallet className="h-5 w-5 text-primary" />
            <CardDescription>Previsto / mês</CardDescription>
            <CardTitle className="text-2xl">{brl(monthly)}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader>
            <TrendingUp className="h-5 w-5 text-primary" />
            <CardDescription>A receber</CardDescription>
            <CardTitle className="text-2xl">{brl(pendingPaid)}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader>
            <CheckCircle2 className="h-5 w-5 text-success" />
            <CardDescription>Recebido</CardDescription>
            <CardTitle className="text-2xl">{brl(totalPaid)}</CardTitle>
          </CardHeader>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Histórico de repasses</CardTitle>
          <CardDescription>Lançamentos mensais por campanha.</CardDescription>
        </CardHeader>
        <CardContent>
          {loadingPayouts ? (
            <Skeleton className="h-24 rounded-md" />
          ) : !payouts?.length ? (
            <p className="text-sm text-muted-foreground">Nenhum repasse lançado ainda.</p>
          ) : (
            <ul className="divide-y">
              {payouts.map((p) => {
                const a = (p as { assignment?: { campaign?: { name?: string } | null; vehicle?: { plate?: string } | null } | null }).assignment;
                return (
                  <li key={p.id} className="flex items-center justify-between gap-3 py-3 text-sm">
                    <div className="min-w-0 flex-1">
                      <div className="font-medium truncate">{a?.campaign?.name ?? "—"}</div>
                      <div className="text-xs text-muted-foreground capitalize">
                        {fmtMonth(p.reference_month)} · {a?.vehicle?.plate ?? "—"}
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <StatusBadge status={p.status} />
                      <div className="font-semibold">{brl(Number(p.amount))}</div>
                      {p.receipt_url && (
                        <Button variant="ghost" size="sm" onClick={async () => {
                          try {
                            const url = await getReceiptSignedUrl(p.receipt_url!);
                            window.open(url, "_blank", "noopener");
                          } catch (e) { toast.error((e as Error).message); }
                        }}>
                          <ExternalLink className="h-4 w-4" />
                        </Button>
                      )}
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Campanhas ativas</CardTitle>
          <CardDescription>Previsão mensal por veículo.</CardDescription>
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
