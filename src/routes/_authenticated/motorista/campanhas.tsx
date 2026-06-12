import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { ArrowLeft, Calendar, Car, Check, MapPin, X, Loader2, Inbox, ImageIcon } from "lucide-react";
import { toast } from "sonner";
import { useSession } from "@/hooks/useSession";
import { getMyDriver, listMyVehicles } from "@/lib/driver";
import { listMyAssignments, type AssignmentWithRelations } from "@/lib/proofs";
import { respondToAssignment } from "@/lib/assignments";
import {
  applyToAvailableCampaign,
  listAvailableCampaignsForDriver,
  type AvailableDriverCampaign,
} from "@/lib/driver-campaign-marketplace";
import { getCampaignArtUrl } from "@/lib/campaigns";
import { useVehicleCatalog } from "@/hooks/useVehicleCatalog";
import { resolveVehicleTier } from "@/lib/vehicle-catalog";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/brand/StatusBadge";

export const Route = createFileRoute("/_authenticated/motorista/campanhas")({
  component: CampaignsPage,
});

function CampaignsPage() {
  const { user } = useSession();

  const { data: driver } = useQuery({
    queryKey: ["my-driver", user?.id],
    queryFn: () => getMyDriver(user!.id),
    enabled: !!user,
  });

  const { data: vehicles } = useQuery({
    queryKey: ["my-vehicles", driver?.id],
    queryFn: () => listMyVehicles(driver!.id),
    enabled: !!driver,
  });

  const { data: assignments, isLoading } = useQuery({
    queryKey: ["my-assignments", driver?.id],
    queryFn: () => listMyAssignments(driver!.id),
    enabled: !!driver,
  });

  const { data: available, isLoading: loadingAvailable } = useQuery({
    queryKey: ["available-driver-campaigns", driver?.id],
    queryFn: () => listAvailableCampaignsForDriver(driver!.id),
    enabled: !!driver && driver.status === "approved",
  });

  const { data: catalog = [] } = useVehicleCatalog();
  const approvedVehicles = (vehicles ?? []).filter((v) => v.status === "approved" || v.crlv_status === "approved");
  const eligibleVehicle = approvedVehicles[0];
  const blackVehicle = approvedVehicles.find((v) => resolveVehicleTier(v.brand, v.model, catalog) === "black");
  const current = (assignments ?? []).filter((a) => ["invited", "accepted", "awaiting_installation", "active", "paused"].includes(a.status));
  const history = (assignments ?? []).filter((a) => ["declined", "completed", "cancelled"].includes(a.status));

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <Button asChild variant="ghost" size="sm">
        <Link to="/motorista"><ArrowLeft className="mr-2 h-4 w-4" />Voltar</Link>
      </Button>

      <div>
        <h1 className="text-2xl font-bold tracking-tight">Campanhas</h1>
        <p className="text-sm text-muted-foreground">Disponiveis, vinculos ativos e historico.</p>
      </div>

      <section className="space-y-3">
        <div>
          <h2 className="text-lg font-semibold">Disponiveis para voce</h2>
          <p className="text-sm text-muted-foreground">Campanhas pagas e aprovadas na sua cidade, aguardando motorista.</p>
        </div>
        {loadingAvailable ? (
          <p className="text-muted-foreground">Carregando campanhas disponiveis...</p>
        ) : !available || available.length === 0 ? (
          <EmptyState text="Nenhuma campanha disponivel no momento." />
        ) : (
          <div className="grid gap-4 md:grid-cols-2">
            {available.map((campaign) => {
              const requiresBlack = campaign.vehicle_tier === "black";
              return (
                <AvailableCampaignCard
                  key={campaign.id}
                  campaign={campaign}
                  driverId={driver!.id}
                  vehicleId={requiresBlack ? blackVehicle?.id : eligibleVehicle?.id}
                  requiresBlack={requiresBlack}
                />
              );
            })}
          </div>
        )}
      </section>

      <section className="space-y-3">
        <div>
          <h2 className="text-lg font-semibold">Meus vinculos</h2>
          <p className="text-sm text-muted-foreground">Convites, candidaturas e campanhas em andamento.</p>
        </div>
        {isLoading ? (
          <p className="text-muted-foreground">Carregando...</p>
        ) : current.length === 0 ? (
          <EmptyState text="Voce ainda nao tem vinculos ativos ou pendentes." />
        ) : (
          <div className="space-y-3">
            {current.map((a) => <AssignmentRow key={a.id} assignment={a} />)}
          </div>
        )}
      </section>

      {history.length > 0 && (
        <section className="space-y-3">
          <div>
            <h2 className="text-lg font-semibold">Historico</h2>
            <p className="text-sm text-muted-foreground">Campanhas finalizadas, recusadas ou canceladas.</p>
          </div>
          <div className="space-y-3">
            {history.map((a) => <AssignmentRow key={a.id} assignment={a} />)}
          </div>
        </section>
      )}
    </div>
  );
}

