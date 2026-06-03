import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/_authenticated/anunciante/")({
  component: AdvertiserHome,
});

function AdvertiserHome() {
  return (
    <div>
      <h1 className="text-3xl font-bold tracking-tight">Portal do Anunciante</h1>
      <p className="mt-2 text-muted-foreground">Em breve: criação de campanhas, contratação de motoristas e acompanhamento das instalações.</p>
    </div>
  );
}
