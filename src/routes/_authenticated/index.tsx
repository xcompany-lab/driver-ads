import { createFileRoute, redirect } from "@tanstack/react-router";
import type { AppRole } from "@/hooks/useSession";
import { roleHome } from "@/hooks/useSession";

export const Route = createFileRoute("/_authenticated/")({
  beforeLoad: ({ context }) => {
    const roles = ((context as { roles?: string[] }).roles ?? []) as AppRole[];
    const order: AppRole[] = ["admin", "operator", "advertiser", "driver"];
    const primary = order.find((r) => roles.includes(r)) ?? null;
    throw redirect({ to: roleHome(primary) });
  },
  component: () => null,
});
