import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { ArrowLeft, Check, X, Pause, Play, UserPlus, Trash2, Ban } from "lucide-react";
import {
  getCampaignAdmin,
  listAssignmentsForCampaign,
  listEligibleDriversForCampaign,
  createAssignment,
  updateAssignmentStatusAdmin,
  updateCampaignStatus,
  deleteAssignment,
  type AssignmentStatus,
  type CampaignStatus,
} from "@/lib/campaigns-admin";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { StatusBadge } from "@/components/brand/StatusBadge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

export const Route = createFileRoute("/_authenticated/admin/campanhas/$id")({
  component: CampaignDetailAdmin,
});

function fmt(d: string) {
  return new Date(d).toLocaleDateString("pt-BR");
}

function CampaignDetailAdmin() {
  const { id } = Route.useParams();
  const qc = useQueryClient();

  const { data: campaign, isLoading } = useQuery({
    queryKey: ["admin", "campaign", id],
    queryFn: () => getCampaignAdmin(id),
  });

  const { data: assignments } = useQuery({
    queryKey: ["admin", "campaign", id, "assignments"],
    queryFn: () => listAssignmentsForCampaign(id),
  });

  const statusMut = useMutation({
    mutationFn: (status: CampaignStatus) => updateCampaignStatus(id, status),
    onSuccess: () => {
      toast.success("Campanha atualizada");
      qc.invalidateQueries({ queryKey: ["admin", "campaign", id] });
      qc.invalidateQueries({ queryKey: ["admin", "campaigns"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const assignmentMut = useMutation({
    mutationFn: ({ aid, status }: { aid: string; status: AssignmentStatus }) =>
      updateAssignmentStatusAdmin(aid, status),
    onSuccess: () => {
      toast.success("Vínculo atualizado");
      qc.invalidateQueries({ queryKey: ["admin", "campaign", id, "assignments"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const deleteMut = useMutation({
    mutationFn: (aid: string) => deleteAssignment(aid),
    onSuccess: () => {
      toast.success("Vínculo removido");
      qc.invalidateQueries({ queryKey: ["admin", "campaign", id, "assignments"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  if (isLoading || !campaign) {
    return <div className="space-y-4"><Skeleton className="h-12 w-1/2" /><Skeleton className="h-40" /></div>;
  }

  const adv = (campaign as { advertiser?: { company_name: string; city: string; responsible: string; email: string; phone: string } | null }).advertiser;
  const activeAssignments = (assignments ?? []).filter((a) => !["declined", "cancelled"].includes(a.status));

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <Link to="/admin/campanhas" className="inline-flex items-center text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="mr-1 h-4 w-4" /> Voltar para campanhas
        </Link>
        <StatusBadge status={campaign.status} />
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-2xl">{campaign.name}</CardTitle>
          <CardDescription>{adv?.company_name} · {campaign.city}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-3 text-sm sm:grid-cols-2 lg:grid-cols-3">
            <Info label="Período" value={`${fmt(campaign.period_start)} → ${fmt(campaign.period_end)}`} />
            <Info label="Veículos" value={String(campaign.vehicles_qty)} />
            <Info label="Valor do plano" value={`R$ ${Number(campaign.plan_value).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`} />
            <Info label="Regiões" value={campaign.regions?.length ? campaign.regions.join(", ") : "—"} />
            {adv && <Info label="Responsável" value={`${adv.responsible} · ${adv.email}`} />}
            {adv && <Info label="Telefone" value={adv.phone} />}
          </div>
          {campaign.description && (
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Descrição</p>
              <p className="text-sm mt-1">{campaign.description}</p>
            </div>
          )}
          {campaign.observations && (
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Observações</p>
              <p className="text-sm mt-1">{campaign.observations}</p>
            </div>
          )}

          <div className="flex flex-wrap gap-2 pt-2 border-t">
            {campaign.status === "pending_review" && (
              <>
                <Button size="sm" onClick={() => statusMut.mutate("approved")} disabled={statusMut.isPending}>
                  <Check className="mr-1 h-4 w-4" /> Aprovar
                </Button>
                <Button size="sm" variant="outline" onClick={() => statusMut.mutate("rejected")} disabled={statusMut.isPending}>
                  <X className="mr-1 h-4 w-4" /> Reprovar
                </Button>
              </>
            )}
            {campaign.status === "approved" && (
              <Button size="sm" onClick={() => statusMut.mutate("active")} disabled={statusMut.isPending}>
                <Play className="mr-1 h-4 w-4" /> Iniciar campanha
              </Button>
            )}
            {campaign.status === "active" && (
              <>
                <Button size="sm" variant="outline" onClick={() => statusMut.mutate("paused")} disabled={statusMut.isPending}>
                  <Pause className="mr-1 h-4 w-4" /> Pausar
                </Button>
                <Button size="sm" variant="outline" onClick={() => statusMut.mutate("completed")} disabled={statusMut.isPending}>
                  Encerrar
                </Button>
              </>
            )}
            {campaign.status === "paused" && (
              <Button size="sm" onClick={() => statusMut.mutate("active")} disabled={statusMut.isPending}>
                <Play className="mr-1 h-4 w-4" /> Retomar
              </Button>
            )}
            {!["cancelled", "completed", "draft"].includes(campaign.status) && (
              <Button size="sm" variant="ghost" onClick={() => statusMut.mutate("cancelled")} disabled={statusMut.isPending}>
                <Ban className="mr-1 h-4 w-4" /> Cancelar
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div className="flex items-start justify-between gap-3">
            <div>
              <CardTitle className="text-base">Motoristas vinculados</CardTitle>
              <CardDescription>
                {activeAssignments.length} de {campaign.vehicles_qty} vagas preenchidas
              </CardDescription>
            </div>
            <NewAssignmentDialog campaignId={id} />
          </div>
        </CardHeader>
        <CardContent>
          {!assignments?.length ? (
            <p className="py-8 text-center text-sm text-muted-foreground">Nenhum motorista vinculado ainda.</p>
          ) : (
            <div className="space-y-3">
              {assignments.map((a) => (
                <div key={a.id} className="flex flex-col gap-3 rounded-lg border p-3 sm:flex-row sm:items-center sm:justify-between">
                  <div className="min-w-0">
                    <p className="font-medium truncate">{a.driver?.full_name ?? "—"}</p>
                    <p className="text-xs text-muted-foreground truncate">
                      {a.vehicle?.brand ?? ""} {a.vehicle?.model} · {a.vehicle?.plate} · {a.driver?.city}
                    </p>
                    <p className="text-xs text-muted-foreground mt-1">
                      Repasse: R$ {Number(a.monthly_payout).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}/mês
                    </p>
                  </div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <StatusBadge status={a.status} />
                    {a.status === "accepted" && (
                      <Button size="sm" variant="outline" onClick={() => assignmentMut.mutate({ aid: a.id, status: "awaiting_installation" })}>
                        Liberar instalação
                      </Button>
                    )}
                    {a.status === "awaiting_installation" && (
                      <Button size="sm" variant="outline" onClick={() => assignmentMut.mutate({ aid: a.id, status: "active" })}>
                        Marcar ativo
                      </Button>
                    )}
                    {!["cancelled", "completed", "declined"].includes(a.status) && (
                      <Button size="sm" variant="ghost" onClick={() => assignmentMut.mutate({ aid: a.id, status: "cancelled" })}>
                        Cancelar
                      </Button>
                    )}
                    <Button size="sm" variant="ghost" className="text-destructive" onClick={() => deleteMut.mutate(a.id)}>
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{label}</p>
      <p className="mt-0.5">{value}</p>
    </div>
  );
}

function NewAssignmentDialog({ campaignId }: { campaignId: string }) {
  const [open, setOpen] = useState(false);
  const [driverId, setDriverId] = useState("");
  const [vehicleId, setVehicleId] = useState("");
  const [payout, setPayout] = useState("");
  const [notes, setNotes] = useState("");
  const qc = useQueryClient();

  const { data: drivers, isLoading } = useQuery({
    queryKey: ["admin", "campaign", campaignId, "eligible-drivers"],
    queryFn: () => listEligibleDriversForCampaign(campaignId),
    enabled: open,
  });

  const selectedDriver = drivers?.find((d) => d.id === driverId);

  const create = useMutation({
    mutationFn: () =>
      createAssignment({
        campaignId,
        driverId,
        vehicleId,
        monthlyPayout: Number(payout || 0),
        notes: notes.trim() || undefined,
      }),
    onSuccess: () => {
      toast.success("Motorista vinculado");
      qc.invalidateQueries({ queryKey: ["admin", "campaign", campaignId, "assignments"] });
      setOpen(false);
      setDriverId(""); setVehicleId(""); setPayout(""); setNotes("");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm"><UserPlus className="mr-1 h-4 w-4" /> Vincular motorista</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Vincular motorista</DialogTitle>
          <DialogDescription>Apenas motoristas aprovados da cidade da campanha aparecem aqui.</DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label>Motorista</Label>
            <Select value={driverId} onValueChange={(v) => { setDriverId(v); setVehicleId(""); }}>
              <SelectTrigger><SelectValue placeholder={isLoading ? "Carregando…" : "Selecione"} /></SelectTrigger>
              <SelectContent>
                {(drivers ?? []).filter((d) => d.vehicles.length > 0).map((d) => (
                  <SelectItem key={d.id} value={d.id}>{d.full_name} · {d.city}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            {drivers && drivers.length === 0 && (
              <p className="text-xs text-muted-foreground">Nenhum motorista aprovado nessa cidade.</p>
            )}
          </div>
          <div className="space-y-2">
            <Label>Veículo</Label>
            <Select value={vehicleId} onValueChange={setVehicleId} disabled={!selectedDriver}>
              <SelectTrigger><SelectValue placeholder={selectedDriver ? "Selecione" : "Selecione um motorista"} /></SelectTrigger>
              <SelectContent>
                {(selectedDriver?.vehicles ?? []).map((v) => (
                  <SelectItem key={v.id} value={v.id}>{v.brand} {v.model} · {v.plate}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="payout">Repasse mensal (R$)</Label>
            <Input id="payout" type="number" min={0} step={0.01} value={payout} onChange={(e) => setPayout(e.target.value)} placeholder="0.00" />
          </div>
          <div className="space-y-2">
            <Label htmlFor="notes">Observações (opcional)</Label>
            <Textarea id="notes" value={notes} onChange={(e) => setNotes(e.target.value)} rows={3} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => setOpen(false)}>Cancelar</Button>
          <Button
            onClick={() => create.mutate()}
            disabled={!driverId || !vehicleId || !payout || create.isPending}
          >
            {create.isPending ? "Enviando…" : "Vincular"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
