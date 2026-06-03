import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Search, Check, Ban, RotateCcw, X, FileText, Eye, CheckCircle2, AlertTriangle, XCircle, Clock } from "lucide-react";
import { listDrivers, updateDriverStatus, type DriverStatus } from "@/lib/admin";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/brand/StatusBadge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  DRIVER_DOC_LABELS,
  DRIVER_DOC_ORDER,
  DRIVER_DOC_STATUS_KEY,
  setDriverDocStatus,
  setVehicleCrlvStatus,
  type DriverDocKey,
  type DocReviewStatus,
} from "@/lib/driver-documents";
import { DocumentPreview, isPdfPath } from "@/components/brand/DocumentPreview";

export const Route = createFileRoute("/_authenticated/admin/motoristas")({
  component: DriversAdmin,
});

function DriversAdmin() {
  const [search, setSearch] = useState("");
  const qc = useQueryClient();
  const { data, isLoading } = useQuery({
    queryKey: ["admin", "drivers", search],
    queryFn: () => listDrivers(search),
  });

  const mut = useMutation({
    mutationFn: ({ id, status }: { id: string; status: DriverStatus }) => updateDriverStatus(id, status),
    onSuccess: () => {
      toast.success("Status atualizado");
      qc.invalidateQueries({ queryKey: ["admin"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Motoristas</h1>
        <p className="mt-1 text-muted-foreground">Aprovar, reprovar ou suspender cadastros.</p>
      </div>

      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input placeholder="Buscar por nome, CPF, e-mail, telefone ou cidade…" value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" />
      </div>

      {isLoading ? (
        <div className="space-y-3">{Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-28 rounded-xl" />)}</div>
      ) : !data?.length ? (
        <Card><CardContent className="py-12 text-center text-muted-foreground">Nenhum motorista encontrado.</CardContent></Card>
      ) : (
        <div className="space-y-3">
          {data.map((d) => (
            <Card key={d.id}>
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <CardTitle className="text-base">{d.full_name}</CardTitle>
                    <CardDescription>
                      CPF {d.cpf} · {d.city}
                      {d.regions?.length ? ` · ${d.regions.join(", ")}` : ""}
                    </CardDescription>
                  </div>
                  <StatusBadge status={d.status} />
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="grid gap-1 text-sm text-muted-foreground sm:grid-cols-2">
                  <span>E-mail: <span className="text-foreground">{d.email}</span></span>
                  <span>Telefone: <span className="text-foreground">{d.phone}</span></span>
                  {d.pix_key && (
                    <span>PIX ({d.pix_key_type}): <span className="text-foreground">{d.pix_key}</span></span>
                  )}
                </div>

                <DriverDocsReview driverId={d.id} driver={d as unknown as Record<DriverDocKey, string | null>} />

                <div className="flex flex-wrap gap-2 pt-2">
                  {d.status !== "approved" && (
                    <Button size="sm" onClick={() => mut.mutate({ id: d.id, status: "approved" })} disabled={mut.isPending}>
                      <Check className="mr-1 h-4 w-4" /> Aprovar
                    </Button>
                  )}
                  {d.status !== "rejected" && (
                    <Button size="sm" variant="outline" onClick={() => mut.mutate({ id: d.id, status: "rejected" })} disabled={mut.isPending}>
                      <X className="mr-1 h-4 w-4" /> Reprovar
                    </Button>
                  )}
                  {d.status !== "suspended" && (
                    <Button size="sm" variant="outline" onClick={() => mut.mutate({ id: d.id, status: "suspended" })} disabled={mut.isPending}>
                      <Ban className="mr-1 h-4 w-4" /> Suspender
                    </Button>
                  )}
                  {d.status !== "pending_review" && (
                    <Button size="sm" variant="ghost" onClick={() => mut.mutate({ id: d.id, status: "pending_review" })} disabled={mut.isPending}>
                      <RotateCcw className="mr-1 h-4 w-4" /> Voltar p/ análise
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

type DriverWithDocs = Record<DriverDocKey, string | null> &
  Partial<Record<"cnh_front_status" | "selfie_doc_status" | "address_proof_status", DocReviewStatus>>;

function DriverDocsReview({ driverId, driver }: { driverId: string; driver: DriverWithDocs }) {
  const [open, setOpen] = useState(false);
  const qc = useQueryClient();
  const { data: vehicles } = useQuery({
    queryKey: ["admin", "driver-vehicles", driverId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("vehicles")
        .select("id, plate, crlv_url, crlv_status")
        .eq("driver_id", driverId);
      if (error) throw error;
      return data as unknown as Array<{ id: string; plate: string; crlv_url: string | null; crlv_status: DocReviewStatus | null }>;
    },
    enabled: open,
  });

  const driverMut = useMutation({
    mutationFn: ({ key, status }: { key: DriverDocKey; status: DocReviewStatus }) =>
      setDriverDocStatus(driverId, DRIVER_DOC_STATUS_KEY[key], status),
    onSuccess: () => {
      toast.success("Documento atualizado");
      qc.invalidateQueries({ queryKey: ["admin", "drivers"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const crlvMut = useMutation({
    mutationFn: ({ vehicleId, status }: { vehicleId: string; status: DocReviewStatus }) =>
      setVehicleCrlvStatus(vehicleId, status),
    onSuccess: () => {
      toast.success("CRLV atualizado");
      qc.invalidateQueries({ queryKey: ["admin", "driver-vehicles", driverId] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const approvedCount = DRIVER_DOC_ORDER.filter((k) => driver[DRIVER_DOC_STATUS_KEY[k]] === "approved").length;
  const totalDriverDocs = DRIVER_DOC_ORDER.length;
  const allDriverOk = approvedCount === totalDriverDocs;

  return (
    <div className="rounded-lg border border-border bg-muted/30 p-3">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-between gap-2 text-sm"
      >
        <span className="flex items-center gap-2 font-medium">
          {allDriverOk ? <CheckCircle2 className="h-4 w-4 text-green-600" /> : <AlertTriangle className="h-4 w-4 text-amber-600" />}
          Documentos aprovados ({approvedCount}/{totalDriverDocs})
        </span>
        <span className="text-xs text-muted-foreground">{open ? "Ocultar" : "Auditar"}</span>
      </button>

      {open && (
        <div className="mt-3 grid gap-2 sm:grid-cols-2">
          {DRIVER_DOC_ORDER.map((k) => (
            <DocLink
              key={k}
              label={DRIVER_DOC_LABELS[k]}
              path={driver[k]}
              status={driver[DRIVER_DOC_STATUS_KEY[k]] ?? "pending"}
              onApprove={() => driverMut.mutate({ key: k, status: "approved" })}
              onReject={() => driverMut.mutate({ key: k, status: "rejected" })}
              pending={driverMut.isPending}
            />
          ))}
          {(vehicles ?? []).map((v) => (
            <DocLink
              key={v.id}
              label={`CRLV — ${v.plate}`}
              path={v.crlv_url}
              status={v.crlv_status ?? "pending"}
              onApprove={() => crlvMut.mutate({ vehicleId: v.id, status: "approved" })}
              onReject={() => crlvMut.mutate({ vehicleId: v.id, status: "rejected" })}
              pending={crlvMut.isPending}
            />
          ))}
          {vehicles && vehicles.length === 0 && (
            <p className="text-xs text-muted-foreground sm:col-span-2">Nenhum veículo cadastrado.</p>
          )}
        </div>
      )}
    </div>
  );
}

function DocStatusPill({ status }: { status: DocReviewStatus }) {
  if (status === "approved")
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-green-500/10 px-2 py-0.5 text-[10px] font-medium text-green-700 dark:text-green-400">
        <CheckCircle2 className="h-3 w-3" /> Aprovado
      </span>
    );
  if (status === "rejected")
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-destructive/10 px-2 py-0.5 text-[10px] font-medium text-destructive">
        <XCircle className="h-3 w-3" /> Reprovado
      </span>
    );
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-amber-500/10 px-2 py-0.5 text-[10px] font-medium text-amber-700 dark:text-amber-400">
      <Clock className="h-3 w-3" /> Pendente
    </span>
  );
}

function DocLink({
  label,
  path,
  status,
  onApprove,
  onReject,
  pending,
}: {
  label: string;
  path: string | null;
  status: DocReviewStatus;
  onApprove: () => void;
  onReject: () => void;
  pending: boolean;
}) {
  const [open, setOpen] = useState(false);
  const isPdf = isPdfPath(path);
  return (
    <>
      <div className="flex flex-col gap-2 rounded-md border border-border bg-card/50 p-2 text-sm">
        <div className="flex items-center justify-between gap-2">
          <span className="flex items-center gap-2 min-w-0">
            {path ? <CheckCircle2 className="h-3 w-3 text-green-600 shrink-0" /> : <FileText className="h-3 w-3 text-muted-foreground shrink-0" />}
            <span className="truncate">
              {label}
              {path && isPdf && <span className="ml-1 text-xs text-muted-foreground">(PDF)</span>}
            </span>
          </span>
          <DocStatusPill status={status} />
        </div>
        <div className="flex items-center justify-between gap-2">
          {path ? (
            <button
              type="button"
              onClick={() => setOpen(true)}
              className="text-xs text-primary inline-flex items-center gap-1 hover:underline"
            >
              <Eye className="h-3 w-3" /> Abrir
            </button>
          ) : (
            <span className="text-xs text-muted-foreground">Sem arquivo</span>
          )}
          <div className="flex gap-1">
            <Button
              size="sm"
              variant="outline"
              className="h-7 px-2 text-xs"
              disabled={!path || pending || status === "approved"}
              onClick={onApprove}
            >
              <Check className="mr-1 h-3 w-3" /> Aprovar
            </Button>
            <Button
              size="sm"
              variant="outline"
              className="h-7 px-2 text-xs"
              disabled={!path || pending || status === "rejected"}
              onClick={onReject}
            >
              <X className="mr-1 h-3 w-3" /> Reprovar
            </Button>
          </div>
        </div>
      </div>
      <DocumentPreview open={open} onOpenChange={setOpen} path={path} label={label} />
    </>
  );
}

