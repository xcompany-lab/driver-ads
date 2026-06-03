import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/_authenticated/motorista/")({
  component: DriverHome,
});

function DriverHome() {
  return (
    <div>
      <h1 className="text-3xl font-bold tracking-tight">Portal do Motorista</h1>
      <p className="mt-2 text-muted-foreground">Em breve: convites de campanha, comprovações de instalação e seus repasses.</p>
    </div>
  );
}
