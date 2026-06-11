import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";

export type QrDestinationType = Database["public"]["Enums"]["qr_destination_type"];
export type CampaignQrCode = Database["public"]["Tables"]["campaign_qr_codes"]["Row"];
export type CampaignQrCodeInsert = Database["public"]["Tables"]["campaign_qr_codes"]["Insert"];
export type CampaignQrCodeUpdate = Database["public"]["Tables"]["campaign_qr_codes"]["Update"];
export type CampaignQrScan = Database["public"]["Tables"]["campaign_qr_scans"]["Row"];

const GENERATED_ART_BUCKET = "campaign-arts";

export function normalizeWhatsappPhone(value: string) {
  const digits = value.replace(/\D/g, "");
  if (digits.length === 10 || digits.length === 11) return `55${digits}`;
  return digits;
}

export function getWhatsappUrl(phone: string) {
  return `https://wa.me/${normalizeWhatsappPhone(phone)}`;
}

export function normalizeLandingUrl(value: string) {
  const trimmed = value.trim();
  if (!trimmed) return "";
  if (/^https?:\/\//i.test(trimmed)) return trimmed;
  return `https://${trimmed}`;
}

export function buildQrDestination(input: {
  destinationType: QrDestinationType;
  whatsappPhone?: string;
  landingPageUrl?: string;
}) {
  if (input.destinationType === "whatsapp") {
    const phone = normalizeWhatsappPhone(input.whatsappPhone ?? "");
    if (!/^[0-9]{10,15}$/.test(phone)) {
      throw new Error("Informe um WhatsApp valido para o QR Code.");
    }
    return {
      destination_url: getWhatsappUrl(phone),
      whatsapp_phone: phone,
      landing_page_url: null,
    };
  }

  const landing = normalizeLandingUrl(input.landingPageUrl ?? "");
  if (!/^https?:\/\//i.test(landing)) {
    throw new Error("Informe uma URL valida para a landing page.");
  }
  return {
    destination_url: landing,
    whatsapp_phone: null,
    landing_page_url: landing,
  };
}

export function getPublicQrUrl(shortCode: string) {
  const origin =
    typeof window !== "undefined" && window.location.origin
      ? window.location.origin
      : "https://driverads.com.br";
  return `${origin}/q/${shortCode}`;
}

export async function getCampaignQrCode(campaignId: string): Promise<CampaignQrCode | null> {
  const { data, error } = await supabase
    .from("campaign_qr_codes")
    .select("*")
    .eq("campaign_id", campaignId)
    .maybeSingle();
  if (error) throw error;
  return data ?? null;
}

export async function upsertCampaignQrCode(input: {
  campaignId: string;
  advertiserId: string;
  destinationType: QrDestinationType;
  whatsappPhone?: string;
  landingPageUrl?: string;
  createdBy?: string | null;
}) {
  const destination = buildQrDestination({
    destinationType: input.destinationType,
    whatsappPhone: input.whatsappPhone,
    landingPageUrl: input.landingPageUrl,
  });

  const payload: CampaignQrCodeInsert = {
    campaign_id: input.campaignId,
    advertiser_id: input.advertiserId,
    destination_type: input.destinationType,
    destination_url: destination.destination_url,
    whatsapp_phone: destination.whatsapp_phone,
    landing_page_url: destination.landing_page_url,
    is_active: true,
    created_by: input.createdBy ?? null,
  };

  const { data, error } = await supabase
    .from("campaign_qr_codes")
    .upsert(payload, { onConflict: "campaign_id" })
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function updateCampaignQrGeneratedAssets(
  id: string,
  patch: Pick<CampaignQrCodeUpdate, "final_image_url" | "final_pdf_url" | "generated_at">,
) {
  const { data, error } = await supabase
    .from("campaign_qr_codes")
    .update(patch)
    .eq("id", id)
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function getCampaignQrScanCount(campaignId: string) {
  const { count, error } = await supabase
    .from("campaign_qr_scans")
    .select("*", { count: "exact", head: true })
    .eq("campaign_id", campaignId);
  if (error) throw error;
  return count ?? 0;
}

export async function listCampaignQrScans(campaignId: string, limit = 10) {
  const { data, error } = await supabase
    .from("campaign_qr_scans")
    .select("*")
    .eq("campaign_id", campaignId)
    .order("scanned_at", { ascending: false })
    .limit(limit);
  if (error) throw error;
  return data ?? [];
}

function extFromType(contentType: string) {
  if (contentType === "application/pdf") return "pdf";
  if (contentType === "image/jpeg") return "jpg";
  return "png";
}

export async function uploadGeneratedQrAsset(input: {
  advertiserId: string;
  campaignId: string;
  blob: Blob;
  contentType: string;
}) {
  const unique =
    typeof crypto !== "undefined" && "randomUUID" in crypto
      ? crypto.randomUUID()
      : `${Date.now()}`;
  const path = `${input.advertiserId}/generated/${input.campaignId}/${unique}.${extFromType(input.contentType)}`;
  const { error } = await supabase.storage.from(GENERATED_ART_BUCKET).upload(path, input.blob, {
    upsert: true,
    contentType: input.contentType,
  });
  if (error) throw error;
  return path;
}
