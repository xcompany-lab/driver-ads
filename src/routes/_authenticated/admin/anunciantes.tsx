import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Search, Check, Ban, RotateCcw, X } from "lucide-react";
import { listAdvertisers, updateAdvertiserStatus, type AdvertiserStatus } from "@/lib/admin";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/brand/StatusBadge";
import { Skeleton } from "@/components/ui/skeleton";

export const Route = createFileRoute("/_authenticated/admin/anunciantes")({
  component: AdvertisersAdmin,
});

function AdvertisersAdmin() {
  const [search, setSearch] = useState("");
  const qc = useQueryClient();
  const { data, isLoading } = useQuery({
    queryKey: ["admin", "advertisers", search],
    queryFn: () => listAdvertisers(search),
  });

  const mut = useMutation({
    mutationFn: ({ id, status }: { id: string; status: AdvertiserStatus }) => updateAdvertiserStatus(id, status),
    onSuccess: () => {
      toast.success("Status atualizado");
      qc.invalidateQueries({ queryKey: ["admin"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Anunciantes</h1>
        <p className="mt-1 text-muted-foreground">Aprovar, suspender ou revisar cadastros.</p>
      </div>

      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input placeholder="Buscar por empresa, CNPJ, e-mail ou cidade…" value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" />
      </div>

      {isLoading ? (
        <div className="space-y-3">{Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-28 rounded-xl" />)}</div>
      ) : !data?.length ? (
        <Card><CardContent className="py-12 text-center text-muted-foreground">Nenhum anunciante encontrado.</CardContent></Card>
      ) : (
        <div className="space-y-3">
          {data.map((a) => (
            <Card key={a.id}>
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <CardTitle className="text-base">{a.company_name}</CardTitle>
                    <CardDescription>
                      CNPJ {a.cnpj} · {a.city}
                      {a.segment ? ` · ${a.segment}` : ""}
                    </CardDescription>
                  </div>
                  <StatusBadge status={a.status} />
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="grid gap-1 text-sm text-muted-foreground sm:grid-cols-2">
                  <span>Responsável: <span className="text-foreground">{a.responsible}</span></span>
                  <span>E-mail: <span className="text-foreground">{a.email}</span></span>
                  <span>Telefone: <span className="text-foreground">{a.phone}</span></span>
                </div>
                <div className="flex flex-wrap gap-2 pt-2">
                  {a.status !== "approved" && (
                    <Button size="sm" onClick={() => mut.mutate({ id: a.id, status: "approved" })} disabled={mut.isPending}>
                      <Check className="mr-1 h-4 w-4" /> Aprovar
                    </Button>
                  )}
                  {a.status !== "rejected" && (
                    <Button size="sm" variant="outline" onClick={() => mut.mutate({ id: a.id, status: "rejected" })} disabled={mut.isPending}>
                      <X className="mr-1 h-4 w-4" /> Reprovar
                    </Button>
                  )}
                  {a.status !== "suspended" && (
                    <Button size="sm" variant="outline" onClick={() => mut.mutate({ id: a.id, status: "suspended" })} disabled={mut.isPending}>
                      <Ban className="mr-1 h-4 w-4" /> Suspender
                    </Button>
                  )}
                  {a.status !== "pending_review" && (
                    <Button size="sm" variant="ghost" onClick={() => mut.mutate({ id: a.id, status: "pending_review" })} disabled={mut.isPending}>
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
