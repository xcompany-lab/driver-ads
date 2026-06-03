import { createFileRoute, Outlet, redirect, Link } from "@tanstack/react-router";
import { LogOut, LayoutDashboard, Building2, Users, Car, Megaphone, ClipboardCheck, Wallet } from "lucide-react";
import type { AppRole } from "@/hooks/useSession";
import { Logo } from "@/components/brand/Logo";
import { Button } from "@/components/ui/button";
import { signOut } from "@/lib/auth";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/admin")({
  beforeLoad: ({ context }) => {
    const roles = ((context as { roles?: string[] }).roles ?? []) as AppRole[];
    if (!roles.includes("admin") && !roles.includes("operator")) {
      throw redirect({ to: "/auth" });
    }
  },
  component: AdminLayout,
});

const navItems: { to: "/admin" | "/admin/anunciantes" | "/admin/motoristas" | "/admin/veiculos" | "/admin/campanhas" | "/admin/comprovacoes" | "/admin/financeiro"; label: string; icon: typeof LayoutDashboard; exact?: boolean }[] = [
  { to: "/admin", label: "Dashboard", icon: LayoutDashboard, exact: true },
  { to: "/admin/campanhas", label: "Campanhas", icon: Megaphone },
  { to: "/admin/comprovacoes", label: "Comprovações", icon: ClipboardCheck },
  { to: "/admin/financeiro", label: "Financeiro", icon: Wallet },
  { to: "/admin/anunciantes", label: "Anunciantes", icon: Building2 },
  { to: "/admin/motoristas", label: "Motoristas", icon: Users },
  { to: "/admin/veiculos", label: "Veículos", icon: Car },
];

function AdminLayout() {
  return (
    <div className="min-h-screen bg-background">
      <header className="border-b bg-card">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-3">
          <Link to="/admin"><Logo size={32} /></Link>
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Painel Operacional</span>
            <Button variant="ghost" size="sm" onClick={() => signOut().then(() => (window.location.href = "/auth"))}>
              <LogOut className="mr-2 h-4 w-4" /> Sair
            </Button>
          </div>
        </div>
        <nav className="mx-auto max-w-7xl px-6 pb-2 flex gap-1 overflow-x-auto">
          {navItems.map((item) => {
            const Icon = item.icon;
            return (
              <Link
                key={item.to}
                to={item.to}
                activeOptions={{ exact: item.exact ?? false }}
                className={cn(
                  "inline-flex items-center gap-2 rounded-md px-3 py-2 text-sm font-medium text-muted-foreground hover:text-foreground hover:bg-muted transition",
                )}
                activeProps={{ className: "!text-foreground !bg-muted" }}
              >
                <Icon className="h-4 w-4" />
                {item.label}
              </Link>
            );
          })}
        </nav>
      </header>
      <main className="mx-auto max-w-7xl px-6 py-8"><Outlet /></main>
    </div>
  );
}
