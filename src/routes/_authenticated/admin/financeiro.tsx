import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Plus, FileText, Wallet, Receipt, Trash2, ExternalLink, RefreshCw, KeyRound, Check, X, Send, Banknote, LayoutDashboard, AlertTriangle, Ban, Undo2 } from "lucide-react";
import {
  listAdvertiserPayments,
  createAdvertiserPayment,
  updateAdvertiserPaymentStatus,
  deleteAdvertiserPayment,
  listDriverPayouts,
  updateDriverPayoutStatus,
  deleteDriverPayout,
  generateMonthlyPayouts,
  generatePayoutsFromEarnings,
  listReleasableEarnings,
  listPixMethodsForReview,
  approvePixMethod,
  rejectPixMethod,
  getReceiptSignedUrl,
  uploadReceipt,
  listPayoutsV2,
  generatePayoutsV2,
  executePayoutV2,
  cancelPayoutV2,
  type AdvertiserPaymentStatus,
  type DriverPayoutStatus,
  type AdvertiserPaymentWithRelations,
  type DriverPayoutWithRelations,
  type PixReviewWithDriver,
  type PayoutV2WithRelations,
  type PayoutV2Status,
  listSubscriptionsAdmin,
  cancelSubscriptionAtPagou,
  listTransactionsAdmin,
  refundTransactionAtPagou,
  listChargebackEvents,
  type SubscriptionAdminRow,
  type TransactionAdminRow,
} from "@/lib/finance";

import {
  getFinanceOverview,
  listWebhookIssues,
  listReconJobs,
  listApiErrors,
  listBalanceSnapshots,
  insertBalanceSnapshot,
} from "@/lib/finance-overview";

import { listCampaignsAdmin } from "@/lib/campaigns-admin";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { StatusBadge } from "@/components/brand/StatusBadge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useIsAdmin } from "@/hooks/useRoleGuards";
import { ShieldAlert } from "lucide-react";

export const Route = createFileRoute("/_authenticated/admin/financeiro")({
  component: FinancePage,
});

const brl = (v: number) => Number(v).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const fmtDate = (s: string | null) => (s ? new Date(s).toLocaleDateString("pt-BR") : "—");
const fmtMonth = (s: string) => {
  const [y, m] = s.split("-");
  return new Date(Number(y), Number(m) - 1, 1).toLocaleDateString("pt-BR", { month: "long", year: "numeric" });
};

function FinancePage() {
  const isAdmin = useIsAdmin();
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Financeiro</h1>
        <p className="mt-1 text-muted-foreground">
          Faturas dos anunciantes e repasses para motoristas.
        </p>
      </div>

      {!isAdmin && (
        <div className="flex items-start gap-3 rounded-lg border border-amber-500/30 bg-amber-500/10 p-3 text-sm text-amber-900 dark:text-amber-200">
          <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0" />
          <p>
            Você está como <strong>Operador</strong>. As ações financeiras sensíveis (marcar como pago, reverter, excluir) ficam restritas ao perfil Admin. Você pode visualizar e anexar comprovantes.
          </p>
        </div>
      )}

      <Tabs defaultValue="overview">
        <TabsList className="flex-wrap h-auto">
          <TabsTrigger value="overview"><LayoutDashboard className="mr-2 h-4 w-4" />Visão geral</TabsTrigger>
          <TabsTrigger value="invoices"><FileText className="mr-2 h-4 w-4" />Faturas — Anunciantes</TabsTrigger>
          <TabsTrigger value="subs"><Ban className="mr-2 h-4 w-4" />Assinaturas</TabsTrigger>
          <TabsTrigger value="tx"><Undo2 className="mr-2 h-4 w-4" />Cobranças & reembolsos</TabsTrigger>
          <TabsTrigger value="payouts"><Wallet className="mr-2 h-4 w-4" />Repasses (legado)</TabsTrigger>
          <TabsTrigger value="pixout"><Banknote className="mr-2 h-4 w-4" />Pix Out</TabsTrigger>
          <TabsTrigger value="pix"><KeyRound className="mr-2 h-4 w-4" />Chaves PIX</TabsTrigger>
          <TabsTrigger value="recon"><AlertTriangle className="mr-2 h-4 w-4" />Reconciliação</TabsTrigger>
        </TabsList>
        <TabsContent value="overview" className="mt-4"><OverviewTab /></TabsContent>
        <TabsContent value="invoices" className="mt-4"><InvoicesTab /></TabsContent>
        <TabsContent value="subs" className="mt-4"><SubscriptionsTab /></TabsContent>
        <TabsContent value="tx" className="mt-4"><TransactionsTab /></TabsContent>
        <TabsContent value="payouts" className="mt-4"><PayoutsTab /></TabsContent>
        <TabsContent value="pixout" className="mt-4"><PixOutTab /></TabsContent>
        <TabsContent value="pix" className="mt-4"><PixReviewTab /></TabsContent>
        <TabsContent value="recon" className="mt-4"><ReconciliationTab /></TabsContent>
      </Tabs>


    </div>
  );
}

/* ============================= INVOICES (advertiser) ============================= */

const INV_STATUSES: { value: AdvertiserPaymentStatus | "all"; label: string }[] = [
  { value: "all", label: "Todas" },
  { value: "pending", label: "Pendentes" },
  { value: "paid", label: "Pagas" },
  { value: "overdue", label: "Vencidas" },
  { value: "cancelled", label: "Canceladas" },
];

