import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { ArrowLeft, Loader2, Camera, MapPin, ClipboardList } from "lucide-react";
import { toast } from "sonner";
import { useSession } from "@/hooks/useSession";
import { getMyDriver } from "@/lib/driver";
import {
  listMyAssignments,
  listProofsForAssignment,
  uploadInstallationProof,
  validatePhoto,
  getCurrentGeo,
  getProofSignedUrl,
  type AssignmentWithRelations,
  type Proof,
} from "@/lib/proofs";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { StatusBadge } from "@/components/brand/StatusBadge";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";

export const Route = createFileRoute("/_authenticated/motorista/comprovacoes")({
  component: ProofsPage,
});

function ProofsPage() {
  const { user } = useSession();

  const { data: driver, isLoading: driverLoading } = useQuery({
    queryKey: ["my-driver", user?.id],
    queryFn: () => getMyDriver(user!.id),
    enabled: !!user,
  });

  const { data: assignments, isLoading } = useQuery({
    queryKey: ["my-assignments", driver?.id],
    queryFn: () => listMyAssignments(driver!.id),
    enabled: !!driver,
  });

  if (!user) return null;

  return (
    <div className="mx-auto max-w-3xl space-y-4">
      <Button asChild variant="ghost" size="sm">
        <Link to="/motorista"><ArrowLeft className="mr-2 h-4 w-4" />Voltar</Link>
      </Button>

      <div>
        <h1 className="text-2xl font-bold tracking-tight">Comprovações de instalação</h1>
        <p className="text-sm text-muted-foreground">
          Envie a foto do adesivo já instalado no veículo. Nossa equipe revisará e liberará a campanha.
        </p>
      </div>

      {driverLoading || isLoading ? (
        <p className="text-muted-foreground">Carregando...</p>
      ) : !assignments || assignments.length === 0 ? (
        <Card>
          <CardContent className="py-10 text-center text-muted-foreground">
            <ClipboardList className="mx-auto mb-3 h-10 w-10 opacity-50" />
            Você ainda não tem campanhas atribuídas.
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {assignments.map((a) => (
            <AssignmentCard key={a.id} assignment={a} userId={user.id} />
          ))}
        </div>
      )}
    </div>
  );
}

function AssignmentCard({ assignment, userId }: { assignment: AssignmentWithRelations; userId: string }) {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [observation, setObservation] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const { data: proofs } = useQuery({
    queryKey: ["proofs", assignment.id],
    queryFn: () => listProofsForAssignment(assignment.id),
  });

  const mutation = useMutation({
    mutationFn: async () => {
      if (!file) throw new Error("Selecione uma foto");
      const err = validatePhoto(file);
      if (err) throw new Error(err);
      setSubmitting(true);
      const geo = await getCurrentGeo();
      return uploadInstallationProof({
        userId,
        assignmentId: assignment.id,
        file,
        observation,
        geo,
      });
    },
    onSuccess: () => {
      toast.success("Comprovação enviada para análise");
      qc.invalidateQueries({ queryKey: ["proofs", assignment.id] });
      setFile(null);
      setObservation("");
      setOpen(false);
    },
    onError: (e: Error) => toast.error(e.message || "Erro ao enviar"),
    onSettled: () => setSubmitting(false),
  });

  const canSubmit = ["accepted", "awaiting_installation", "active", "paused"].includes(assignment.status);
  const hasPending = proofs?.some((p) => p.status === "pending_review");
  const hasApproved = proofs?.some((p) => p.status === "approved");

  return (
    <Card>
      <CardHeader>
        <div className="flex items-start justify-between gap-3">
          <div>
            <CardTitle className="text-base">{assignment.campaign?.name ?? "Campanha"}</CardTitle>
            <CardDescription>
              {assignment.campaign?.city ?? "—"} · Veículo {assignment.vehicle?.plate ?? "—"}
            </CardDescription>
          </div>
          <StatusBadge status={assignment.status} />
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {proofs && proofs.length > 0 && (
          <div className="space-y-2">
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Envios anteriores</p>
            {proofs.map((p) => <ProofRow key={p.id} proof={p} />)}
          </div>
        )}

        {canSubmit && !hasApproved && (
          <Dialog open={open} onOpenChange={setOpen}>
            <Button variant={hasPending ? "outline" : "hero"} onClick={() => setOpen(true)} className="w-full sm:w-auto">
              <Camera className="mr-2 h-4 w-4" />
              {hasPending ? "Reenviar foto" : "Enviar comprovação"}
            </Button>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Enviar comprovação</DialogTitle>
                <DialogDescription>
                  Tire uma foto clara do adesivo aplicado no veículo. Sua localização será registrada para a análise.
                </DialogDescription>
              </DialogHeader>
              <form
                className="space-y-4"
                onSubmit={(e) => { e.preventDefault(); mutation.mutate(); }}
              >
                <div className="space-y-2">
                  <Label htmlFor="photo">Foto do veículo com o adesivo</Label>
                  <Input
                    id="photo"
                    type="file"
                    accept="image/jpeg,image/png,image/webp"
                    capture="environment"
                    onChange={(e) => setFile(e.target.files?.[0] ?? null)}
                    required
                  />
                  <p className="text-xs text-muted-foreground">JPG, PNG ou WebP, até 8MB.</p>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="obs">Observação (opcional)</Label>
                  <Textarea
                    id="obs"
                    rows={3}
                    value={observation}
                    onChange={(e) => setObservation(e.target.value.slice(0, 500))}
                    placeholder="Local de instalação, observações..."
                  />
                  <p className="text-xs text-muted-foreground">{observation.length}/500</p>
                </div>
                <p className="flex items-center gap-2 text-xs text-muted-foreground">
                  <MapPin className="h-3.5 w-3.5" /> Sua localização será solicitada ao enviar.
                </p>
                <DialogFooter>
                  <Button type="submit" variant="hero" disabled={submitting || !file}>
                    {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    Enviar
                  </Button>
                </DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
        )}

        {!canSubmit && (
          <p className="text-xs text-muted-foreground">
            Aguarde o convite ser aceito e liberado para envio de comprovação.
          </p>
        )}
      </CardContent>
    </Card>
  );
}

function ProofRow({ proof }: { proof: Proof }) {
  const [url, setUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function viewPhoto() {
    if (url) {
      window.open(url, "_blank");
      return;
    }
    setLoading(true);
    try {
      const signed = await getProofSignedUrl(proof.photo_url);
      setUrl(signed);
      window.open(signed, "_blank");
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex items-center justify-between rounded-md border bg-muted/30 px-3 py-2">
      <div className="text-sm">
        <div className="font-medium">{new Date(proof.submitted_at).toLocaleString("pt-BR")}</div>
        {proof.rejection_reason && (
          <div className="text-xs text-destructive">{proof.rejection_reason}</div>
        )}
      </div>
      <div className="flex items-center gap-2">
        <StatusBadge status={proof.status} />
        <Button size="sm" variant="ghost" onClick={viewPhoto} disabled={loading}>
          {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : "Ver foto"}
        </Button>
      </div>
    </div>
  );
}
