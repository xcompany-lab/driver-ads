import { createFileRoute, Link } from "@tanstack/react-router";
import { Building2, Car, ShieldCheck, ArrowRight } from "lucide-react";
import { AuthCard } from "@/components/auth/AuthCard";

export const Route = createFileRoute("/auth/")({
  head: () => ({ meta: [{ title: "Acessar Driver Ads" }] }),
  component: AuthIndex,
});

function AuthIndex() {
  return (
    <AuthCard
      title="Quem está acessando?"
      subtitle="Escolha o tipo de conta para entrar ou se cadastrar."
    >
      <div className="space-y-3">
        <RoleLink to="/auth/anunciante" icon={<Building2 className="h-5 w-5" />} label="Sou Anunciante" desc="Quero criar campanhas e contratar motoristas." />
        <RoleLink to="/auth/motorista" icon={<Car className="h-5 w-5" />} label="Sou Motorista" desc="Quero monetizar meu veículo com publicidade." />
        <RoleLink to="/auth/admin" icon={<ShieldCheck className="h-5 w-5" />} label="Sou da equipe Driver Ads" desc="Acesso administrativo e operacional." />
      </div>
    </AuthCard>
  );
}

function RoleLink({ to, icon, label, desc }: { to: string; icon: React.ReactNode; label: string; desc: string }) {
  return (
    <Link
      to={to}
      className="group flex items-center gap-4 rounded-xl border bg-card p-4 transition-all hover:border-primary/40 hover:shadow-brand"
    >
      <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary">{icon}</div>
      <div className="flex-1">
        <div className="font-semibold text-foreground">{label}</div>
        <div className="text-xs text-muted-foreground">{desc}</div>
      </div>
      <ArrowRight className="h-4 w-4 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
    </Link>
  );
}
