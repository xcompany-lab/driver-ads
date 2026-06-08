import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";

export type DriverPayoutMethod =
  Database["public"]["Tables"]["driver_payout_methods"]["Row"];
export type PixKeyType = "cpf" | "cnpj" | "email" | "phone" | "random";
type DbPixKeyType = "CPF" | "CNPJ" | "EMAIL" | "PHONE" | "EVP";

const onlyDigits = (s: string) => s.replace(/\D+/g, "");

const DB_PIX_KEY_TYPES: Record<PixKeyType, DbPixKeyType> = {
  cpf: "CPF",
  cnpj: "CNPJ",
  email: "EMAIL",
  phone: "PHONE",
  random: "EVP",
};

export function fromDbPixKeyType(value: string | null | undefined): PixKeyType {
  switch ((value ?? "").toUpperCase()) {
    case "CPF":
      return "cpf";
    case "CNPJ":
      return "cnpj";
    case "EMAIL":
      return "email";
    case "PHONE":
      return "phone";
    case "EVP":
      return "random";
    default:
      return "cpf";
  }
}

function toDbDocumentType(value: "cpf" | "cnpj" | null | undefined): "CPF" | "CNPJ" | null {
  if (value === "cpf") return "CPF";
  if (value === "cnpj") return "CNPJ";
  return null;
}

/** Lightweight mask for showing to the driver/admin without leaking the full key. */
export function maskPixKey(type: PixKeyType, value: string): string {
  const v = value.trim();
  if (!v) return "";
  switch (type) {
    case "cpf": {
      const d = onlyDigits(v).padStart(11, "0").slice(-11);
      return `***.${d.slice(3, 6)}.${d.slice(6, 9)}-**`;
    }
    case "cnpj": {
      const d = onlyDigits(v).padStart(14, "0").slice(-14);
      return `**.${d.slice(2, 5)}.${d.slice(5, 8)}/${d.slice(8, 12)}-**`;
    }
    case "email": {
      const [user, dom] = v.split("@");
      if (!dom) return v;
      const u = user.length <= 2 ? user[0] + "*" : user[0] + "***" + user.slice(-1);
      return `${u}@${dom}`;
    }
    case "phone": {
      const d = onlyDigits(v);
      return `+** (**) ****-${d.slice(-4)}`;
    }
    case "random":
      return v.slice(0, 4) + "…" + v.slice(-4);
  }
}

/** Light validation per key type. Returns an error message or null. */
export function validatePixKey(type: PixKeyType, value: string): string | null {
  const v = value.trim();
  if (!v) return "Informe a chave Pix.";
  switch (type) {
    case "cpf":
      if (onlyDigits(v).length !== 11) return "CPF inválido.";
      return null;
    case "cnpj":
      if (onlyDigits(v).length !== 14) return "CNPJ inválido.";
      return null;
    case "email":
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v)) return "E-mail inválido.";
      return null;
    case "phone":
      if (onlyDigits(v).length < 10) return "Telefone inválido.";
      return null;
    case "random":
      if (v.length < 8) return "Chave aleatória inválida.";
      return null;
  }
}

export async function getMyPayoutMethod(
  driverId: string,
): Promise<DriverPayoutMethod | null> {
  const { data, error } = await supabase
    .from("driver_payout_methods")
    .select("*")
    .eq("driver_id", driverId)
    .eq("is_default", true)
    .maybeSingle();
  if (error) throw error;
  return data;
}

export interface UpsertPayoutMethodInput {
  driver_id: string;
  pix_key_type: PixKeyType;
  pix_key_value: string;
  legal_name?: string | null;
  document_type?: "cpf" | "cnpj" | null;
  document_number?: string | null;
}

/**
 * Inserts or updates the driver's default Pix payout method. Any change
 * forces status back to `pending_review` so admins re-validate before
 * releasing payouts.
 */
export async function upsertMyPayoutMethod(input: UpsertPayoutMethodInput) {
  const value = input.pix_key_value.trim();
  const normalized =
    input.pix_key_type === "cpf" ||
    input.pix_key_type === "cnpj" ||
    input.pix_key_type === "phone"
      ? onlyDigits(value)
      : value;
  const masked = maskPixKey(input.pix_key_type, value);

  const existing = await getMyPayoutMethod(input.driver_id);

  const patch = {
    driver_id: input.driver_id,
    pix_key_type: DB_PIX_KEY_TYPES[input.pix_key_type],
    pix_key_value: normalized,
    pix_key_value_masked: masked,
    legal_name: input.legal_name?.trim() || null,
    document_type: toDbDocumentType(input.document_type),
    document_number: input.document_number
      ? onlyDigits(input.document_number)
      : null,
    is_default: true,
    status: "pending_review" as const,
    reviewed_at: null,
    reviewed_by: null,
    rejection_reason: null,
  };

  if (existing) {
    const { error } = await supabase
      .from("driver_payout_methods")
      .update(patch)
      .eq("id", existing.id);
    if (error) throw error;
    return existing.id;
  }

  const { data, error } = await supabase
    .from("driver_payout_methods")
    .insert(patch)
    .select("id")
    .single();
  if (error) throw error;
  return data.id;
}