function InvoicesTab() {
  const qc = useQueryClient();
  const isAdmin = useIsAdmin();
  const [status, setStatus] = useState<AdvertiserPaymentStatus | "all">("all");
  const [openNew, setOpenNew] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ["admin", "invoices", status],
    queryFn: () => listAdvertiserPayments(status),
  });

  const total = (data ?? []).reduce((s, p) => s + Number(p.amount || 0), 0);
  const pending = (data ?? []).filter((p) => p.status === "pending").reduce((s, p) => s + Number(p.amount), 0);
  const paid = (data ?? []).filter((p) => p.status === "paid").reduce((s, p) => s + Number(p.amount), 0);

  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-3">
        <KpiMini label="Total no filtro" value={brl(total)} />
        <KpiMini label="A receber" value={brl(pending)} />
        <KpiMini label="Recebido" value={brl(paid)} />
      </div>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <Select value={status} onValueChange={(v) => setStatus(v as AdvertiserPaymentStatus | "all")}>
          <SelectTrigger className="sm:w-64"><SelectValue /></SelectTrigger>
          <SelectContent>
            {INV_STATUSES.map((o) => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
          </SelectContent>
        </Select>
        {isAdmin && <Button onClick={() => setOpenNew(true)}><Plus className="mr-2 h-4 w-4" />Nova fatura</Button>}
      </div>

      {isLoading ? (
        <Skeleton className="h-64 rounded-xl" />
      ) : !data?.length ? (
        <Card><CardContent className="py-16 text-center text-muted-foreground">Nenhuma fatura encontrada.</CardContent></Card>
      ) : (
        <Card>
          <CardContent className="p-0 overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Anunciante</TableHead>
                  <TableHead>Campanha</TableHead>
                  <TableHead>Valor</TableHead>
                  <TableHead>Vencimento</TableHead>
                  <TableHead>Pago em</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.map((p) => <InvoiceRow key={p.id} payment={p} onChange={() => qc.invalidateQueries({ queryKey: ["admin", "invoices"] })} />)}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      <NewInvoiceDialog open={openNew} onOpenChange={setOpenNew} />
    </div>
  );
}

function InvoiceRow({ payment, onChange }: { payment: AdvertiserPaymentWithRelations; onChange: () => void }) {
  const isAdmin = useIsAdmin();
  const setStatusMut = useMutation({
    mutationFn: (s: AdvertiserPaymentStatus) => updateAdvertiserPaymentStatus(payment.id, s),
    onSuccess: () => { toast.success("Fatura atualizada"); onChange(); },
    onError: (e: Error) => toast.error(e.message),
  });
  const delMut = useMutation({
    mutationFn: () => deleteAdvertiserPayment(payment.id),
    onSuccess: () => { toast.success("Fatura excluída"); onChange(); },
    onError: (e: Error) => toast.error(e.message),
  });
  const uploadMut = useMutation({
    mutationFn: async (file: File) => {
      if (!payment.advertiser_id) throw new Error("Anunciante ausente");
      const path = await uploadReceipt("advertisers", payment.advertiser_id, file);
      await updateAdvertiserPaymentStatus(payment.id, "paid", path);
    },
    onSuccess: () => { toast.success("Comprovante anexado"); onChange(); },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <TableRow>
      <TableCell>
        <div className="font-medium">{payment.advertiser?.company_name ?? "—"}</div>
        <div className="text-xs text-muted-foreground">{payment.advertiser?.cnpj}</div>
      </TableCell>
      <TableCell>{payment.campaign?.name ?? "—"}</TableCell>
      <TableCell className="font-semibold">{brl(Number(payment.amount))}</TableCell>
      <TableCell>{fmtDate(payment.due_date)}</TableCell>
      <TableCell>{fmtDate(payment.paid_at)}</TableCell>
      <TableCell><StatusBadge status={payment.status} /></TableCell>
      <TableCell className="text-right space-x-1 whitespace-nowrap">
        {payment.receipt_url && <ReceiptLinkButton path={payment.receipt_url} />}
        {isAdmin && (
          <label>
            <input
              type="file"
              accept="image/*,application/pdf"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) uploadMut.mutate(f);
                e.currentTarget.value = "";
              }}
            />
            <Button asChild variant="outline" size="sm"><span><Receipt className="mr-1 h-3 w-3" />Anexar</span></Button>
          </label>
        )}
        {isAdmin && payment.status !== "paid" && (
          <Button size="sm" onClick={() => setStatusMut.mutate("paid")}>Marcar pago</Button>
        )}
        {isAdmin && payment.status === "paid" && (
          <Button size="sm" variant="outline" onClick={() => setStatusMut.mutate("pending")}>Reverter</Button>
        )}
        {isAdmin && payment.status !== "cancelled" && (
          <Button size="sm" variant="ghost" onClick={() => setStatusMut.mutate("cancelled")}>Cancelar</Button>
        )}
        {isAdmin && (
          <Button size="sm" variant="ghost" onClick={() => { if (confirm("Excluir fatura?")) delMut.mutate(); }}>
            <Trash2 className="h-3 w-3" />
          </Button>
        )}
      </TableCell>
    </TableRow>
  );
}

function NewInvoiceDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (v: boolean) => void }) {
  const qc = useQueryClient();
  const [campaignId, setCampaignId] = useState<string>("");
  const [amount, setAmount] = useState<string>("");
  const [dueDate, setDueDate] = useState<string>("");
  const [notes, setNotes] = useState<string>("");

  const { data: campaigns } = useQuery({
    queryKey: ["admin", "campaigns-for-invoice"],
    queryFn: () => listCampaignsAdmin({ status: "all" }),
    enabled: open,
  });

  const mut = useMutation({
    mutationFn: async () => {
      const camp = campaigns?.find((c) => c.id === campaignId);
      if (!camp) throw new Error("Selecione a campanha");
      if (!amount || Number(amount) <= 0) throw new Error("Informe o valor");
      if (!dueDate) throw new Error("Informe o vencimento");
      await createAdvertiserPayment({
        campaign_id: camp.id,
        advertiser_id: camp.advertiser_id,
        amount: Number(amount),
        due_date: dueDate,
        notes: notes || null,
      });
    },
    onSuccess: () => {
      toast.success("Fatura criada");
      qc.invalidateQueries({ queryKey: ["admin", "invoices"] });
      onOpenChange(false);
      setCampaignId(""); setAmount(""); setDueDate(""); setNotes("");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Nova fatura</DialogTitle>
          <DialogDescription>Lançar cobrança para um anunciante por campanha.</DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div>
            <Label>Campanha</Label>
            <Select value={campaignId} onValueChange={setCampaignId}>
              <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
              <SelectContent>
                {(campaigns ?? []).map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.name} — {c.advertiser?.company_name ?? "?"}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Valor (R$)</Label>
              <Input type="number" step="0.01" min="0" value={amount} onChange={(e) => setAmount(e.target.value)} />
            </div>
            <div>
              <Label>Vencimento</Label>
              <Input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
            </div>
          </div>
          <div>
            <Label>Observações</Label>
            <Textarea rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={() => mut.mutate()} disabled={mut.isPending}>Criar fatura</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/* ============================= PAYOUTS (driver) ============================= */

const PAY_STATUSES: { value: DriverPayoutStatus | "all"; label: string }[] = [
  { value: "all", label: "Todos" },
  { value: "pending", label: "Pendentes" },
  { value: "processing", label: "Em processamento" },
  { value: "paid", label: "Pagos" },
  { value: "cancelled", label: "Cancelados" },
];

function currentMonthIso() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-01`;
}

function PayoutsTab() {
  const qc = useQueryClient();
  const isAdmin = useIsAdmin();
  const [status, setStatus] = useState<DriverPayoutStatus | "all">("all");
  const [refMonth, setRefMonth] = useState<string>(currentMonthIso());

  const { data, isLoading } = useQuery({
    queryKey: ["admin", "payouts", status],
    queryFn: () => listDriverPayouts(status),
  });

  const generate = useMutation({
    mutationFn: () => generatePayoutsFromEarnings(refMonth),
    onSuccess: (r) => {
      if (r.totalEarnings === 0) {
        toast.info("Nenhum ganho disponível para repasse no momento.");
      } else {
        toast.success(
          `Repasses gerados: ${r.created}. Motoristas sem PIX aprovado: ${r.skippedNoPix}. Períodos consumidos: ${r.totalEarnings}.`,
        );
      }
      qc.invalidateQueries({ queryKey: ["admin", "payouts"] });
      qc.invalidateQueries({ queryKey: ["admin", "releasable-earnings"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const legacyGen = useMutation({
    mutationFn: () => generateMonthlyPayouts(refMonth),
    onSuccess: (r) => {
      toast.success(`(Legado) Repasses gerados: ${r.created} novos, ${r.skipped} já existentes.`);
      qc.invalidateQueries({ queryKey: ["admin", "payouts"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const total = (data ?? []).reduce((s, p) => s + Number(p.amount || 0), 0);
  const pending = (data ?? []).filter((p) => p.status === "pending" || p.status === "processing").reduce((s, p) => s + Number(p.amount), 0);
  const paid = (data ?? []).filter((p) => p.status === "paid").reduce((s, p) => s + Number(p.amount), 0);

  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-3">
        <KpiMini label="Total no filtro" value={brl(total)} />
        <KpiMini label="A pagar" value={brl(pending)} />
        <KpiMini label="Pago" value={brl(paid)} />
      </div>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <Select value={status} onValueChange={(v) => setStatus(v as DriverPayoutStatus | "all")}>
          <SelectTrigger className="sm:w-64"><SelectValue /></SelectTrigger>
          <SelectContent>
            {PAY_STATUSES.map((o) => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
          </SelectContent>
        </Select>
        {isAdmin && (
          <div className="flex items-end gap-2">
            <div>
              <Label className="text-xs">Mês de referência</Label>
              <Input type="month" value={refMonth.slice(0, 7)} onChange={(e) => setRefMonth(`${e.target.value}-01`)} />
            </div>
            <Button onClick={() => generate.mutate()} disabled={generate.isPending}>
              <RefreshCw className="mr-2 h-4 w-4" />Gerar via ganhos
            </Button>
            <Button variant="outline" onClick={() => legacyGen.mutate()} disabled={legacyGen.isPending} title="Gera 1 repasse por motorista ativo usando o valor mensal do vínculo (legado, ignora ganhos acumulados).">
              Legado
            </Button>
          </div>
        )}
      </div>

      {isAdmin && <ReleasableEarningsPanel />}


      {isLoading ? (
        <Skeleton className="h-64 rounded-xl" />
      ) : !data?.length ? (
        <Card><CardContent className="py-16 text-center text-muted-foreground">Nenhum repasse no filtro.</CardContent></Card>
      ) : (
        <Card>
          <CardContent className="p-0 overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Motorista</TableHead>
                  <TableHead>Campanha / Veículo</TableHead>
                  <TableHead>Mês</TableHead>
                  <TableHead>Valor</TableHead>
                  <TableHead>PIX</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.map((p) => <PayoutRow key={p.id} payout={p} onChange={() => qc.invalidateQueries({ queryKey: ["admin", "payouts"] })} />)}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function PayoutRow({ payout, onChange }: { payout: DriverPayoutWithRelations; onChange: () => void }) {
  const isAdmin = useIsAdmin();
  const setStatusMut = useMutation({
    mutationFn: (s: DriverPayoutStatus) => updateDriverPayoutStatus(payout.id, s),
    onSuccess: () => { toast.success("Repasse atualizado"); onChange(); },
    onError: (e: Error) => toast.error(e.message),
  });
  const delMut = useMutation({
    mutationFn: () => deleteDriverPayout(payout.id),
    onSuccess: () => { toast.success("Repasse excluído"); onChange(); },
    onError: (e: Error) => toast.error(e.message),
  });
  const uploadMut = useMutation({
    mutationFn: async (file: File) => {
      const path = await uploadReceipt("drivers", payout.driver_id, file);
      await updateDriverPayoutStatus(payout.id, "paid", path);
    },
    onSuccess: () => { toast.success("Comprovante anexado"); onChange(); },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <TableRow>
      <TableCell>
        <div className="font-medium">{payout.driver?.full_name ?? "—"}</div>
        <div className="text-xs text-muted-foreground">{payout.driver?.city}</div>
      </TableCell>
      <TableCell>
        <div className="text-sm">{payout.assignment?.campaign?.name ?? "—"}</div>
        <div className="text-xs text-muted-foreground">{payout.assignment?.vehicle?.plate}</div>
      </TableCell>
      <TableCell className="capitalize">{fmtMonth(payout.reference_month)}</TableCell>
      <TableCell className="font-semibold">{brl(Number(payout.amount))}</TableCell>
      <TableCell className="text-xs">
        {payout.pix_key ? <><div className="font-mono">{payout.pix_key}</div><div className="text-muted-foreground">{payout.pix_key_type}</div></> : "—"}
      </TableCell>
      <TableCell><StatusBadge status={payout.status} /></TableCell>
      <TableCell className="text-right space-x-1 whitespace-nowrap">
        {payout.receipt_url && <ReceiptLinkButton path={payout.receipt_url} />}
        {isAdmin && (
          <label>
            <input
              type="file"
              accept="image/*,application/pdf"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) uploadMut.mutate(f);
                e.currentTarget.value = "";
              }}
            />
            <Button asChild variant="outline" size="sm"><span><Receipt className="mr-1 h-3 w-3" />Anexar</span></Button>
          </label>
        )}
        {isAdmin && payout.status === "pending" && (
          <Button size="sm" variant="outline" onClick={() => setStatusMut.mutate("processing")}>Processar</Button>
        )}
        {isAdmin && payout.status !== "paid" && (
          <Button size="sm" onClick={() => setStatusMut.mutate("paid")}>Marcar pago</Button>
        )}
        {isAdmin && payout.status === "paid" && (
          <Button size="sm" variant="outline" onClick={() => setStatusMut.mutate("pending")}>Reverter</Button>
        )}
        {isAdmin && payout.status !== "cancelled" && (
          <Button size="sm" variant="ghost" onClick={() => setStatusMut.mutate("cancelled")}>Cancelar</Button>
        )}
        {isAdmin && (
          <Button size="sm" variant="ghost" onClick={() => { if (confirm("Excluir repasse?")) delMut.mutate(); }}>
            <Trash2 className="h-3 w-3" />
          </Button>
        )}
      </TableCell>
    </TableRow>
  );
}

/* ============================= shared ============================= */

function KpiMini({ label, value }: { label: string; value: string }) {
  return (
    <Card>
      <CardHeader className="pb-2"><CardDescription>{label}</CardDescription><CardTitle className="text-2xl">{value}</CardTitle></CardHeader>
    </Card>
  );
}

function ReceiptLinkButton({ path }: { path: string }) {
  const open = async () => {
    try {
      const url = await getReceiptSignedUrl(path);
      window.open(url, "_blank", "noopener");
    } catch (e) {
      toast.error((e as Error).message);
    }
  };
  return (
    <Button variant="outline" size="sm" onClick={open}><ExternalLink className="mr-1 h-3 w-3" />Comprovante</Button>
  );
}

/* ============================= RELEASABLE EARNINGS PANEL ============================= */

function ReleasableEarningsPanel() {
  const { data, isLoading } = useQuery({
    queryKey: ["admin", "releasable-earnings"],
    queryFn: () => listReleasableEarnings(),
  });

  if (isLoading) return <Skeleton className="h-32 rounded-xl" />;
  if (!data?.length) return null;

  const byDriver = new Map<string, { name: string; city: string; total: number; pixStatus: string; pixMask: string | null; count: number }>();
  for (const e of data) {
    const k = e.driver_id;
    const cur = byDriver.get(k) ?? {
      name: e.driver?.full_name ?? "—",
      city: e.driver?.city ?? "",
      total: 0,
      pixStatus: e.pix?.status ?? "missing",
      pixMask: e.pix?.pix_key_value_masked ?? null,
      count: 0,
    };
    cur.total += Number(e.amount_cents) / 100;
    cur.count += 1;
    byDriver.set(k, cur);
  }
  const rows = Array.from(byDriver.entries());

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">Ganhos liberados aguardando repasse</CardTitle>
        <CardDescription>
          {data.length} período(s) acumulado(s) de {rows.length} motorista(s). Clique em "Gerar via ganhos" acima para criar os repasses.
        </CardDescription>
      </CardHeader>
      <CardContent className="p-0 overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Motorista</TableHead>
              <TableHead>Períodos</TableHead>
              <TableHead>Total liberado</TableHead>
              <TableHead>PIX</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map(([driverId, r]) => (
              <TableRow key={driverId}>
                <TableCell>
                  <div className="font-medium">{r.name}</div>
                  <div className="text-xs text-muted-foreground">{r.city}</div>
                </TableCell>
                <TableCell>{r.count}</TableCell>
                <TableCell className="font-semibold">{brl(r.total)}</TableCell>
                <TableCell className="text-xs">
                  {r.pixStatus === "approved" ? (
                    <span className="text-emerald-600 font-mono">{r.pixMask ?? "aprovado"}</span>
                  ) : r.pixStatus === "missing" ? (
                    <span className="text-amber-600">sem chave cadastrada</span>
                  ) : (
                    <span className="text-amber-600">PIX {r.pixStatus}</span>
                  )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}

/* ============================= PIX REVIEW TAB ============================= */

const PIX_STATUSES: { value: "pending_review" | "approved" | "rejected" | "all"; label: string }[] = [
  { value: "pending_review", label: "Aguardando análise" },
  { value: "approved", label: "Aprovadas" },
  { value: "rejected", label: "Recusadas" },
  { value: "all", label: "Todas" },
];

function PixReviewTab() {
  const qc = useQueryClient();
  const isAdmin = useIsAdmin();
  const [status, setStatus] = useState<"pending_review" | "approved" | "rejected" | "all">("pending_review");
  const { data, isLoading } = useQuery({
    queryKey: ["admin", "pix-review", status],
    queryFn: () => listPixMethodsForReview(status),
  });

  return (
    <div className="space-y-4">
      <div className="flex items-end justify-between">
        <Select value={status} onValueChange={(v) => setStatus(v as typeof status)}>
          <SelectTrigger className="sm:w-64"><SelectValue /></SelectTrigger>
          <SelectContent>
            {PIX_STATUSES.map((o) => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      {isLoading ? (
        <Skeleton className="h-64 rounded-xl" />
      ) : !data?.length ? (
        <Card><CardContent className="py-16 text-center text-muted-foreground">Nenhuma chave PIX no filtro.</CardContent></Card>
      ) : (
        <Card>
          <CardContent className="p-0 overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Motorista</TableHead>
                  <TableHead>Tipo</TableHead>
                  <TableHead>Chave</TableHead>
                  <TableHead>Titular</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.map((p) => (
                  <PixReviewRow
                    key={p.id}
                    row={p}
                    isAdmin={isAdmin}
                    onChange={() => {
                      qc.invalidateQueries({ queryKey: ["admin", "pix-review"] });
                      qc.invalidateQueries({ queryKey: ["admin", "releasable-earnings"] });
                    }}
                  />
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function PixReviewRow({ row, isAdmin, onChange }: { row: PixReviewWithDriver; isAdmin: boolean; onChange: () => void }) {
  const [rejectOpen, setRejectOpen] = useState(false);
  const [reason, setReason] = useState("");

  const approveMut = useMutation({
    mutationFn: () => approvePixMethod(row.id),
    onSuccess: () => { toast.success("Chave PIX aprovada"); onChange(); },
    onError: (e: Error) => toast.error(e.message),
  });
  const rejectMut = useMutation({
    mutationFn: () => rejectPixMethod(row.id, reason),
    onSuccess: () => { toast.success("Chave PIX recusada"); setRejectOpen(false); setReason(""); onChange(); },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <TableRow>
      <TableCell>
        <div className="font-medium">{row.driver?.full_name ?? "—"}</div>
        <div className="text-xs text-muted-foreground">{row.driver?.city} · {row.driver?.email}</div>
      </TableCell>
      <TableCell className="uppercase text-xs">{row.pix_key_type}</TableCell>
      <TableCell className="font-mono text-xs">{row.pix_key_value_masked ?? row.pix_key_value}</TableCell>
      <TableCell className="text-xs">
        <div>{row.legal_name ?? "—"}</div>
        <div className="text-muted-foreground">{row.document_type?.toUpperCase()} {row.document_number ?? ""}</div>
      </TableCell>
      <TableCell><StatusBadge status={row.status} /></TableCell>
      <TableCell className="text-right space-x-1 whitespace-nowrap">
        {isAdmin && row.status !== "approved" && (
          <Button size="sm" onClick={() => approveMut.mutate()} disabled={approveMut.isPending}>
            <Check className="mr-1 h-3 w-3" />Aprovar
          </Button>
        )}
        {isAdmin && row.status !== "rejected" && (
          <Button size="sm" variant="outline" onClick={() => setRejectOpen(true)}>
            <X className="mr-1 h-3 w-3" />Recusar
          </Button>
        )}
        {row.rejection_reason && (
          <div className="text-[11px] text-amber-600 mt-1 max-w-[260px] whitespace-normal text-left">
            Motivo: {row.rejection_reason}
          </div>
        )}
      </TableCell>

      <Dialog open={rejectOpen} onOpenChange={setRejectOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Recusar chave PIX</DialogTitle>
            <DialogDescription>
              O motorista verá o motivo abaixo e precisará reenviar a chave.
            </DialogDescription>
          </DialogHeader>
          <Textarea rows={3} value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Ex.: Titularidade não confere com o cadastro." />
          <DialogFooter>
            <Button variant="ghost" onClick={() => setRejectOpen(false)}>Cancelar</Button>
            <Button onClick={() => rejectMut.mutate()} disabled={rejectMut.isPending}>Confirmar recusa</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </TableRow>
  );
}

/* ============================= PIX OUT (payouts v2) ============================= */

const PIXOUT_STATUSES: { value: PayoutV2Status | "all"; label: string }[] = [
  { value: "all", label: "Todos" },
  { value: "draft", label: "Rascunhos" },
  { value: "approved", label: "Aprovados" },
  { value: "processing", label: "Em processamento" },
  { value: "in_analysis", label: "Em análise" },
  { value: "paid", label: "Pagos" },
  { value: "failed", label: "Falhou" },
  { value: "rejected", label: "Recusado" },
  { value: "cancelled", label: "Cancelado" },
];

function PixOutTab() {
  const qc = useQueryClient();
  const isAdmin = useIsAdmin();
  const [status, setStatus] = useState<PayoutV2Status | "all">("all");

  const { data, isLoading } = useQuery({
    queryKey: ["admin", "payouts-v2", status],
    queryFn: () => listPayoutsV2(status),
  });

  const generate = useMutation({
    mutationFn: () => generatePayoutsV2(),
    onSuccess: (r) => {
      if (r.totalEarnings === 0) {
        toast.info("Nenhum ganho liberado disponível.");
      } else {
        toast.success(
          `Pix Out: ${r.created} novo(s) repasse(s). Motoristas sem PIX aprovado: ${r.skippedNoPix}. Períodos consumidos: ${r.totalEarnings}.`,
        );
      }
      qc.invalidateQueries({ queryKey: ["admin", "payouts-v2"] });
      qc.invalidateQueries({ queryKey: ["admin", "releasable-earnings"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ["admin", "payouts-v2"] });
    qc.invalidateQueries({ queryKey: ["admin", "releasable-earnings"] });
  };

  const totalCents = (data ?? []).reduce((s, p) => s + Number(p.amount_cents), 0);
  const pendingCents = (data ?? [])
    .filter((p) => ["draft", "approved", "processing", "in_analysis"].includes(p.status))
    .reduce((s, p) => s + Number(p.amount_cents), 0);
  const paidCents = (data ?? []).filter((p) => p.status === "paid").reduce((s, p) => s + Number(p.amount_cents), 0);

  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-3">
        <KpiMini label="Total no filtro" value={brl(totalCents / 100)} />
        <KpiMini label="A enviar" value={brl(pendingCents / 100)} />
        <KpiMini label="Pago" value={brl(paidCents / 100)} />
      </div>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <Select value={status} onValueChange={(v) => setStatus(v as PayoutV2Status | "all")}>
          <SelectTrigger className="sm:w-64"><SelectValue /></SelectTrigger>
          <SelectContent>
            {PIXOUT_STATUSES.map((o) => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
          </SelectContent>
        </Select>
        {isAdmin && (
          <Button onClick={() => generate.mutate()} disabled={generate.isPending}>
            <RefreshCw className="mr-2 h-4 w-4" />Gerar Pix Out dos ganhos liberados
          </Button>
        )}
      </div>

      {isLoading ? (
        <Skeleton className="h-64 rounded-xl" />
      ) : !data?.length ? (
        <Card><CardContent className="py-16 text-center text-muted-foreground">Nenhum Pix Out no filtro.</CardContent></Card>
      ) : (
        <Card>
          <CardContent className="p-0 overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Motorista</TableHead>
                  <TableHead>Períodos</TableHead>
                  <TableHead>Valor</TableHead>
                  <TableHead>PIX</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Pagou ID</TableHead>
                  <TableHead className="text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.map((p) => <PixOutRow key={p.id} row={p} isAdmin={isAdmin} onChange={invalidate} />)}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function PixOutRow({ row, isAdmin, onChange }: { row: PayoutV2WithRelations; isAdmin: boolean; onChange: () => void }) {
  const execMut = useMutation({
    mutationFn: () => executePayoutV2(row.id),
    onSuccess: (r) => {
      toast.success(`Pix Out enviado à Pagou${r.pagou_transfer_id ? ` (${r.pagou_transfer_id})` : ""}.`);
      onChange();
    },
    onError: (e: Error) => toast.error(e.message),
  });
  const cancelMut = useMutation({
    mutationFn: () => cancelPayoutV2(row.id),
    onSuccess: () => { toast.success("Repasse cancelado; ganhos liberados."); onChange(); },
    onError: (e: Error) => toast.error(e.message),
  });

  const canExecute = ["draft", "approved", "failed", "rejected", "error"].includes(row.status) && !row.pagou_transfer_id;
  const canCancel = ["draft", "approved", "failed", "rejected", "error"].includes(row.status);

  return (
    <TableRow>
      <TableCell>
        <div className="font-medium">{row.driver?.full_name ?? "—"}</div>
        <div className="text-xs text-muted-foreground">{row.driver?.city}</div>
      </TableCell>
      <TableCell>{row.items?.length ?? 0}</TableCell>
      <TableCell className="font-semibold">{brl(Number(row.amount_cents) / 100)}</TableCell>
      <TableCell className="text-xs">
        {row.method ? (
          <>
            <div className="font-mono">{row.method.pix_key_value_masked ?? "—"}</div>
            <div className="text-muted-foreground uppercase">{row.method.pix_key_type}</div>
          </>
        ) : "—"}
      </TableCell>
      <TableCell><StatusBadge status={row.status} /></TableCell>
      <TableCell className="text-xs font-mono">
        {row.pagou_transfer_id ?? "—"}
        {row.failure_reason && (
          <div className="text-amber-600 mt-1 max-w-[220px] whitespace-normal">{row.failure_reason}</div>
        )}
      </TableCell>
      <TableCell className="text-right space-x-1 whitespace-nowrap">
        {isAdmin && canExecute && (
          <Button size="sm" onClick={() => execMut.mutate()} disabled={execMut.isPending}>
            <Send className="mr-1 h-3 w-3" />Enviar Pix Out
          </Button>
        )}
        {isAdmin && canCancel && (
          <Button size="sm" variant="ghost" onClick={() => { if (confirm("Cancelar este repasse e liberar os ganhos?")) cancelMut.mutate(); }}>
            Cancelar
          </Button>
        )}
      </TableCell>
    </TableRow>
  );
}

/* ============================= OVERVIEW TAB ============================= */

function OverviewTab() {
  const { data, isLoading } = useQuery({
    queryKey: ["admin", "finance-overview"],
    queryFn: () => getFinanceOverview(),
    refetchInterval: 60_000,
  });

  if (isLoading || !data) return <Skeleton className="h-96 rounded-xl" />;

  const onHand =
    (data.providerAvailableCents ?? 0) - data.payoutsPendingCents;
  const onHandLabel =
    data.providerAvailableCents == null
      ? "Capture um snapshot de saldo na aba Reconciliação para ver."
      : onHand >= 0
        ? `Sobra estimada após pagar Pix Out pendentes: ${brl(onHand / 100)}`
        : `Falta ${brl(Math.abs(onHand) / 100)} para cobrir Pix Out pendentes`;

  return (
    <div className="space-y-6">
      <section>
        <h2 className="mb-3 text-lg font-semibold">Receita</h2>
        <div className="grid gap-3 sm:grid-cols-3">
          <KpiMini label={`MRR (${data.activeSubscriptions} assinaturas)`} value={brl(data.mrrCents / 100)} />
          <KpiMini label={`Recebido no mês (${data.monthPaidTxCount} tx)`} value={brl(data.monthRevenueCents / 100)} />
          <KpiMini label="Saldo Pagou (disponível)" value={data.providerAvailableCents == null ? "—" : brl(data.providerAvailableCents / 100)} />
        </div>
      </section>

      <section>
        <h2 className="mb-3 text-lg font-semibold">Ganhos dos motoristas</h2>
        <div className="grid gap-3 sm:grid-cols-3">
          <KpiMini label="A liberar (accrued)" value={brl(data.accruedCents / 100)} />
          <KpiMini label="Travados em Pix Out" value={brl(data.lockedCents / 100)} />
          <KpiMini label="Já pagos (histórico)" value={brl(data.paidEarningsCents / 100)} />
        </div>
      </section>

      <section>
        <h2 className="mb-3 text-lg font-semibold">Pix Out</h2>
        <div className="grid gap-3 sm:grid-cols-3">
          <KpiMini label="A enviar" value={brl(data.payoutsPendingCents / 100)} />
          <KpiMini label="Pagos (histórico)" value={brl(data.payoutsPaidCents / 100)} />
          <KpiMini label="Gap travados − Pix Out" value={brl(data.reconciliationGapCents / 100)} />
        </div>
      </section>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Posição de caixa</CardTitle>
          <CardDescription>{onHandLabel}</CardDescription>
        </CardHeader>
        <CardContent className="text-xs text-muted-foreground">
          Último snapshot Pagou: {data.providerSnapshotAt ? new Date(data.providerSnapshotAt).toLocaleString("pt-BR") : "—"}
          {data.providerPendingCents != null && <> · Pendente Pagou: {brl(data.providerPendingCents / 100)}</>}
        </CardContent>
      </Card>
    </div>
  );
}

/* ============================= RECONCILIATION TAB ============================= */

function ReconciliationTab() {
  const qc = useQueryClient();
  const isAdmin = useIsAdmin();
  const [snapOpen, setSnapOpen] = useState(false);

  const webhooks = useQuery({ queryKey: ["admin", "recon", "webhooks"], queryFn: () => listWebhookIssues() });
  const jobs = useQuery({ queryKey: ["admin", "recon", "jobs"], queryFn: () => listReconJobs() });
  const apiErrors = useQuery({ queryKey: ["admin", "recon", "api-errors"], queryFn: () => listApiErrors() });
  const snapshots = useQuery({ queryKey: ["admin", "recon", "snapshots"], queryFn: () => listBalanceSnapshots() });

  const refresh = () => {
    qc.invalidateQueries({ queryKey: ["admin", "recon"] });
    qc.invalidateQueries({ queryKey: ["admin", "finance-overview"] });
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 className="text-lg font-semibold">Reconciliação Pagou</h2>
          <p className="text-sm text-muted-foreground">Webhooks pendentes, jobs de reconciliação e chamadas com erro.</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={refresh}><RefreshCw className="mr-2 h-4 w-4" />Atualizar</Button>
          {isAdmin && (
            <Button size="sm" onClick={() => setSnapOpen(true)}><Plus className="mr-2 h-4 w-4" />Snapshot saldo</Button>
          )}
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Webhooks pendentes / com erro</CardTitle>
          <CardDescription>{webhooks.data?.length ?? 0} evento(s)</CardDescription>
        </CardHeader>
        <CardContent className="p-0 overflow-x-auto">
          {webhooks.isLoading ? <Skeleton className="m-4 h-24" /> : !webhooks.data?.length ? (
            <div className="py-8 text-center text-sm text-muted-foreground">Nenhum webhook pendente.</div>
          ) : (
            <Table>
              <TableHeader><TableRow>
                <TableHead>Evento</TableHead><TableHead>Tipo</TableHead><TableHead>Status</TableHead>
                <TableHead>Recebido</TableHead><TableHead>Erro</TableHead>
              </TableRow></TableHeader>
              <TableBody>
                {webhooks.data.map((w) => (
                  <TableRow key={w.id}>
                    <TableCell className="font-mono text-xs">{w.pagou_event_id}</TableCell>
                    <TableCell className="text-xs">{w.event_type ?? "—"}</TableCell>
                    <TableCell><StatusBadge status={w.processing_status} /></TableCell>
                    <TableCell className="text-xs">{new Date(w.received_at).toLocaleString("pt-BR")}</TableCell>
                    <TableCell className="text-xs text-amber-600 max-w-[320px] truncate">{w.error_message ?? "—"}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Jobs de reconciliação</CardTitle>
          <CardDescription>{jobs.data?.length ?? 0} job(s) abertos</CardDescription>
        </CardHeader>
        <CardContent className="p-0 overflow-x-auto">
          {jobs.isLoading ? <Skeleton className="m-4 h-24" /> : !jobs.data?.length ? (
            <div className="py-8 text-center text-sm text-muted-foreground">Sem jobs pendentes.</div>
          ) : (
            <Table>
              <TableHeader><TableRow>
                <TableHead>Recurso</TableHead><TableHead>Pagou ID</TableHead><TableHead>Status</TableHead>
                <TableHead>Tentativas</TableHead><TableHead>Agendado</TableHead><TableHead>Erro</TableHead>
              </TableRow></TableHeader>
              <TableBody>
                {jobs.data.map((j) => (
                  <TableRow key={j.id}>
                    <TableCell className="text-xs">{j.resource_type}</TableCell>
                    <TableCell className="font-mono text-xs">{j.pagou_resource_id ?? "—"}</TableCell>
                    <TableCell><StatusBadge status={j.status} /></TableCell>
                    <TableCell>{j.attempts}</TableCell>
                    <TableCell className="text-xs">{new Date(j.scheduled_at).toLocaleString("pt-BR")}</TableCell>
                    <TableCell className="text-xs text-amber-600 max-w-[260px] truncate">{j.last_error ?? "—"}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Chamadas Pagou com erro (HTTP ≥ 400)</CardTitle>
          <CardDescription>{apiErrors.data?.length ?? 0} chamada(s)</CardDescription>
        </CardHeader>
        <CardContent className="p-0 overflow-x-auto">
          {apiErrors.isLoading ? <Skeleton className="m-4 h-24" /> : !apiErrors.data?.length ? (
            <div className="py-8 text-center text-sm text-muted-foreground">Sem erros recentes.</div>
          ) : (
            <Table>
              <TableHeader><TableRow>
                <TableHead>Quando</TableHead><TableHead>Endpoint</TableHead>
                <TableHead>Status</TableHead><TableHead>Recurso</TableHead><TableHead>Erro</TableHead>
              </TableRow></TableHeader>
              <TableBody>
                {apiErrors.data.map((l) => (
                  <TableRow key={l.id}>
                    <TableCell className="text-xs">{new Date(l.created_at).toLocaleString("pt-BR")}</TableCell>
                    <TableCell className="font-mono text-xs">{l.method} {l.endpoint}</TableCell>
                    <TableCell><span className="rounded bg-destructive/10 px-2 py-0.5 text-xs text-destructive">{l.http_status}</span></TableCell>
                    <TableCell className="text-xs">{l.entity_type ?? "—"} {l.entity_id ?? ""}</TableCell>
                    <TableCell className="text-xs text-amber-600 max-w-[260px] truncate">{l.error_message ?? "—"}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Snapshots de saldo (Pagou)</CardTitle>
          <CardDescription>Histórico das capturas manuais ou automáticas.</CardDescription>
        </CardHeader>
        <CardContent className="p-0 overflow-x-auto">
          {snapshots.isLoading ? <Skeleton className="m-4 h-24" /> : !snapshots.data?.length ? (
            <div className="py-8 text-center text-sm text-muted-foreground">Nenhum snapshot.</div>
          ) : (
            <Table>
              <TableHeader><TableRow>
                <TableHead>Quando</TableHead><TableHead>Disponível</TableHead>
                <TableHead>Pendente</TableHead><TableHead>Origem</TableHead>
              </TableRow></TableHeader>
              <TableBody>
                {snapshots.data.map((s) => (
                  <TableRow key={s.id}>
                    <TableCell className="text-xs">{new Date(s.captured_at).toLocaleString("pt-BR")}</TableCell>
                    <TableCell className="font-semibold">{s.available_balance_cents == null ? "—" : brl(s.available_balance_cents / 100)}</TableCell>
                    <TableCell>{s.pending_balance_cents == null ? "—" : brl(s.pending_balance_cents / 100)}</TableCell>
                    <TableCell className="text-xs uppercase">{s.source}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <BalanceSnapshotDialog open={snapOpen} onOpenChange={setSnapOpen} onSaved={refresh} />
    </div>
  );
}

function BalanceSnapshotDialog({ open, onOpenChange, onSaved }: { open: boolean; onOpenChange: (v: boolean) => void; onSaved: () => void }) {
  const [available, setAvailable] = useState("");
  const [pending, setPending] = useState("");
  const [notes, setNotes] = useState("");

  const mut = useMutation({
    mutationFn: async () => {
      const a = Math.round(Number(available) * 100);
      const p = Math.round(Number(pending || "0") * 100);
      if (!Number.isFinite(a) || a < 0) throw new Error("Informe o saldo disponível em R$.");
      await insertBalanceSnapshot({ available_balance_cents: a, pending_balance_cents: p, notes: notes || undefined });
    },
    onSuccess: () => {
      toast.success("Snapshot registrado");
      onOpenChange(false);
      setAvailable(""); setPending(""); setNotes("");
      onSaved();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Registrar snapshot de saldo Pagou</DialogTitle>
          <DialogDescription>Use os valores que aparecem no painel da Pagou agora mesmo.</DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Disponível (R$)</Label>
              <Input type="number" step="0.01" min="0" value={available} onChange={(e) => setAvailable(e.target.value)} />
            </div>
            <div>
              <Label>Pendente (R$)</Label>
              <Input type="number" step="0.01" min="0" value={pending} onChange={(e) => setPending(e.target.value)} />
            </div>
          </div>
          <div>
            <Label>Observações</Label>
            <Textarea rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={() => mut.mutate()} disabled={mut.isPending}>Salvar snapshot</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
