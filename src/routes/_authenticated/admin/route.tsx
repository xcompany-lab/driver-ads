import { createFileRoute, Outlet, redirect, Link } from "@tanstack/react-router";
import { LogOut, LayoutDashboard, Building2, Users, Car, Megaphone, ClipboardCheck, Wallet, History, BarChart3, Images } from "lucide-react";
import type { AppRole } from "@/hooks/useSession";
import { Logo } from "@/components/brand/Logo";
import { Button } from "@/components/ui/button";
import { NotificationBell } from "@/components/NotificationBell";
import { signOut } from "@/lib/auth";
import { cn } from "@/lib/utils";
import { useIsAdmin } from "@/hooks/useRoleGuards";

export const Route = createFileRoute("/_authenticated/admin")({
  beforeLoad: ({ context }) => {
    const roles = ((context as { roles?: string[] }).roles ?? []) as AppRole[];
    if (!roles.includes("admin") && !roles.includes("operator")) {
      throw redirect({ to: "/login" });
    }
  },
  component: AdminLayout,
});

const navItems: { to: "/admin" | "/admin/anunciantes" | "/admin/motoristas" | "/admin/veiculos" | "/admin/catalogo-veiculos" | "/admin/campanhas" | "/admin/comprovacoes" | "/admin/financeiro" | "/admin/auditoria" | "/admin/analytics"; label: string; icon: typeof LayoutDashboard; exact?: boolean }[] = [
  { to: "/admin", label: "Dashboard", icon: LayoutDashboard, exact: true },
  { to: "/admin/campanhas", label: "Campanhas", icon: Megaphone },
  { to: "/admin/comprovacoes", label: "Comprovações", icon: ClipboardCheck },
  { to: "/admin/analytics", label: "Analytics", icon: BarChart3 },
  { to: "/admin/financeiro", label: "Financeiro", icon: Wallet },
  { to: "/admin/anunciantes", label: "Anunciantes", icon: Building2 },
  { to: "/admin/motoristas", label: "Motoristas", icon: Users },
  { to: "/admin/veiculos", label: "Veículos", icon: Car },
  { to: "/admin/catalogo-veiculos", label: "Catálogo", icon: Images },
  { to: "/admin/auditoria", label: "Auditoria", icon: History },
];

function AdminLayout() {
  return (
    <div className="min-h-screen bg-platform">
      <header className="platform-header sticky top-0 z-30">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-3">
          <Link to="/admin"><Logo size={32} /></Link>
          <div className="flex items-center gap-2">
            <RoleChip />
            <NotificationBell />
            <Button variant="ghost" size="sm" onClick={() => signOut().then(() => (window.location.href = "/login"))}>
              <LogOut className="mr-2 h-4 w-4" /> Sair
            </Button>
          </div>
        </div>
        <NavBar />
      </header>
      <main className="mx-auto max-w-7xl px-6 py-8"><Outlet /></main>
    </div>
  );
}

function RoleChip() {
  const isAdmin = useIsAdmin();
  return (
    <span className={cn(
      "rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider",
      isAdmin ? "bg-primary/15 text-primary" : "bg-amber-500/15 text-amber-700 dark:text-amber-300",
    )}>
      {isAdmin ? "Admin" : "Operador"}
    </span>
  );
}

function NavBar() {
  const isAdmin = useIsAdmin();
  const items = navItems.filter((i) => isAdmin || i.to !== "/admin/auditoria");
  return (
    <nav className="mx-auto max-w-7xl px-6 pb-3 flex gap-1 overflow-x-auto">
      {items.map((item) => {
        const Icon = item.icon;
        return (
          <Link
            key={item.to}
            to={item.to}
            activeOptions={{ exact: item.exact ?? false }}
            className={cn(
              "inline-flex items-center gap-2 rounded-full px-3.5 py-2 text-sm font-medium text-muted-foreground hover:text-foreground transition",
            )}
            activeProps={{ className: "nav-pill-active !text-foreground" }}
          >
            <Icon className="h-4 w-4" />
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}
