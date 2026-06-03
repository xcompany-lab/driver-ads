import { createFileRoute, Outlet, redirect, Link } from "@tanstack/react-router";
import { LogOut } from "lucide-react";
import type { AppRole } from "@/hooks/useSession";
import { Logo } from "@/components/brand/Logo";
import { Button } from "@/components/ui/button";
import { signOut } from "@/lib/auth";
import { NotificationBell } from "@/components/NotificationBell";

export const Route = createFileRoute("/_authenticated/anunciante")({
  beforeLoad: ({ context }) => {
    const roles = ((context as { roles?: string[] }).roles ?? []) as AppRole[];
    if (!roles.includes("advertiser")) {
      throw redirect({ to: "/login" });
    }
  },
  component: AdvertiserLayout,
});

function AdvertiserLayout() {
  return (
    <div className="min-h-screen bg-platform">
      <header className="platform-header sticky top-0 z-30">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-3">
          <Link to="/anunciante"><Logo size={32} /></Link>
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Portal do Anunciante</span>
            <NotificationBell />
            <Button variant="ghost" size="sm" onClick={() => signOut().then(() => (window.location.href = "/login"))}>
              <LogOut className="mr-2 h-4 w-4" /> Sair
            </Button>
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-7xl px-6 py-8"><Outlet /></main>
    </div>
  );
}
