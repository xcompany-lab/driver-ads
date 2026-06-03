import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";

export type AdvertiserPayment = Database["public"]["Tables"]["advertiser_payments"]["Row"];
export type DriverPayout = Database["public"]["Tables"]["driver_payouts"]["Row"];
export type AdvertiserPaymentStatus = Database["public"]["Enums"]["advertiser_payment_status"];
export type DriverPayoutStatus = Database["public"]["Enums"]["driver_payout_status"];

export interface AdvertiserPaymentWithRelations extends AdvertiserPayment {
  campaign: { id: string; name: string; city: string } | null;
  advertiser: { id: string; company_name: string; cnpj: string } | null;
}

export interface DriverPayoutWithRelations extends DriverPayout {
  driver: { id: string; full_name: string; city: string; pix_key: string | null; pix_key_type: string | null } | null;
  assignment: {
    id: string;
    monthly_payout: number;
    campaign: { id: string; name: string } | null;
    vehicle: { id: string; plate: string; model: string } | null;
  } | null;
}

/* =========================
   Admin — Advertiser payments
   ========================= */

export async function listAdvertiserPayments(
  status: AdvertiserPaymentStatus | "all" = "all",
): Promise<AdvertiserPaymentWithRelations[]> {
  let q = supabase
    .from("advertiser_payments")
    .select(`
      *,
      campaign:campaigns(id, name, city),
      advertiser:advertisers(id, company_name, cnpj)
    `)
    .order("due_date", { ascending: false });
  if (status !== "all") q = q.eq("status", status);
  const { data, error } = await q;
  if (error) throw error;
  return (data ?? []) as unknown as AdvertiserPaymentWithRelations[];
}

export interface CreateAdvertiserPaymentInput {
  campaign_id: string;
  advertiser_id: string;
  amount: number;
  due_date: string;
  notes?: string | null;
}

export async function createAdvertiserPayment(input: CreateAdvertiserPaymentInput) {
  const { data: u } = await supabase.auth.getUser();
  const { error } = await supabase.from("advertiser_payments").insert({
    ...input,
    created_by: u.user?.id ?? null,
  });
  if (error) throw error;
}

export async function updateAdvertiserPaymentStatus(
  id: string,
  status: AdvertiserPaymentStatus,
  receipt_url?: string | null,
) {
  const patch: Partial<AdvertiserPayment> = { status };
  if (status === "paid") patch.paid_at = new Date().toISOString();
  if (status !== "paid") patch.paid_at = null;
  if (typeof receipt_url !== "undefined") patch.receipt_url = receipt_url;
  const { error } = await supabase.from("advertiser_payments").update(patch).eq("id", id);
  if (error) throw error;
}

export async function deleteAdvertiserPayment(id: string) {
  const { error } = await supabase.from("advertiser_payments").delete().eq("id", id);
  if (error) throw error;
}

/* =========================
   Admin — Driver payouts
   ========================= */

export async function listDriverPayouts(
  status: DriverPayoutStatus | "all" = "all",
): Promise<DriverPayoutWithRelations[]> {
  let q = supabase
    .from("driver_payouts")
    .select(`
      *,
      driver:drivers(id, full_name, city, pix_key, pix_key_type),
      assignment:campaign_driver_assignments(
        id, monthly_payout,
        campaign:campaigns(id, name),
        vehicle:vehicles(id, plate, model)
      )
    `)
    .order("reference_month", { ascending: false });
  if (status !== "all") q = q.eq("status", status);
  const { data, error } = await q;
  if (error) throw error;
  return (data ?? []) as unknown as DriverPayoutWithRelations[];
}

export interface CreatePayoutInput {
  assignment_id: string;
  driver_id: string;
  reference_month: string; // YYYY-MM-01
  amount: number;
  pix_key?: string | null;
  pix_key_type?: string | null;
  notes?: string | null;
}

export async function createDriverPayout(input: CreatePayoutInput) {
  const { data: u } = await supabase.auth.getUser();
  const { error } = await supabase.from("driver_payouts").insert({
    ...input,
    created_by: u.user?.id ?? null,
  });
  if (error) throw error;
}

export async function updateDriverPayoutStatus(
  id: string,
  status: DriverPayoutStatus,
  receipt_url?: string | null,
) {
  const patch: Partial<DriverPayout> = { status };
  if (status === "paid") patch.paid_at = new Date().toISOString();
  if (status !== "paid") patch.paid_at = null;
  if (typeof receipt_url !== "undefined") patch.receipt_url = receipt_url;
  const { error } = await supabase.from("driver_payouts").update(patch).eq("id", id);
  if (error) throw error;
}

export async function deleteDriverPayout(id: string) {
  const { error } = await supabase.from("driver_payouts").delete().eq("id", id);
  if (error) throw error;
}

/* =========================
   Generate payouts from active assignments for a given month
   ========================= */

export async function generateMonthlyPayouts(refMonth: string): Promise<{ created: number; skipped: number }> {
  const { data: u } = await supabase.auth.getUser();
  const { data: assignments, error } = await supabase
    .from("campaign_driver_assignments")
    .select("id, driver_id, monthly_payout, status, driver:drivers(pix_key, pix_key_type)")
    .eq("status", "active");
  if (error) throw error;

  let created = 0;
  let skipped = 0;
  for (const a of assignments ?? []) {
    const driver = (a as unknown as { driver: { pix_key: string | null; pix_key_type: string | null } | null }).driver;
    const { error: insErr } = await supabase.from("driver_payouts").insert({
      assignment_id: a.id,
      driver_id: a.driver_id,
      reference_month: refMonth,
      amount: Number(a.monthly_payout || 0),
      pix_key: driver?.pix_key ?? null,
      pix_key_type: driver?.pix_key_type ?? null,
      created_by: u.user?.id ?? null,
    });
    if (insErr) {
      // unique violation -> already exists
      skipped++;
    } else {
      created++;
    }
  }
  return { created, skipped };
}

/* =========================
   Advertiser self-service
   ========================= */

export async function listMyAdvertiserPayments(advertiserId: string) {
  const { data, error } = await supabase
    .from("advertiser_payments")
    .select(`*, campaign:campaigns(id, name, city)`)
    .eq("advertiser_id", advertiserId)
    .order("due_date", { ascending: false });
  if (error) throw error;
  return data ?? [];
}

/* =========================
   Driver self-service
   ========================= */

export async function listMyDriverPayouts(driverId: string) {
  const { data, error } = await supabase
    .from("driver_payouts")
    .select(`
      *,
      assignment:campaign_driver_assignments(
        id, monthly_payout,
        campaign:campaigns(id, name),
        vehicle:vehicles(id, plate, model)
      )
    `)
    .eq("driver_id", driverId)
    .order("reference_month", { ascending: false });
  if (error) throw error;
  return data ?? [];
}

/* =========================
   Receipt URLs (private bucket)
   ========================= */

export async function getReceiptSignedUrl(path: string, expiresIn = 60 * 10): Promise<string> {
  const { data, error } = await supabase.storage
    .from("payment-receipts")
    .createSignedUrl(path, expiresIn);
  if (error) throw error;
  return data.signedUrl;
}

export async function uploadReceipt(
  folder: "advertisers" | "drivers",
  ownerId: string,
  file: File,
): Promise<string> {
  const ext = file.name.split(".").pop() || "pdf";
  const path = `${folder}/${ownerId}/${Date.now()}.${ext}`;
  const { error } = await supabase.storage.from("payment-receipts").upload(path, file, {
    cacheControl: "3600",
    upsert: false,
  });
  if (error) throw error;
  return path;
}
