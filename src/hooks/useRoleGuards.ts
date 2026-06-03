import { useSession } from "@/hooks/useSession";

/** Operators have read-only access to sensitive financial actions. Only admins can mutate. */
export function useIsAdmin(): boolean {
  const { roles } = useSession();
  return roles.includes("admin");
}

export function useIsStaff(): boolean {
  const { roles } = useSession();
  return roles.includes("admin") || roles.includes("operator");
}
