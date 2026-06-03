import { useEffect, useState, useCallback } from "react";
import type { Session, User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";

export type AppRole = Database["public"]["Enums"]["app_role"];

export interface SessionState {
  loading: boolean;
  session: Session | null;
  user: User | null;
  roles: AppRole[];
  primaryRole: AppRole | null;
  refresh: () => Promise<void>;
}

function pickPrimaryRole(roles: AppRole[]): AppRole | null {
  const order: AppRole[] = ["admin", "operator", "advertiser", "driver"];
  for (const r of order) if (roles.includes(r)) return r;
  return null;
}

export function useSession(): SessionState {
  const [loading, setLoading] = useState(true);
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [roles, setRoles] = useState<AppRole[]>([]);

  const loadRoles = useCallback(async (uid: string | undefined) => {
    if (!uid) {
      setRoles([]);
      return;
    }
    const { data } = await supabase.from("user_roles").select("role").eq("user_id", uid);
    setRoles((data ?? []).map((r) => r.role as AppRole));
  }, []);

  const refresh = useCallback(async () => {
    const { data } = await supabase.auth.getSession();
    setSession(data.session);
    setUser(data.session?.user ?? null);
    await loadRoles(data.session?.user.id);
  }, [loadRoles]);

  useEffect(() => {
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => {
      setSession(s);
      setUser(s?.user ?? null);
      // defer Supabase query to avoid deadlock with auth callback
      setTimeout(() => {
        loadRoles(s?.user.id);
      }, 0);
    });
    refresh().finally(() => setLoading(false));
    return () => sub.subscription.unsubscribe();
  }, [loadRoles, refresh]);

  return { loading, session, user, roles, primaryRole: pickPrimaryRole(roles), refresh };
}

export function roleHome(role: AppRole | null): string {
  switch (role) {
    case "admin":
    case "operator":
      return "/admin";
    case "advertiser":
      return "/anunciante";
    case "driver":
      return "/motorista";
    default:
      return "/auth";
  }
}
