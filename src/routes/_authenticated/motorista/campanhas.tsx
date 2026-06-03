import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, Calendar, Car, Check, MapPin, X, Loader2, Inbox } from "lucide-react";
import { toast } from "sonner";
import { useSession } from "@/hooks/useSession";
import { getMyDriver } from "@/lib/driver";
import { listMyAssignments, type AssignmentWithRelations } from "@/lib/proofs";
import { respondToAssignment } from "@/lib/assignments";
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

  const { data: assignments, isLoading } = useQuery({
    queryKey: ["my-assignments", driver?.id],
    queryFn: () => listMyAssignments(driver!.id),
    enabled: !!driver,
  });

  return (
    <div className="mx-auto max-w-3xl space-y-4">
      <Button asChild variant="ghost" size="sm">
        <Link to="/motorista"><ArrowLeft className="mr-2 h-4 w-4" />Voltar</Link>
      </Button>

      <div>
        <h1 className="text-2xl font-bold tracking-tight">Minhas campanhas</h1>
        <p className="text-sm text-muted-foreground">Convites, vínculos ativos e histórico.</p>
      </div>

      {isLoading ? (
        <p className="text-muted-foreground">Carregando...</p>
      ) : !assignments || assignments.length === 0 ? (
        <Card>
          <CardContent className="py-10 text-center text-muted-foreground">
            <Inbox className="mx-auto mb-3 h-10 w-10 opacity-50" />
            Nenhum convite por enquanto. Avisaremos quando houver uma campanha para você.
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {assignments.map((a) => <AssignmentRow key={a.id} assignment={a} />)}
        </div>
      )}
    </div>
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
  const fmt = (d: string) => new Date(d).toLocaleDateString("pt-BR");

  return (
    <Card>
      <CardHeader>
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <CardTitle className="text-base">{assignment.campaign?.name ?? "Campanha"}</CardTitle>
            <CardDescription className="space-y-1">
              <span className="flex items-center gap-1.5"><MapPin className="h-3.5 w-3.5" />{assignment.campaign?.city ?? "—"}</span>
              <span className="flex items-center gap-1.5"><Car className="h-3.5 w-3.5" />{assignment.vehicle?.plate} · {assignment.vehicle?.model}</span>
              {assignment.campaign && (
                <span className="flex items-center gap-1.5"><Calendar className="h-3.5 w-3.5" />{fmt(assignment.campaign.period_start)} a {fmt(assignment.campaign.period_end)}</span>
              )}
            </CardDescription>
          </div>
          <StatusBadge status={assignment.status} />
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex items-center justify-between rounded-md bg-muted/40 px-3 py-2 text-sm">
          <span className="text-muted-foreground">Repasse mensal</span>
          <span className="font-semibold">
            {Number(assignment.monthly_payout).toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
          </span>
        </div>

        {assignment.notes && (
          <p className="text-sm text-muted-foreground">
            <span className="font-medium text-foreground">Instruções: </span>{assignment.notes}
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
            <Link to="/motorista/auditoria">Enviar / ver comprovações</Link>
          </Button>
        )}
      </CardContent>
    </Card>
  );
}
