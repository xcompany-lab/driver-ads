import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { ArrowLeft, Loader2, Camera, MapPin, ClipboardList, ShieldCheck, FileText } from "lucide-react";
import { toast } from "sonner";
import { useSession } from "@/hooks/useSession";
import { getMyDriver, listMyVehicles } from "@/lib/driver";
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
import {
  DRIVER_DOC_LABELS,
  DRIVER_DOC_ORDER,
  uploadDriverDoc,
  updateDriverDoc,
  updateVehicleCrlv,
  type DriverDocKey,
} from "@/lib/driver-documents";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { StatusBadge } from "@/components/brand/StatusBadge";
import { DocumentUploadField } from "@/components/brand/DocumentUploadField";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";

export const Route = createFileRoute("/_authenticated/motorista/auditoria")({
  component: AuditoriaPage,
});

function AuditoriaPage() {
  const { user } = useSession();

  const { data: driver, isLoading: driverLoading } = useQuery({
    queryKey: ["my-driver", user?.id],
    queryFn: () => getMyDriver(user!.id),
    enabled: !!user,
  });

  const { data: vehicles } = useQuery({
    queryKey: ["my-vehicles", driver?.id],
    queryFn: () => listMyVehicles(driver!.id),
    enabled: !!driver,
  });

  const { data: assignments, isLoading: assignmentsLoading } = useQuery({
    queryKey: ["my-assignments", driver?.id],
    queryFn: () => listMyAssignments(driver!.id),
    enabled: !!driver,
  });

  if (!user) return null;

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <Button asChild variant="ghost" size="sm">
        <Link to="/motorista"><ArrowLeft className="mr-2 h-4 w-4" />Voltar</Link>
      </Button>

      <div>
        <h1 className="text-2xl font-bold tracking-tight">Auditoria</h1>
        <p className="text-sm text-muted-foreground">
          Acompanhe a verificação de identidade e envie as fotos de instalação das suas campanhas.
        </p>
      </div>

      {/* Section 1: Identity verification */}
      <Card>
        <CardHeader>
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-start gap-2">
              <ShieldCheck className="h-5 w-5 mt-0.5 text-primary" />
              <div>
                <CardTitle className="text-base">Verificação de identidade</CardTitle>
                <CardDescription>
                  Envie seus documentos pessoais e o CRLV de cada veículo para validação do nosso time.
                </CardDescription>
              </div>
            </div>
            {driver && <StatusBadge status={driver.status} />}
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {driverLoading ? (
            <p className="text-muted-foreground">Carregando...</p>
          ) : !driver ? (
            <div className="rounded-md border border-dashed p-4 text-sm text-muted-foreground">
              Complete seu cadastro antes de enviar os documentos.{" "}
              <Link to="/motorista/perfil" className="text-primary hover:underline">Ir para o perfil</Link>
            </div>
          ) : (
            <>
              <div className="grid gap-3 sm:grid-cols-2">
                {DRIVER_DOC_ORDER.map((key) => (
                  <DocumentUploadField
                    key={key}
                    label={DRIVER_DOC_LABELS[key]}
                    currentPath={(driver as unknown as Record<DriverDocKey, string | null>)[key]}
                    onUpload={async (file) => {
                      const path = await uploadDriverDoc({ userId: user.id, driverId: driver.id, key, file });
                      await updateDriverDoc(driver.id, key, path);
                    }}
                  />
                ))}
              </div>

              <div className="space-y-2">
                <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">CRLV dos veículos</p>
                {(vehicles ?? []).length === 0 ? (
                  <div className="rounded-md border border-dashed p-3 text-sm text-muted-foreground">
                    Nenhum veículo cadastrado.{" "}
                    <Link to="/motorista/veiculos" className="text-primary hover:underline">Cadastrar veículo</Link>
                  </div>
                ) : (
                  <div className="grid gap-3 sm:grid-cols-2">
                    {(vehicles ?? []).map((v) => (
                      <DocumentUploadField
                        key={v.id}
                        label={`CRLV — ${v.plate}`}
                        currentPath={(v as unknown as { crlv_url?: string | null }).crlv_url ?? null}
                        onUpload={async (file) => {
                          const path = await uploadDriverDoc({
                            userId: user.id,
                            driverId: driver.id,
                            key: "crlv",
                            vehicleId: v.id,
                            file,
                          });
                          await updateVehicleCrlv(v.id, path);
                        }}
                      />
                    ))}
                  </div>
                )}
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {/* Section 2: Installation photos tied to campaigns */}
      <Card>
        <CardHeader>
          <div className="flex items-start gap-2">
            <Camera className="h-5 w-5 mt-0.5 text-primary" />
            <div>
              <CardTitle className="text-base">Foto da instalação por campanha</CardTitle>
              <CardDescription>
                Envie a foto do adesivo instalado no veículo para cada campanha em que você está atrelado.
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {assignmentsLoading ? (
            <p className="text-muted-foreground">Carregando campanhas...</p>
          ) : !assignments || assignments.length === 0 ? (
            <div className="py-8 text-center text-muted-foreground">
              <ClipboardList className="mx-auto mb-3 h-10 w-10 opacity-50" />
              <p className="text-sm">Você ainda não tem campanhas atribuídas.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {assignments.map((a) => (
                <AssignmentCard key={a.id} assignment={a} userId={user.id} />
              ))}
            </div>
          )}
        </CardContent>
      </Card>
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
    <div className="rounded-lg border bg-card/50 p-4 space-y-3">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="font-semibold">{assignment.campaign?.name ?? "Campanha"}</p>
          <p className="text-xs text-muted-foreground">
            {assignment.campaign?.city ?? "—"} · Veículo {assignment.vehicle?.plate ?? "—"}
          </p>
        </div>
        <StatusBadge status={assignment.status} />
      </div>

      {proofs && proofs.length > 0 && (
        <div className="space-y-2">
          <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Envios anteriores</p>
          {proofs.map((p) => <ProofRow key={p.id} proof={p} />)}
        </div>
      )}

      {canSubmit && !hasApproved && (
        <Dialog open={open} onOpenChange={setOpen}>
          <Button variant={hasPending ? "outline" : "hero"} onClick={() => setOpen(true)} size="sm">
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
        <p className="flex items-center gap-2 text-xs text-muted-foreground">
          <FileText className="h-3.5 w-3.5" />
          Aguarde o convite ser aceito e liberado para envio de comprovação.
        </p>
      )}
    </div>
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
