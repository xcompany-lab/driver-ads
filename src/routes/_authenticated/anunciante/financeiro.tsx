import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, FileText, ExternalLink } from "lucide-react";
import { toast } from "sonner";
import { useSession } from "@/hooks/useSession";
import { getMyAdvertiser } from "@/lib/advertiser";
import { listMyAdvertiserPayments, getReceiptSignedUrl } from "@/lib/finance";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { StatusBadge } from "@/components/brand/StatusBadge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

export const Route = createFileRoute("/_authenticated/anunciante/financeiro")({
  component: AdvertiserFinancePage,
});

const brl = (v: number) => Number(v).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const fmtDate = (s: string | null) => (s ? new Date(s).toLocaleDateString("pt-BR") : "—");

function AdvertiserFinancePage() {
  const { user } = useSession();
  const { data: adv } = useQuery({
    queryKey: ["my-advertiser", user?.id],
    queryFn: () => getMyAdvertiser(user!.id),
    enabled: !!user,
  });
  const { data, isLoading } = useQuery({
    queryKey: ["my-advertiser-payments", adv?.id],
    queryFn: () => listMyAdvertiserPayments(adv!.id),
    enabled: !!adv,
  });

  const pending = (data ?? []).filter((p) => p.status === "pending" || p.status === "overdue").reduce((s, p) => s + Number(p.amount), 0);
  const paid = (data ?? []).filter((p) => p.status === "paid").reduce((s, p) => s + Number(p.amount), 0);

  return (
    <div className="space-y-6">
      <Button asChild variant="ghost" size="sm">
        <Link to="/anunciante"><ArrowLeft className="mr-2 h-4 w-4" />Voltar</Link>
      </Button>

      <div>
        <h1 className="text-3xl font-bold tracking-tight">Financeiro</h1>
        <p className="mt-1 text-muted-foreground">Acompanhe suas faturas das campanhas.</p>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <Card>
          <CardHeader><CardDescription>Em aberto</CardDescription><CardTitle className="text-2xl">{brl(pending)}</CardTitle></CardHeader>
        </Card>
        <Card>
          <CardHeader><CardDescription>Pago</CardDescription><CardTitle className="text-2xl">{brl(paid)}</CardTitle></CardHeader>
        </Card>
      </div>

      {isLoading ? (
        <Skeleton className="h-64 rounded-xl" />
      ) : !data?.length ? (
        <Card><CardContent className="py-16 text-center text-muted-foreground"><FileText className="mx-auto mb-2 h-8 w-8 opacity-40" />Nenhuma fatura emitida ainda.</CardContent></Card>
      ) : (
        <Card>
          <CardContent className="p-0 overflow-x-auto">
            <Table>
              <TableHeader><TableRow>
                <TableHead>Campanha</TableHead>
                <TableHead>Valor</TableHead>
                <TableHead>Vencimento</TableHead>
                <TableHead>Pago em</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Comprovante</TableHead>
              </TableRow></TableHeader>
              <TableBody>
                {data.map((p) => (
                  <TableRow key={p.id}>
                    <TableCell>
                      <div className="font-medium">{(p as { campaign?: { name?: string } }).campaign?.name ?? "—"}</div>
                    </TableCell>
                    <TableCell className="font-semibold">{brl(Number(p.amount))}</TableCell>
                    <TableCell>{fmtDate(p.due_date)}</TableCell>
                    <TableCell>{fmtDate(p.paid_at)}</TableCell>
                    <TableCell><StatusBadge status={p.status} /></TableCell>
                    <TableCell className="text-right">
                      {p.receipt_url ? <ReceiptButton path={p.receipt_url} /> : <span className="text-xs text-muted-foreground">—</span>}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function ReceiptButton({ path }: { path: string }) {
  return (
    <Button variant="outline" size="sm" onClick={async () => {
      try {
        const url = await getReceiptSignedUrl(path);
        window.open(url, "_blank", "noopener");
      } catch (e) { toast.error((e as Error).message); }
    }}><ExternalLink className="mr-1 h-3 w-3" />Abrir</Button>
  );
}
