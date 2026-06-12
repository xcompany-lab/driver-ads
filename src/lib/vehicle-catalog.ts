import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";

export type VehicleModelImage = Database["public"]["Tables"]["vehicle_model_images"]["Row"];
export type VehicleModelImageInsert = Database["public"]["Tables"]["vehicle_model_images"]["Insert"];

const VEHICLES_BUCKET = "vehicles";
const CATALOG_PREFIX = "catalog";
/** Limiar mínimo de similaridade para aceitar um match fuzzy (0..1). */
const MATCH_THRESHOLD = 0.45;

/**
 * Normaliza texto de marca/modelo: minúsculas, sem acento, sem pontuação,
 * espaços colapsados. Espelha public.normalize_vehicle_text no Postgres.
 */
export function normalizeVehicleText(input: string | null | undefined): string {
  return (input ?? "")
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

/** Coeficiente de Dice sobre bigramas — similaridade tolerante de 0 a 1. */
function diceCoefficient(a: string, b: string): number {
  const ca = a.replace(/\s+/g, "");
  const cb = b.replace(/\s+/g, "");
  if (!ca.length || !cb.length) return 0;
  if (ca === cb) return 1;
  if (ca.length < 2 || cb.length < 2) return ca === cb ? 1 : 0;

  const bigrams = new Map<string, number>();
  for (let i = 0; i < ca.length - 1; i++) {
    const bg = ca.slice(i, i + 2);
    bigrams.set(bg, (bigrams.get(bg) ?? 0) + 1);
  }
  let intersection = 0;
  for (let i = 0; i < cb.length - 1; i++) {
    const bg = cb.slice(i, i + 2);
    const count = bigrams.get(bg) ?? 0;
    if (count > 0) {
      bigrams.set(bg, count - 1);
      intersection++;
    }
  }
  return (2 * intersection) / (ca.length - 1 + (cb.length - 1));
}

/** Pontua quão bem uma entrada do catálogo casa com a marca/modelo normalizados. */
export function scoreMatch(nBrand: string, nModel: string, entry: VehicleModelImage): number {
  if (entry.is_default || !entry.active) return -1;
  const modelKey = entry.model_key ?? "";
  const brandKey = entry.brand_key ?? "";
  if (!modelKey && !entry.aliases.length) return 0;

  const combo = `${nBrand} ${nModel}`.trim();

  // Match exato de modelo
  if (nModel && nModel === modelKey) return brandKey && nBrand === brandKey ? 1 : 0.96;
  // Alias bate exatamente (aliases já são normalizados)
  if (nModel && entry.aliases.includes(nModel)) return 0.95;
  if (combo && entry.aliases.includes(combo)) return 0.95;

  // Similaridade fuzzy sobre o MODELO (a marca não entra na comparação para não
  // inflar o score entre modelos distintos da mesma marca — ex.: Prisma vs Onix).
  let best = diceCoefficient(nModel, modelKey);
  for (const alias of entry.aliases) {
    best = Math.max(best, diceCoefficient(nModel, alias), diceCoefficient(combo, alias));
  }
  // Pequeno bônus quando a marca coincide (desempate, não força match isolado).
  if (brandKey && nBrand && nBrand === brandKey && best > 0) best = Math.min(1, best + 0.1);
  return best;
}

/**
 * Resolve a melhor imagem do catálogo para uma marca/modelo.
 * Retorna o image_path da entrada vencedora ou o default (silhueta única).
 */
export function resolveVehicleImagePath(
  brand: string | null | undefined,
  model: string | null | undefined,
  catalog: VehicleModelImage[],
): string | null {
  const fallback = catalog.find((c) => c.is_default)?.image_path ?? null;
  if (!catalog.length) return fallback;

  const nBrand = normalizeVehicleText(brand);
  const nModel = normalizeVehicleText(model);
  if (!nModel) return fallback;

  let bestScore = -1;
  let bestEntry: VehicleModelImage | null = null;
  for (const entry of catalog) {
    const score = scoreMatch(nBrand, nModel, entry);
    // Desempate por prioridade menor (mais específico)
    if (score > bestScore || (score === bestScore && bestEntry && entry.priority < bestEntry.priority)) {
      bestScore = score;
      bestEntry = entry;
    }
  }
  if (bestEntry && bestScore >= MATCH_THRESHOLD) return bestEntry.image_path;
  return fallback;
}

/** Constrói a URL pública de um image_path do bucket de veículos. */
export function vehicleImageUrl(path: string | null | undefined): string | null {
  if (!path) return null;
  if (/^https?:\/\//i.test(path)) return path;
  const { data } = supabase.storage.from(VEHICLES_BUCKET).getPublicUrl(path);
  return data.publicUrl;
}

/** Atalho: resolve marca/modelo direto para URL pública. */
export function resolveVehicleImageUrl(
  brand: string | null | undefined,
  model: string | null | undefined,
  catalog: VehicleModelImage[],
): string | null {
  return vehicleImageUrl(resolveVehicleImagePath(brand, model, catalog));
}

// ---------------------------------------------------------------------------
// CRUD do catálogo (tela admin)
// ---------------------------------------------------------------------------

/** Lista modelos do catalogo de uma categoria (tier), para previas por plano. */
export async function listCatalogByTier(tier: string, limit = 8): Promise<VehicleModelImage[]> {
  const { data, error } = await supabase
    .from("vehicle_model_images")
    .select("*")
    .eq("tier", tier)
    .eq("active", true)
    .eq("is_default", false)
    .order("priority", { ascending: true })
    .limit(limit);
  if (error) throw error;
  return data ?? [];
}

export async function listVehicleCatalog(): Promise<VehicleModelImage[]> {
  const { data, error } = await supabase
    .from("vehicle_model_images")
    .select("*")
    .order("is_default", { ascending: false })
    .order("priority", { ascending: true })
    .order("display_brand", { ascending: true });
  if (error) throw error;
  return data ?? [];
}

export async function upsertVehicleCatalog(payload: VehicleModelImageInsert): Promise<VehicleModelImage> {
  // Só um default pode existir (unique index parcial). Limpa os demais antes.
  if (payload.is_default) {
    let clear = supabase.from("vehicle_model_images").update({ is_default: false }).eq("is_default", true);
    if (payload.id) clear = clear.neq("id", payload.id);
    const { error: clearError } = await clear;
    if (clearError) throw clearError;
  }
  const { data, error } = await supabase
    .from("vehicle_model_images")
    .upsert(payload, { onConflict: "id" })
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function deleteVehicleCatalog(id: string): Promise<void> {
  const { error } = await supabase.from("vehicle_model_images").delete().eq("id", id);
  if (error) throw error;
}

function ext(file: File) {
  const m = file.name.match(/\.([^.]+)$/);
  return m ? m[1].toLowerCase() : "png";
}

function slugify(s: string) {
  return normalizeVehicleText(s).replace(/\s+/g, "-") || "modelo";
}

/** Faz upload de uma imagem para catalog/ e retorna o image_path (relativo ao bucket). */
export async function uploadCatalogImage(file: File, brand?: string | null, model?: string | null): Promise<string> {
  if (!file.type.startsWith("image/")) {
    throw new Error("Envie um arquivo de imagem.");
  }
  if (file.size > 5 * 1024 * 1024) {
    throw new Error("A imagem deve ter no máximo 5MB.");
  }
  const unique = typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : `${Date.now()}`;
  const base = slugify(`${brand ?? ""} ${model ?? ""}`.trim());
  const path = `${CATALOG_PREFIX}/${base}-${unique}.${ext(file)}`;
  const { error } = await supabase.storage.from(VEHICLES_BUCKET).upload(path, file, {
    upsert: true,
    contentType: file.type || undefined,
  });
  if (error) throw error;
  return path;
}
