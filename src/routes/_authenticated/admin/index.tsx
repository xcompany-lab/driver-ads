import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/_authenticated/admin/")({
  component: AdminHome,
});

function AdminHome() {
  return (
    <div>
      <h1 className="text-3xl font-bold tracking-tight">Painel Operacional</h1>
      <p className="mt-2 text-muted-foreground">Bem-vindo à área administrativa. Próximas fases trarão métricas, aprovações e gestão completa.</p>
    </div>
  );
}
