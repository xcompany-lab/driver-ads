import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { History } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

export const Route = createFileRoute("/_authenticated/admin/auditoria")({
  component: AuditPage,
});

const ENTITY_OPTIONS = [
  { value: "all", label: "Todos" },
  { value: "campaign", label: "Campanhas" },
  { value: "assignment", label: "Vínculos" },
  { value: "proof", label: "Comprovantes" },
  { value: "invoice", label: "Faturas" },
  { value: "payout", label: "Repasses" },
];

async function listLogs(entity: string, search: string) {
  let q = supabase
    .from("activity_logs")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(300);
  if (entity !== "all") q = q.eq("entity_type", entity);
  if (search.trim()) q = q.ilike("action", `%${search.trim()}%`);
  const { data, error } = await q;
  if (error) throw error;
  return data ?? [];
}

function AuditPage() {
  const [entity, setEntity] = useState("all");
  const [search, setSearch] = useState("");
  const { data, isLoading } = useQuery({
    queryKey: ["admin", "audit", entity, search],
    queryFn: () => listLogs(entity, search),
  });

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Auditoria</h1>
        <p className="mt-1 text-muted-foreground">Histórico de ações em campanhas, vínculos, comprovantes e financeiro.</p>
      </div>

      <div className="flex flex-col gap-2 sm:flex-row">
        <Select value={entity} onValueChange={setEntity}>
          <SelectTrigger className="sm:w-56"><SelectValue /></SelectTrigger>
          <SelectContent>
            {ENTITY_OPTIONS.map((o) => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
          </SelectContent>
        </Select>
        <Input placeholder="Buscar por ação (ex: status:approved)" value={search} onChange={(e) => setSearch(e.target.value)} />
      </div>

      {isLoading ? (
        <Skeleton className="h-64 rounded-xl" />
      ) : !data?.length ? (
        <Card><CardContent className="py-16 text-center text-muted-foreground"><History className="mx-auto mb-2 h-8 w-8 opacity-40" />Sem registros.</CardContent></Card>
      ) : (
        <Card>
          <CardContent className="p-0 overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Quando</TableHead>
                  <TableHead>Entidade</TableHead>
                  <TableHead>Ação</TableHead>
                  <TableHead>Payload</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.map((l) => (
                  <TableRow key={l.id}>
                    <TableCell className="whitespace-nowrap text-xs">{new Date(l.created_at).toLocaleString("pt-BR")}</TableCell>
                    <TableCell className="text-xs">{l.entity_type}</TableCell>
                    <TableCell className="font-mono text-xs">{l.action}</TableCell>
                    <TableCell className="font-mono text-[11px] text-muted-foreground max-w-md truncate">{JSON.stringify(l.payload)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
