import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Search, Check, Ban, RotateCcw, X } from "lucide-react";
import { listVehicles, updateVehicleStatus, type VehicleStatus } from "@/lib/admin";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/brand/StatusBadge";
import { Skeleton } from "@/components/ui/skeleton";

export const Route = createFileRoute("/_authenticated/admin/veiculos")({
  component: VehiclesAdmin,
});

function VehiclesAdmin() {
  const [search, setSearch] = useState("");
  const qc = useQueryClient();
  const { data, isLoading } = useQuery({
    queryKey: ["admin", "vehicles", search],
    queryFn: () => listVehicles(search),
  });

  const mut = useMutation({
    mutationFn: ({ id, status }: { id: string; status: VehicleStatus }) => updateVehicleStatus(id, status),
    onSuccess: () => {
      toast.success("Status atualizado");
      qc.invalidateQueries({ queryKey: ["admin"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Veículos</h1>
        <p className="mt-1 text-muted-foreground">Aprovar ou suspender veículos cadastrados pelos motoristas.</p>
      </div>

      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input placeholder="Buscar por placa, modelo ou marca…" value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" />
      </div>

      {isLoading ? (
        <div className="space-y-3">{Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-24 rounded-xl" />)}</div>
      ) : !data?.length ? (
        <Card><CardContent className="py-12 text-center text-muted-foreground">Nenhum veículo encontrado.</CardContent></Card>
      ) : (
        <div className="space-y-3">
          {data.map((v) => (
            <Card key={v.id}>
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <CardTitle className="text-base">{v.plate} · {v.model}</CardTitle>
                    <CardDescription>
                      {v.brand ?? "—"}{v.year ? ` · ${v.year}` : ""}{v.color ? ` · ${v.color}` : ""}{v.vehicle_type ? ` · ${v.vehicle_type}` : ""}
                      {v.driver ? ` — Motorista: ${v.driver.full_name} (${v.driver.city})` : ""}
                    </CardDescription>
                  </div>
                  <StatusBadge status={v.status} />
                </div>
              </CardHeader>
              <CardContent>
                <div className="flex flex-wrap gap-2">
                  {v.status !== "approved" && (
                    <Button size="sm" onClick={() => mut.mutate({ id: v.id, status: "approved" })} disabled={mut.isPending}>
                      <Check className="mr-1 h-4 w-4" /> Aprovar
                    </Button>
                  )}
                  {v.status !== "rejected" && (
                    <Button size="sm" variant="outline" onClick={() => mut.mutate({ id: v.id, status: "rejected" })} disabled={mut.isPending}>
                      <X className="mr-1 h-4 w-4" /> Reprovar
                    </Button>
                  )}
                  {v.status !== "suspended" && (
                    <Button size="sm" variant="outline" onClick={() => mut.mutate({ id: v.id, status: "suspended" })} disabled={mut.isPending}>
                      <Ban className="mr-1 h-4 w-4" /> Suspender
                    </Button>
                  )}
                  {v.status !== "pending_review" && (
                    <Button size="sm" variant="ghost" onClick={() => mut.mutate({ id: v.id, status: "pending_review" })} disabled={mut.isPending}>
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
