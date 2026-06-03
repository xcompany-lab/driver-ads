import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Check, X, RotateCcw, MapPin, Calendar, ExternalLink } from "lucide-react";
import {
  listProofsAdmin,
  reviewProof,
  getProofSignedUrlAdmin,
  type ProofStatus,
  type ProofWithRelations,
} from "@/lib/proofs-admin";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { StatusBadge } from "@/components/brand/StatusBadge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";

export const Route = createFileRoute("/_authenticated/admin/comprovacoes")({
  component: ProofsQueue,
});

const STATUS_OPTIONS: { value: ProofStatus | "all"; label: string }[] = [
  { value: "pending_review", label: "Aguardando revisão" },
  { value: "approved", label: "Aprovadas" },
  { value: "rejected", label: "Reprovadas" },
  { value: "resubmission_requested", label: "Reenvio solicitado" },
  { value: "all", label: "Todas" },
];

function fmtDateTime(d: string) {
  return new Date(d).toLocaleString("pt-BR");
}

function ProofsQueue() {
  const [status, setStatus] = useState<ProofStatus | "all">("pending_review");
  const { data, isLoading } = useQuery({
    queryKey: ["admin", "proofs", status],
    queryFn: () => listProofsAdmin(status),
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Comprovações</h1>
          <p className="mt-1 text-muted-foreground">Revise as fotos de instalação enviadas pelos motoristas.</p>
        </div>
        <Select value={status} onValueChange={(v) => setStatus(v as ProofStatus | "all")}>
          <SelectTrigger className="sm:w-64"><SelectValue /></SelectTrigger>
          <SelectContent>
            {STATUS_OPTIONS.map((o) => (
              <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {isLoading ? (
        <div className="grid gap-4 md:grid-cols-2">
          {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-72 rounded-xl" />)}
        </div>
      ) : !data?.length ? (
        <Card><CardContent className="py-16 text-center text-muted-foreground">Nenhuma comprovação nesta categoria.</CardContent></Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {data.map((p) => <ProofCard key={p.id} proof={p} />)}
        </div>
      )}
    </div>
  );
}

function ProofCard({ proof }: { proof: ProofWithRelations }) {
  const qc = useQueryClient();
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [dialog, setDialog] = useState<"reject" | "resubmit" | null>(null);
  const [reason, setReason] = useState("");
  const [activate, setActivate] = useState(true);

  useEffect(() => {
    let mounted = true;
    getProofSignedUrlAdmin(proof.photo_url).then((u) => { if (mounted) setImageUrl(u); }).catch(() => {});
    return () => { mounted = false; };
  }, [proof.photo_url]);

  const review = useMutation({
    mutationFn: (vars: { status: "approved" | "rejected" | "resubmission_requested"; reason?: string }) =>
      reviewProof({
        id: proof.id,
        status: vars.status,
        rejectionReason: vars.reason,
        assignmentId: proof.assignment?.id,
        activateAssignment: vars.status === "approved" && activate,
      }),
    onSuccess: () => {
      toast.success("Comprovação atualizada");
      qc.invalidateQueries({ queryKey: ["admin", "proofs"] });
      qc.invalidateQueries({ queryKey: ["admin", "kpis"] });
      setDialog(null); setReason("");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const a = proof.assignment;
  const driverName = a?.driver?.full_name ?? "Motorista";
  const campaignName = a?.campaign?.name ?? "Campanha";
  const vehicle = a?.vehicle ? `${a.vehicle.brand ?? ""} ${a.vehicle.model} · ${a.vehicle.plate}` : "—";

  return (
    <>
      <Card className="overflow-hidden">
        <div className="relative aspect-video bg-muted">
          {imageUrl ? (
            <img src={imageUrl} alt="Comprovação de instalação" className="h-full w-full object-cover" />
          ) : (
            <Skeleton className="h-full w-full" />
          )}
          <div className="absolute top-2 right-2"><StatusBadge status={proof.status} /></div>
        </div>
        <CardHeader className="pb-2">
          <CardTitle className="text-base truncate">{campaignName}</CardTitle>
          <CardDescription className="truncate">{driverName} · {vehicle}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="grid gap-1.5 text-xs text-muted-foreground">
            <span className="inline-flex items-center gap-1.5"><Calendar className="h-3 w-3" />Enviada {fmtDateTime(proof.submitted_at)}</span>
            {proof.geo_lat != null && proof.geo_lng != null && (
              <a
                href={`https://www.google.com/maps?q=${proof.geo_lat},${proof.geo_lng}`}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1.5 text-primary hover:underline"
              >
                <MapPin className="h-3 w-3" />
                {proof.geo_lat.toFixed(5)}, {proof.geo_lng.toFixed(5)}
                <ExternalLink className="h-3 w-3" />
              </a>
            )}
            {imageUrl && (
              <a href={imageUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 text-primary hover:underline">
                <ExternalLink className="h-3 w-3" /> Abrir foto em tamanho real
              </a>
            )}
          </div>
          {proof.observation && (
            <div className="rounded-md bg-muted p-2 text-xs">
              <span className="font-semibold">Obs. do motorista: </span>{proof.observation}
            </div>
          )}
          {proof.rejection_reason && proof.status !== "pending_review" && (
            <div className="rounded-md bg-destructive/5 border border-destructive/20 p-2 text-xs">
              <span className="font-semibold">Motivo: </span>{proof.rejection_reason}
            </div>
          )}

          {proof.status === "pending_review" && (
            <>
              <label className="flex items-center gap-2 text-xs text-muted-foreground">
                <Checkbox checked={activate} onCheckedChange={(c) => setActivate(c === true)} />
                Ao aprovar, ativar campanha do motorista
              </label>
              <div className="flex flex-wrap gap-2 pt-1">
                <Button size="sm" onClick={() => review.mutate({ status: "approved" })} disabled={review.isPending}>
                  <Check className="mr-1 h-4 w-4" /> Aprovar
                </Button>
                <Button size="sm" variant="outline" onClick={() => setDialog("resubmit")} disabled={review.isPending}>
                  <RotateCcw className="mr-1 h-4 w-4" /> Pedir reenvio
                </Button>
                <Button size="sm" variant="outline" className="text-destructive" onClick={() => setDialog("reject")} disabled={review.isPending}>
                  <X className="mr-1 h-4 w-4" /> Reprovar
                </Button>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      <Dialog open={dialog !== null} onOpenChange={(o) => { if (!o) { setDialog(null); setReason(""); } }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{dialog === "reject" ? "Reprovar comprovação" : "Pedir reenvio"}</DialogTitle>
            <DialogDescription>
              {dialog === "reject"
                ? "Explique o motivo da reprovação. O motorista verá esta mensagem."
                : "Diga ao motorista o que precisa ser ajustado na nova foto."}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label htmlFor="reason">Motivo</Label>
            <Textarea
              id="reason"
              rows={4}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Ex.: foto desfocada, placa não visível, adesivo fora do padrão…"
            />
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => { setDialog(null); setReason(""); }}>Cancelar</Button>
            <Button
              onClick={() => review.mutate({
                status: dialog === "reject" ? "rejected" : "resubmission_requested",
                reason: reason.trim(),
              })}
              disabled={review.isPending || reason.trim().length < 3}
            >
              {review.isPending ? "Enviando…" : "Confirmar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
