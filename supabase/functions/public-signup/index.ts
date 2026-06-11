import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

type SignupRole = "driver" | "advertiser";

type SignupInput = {
  role?: SignupRole;
  email?: string;
  password?: string;
  full_name?: string;
  phone?: string;
  cpf?: string;
  city?: string;
  company_name?: string;
  cnpj?: string;
  segment?: string;
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", ...corsHeaders },
  });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return json({ error: "method_not_allowed" }, 405);
  }

  let raw: SignupInput;
  try {
    raw = await req.json();
  } catch {
    return json({ error: "invalid_json", message: "Dados invalidos." }, 400);
  }

  const input = normalizeInput(raw);
  const validationError = validateInput(input);
  if (validationError) {
    return json({ error: "invalid_input", message: validationError }, 400);
  }

  const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { data: created, error: createError } = await admin.auth.admin.createUser({
    email: input.email,
    password: input.password,
    email_confirm: true,
    user_metadata: buildMetadata(input),
  });

  if (createError || !created.user) {
    return json(mapAuthError(createError?.message), authErrorStatus(createError?.message));
  }

  const userId = created.user.id;
  const { error: profileError } = await admin.from("profiles").upsert({
    id: userId,
    full_name: input.full_name,
    phone: input.phone,
  });

  if (profileError) {
    await admin.auth.admin.deleteUser(userId);
    console.error("[public-signup] profile upsert failed", profileError);
    return json({ error: "profile_create_failed", message: "Nao foi possivel criar o perfil." }, 500);
  }

  const { error: roleError } = await admin
    .from("user_roles")
    .upsert({ user_id: userId, role: input.role }, { onConflict: "user_id,role" });

  if (roleError) {
    await admin.auth.admin.deleteUser(userId);
    console.error("[public-signup] role upsert failed", roleError);
    return json({ error: "role_create_failed", message: "Nao foi possivel definir o tipo de conta." }, 500);
  }

  const entityError = input.role === "driver"
    ? await upsertDriver(admin, userId, input)
    : await upsertAdvertiser(admin, userId, input);

  if (entityError) {
    await admin.auth.admin.deleteUser(userId);
    console.error("[public-signup] entity upsert failed", entityError);
    return json(mapEntityError(entityError), entityError.code === "23505" ? 409 : 500);
  }

  return json({ user_id: userId, email_confirmed: true, status: "pending_review" });
});

function normalizeInput(raw: SignupInput): Required<SignupInput> {
  return {
    role: raw.role === "advertiser" ? "advertiser" : "driver",
    email: String(raw.email ?? "").trim().toLowerCase(),
    password: String(raw.password ?? ""),
    full_name: collapseSpaces(raw.full_name),
    phone: onlyDigits(raw.phone),
    cpf: onlyDigits(raw.cpf),
    city: collapseSpaces(raw.city),
    company_name: collapseSpaces(raw.company_name),
    cnpj: onlyDigits(raw.cnpj),
    segment: collapseSpaces(raw.segment),
  };
}

function validateInput(input: Required<SignupInput>) {
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(input.email)) return "Informe um e-mail valido.";
  if (input.password.length < 6) return "A senha precisa ter pelo menos 6 caracteres.";
  if (input.full_name.length < 3) return "Informe o nome completo.";
  if (input.phone.length < 10 || input.phone.length > 15) return "Informe um telefone valido.";
  if (input.city.length < 2) return "Informe a cidade.";

  if (input.role === "driver") {
    if (input.cpf.length !== 11) return "Informe um CPF com 11 digitos.";
    return null;
  }

  if (input.company_name.length < 2) return "Informe o nome da empresa.";
  if (input.cnpj.length !== 14) return "Informe um CNPJ com 14 digitos.";
  return null;
}

function buildMetadata(input: Required<SignupInput>) {
  if (input.role === "driver") {
    return {
      account_type: "driver",
      full_name: input.full_name,
      phone: input.phone,
      cpf: input.cpf,
      city: input.city,
    };
  }

  return {
    account_type: "advertiser",
    full_name: input.full_name,
    phone: input.phone,
    company_name: input.company_name,
    cnpj: input.cnpj,
    city: input.city,
    segment: input.segment,
  };
}

async function upsertDriver(
  admin: ReturnType<typeof createClient>,
  userId: string,
  input: Required<SignupInput>,
) {
  const { error } = await admin.from("drivers").upsert({
    user_id: userId,
    full_name: input.full_name,
    cpf: input.cpf,
    email: input.email,
    phone: input.phone,
    city: input.city,
    regions: [],
  }, { onConflict: "user_id" });
  return error;
}

async function upsertAdvertiser(
  admin: ReturnType<typeof createClient>,
  userId: string,
  input: Required<SignupInput>,
) {
  const { error } = await admin.from("advertisers").upsert({
    user_id: userId,
    company_name: input.company_name,
    cnpj: input.cnpj,
    responsible: input.full_name,
    email: input.email,
    phone: input.phone,
    city: input.city,
    segment: input.segment || null,
  }, { onConflict: "user_id" });
  return error;
}

function mapAuthError(message = "") {
  const lower = message.toLowerCase();
  if (lower.includes("already") || lower.includes("registered") || lower.includes("exists")) {
    return { error: "email_already_registered", message: "Este e-mail ja possui cadastro. Use Entrar." };
  }
  if (lower.includes("password")) {
    return { error: "weak_password", message: "A senha informada nao foi aceita." };
  }
  console.error("[public-signup] auth create failed", message);
  return { error: "signup_failed", message: "Nao foi possivel criar a conta agora." };
}

function authErrorStatus(message = "") {
  const lower = message.toLowerCase();
  return lower.includes("already") || lower.includes("registered") || lower.includes("exists") ? 409 : 400;
}

function mapEntityError(error: { code?: string; message?: string }) {
  if (error.code === "23505") {
    return { error: "document_already_registered", message: "CPF/CNPJ ja cadastrado na plataforma." };
  }
  return { error: "entity_create_failed", message: "Nao foi possivel finalizar o cadastro." };
}

function collapseSpaces(value: unknown) {
  return String(value ?? "").trim().replace(/\s+/g, " ");
}

function onlyDigits(value: unknown) {
  return String(value ?? "").replace(/\D/g, "");
}
