import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Plus, FileText, Wallet, Receipt, Trash2, ExternalLink, RefreshCw } from "lucide-react";
import {
  listAdvertiserPayments,
  createAdvertiserPayment,
  updateAdvertiserPaymentStatus,
  deleteAdvertiserPayment,
  listDriverPayouts,
  updateDriverPayoutStatus,
  deleteDriverPayout,
  generateMonthlyPayouts,
  getReceiptSignedUrl,
  uploadReceipt,
  type AdvertiserPaymentStatus,
  type DriverPayoutStatus,
  type AdvertiserPaymentWithRelations,
  type DriverPayoutWithRelations,
} from "@/lib/finance";
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

      <Tabs defaultValue="invoices">
        <TabsList>
          <TabsTrigger value="invoices"><FileText className="mr-2 h-4 w-4" />Faturas — Anunciantes</TabsTrigger>
          <TabsTrigger value="payouts"><Wallet className="mr-2 h-4 w-4" />Repasses — Motoristas</TabsTrigger>
        </TabsList>
        <TabsContent value="invoices" className="mt-4"><InvoicesTab /></TabsContent>
        <TabsContent value="payouts" className="mt-4"><PayoutsTab /></TabsContent>
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
    mutationFn: () => generateMonthlyPayouts(refMonth),
    onSuccess: (r) => {
      toast.success(`Repasses gerados: ${r.created} novos, ${r.skipped} já existentes.`);
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
              <RefreshCw className="mr-2 h-4 w-4" />Gerar repasses
            </Button>
          </div>
        )}
      </div>

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
