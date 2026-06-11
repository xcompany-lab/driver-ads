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

type PublicSignUpResult = {
  error?: string;
  message?: string;
};

async function publicSignUp(
  role: AppRole,
  input: SignUpAdvertiserInput | SignUpDriverInput,
) {
  const { data, error } = await supabase.functions.invoke<PublicSignUpResult>("public-signup", {
    body: { role, ...input },
  });

  if (error) {
    const payload = await readFunctionError(error);
    throw new Error(payload?.message || data?.message || error.message || "Nao foi possivel criar a conta.");
  }

  const { error: signInError } = await supabase.auth.signInWithPassword({
    email: input.email,
    password: input.password,
  });
  if (signInError) throw signInError;
}

export async function signUpAdvertiser(input: SignUpAdvertiserInput) {
  await publicSignUp("advertiser", input);
  return { needsEmailConfirmation: false as const };
}

export async function signUpDriver(input: SignUpDriverInput) {
  await publicSignUp("driver", input);
  return { needsEmailConfirmation: false as const };
}

async function readFunctionError(error: unknown): Promise<PublicSignUpResult | null> {
  const response = (error as { context?: Response })?.context;
  if (!response || typeof response.json !== "function") return null;

  try {
    return (await response.json()) as PublicSignUpResult;
  } catch {
    return null;
  }
}
