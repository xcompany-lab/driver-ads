import { createFileRoute, Outlet, redirect, Link, useRouterState } from "@tanstack/react-router";
import { LogOut, Home, Megaphone, Wallet, User } from "lucide-react";
import type { AppRole } from "@/hooks/useSession";
import { Logo } from "@/components/brand/Logo";
import { Button } from "@/components/ui/button";
import { signOut } from "@/lib/auth";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/motorista")({
  beforeLoad: ({ context }) => {
    const roles = ((context as { roles?: string[] }).roles ?? []) as AppRole[];
    if (!roles.includes("driver")) {
      throw redirect({ to: "/auth" });
    }
  },
  component: DriverLayout,
});

const NAV = [
  { to: "/motorista", label: "Início", icon: Home, match: (p: string) => p === "/motorista" || p === "/motorista/" },
  { to: "/motorista/campanhas", label: "Campanhas", icon: Megaphone, match: (p: string) => p.startsWith("/motorista/campanhas") || p.startsWith("/motorista/comprovacoes") || p.startsWith("/motorista/veiculos") },
  { to: "/motorista/ganhos", label: "Ganhos", icon: Wallet, match: (p: string) => p.startsWith("/motorista/ganhos") },
  { to: "/motorista/perfil", label: "Perfil", icon: User, match: (p: string) => p.startsWith("/motorista/perfil") },
] as const;

function DriverLayout() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });

  return (
    <div className="min-h-screen bg-background pb-20 md:pb-0">
      <header className="border-b bg-card">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-3 sm:px-6">
          <Link to="/motorista"><Logo size={32} /></Link>
          <div className="flex items-center gap-2">
            <span className="hidden text-xs font-semibold uppercase tracking-wider text-muted-foreground sm:inline">Portal do Motorista</span>
            <Button variant="ghost" size="sm" onClick={() => signOut().then(() => (window.location.href = "/auth"))}>
              <LogOut className="h-4 w-4 sm:mr-2" /><span className="hidden sm:inline">Sair</span>
            </Button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-4 py-6 sm:px-6 sm:py-8"><Outlet /></main>

      <nav className="fixed inset-x-0 bottom-0 z-40 border-t bg-card/95 backdrop-blur md:hidden">
        <ul className="mx-auto grid max-w-md grid-cols-4">
          {NAV.map(({ to, label, icon: Icon, match }) => {
            const active = match(pathname);
            return (
              <li key={to}>
                <Link
                  to={to}
                  className={cn(
                    "flex flex-col items-center gap-1 py-2.5 text-xs transition-colors",
                    active ? "text-primary" : "text-muted-foreground hover:text-foreground",
                  )}
                >
                  <Icon className="h-5 w-5" />
                  {label}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>
    </div>
  );
}