function EmptyState({ text }: { text: string }) {
  return (
    <Card>
      <CardContent className="py-8 text-center text-muted-foreground">
        <Inbox className="mx-auto mb-3 h-9 w-9 opacity-50" />
        {text}
      </CardContent>
    </Card>
  );
}

function CampaignArt({ path, name }: { path: string | null | undefined; name: string }) {
  const [url, setUrl] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;
    if (!path) {
      setUrl(null);
      return;
    }
    getCampaignArtUrl(path).then((signed) => {
      if (mounted) setUrl(signed);
    });
    return () => {
      mounted = false;
    };
  }, [path]);

  return (
    <div className="aspect-[16/9] overflow-hidden rounded-md border bg-muted">
      {url ? (
        <img src={url} alt={name} className="h-full w-full object-cover" />
      ) : (
        <div className="grid h-full place-items-center text-muted-foreground">
          <ImageIcon className="h-8 w-8" />
        </div>
      )}
    </div>
  );
}

function AvailableCampaignCard({ campaign, driverId, vehicleId, requiresBlack }: { campaign: AvailableDriverCampaign; driverId: string; vehicleId?: string; requiresBlack?: boolean }) {
  const qc = useQueryClient();
  const mutation = useMutation({
    mutationFn: () => {
      if (!vehicleId) {
        throw new Error(
          requiresBlack
            ? "Esta campanha Black exige um veiculo de modelo Black aprovado."
            : "Cadastre e aprove um veiculo antes de se candidatar.",
        );
      }
      return applyToAvailableCampaign({ campaignId: campaign.id, driverId, vehicleId });
    },
    onSuccess: () => {
      toast.success("Candidatura enviada");
      qc.invalidateQueries({ queryKey: ["available-driver-campaigns", driverId] });
      qc.invalidateQueries({ queryKey: ["my-assignments", driverId] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <Card className="overflow-hidden">
      <CampaignArt path={campaign.art_url} name={campaign.name} />
      <CardHeader>
        <div className="flex items-start justify-between gap-3">
          <div>
            <CardTitle className="text-base">{campaign.name}</CardTitle>
            <CardDescription className="space-y-1">
              <span className="flex items-center gap-1.5"><MapPin className="h-3.5 w-3.5" />{campaign.city}</span>
              <span className="flex items-center gap-1.5"><Calendar className="h-3.5 w-3.5" />{fmt(campaign.period_start)} a {fmt(campaign.period_end)}</span>
            </CardDescription>
          </div>
          <div className="flex shrink-0 flex-col items-end gap-1">
            {requiresBlack && (
              <span className="rounded-full bg-foreground px-2 py-1 text-xs font-semibold text-background">Black</span>
            )}
            <span className="rounded-full bg-primary/10 px-2 py-1 text-xs font-medium text-primary">
              {campaign.available_slots} vaga(s)
            </span>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {campaign.description && <p className="line-clamp-2 text-sm text-muted-foreground">{campaign.description}</p>}
        <div className="flex items-center justify-between rounded-md bg-muted/40 px-3 py-2 text-sm">
          <span className="text-muted-foreground">Repasse mensal previsto</span>
          <span className="font-semibold">{money(campaign.monthly_payout)}</span>
        </div>
        {requiresBlack && !vehicleId && (
          <p className="rounded-md border border-dashed bg-muted/30 p-2 text-xs text-muted-foreground">
            Campanha <strong>Black</strong>: requer um veículo de <strong>modelo Black</strong> aprovado no seu cadastro.
          </p>
        )}
        <Button
          variant="hero"
          className="w-full"
          disabled={mutation.isPending || !vehicleId}
          onClick={() => mutation.mutate()}
        >
          {mutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          Candidatar-se
        </Button>
      </CardContent>
    </Card>
  );
}

function AssignmentRow({ assignment }: { assignment: AssignmentWithRelations }) {
  const qc = useQueryClient();
  const mutation = useMutation({
    mutationFn: (accept: boolean) => respondToAssignment(assignment.id, accept),
    onSuccess: (_, accept) => {
      toast.success(accept ? "Convite aceito" : "Convite recusado");
      qc.invalidateQueries({ queryKey: ["my-assignments"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const isInvite = assignment.status === "invited";

  return (
    <Card>
      <CardContent className="grid gap-4 p-4 sm:grid-cols-[180px_1fr]">
        <CampaignArt path={assignment.campaign?.art_url} name={assignment.campaign?.name ?? "Campanha"} />
        <div className="space-y-3">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <CardTitle className="text-base">{assignment.campaign?.name ?? "Campanha"}</CardTitle>
              <CardDescription className="space-y-1">
                <span className="flex items-center gap-1.5"><MapPin className="h-3.5 w-3.5" />{assignment.campaign?.city ?? "-"}</span>
                <span className="flex items-center gap-1.5"><Car className="h-3.5 w-3.5" />{assignment.vehicle?.plate} - {assignment.vehicle?.model}</span>
                {assignment.campaign && (
                  <span className="flex items-center gap-1.5"><Calendar className="h-3.5 w-3.5" />{fmt(assignment.campaign.period_start)} a {fmt(assignment.campaign.period_end)}</span>
                )}
              </CardDescription>
            </div>
            <StatusBadge status={assignment.status} />
          </div>

          <div className="flex items-center justify-between rounded-md bg-muted/40 px-3 py-2 text-sm">
            <span className="text-muted-foreground">Repasse mensal</span>
            <span className="font-semibold">{money(Number(assignment.monthly_payout))}</span>
          </div>

          {assignment.notes && (
            <p className="text-sm text-muted-foreground">
              <span className="font-medium text-foreground">Instrucoes: </span>{assignment.notes}
            </p>
          )}

          {isInvite && (
            <div className="flex gap-2">
              <Button
                variant="hero"
                className="flex-1"
                disabled={mutation.isPending}
                onClick={() => mutation.mutate(true)}
              >
                {mutation.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Check className="mr-2 h-4 w-4" />}
                Aceitar
              </Button>
              <Button
                variant="outline"
                className="flex-1"
                disabled={mutation.isPending}
                onClick={() => mutation.mutate(false)}
              >
                <X className="mr-2 h-4 w-4" />Recusar
              </Button>
            </div>
          )}

          {["accepted", "awaiting_installation", "active", "paused"].includes(assignment.status) && (
            <Button asChild variant="outline" size="sm" className="w-full sm:w-auto">
              <Link to="/motorista/auditoria">Enviar / ver comprovacoes</Link>
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

function fmt(d: string) {
  return new Date(d).toLocaleDateString("pt-BR");
}

function money(value: number) {
  return Number(value).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}
