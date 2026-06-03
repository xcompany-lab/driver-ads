import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Search, Check, Ban, RotateCcw, X, FileText, Eye, CheckCircle2, AlertTriangle } from "lucide-react";
import { listDrivers, updateDriverStatus, type DriverStatus } from "@/lib/admin";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/brand/StatusBadge";
import { Skeleton } from "@/components/ui/skeleton";
import { DRIVER_DOC_LABELS, DRIVER_DOC_ORDER, getSignedDocUrl, type DriverDocKey } from "@/lib/driver-documents";

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
