import { supabase } from "@/integrations/supabase/client";
import type { AppRole } from "@/hooks/useSession";

export async function signIn(email: string, password: string) {
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) throw error;
  return data;
}

export async function signOut() {
  await supabase.auth.signOut();
}

export interface SignUpAdvertiserInput {
  email: string;
  password: string;
  full_name: string;
  phone: string;
  company_name: string;
  cnpj: string;
  city: string;
  segment?: string;
}

export interface SignUpDriverInput {
  email: string;
  password: string;
  full_name: string;
  phone: string;
  cpf: string;
  city: string;
}

async function baseSignUp(
  email: string,
  password: string,
  metadata: Record<string, unknown>,
) {
  const PUBLIC_SITE_URL = "https://driverads.com.br";
  const origin =
    typeof window !== "undefined" && !/localhost|127\.0\.0\.1|lovable\.app/i.test(window.location.origin)
      ? window.location.origin
      : PUBLIC_SITE_URL;
  const redirectTo = `${origin}/login`;
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      emailRedirectTo: redirectTo,
      data: metadata,
    },
  });
  if (error) throw error;
  return { user: data.user, session: data.session };
}

async function assignRole(role: AppRole) {
  const { error } = await supabase.rpc("assign_self_role", { _role: role });
  if (error) throw error;
}

export async function signUpAdvertiser(input: SignUpAdvertiserInput) {
  const res = await baseSignUp(input.email, input.password, {
    account_type: "advertiser",
    full_name: input.full_name,
    phone: input.phone,
    company_name: input.company_name,
    cnpj: input.cnpj,
    city: input.city,
    segment: input.segment ?? "",
  });
  if (!res.session) {
    // Email confirmation required — DB trigger finalizes role + advertiser row on confirm
    return { needsEmailConfirmation: true as const };
  }
  await assignRole("advertiser");
  const { error } = await supabase.from("advertisers").insert({
    user_id: res.user!.id,
    company_name: input.company_name,
    cnpj: input.cnpj,
    responsible: input.full_name,
    email: input.email,
    phone: input.phone,
    city: input.city,
    segment: input.segment ?? null,
  });
  if (error && error.code !== "23505") throw error;
  return { needsEmailConfirmation: false as const };
}

export async function signUpDriver(input: SignUpDriverInput) {
  const res = await baseSignUp(input.email, input.password, {
    account_type: "driver",
    full_name: input.full_name,
    phone: input.phone,
    cpf: input.cpf,
    city: input.city,
  });
  if (!res.session) {
    // Email confirmation required — DB trigger finalizes role + driver row on confirm
    return { needsEmailConfirmation: true as const };
  }
  await assignRole("driver");
  const { error } = await supabase.from("drivers").insert({
    user_id: res.user!.id,
    full_name: input.full_name,
    cpf: input.cpf,
    email: input.email,
    phone: input.phone,
    city: input.city,
    regions: [],
  });
  if (error && error.code !== "23505") throw error;
  return { needsEmailConfirmation: false as const };
}
