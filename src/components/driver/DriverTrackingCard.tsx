import { useEffect, useMemo, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Loader2, MapPin, Power, ShieldCheck, Square } from "lucide-react";
import { toast } from "sonner";

import type { AssignmentWithRelations } from "@/lib/proofs";
import {
  endDriverTrackingSession,
  getMyTrackingStatus,
  ingestDriverLocationPoint,
  revokeDriverLocationConsent,
  shouldSendPoint,
  startDriverTrackingSession,
} from "@/lib/driver-tracking";
import { formatDistance, formatDuration } from "@/lib/campaign-analytics";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

const TRACKABLE_STATUSES = new Set(["accepted", "awaiting_installation", "active"]);

export function DriverTrackingCard({ assignments }: { assignments: AssignmentWithRelations[] }) {
  const eligible = useMemo(
    () => assignments.filter((assignment) => TRACKABLE_STATUSES.has(assignment.status)),
    [assignments],
  );
  const [assignmentId, setAssignmentId] = useState<string | null>(eligible[0]?.id ?? null);
  const [watching, setWatching] = useState(false);
  const watchIdRef = useRef<number | null>(null);
  const activeSessionRef = useRef<string | null>(null);
  const lastSentRef = useRef<{ lat: number; lng: number; sentAt: number } | null>(null);
  const qc = useQueryClient();

  useEffect(() => {
    if (!assignmentId && eligible[0]) setAssignmentId(eligible[0].id);
  }, [assignmentId, eligible]);

  const selected = eligible.find((assignment) => assignment.id === assignmentId) ?? null;
  const { data: status, isLoading } = useQuery({
    queryKey: ["driver-tracking-status", assignmentId],
    queryFn: () => getMyTrackingStatus(assignmentId!),
    enabled: !!assignmentId,
  });

  useEffect(() => {
    activeSessionRef.current = status?.active_session_id ?? null;
  }, [status?.active_session_id]);

  useEffect(() => {
    return () => clearWatch();
  }, []);

  const startMutation = useMutation({
    mutationFn: async () => {
      if (!assignmentId) throw new Error("Selecione uma campanha.");
      if (!navigator.geolocation) throw new Error("Geolocalizacao indisponivel neste navegador.");
      const sessionId = await startDriverTrackingSession(assignmentId);
      activeSessionRef.current = sessionId;
      startWatch(sessionId);
      return sessionId;
    },
    onSuccess: () => {
      toast.success("Rastreamento iniciado");
      qc.invalidateQueries({ queryKey: ["driver-tracking-status", assignmentId] });
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const stopMutation = useMutation({
    mutationFn: async () => {
      const sessionId = activeSessionRef.current ?? status?.active_session_id;
      if (!sessionId) throw new Error("Nenhuma sessao ativa.");
      clearWatch();
      return endDriverTrackingSession(sessionId);
    },
    onSuccess: () => {
      activeSessionRef.current = null;
      toast.success("Rastreamento encerrado");
      qc.invalidateQueries({ queryKey: ["driver-tracking-status", assignmentId] });
      qc.invalidateQueries({ queryKey: ["campaign-tracking-analytics"] });
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const revokeMutation = useMutation({
    mutationFn: revokeDriverLocationConsent,
    onSuccess: () => {
      clearWatch();
      activeSessionRef.current = null;
      toast.success("Consentimento revogado");
      qc.invalidateQueries({ queryKey: ["driver-tracking-status", assignmentId] });
    },
    onError: (error: Error) => toast.error(error.message),
  });

  function startWatch(sessionId: string) {
    clearWatch();
    lastSentRef.current = null;
    const id = navigator.geolocation.watchPosition(
      async (position) => {
        const point = {
          lat: position.coords.latitude,
          lng: position.coords.longitude,
        };
        const now = Date.now();
        if (!shouldSendPoint(lastSentRef.current, point, now)) return;
        lastSentRef.current = { ...point, sentAt: now };
        try {
          await ingestDriverLocationPoint({
            sessionId,
            lat: point.lat,
            lng: point.lng,
            accuracyM: position.coords.accuracy,
            speedMps: position.coords.speed,
            heading: position.coords.heading,
            recordedAt: new Date(position.timestamp).toISOString(),
            metadata: { source: "driver_portal_watch_position" },
          });
          qc.invalidateQueries({ queryKey: ["driver-tracking-status", assignmentId] });
        } catch (error) {
          console.error("[driver-tracking] Failed to ingest point", error);
        }
      },
      (error) => {
        clearWatch();
        if (error.code === error.PERMISSION_DENIED) {
          toast.error("Permissao de localizacao negada. Ative a localizacao do navegador para rastrear a campanha.");
          return;
        }
        toast.error("Nao foi possivel obter sua localizacao agora.");
      },
      { enableHighAccuracy: true, maximumAge: 15000, timeout: 10000 },
    );
    watchIdRef.current = id;
    setWatching(true);
  }

  function clearWatch() {
    if (watchIdRef.current !== null && typeof navigator !== "undefined" && navigator.geolocation) {
      navigator.geolocation.clearWatch(watchIdRef.current);
    }
    watchIdRef.current = null;
    setWatching(false);
  }

  if (eligible.length === 0) return null;

  const activeSession = status?.active_session_id ?? null;

  return (
    <Card className="border-primary/30">
      <CardHeader className="space-y-1">
        <div className="flex items-start justify-between gap-3">
          <div>
            <CardTitle className="inline-flex items-center gap-2 text-base">
              <MapPin className="h-4 w-4 text-primary" /> Rastreamento operacional
            </CardTitle>
            <CardDescription>
              Compartilhamento manual de localizacao enquanto o portal estiver aberto.
            </CardDescription>
          </div>
          <ShieldCheck className="h-5 w-5 text-primary" />
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {eligible.length > 1 && (
          <Select value={assignmentId ?? ""} onValueChange={setAssignmentId}>
            <SelectTrigger>
              <SelectValue placeholder="Selecione a campanha" />
            </SelectTrigger>
            <SelectContent>
              {eligible.map((assignment) => (
                <SelectItem key={assignment.id} value={assignment.id}>
                  {assignment.campaign?.name ?? "Campanha"} · {assignment.vehicle?.plate ?? "veiculo"}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}

        {selected && (
          <div className="rounded-md bg-muted/40 p-3 text-sm">
            <p className="font-medium">{selected.campaign?.name ?? "Campanha"}</p>
            <p className="text-muted-foreground">
              {selected.vehicle?.plate ?? "-"} · status {selected.status}
            </p>
          </div>
        )}

        <div className="grid gap-3 sm:grid-cols-3">
          <SmallMetric label="Km enviados" value={formatDistance(status?.total_distance_m ?? 0)} />
          <SmallMetric label="Tempo ativo" value={formatDuration(status?.duration_seconds ?? 0)} />
          <SmallMetric label="Pontos" value={String(status?.points_count ?? 0)} />
        </div>

        <div className="rounded-md border p-3 text-sm text-muted-foreground">
          {status?.has_consent ? (
            <span>Consentimento ativo. Voce pode encerrar a sessao ou revogar o consentimento a qualquer momento.</span>
          ) : (
            <span>Ao iniciar, voce autoriza a Driver Ads a usar sua localizacao para analytics operacionais agregados.</span>
          )}
        </div>

        <div className="flex flex-wrap gap-2">
          {activeSession ? (
            <>
              {!watching && (
                <Button variant="hero" onClick={() => activeSession && startWatch(activeSession)}>
                  <Power className="mr-2 h-4 w-4" /> Retomar envio
                </Button>
              )}
              <Button variant="outline" onClick={() => stopMutation.mutate()} disabled={stopMutation.isPending}>
                {stopMutation.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Square className="mr-2 h-4 w-4" />}
                Encerrar sessao
              </Button>
            </>
          ) : (
            <Button variant="hero" onClick={() => startMutation.mutate()} disabled={startMutation.isPending || isLoading}>
              {startMutation.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Power className="mr-2 h-4 w-4" />}
              Iniciar sessao
            </Button>
          )}

          {status?.has_consent && (
            <Button variant="ghost" onClick={() => revokeMutation.mutate()} disabled={revokeMutation.isPending}>
              Revogar consentimento
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

function SmallMetric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border bg-muted/20 p-3">
      <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{label}</p>
      <p className="mt-1 font-bold">{value}</p>
    </div>
  );
}
