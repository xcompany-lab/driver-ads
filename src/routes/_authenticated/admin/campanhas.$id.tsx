import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { ArrowLeft, Check, X, Pause, Play, UserPlus, Trash2, Ban, QrCode, Copy, ExternalLink, LinkIcon } from "lucide-react";
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
import { QrArtExporter } from "@/components/campaigns/QrArtExporter";
import { VehicleImage } from "@/components/VehicleImage";
import { CampaignArt } from "@/components/CampaignArt";
import {
  ensureAssignmentQrCode,
  getCampaignQrCode,
  listAssignmentQrCodes,
  type CampaignQrCode,
} from "@/lib/trackable-qr";
import { getCampaignPlanById, planVehicleTier } from "@/lib/campaign-plans";
import { useVehicleCatalog } from "@/hooks/useVehicleCatalog";
import { resolveVehicleTier } from "@/lib/vehicle-catalog";
import { ensureCampaignCheckoutLink } from "@/lib/public-checkout";

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

  const { data: plan } = useQuery({
    queryKey: ["admin", "campaign", id, "plan", campaign?.plan_id],
    queryFn: () => getCampaignPlanById(campaign!.plan_id!),
    enabled: !!campaign?.plan_id,
  });

  const { data: baseQr } = useQuery({
    queryKey: ["admin", "campaign", id, "base-qr"],
    queryFn: () => getCampaignQrCode(id),
  });

  const { data: assignmentQrs } = useQuery({
    queryKey: ["admin", "campaign", id, "assignment-qrs"],
    queryFn: () => listAssignmentQrCodes(id),
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
  const startReadyAssignments = (assignments ?? []).filter((a) =>
    ["accepted", "awaiting_installation", "active"].includes(a.status),
  );

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
          <div className="grid gap-4 md:grid-cols-[260px_1fr]">
            <div>
              <p className="mb-1 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Arte da campanha</p>
              <CampaignArt path={campaign.art_url} name={campaign.name} />
            </div>
            <div className="grid gap-3 text-sm sm:grid-cols-2 self-start">
              <Info label="Período" value={`${fmt(campaign.period_start)} → ${fmt(campaign.period_end)}`} />
              <Info label="Veículos" value={String(campaign.vehicles_qty)} />
              <Info label="Valor do plano" value={`R$ ${Number(campaign.plan_value).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`} />
              <Info label="Regiões" value={campaign.regions?.length ? campaign.regions.join(", ") : "—"} />
              {adv && <Info label="Responsável" value={`${adv.responsible} · ${adv.email}`} />}
              {adv && <Info label="Telefone" value={adv.phone} />}
            </div>
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
              <Button
                size="sm"
                onClick={() => statusMut.mutate("active")}
                disabled={statusMut.isPending || startReadyAssignments.length === 0}
                title={
                  startReadyAssignments.length === 0
                    ? "Vincule um motorista e aguarde o aceite antes de iniciar."
                    : undefined
                }
              >
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

      <PublicCheckoutLinkCard campaignId={id} advertiserPhone={adv?.phone ?? ""} />

      <Card>
        <CardHeader>
          <div className="flex items-start justify-between gap-3">
            <div>
              <CardTitle className="text-base">Motoristas vinculados</CardTitle>
              <CardDescription>
                {activeAssignments.length} de {campaign.vehicles_qty} vagas preenchidas
              </CardDescription>
            </div>
            <NewAssignmentDialog
              campaignId={id}
              campaignCity={campaign.city}
              planPayoutCents={plan?.driver_payout_cents ?? 0}
              planTier={planVehicleTier(plan)}
            />
          </div>
        </CardHeader>
        <CardContent>
          {!assignments?.length ? (
            <p className="py-8 text-center text-sm text-muted-foreground">Nenhum motorista vinculado ainda.</p>
          ) : (
            <div className="space-y-3">
              {assignments.map((a) => (
                <div key={a.id} className="flex flex-col gap-3 rounded-lg border p-3 sm:flex-row sm:items-center sm:justify-between">
                  <div className="flex min-w-0 items-center gap-3">
                    <VehicleImage brand={a.vehicle?.brand} model={a.vehicle?.model} size={56} />
                    <div className="min-w-0">
                      <p className="font-medium truncate">{a.driver?.full_name ?? "—"}</p>
                      <p className="text-xs text-muted-foreground truncate">
                        {a.vehicle?.brand ?? ""} {a.vehicle?.model} · {a.vehicle?.plate} · {a.driver?.city}
                      </p>
                      <p className="text-xs text-muted-foreground mt-1">
                        Repasse: R$ {Number(a.monthly_payout).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}/mês
                      </p>
                    </div>
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

      <Card>
        <CardHeader>
          <CardTitle className="inline-flex items-center gap-2 text-base">
            <QrCode className="h-4 w-4 text-primary" /> Kits de impressao com QR
          </CardTitle>
          <CardDescription>
            Gere a arte final individual de cada motorista/veiculo vinculado a esta campanha.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {!baseQr ? (
            <p className="text-sm text-muted-foreground">
              Configure o destino do QR no cadastro da campanha do anunciante antes de gerar kits por motorista.
            </p>
          ) : activeAssignments.length === 0 ? (
            <p className="text-sm text-muted-foreground">Vincule ao menos um motorista para gerar os kits.</p>
          ) : (
            <div className="space-y-4">
              {activeAssignments.map((assignment) => {
                const qr = (assignmentQrs ?? []).find(
                  (item) =>
                    (item as CampaignQrCode & { assignment_id?: string | null }).assignment_id === assignment.id,
                );
                return (
                  <AssignmentQrKit
                    key={assignment.id}
                    campaign={campaign}
                    assignment={assignment}
                    qrCode={qr ?? null}
                  />
                );
              })}
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

function PublicCheckoutLinkCard({ campaignId, advertiserPhone }: { campaignId: string; advertiserPhone: string }) {
  const [url, setUrl] = useState("");

  const generate = useMutation({
    mutationFn: () => ensureCampaignCheckoutLink(campaignId),
    onSuccess: (link) => {
      const checkoutUrl = `${window.location.origin}/checkout/${link.token}`;
      setUrl(checkoutUrl);
      toast.success("Link de checkout gerado");
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const copy = async () => {
    if (!url) return;
    try {
      await navigator.clipboard.writeText(url);
      toast.success("Link copiado");
    } catch {
      toast.error("Nao foi possivel copiar o link");
    }
  };

  const whatsappHref = url && advertiserPhone.replace(/\D/g, "").length >= 10
    ? `https://wa.me/55${advertiserPhone.replace(/\D/g, "").replace(/^55/, "")}?text=${encodeURIComponent(
        `Ola! Segue o link para pagamento da sua campanha Driver Ads: ${url}`,
      )}`
    : "";

  return (
    <Card>
      <CardHeader>
        <CardTitle className="inline-flex items-center gap-2 text-base">
          <LinkIcon className="h-4 w-4 text-primary" /> Checkout do anunciante
        </CardTitle>
        <CardDescription>
          Gere um link publico para o cliente pagar sem precisar entrar no portal.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex flex-col gap-2 sm:flex-row">
          <Input readOnly value={url || "Gere o link para copiar ou enviar ao cliente"} className="font-mono text-xs" />
          <Button onClick={() => generate.mutate()} disabled={generate.isPending}>
            {generate.isPending ? "Gerando..." : url ? "Regerar" : "Gerar link"}
          </Button>
          <Button variant="outline" onClick={copy} disabled={!url}>
            <Copy className="mr-1 h-4 w-4" /> Copiar
          </Button>
          {url && (
            <Button variant="outline" asChild>
              <a href={url} target="_blank" rel="noreferrer">
                <ExternalLink className="mr-1 h-4 w-4" /> Abrir
              </a>
            </Button>
          )}
        </div>
        {whatsappHref && (
          <Button variant="secondary" asChild>
            <a href={whatsappHref} target="_blank" rel="noreferrer">Enviar pelo WhatsApp</a>
          </Button>
        )}
      </CardContent>
    </Card>
  );
}

function AssignmentQrKit({
  campaign,
  assignment,
  qrCode,
}: {
  campaign: NonNullable<Awaited<ReturnType<typeof getCampaignAdmin>>>;
  assignment: Awaited<ReturnType<typeof listAssignmentsForCampaign>>[number];
  qrCode: CampaignQrCode | null;
}) {
  const qc = useQueryClient();
  const ensure = useMutation({
    mutationFn: () => ensureAssignmentQrCode(assignment.id),
    onSuccess: () => {
      toast.success("QR individual gerado");
      qc.invalidateQueries({ queryKey: ["admin", "campaign", campaign.id, "assignment-qrs"] });
    },
    onError: (error: Error) => toast.error(error.message),
  });

  return (
    <div className="rounded-lg border p-3">
      <div className="mb-3 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold">{assignment.driver?.full_name ?? "Motorista"}</p>
          <p className="truncate text-xs text-muted-foreground">
            {assignment.vehicle?.brand ?? ""} {assignment.vehicle?.model} · {assignment.vehicle?.plate}
          </p>
        </div>
        {!qrCode && (
          <Button size="sm" onClick={() => ensure.mutate()} disabled={ensure.isPending}>
            {ensure.isPending ? "Gerando..." : "Gerar QR do kit"}
          </Button>
        )}
      </div>
      {qrCode ? (
        <QrArtExporter
          campaign={campaign}
          qrCode={qrCode}
          artUrl={campaign.art_url}
          onGenerated={() => qc.invalidateQueries({ queryKey: ["admin", "campaign", campaign.id, "assignment-qrs"] })}
        />
      ) : (
        <p className="text-xs text-muted-foreground">
          Este vinculo ainda nao tem QR individual. Gere antes de enviar a arte para impressao.
        </p>
      )}
    </div>
  );
}

function NewAssignmentDialog({
  campaignId,
  campaignCity,
  planPayoutCents,
  planTier,
}: {
  campaignId: string;
  campaignCity: string;
  planPayoutCents: number;
  planTier: string;
}) {
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
  const { data: catalog = [] } = useVehicleCatalog();

  // Plano Black só aceita veículos de modelos cadastrados como Black.
  const requireBlack = planTier === "black";
  const vehicleEligible = (v: { brand: string | null; model: string }) =>
    !requireBlack || resolveVehicleTier(v.brand, v.model, catalog) === "black";
  const eligibleDrivers = (drivers ?? []).filter((d) => d.vehicles.some(vehicleEligible));

  const selectedDriver = eligibleDrivers.find((d) => d.id === driverId);
  const selectedDriverVehicles = (selectedDriver?.vehicles ?? []).filter(vehicleEligible);
  const selectedVehicle = selectedDriverVehicles.find((v) => v.id === vehicleId);

  // Pré-preenche o repasse com o valor do plano (editável) ao abrir.
  useEffect(() => {
    if (open && planPayoutCents > 0) {
      setPayout((planPayoutCents / 100).toFixed(2));
    }
  }, [open, planPayoutCents]);

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
          <DialogDescription>
            Apenas motoristas aprovados de {campaignCity}, com veículo aprovado, aparecem aqui.
            {requireBlack && " Esta é uma campanha Black: só veículos de modelos Black são aceitos."}
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label>Motorista</Label>
            <Select value={driverId} onValueChange={(v) => { setDriverId(v); setVehicleId(""); }}>
              <SelectTrigger><SelectValue placeholder={isLoading ? "Carregando…" : "Selecione"} /></SelectTrigger>
              <SelectContent>
                {eligibleDrivers.map((d) => (
                  <SelectItem key={d.id} value={d.id}>{d.full_name} · {d.city}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            {drivers && eligibleDrivers.length === 0 && (
              <p className="rounded-md border border-dashed bg-muted/30 p-3 text-xs text-muted-foreground">
                Não há motorista disponível para esta localização ({campaignCity}). Para aparecer aqui, o motorista
                precisa estar <strong>aprovado</strong>, ter <strong>veículo aprovado</strong> e estar cadastrado na
                <strong> mesma cidade</strong> da campanha
                {requireBlack && (
                  <> — e, por ser campanha <strong>Black</strong>, ter um <strong>veículo de modelo Black</strong></>
                )}.
              </p>
            )}
          </div>
          <div className="space-y-2">
            <Label>Veículo</Label>
            <Select value={vehicleId} onValueChange={setVehicleId} disabled={!selectedDriver}>
              <SelectTrigger><SelectValue placeholder={selectedDriver ? "Selecione" : "Selecione um motorista"} /></SelectTrigger>
              <SelectContent>
                {selectedDriverVehicles.map((v) => (
                  <SelectItem key={v.id} value={v.id}>
                    <span className="flex items-center gap-2">
                      <VehicleImage brand={v.brand} model={v.model} size={28} />
                      {v.brand} {v.model} · {v.plate}
                    </span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {selectedVehicle && (
              <div className="flex items-center gap-3 rounded-lg border bg-muted/30 p-3">
                <VehicleImage brand={selectedVehicle.brand} model={selectedVehicle.model} size={64} />
                <div className="text-sm">
                  <p className="font-medium">{selectedVehicle.brand} {selectedVehicle.model}</p>
                  <p className="font-mono text-muted-foreground">{selectedVehicle.plate}</p>
                </div>
              </div>
            )}
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
