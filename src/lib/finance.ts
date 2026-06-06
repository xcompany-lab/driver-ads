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

/* =========================
   Admin — PIX review queue
   ========================= */

export type DriverPayoutMethodRow =
  Database["public"]["Tables"]["driver_payout_methods"]["Row"];

export interface PixReviewWithDriver extends DriverPayoutMethodRow {
  driver: { id: string; full_name: string; cpf: string; email: string; city: string } | null;
}

export async function listPixMethodsForReview(
  status: "pending_review" | "approved" | "rejected" | "all" = "pending_review",
): Promise<PixReviewWithDriver[]> {
  let q = supabase
    .from("driver_payout_methods")
    .select(`*, driver:drivers(id, full_name, cpf, email, city)`)
    .order("updated_at", { ascending: false });
  if (status !== "all") q = q.eq("status", status);
  const { data, error } = await q;
  if (error) throw error;
  return (data ?? []) as unknown as PixReviewWithDriver[];
}

export async function approvePixMethod(id: string) {
  const { data: u } = await supabase.auth.getUser();
  const { error } = await supabase
    .from("driver_payout_methods")
    .update({
      status: "approved",
      reviewed_at: new Date().toISOString(),
      reviewed_by: u.user?.id ?? null,
      rejection_reason: null,
    })
    .eq("id", id);
  if (error) throw error;
}

export async function rejectPixMethod(id: string, reason: string) {
  if (!reason.trim()) throw new Error("Informe o motivo da recusa.");
  const { data: u } = await supabase.auth.getUser();
  const { error } = await supabase
    .from("driver_payout_methods")
    .update({
      status: "rejected",
      reviewed_at: new Date().toISOString(),
      reviewed_by: u.user?.id ?? null,
      rejection_reason: reason.trim(),
    })
    .eq("id", id);
  if (error) throw error;
}

/* =========================
   Earnings → Payouts (Phase 9 flow)
   ========================= */

export interface ReleasableEarning {
  id: string;
  driver_id: string;
  assignment_id: string | null;
  campaign_id: string;
  amount_cents: number;
  period_start: string;
  period_end: string;
  available_at: string | null;
  driver: { id: string; full_name: string; city: string } | null;
  pix: { status: string; pix_key_value_masked: string | null; pix_key_type: string } | null;
}

/**
 * Lists driver_earnings that are 'accrued' and whose available_at has passed
 * (chargeback hold cleared). Each row is enriched with the driver's default
 * PIX method so the admin can see who is actually payable.
 */
export async function listReleasableEarnings(): Promise<ReleasableEarning[]> {
  const nowIso = new Date().toISOString();
  const { data: earnings, error } = await supabase
    .from("driver_earnings")
    .select(`
      id, driver_id, assignment_id, campaign_id, amount_cents,
      period_start, period_end, available_at,
      driver:drivers(id, full_name, city)
    `)
    .eq("status", "accrued")
    .lte("available_at", nowIso)
    .order("available_at", { ascending: true });
  if (error) throw error;

  const driverIds = Array.from(new Set((earnings ?? []).map((e) => e.driver_id)));
  let pixByDriver = new Map<string, { status: string; pix_key_value_masked: string | null; pix_key_type: string }>();
  if (driverIds.length) {
    const { data: pix } = await supabase
      .from("driver_payout_methods")
      .select("driver_id, status, pix_key_value_masked, pix_key_type, is_default")
      .in("driver_id", driverIds)
      .eq("is_default", true);
    for (const p of pix ?? []) {
      pixByDriver.set(p.driver_id, {
        status: p.status as string,
        pix_key_value_masked: p.pix_key_value_masked,
        pix_key_type: p.pix_key_type,
      });
    }
  }

  return (earnings ?? []).map((e) => ({
    ...(e as Omit<ReleasableEarning, "pix">),
    pix: pixByDriver.get(e.driver_id) ?? null,
  })) as ReleasableEarning[];
}

/**
 * For each driver with available earnings (PIX approved), creates ONE
 * driver_payouts row summing the earnings and links them via earnings.payout_id,
 * flipping the earnings to 'paid'. Skips drivers without an approved PIX.
 */
export async function generatePayoutsFromEarnings(
  refMonth: string,
): Promise<{ created: number; skippedNoPix: number; totalEarnings: number }> {
  const { data: u } = await supabase.auth.getUser();
  const releasable = await listReleasableEarnings();
  if (!releasable.length) return { created: 0, skippedNoPix: 0, totalEarnings: 0 };

  // Group by driver
  const byDriver = new Map<string, ReleasableEarning[]>();
  for (const e of releasable) {
    const arr = byDriver.get(e.driver_id) ?? [];
    arr.push(e);
    byDriver.set(e.driver_id, arr);
  }

  let created = 0;
  let skippedNoPix = 0;

  for (const [driverId, items] of byDriver.entries()) {
    const pix = items[0].pix;
    if (!pix || pix.status !== "approved") {
      skippedNoPix++;
      continue;
    }
    // Use one assignment_id for the payout row (legacy column requires NOT NULL)
    const anyAssignment = items.find((i) => i.assignment_id)?.assignment_id;
    if (!anyAssignment) {
      skippedNoPix++;
      continue;
    }
    const totalCents = items.reduce((s, i) => s + Number(i.amount_cents), 0);
    const amount = totalCents / 100;

    const { data: payout, error: payErr } = await supabase
      .from("driver_payouts")
      .insert({
        assignment_id: anyAssignment,
        driver_id: driverId,
        reference_month: refMonth,
        amount,
        pix_key: null,
        pix_key_type: pix.pix_key_type,
        notes: `Gerado a partir de ${items.length} período(s) de ganhos.`,
        created_by: u.user?.id ?? null,
      })
      .select("id")
      .single();
    if (payErr) {
      // unique violation (assignment+month) — skip; earnings remain accrued
      continue;
    }

    const ids = items.map((i) => i.id);
    const { error: updErr } = await supabase
      .from("driver_earnings")
      .update({
        status: "paid",
        payout_id: payout.id,
        paid_at: new Date().toISOString(),
      })
      .in("id", ids);
    if (updErr) throw updErr;

    created++;
  }

  return { created, skippedNoPix, totalEarnings: releasable.length };
}

/* =========================
   Phase 10 — Pix Out execution (payouts v2)
   ========================= */

export type PayoutV2Row = Database["public"]["Tables"]["payouts"]["Row"];
export type PayoutV2Status = Database["public"]["Enums"]["payout_status"];

export interface PayoutV2WithRelations extends PayoutV2Row {
  driver: { id: string; full_name: string; city: string } | null;
  method: {
    id: string;
    pix_key_type: string;
    pix_key_value_masked: string | null;
    status: string;
  } | null;
  items: { id: string; driver_earning_id: string; amount_cents: number }[];
}

export async function listPayoutsV2(
  status: PayoutV2Status | "all" = "all",
): Promise<PayoutV2WithRelations[]> {
  let q = supabase
    .from("payouts")
    .select(`
      *,
      driver:drivers(id, full_name, city),
      method:driver_payout_methods!payouts_payout_method_id_fkey(id, pix_key_type, pix_key_value_masked, status),
      items:payout_items(id, driver_earning_id, amount_cents)
    `)
    .order("created_at", { ascending: false });
  if (status !== "all") q = q.eq("status", status);
  const { data, error } = await q;
  if (error) throw error;
  return (data ?? []) as unknown as PayoutV2WithRelations[];
}

/**
 * Phase 10 generator: writes to the new `payouts` + `payout_items` tables and
 * locks the underlying `driver_earnings` via payout_id (status becomes 'locked').
 * Only consumes earnings whose driver has an approved default PIX method.
 */
export async function generatePayoutsV2(): Promise<{
  created: number;
  skippedNoPix: number;
  totalEarnings: number;
}> {
  const releasable = await listReleasableEarnings();
  if (!releasable.length) return { created: 0, skippedNoPix: 0, totalEarnings: 0 };

  const byDriver = new Map<string, typeof releasable>();
  for (const e of releasable) {
    const arr = byDriver.get(e.driver_id) ?? [];
    arr.push(e);
    byDriver.set(e.driver_id, arr);
  }

  // Fetch default methods once
  const { data: methods } = await supabase
    .from("driver_payout_methods")
    .select("id, driver_id, status, pix_key_type, pix_key_value_masked")
    .in("driver_id", Array.from(byDriver.keys()))
    .eq("is_default", true);
  const methodByDriver = new Map<string, (typeof methods)[number]>();
  for (const m of methods ?? []) methodByDriver.set(m.driver_id, m);

  let created = 0;
  let skippedNoPix = 0;

  for (const [driverId, items] of byDriver.entries()) {
    const method = methodByDriver.get(driverId);
    if (!method || method.status !== "approved") {
      skippedNoPix++;
      continue;
    }
    const totalCents = items.reduce((s, i) => s + Number(i.amount_cents), 0);

    const { data: payout, error: payErr } = await supabase
      .from("payouts")
      .insert({
        driver_id: driverId,
        payout_method_id: method.id,
        amount_cents: totalCents,
        status: "draft" as PayoutV2Status,
        pix_key_type: method.pix_key_type,
        pix_key_value_masked: method.pix_key_value_masked,
        description: `Repasse Driver Ads — ${items.length} período(s) de ganhos`,
      })
      .select("id")
      .single();
    if (payErr || !payout) continue;

    const itemRows = items.map((i) => ({
      payout_id: payout.id,
      driver_earning_id: i.id,
      amount_cents: Number(i.amount_cents),
    }));
    const { error: itemsErr } = await supabase.from("payout_items").insert(itemRows);
    if (itemsErr) {
      await supabase.from("payouts").delete().eq("id", payout.id);
      continue;
    }

    // Lock earnings to this payout (still 'accrued' but now tied)
    await supabase
      .from("driver_earnings")
      .update({ payout_id: payout.id, status: "locked", locked_reason: "pending_payout" })
      .in("id", items.map((i) => i.id));

    created++;
  }

  return { created, skippedNoPix, totalEarnings: releasable.length };
}

export async function executePayoutV2(payoutId: string): Promise<{
  pagou_transfer_id: string | null;
  request_id: string | null;
}> {
  const { data, error } = await supabase.functions.invoke("pagou-execute-payout", {
    body: { payout_id: payoutId },
  });
  if (error) {
    type FnContext = { context?: { error?: string; detail?: string } };
    const ctx = (error as unknown as FnContext).context;
    throw new Error(ctx?.detail ?? ctx?.error ?? error.message);
  }
  return data as { pagou_transfer_id: string | null; request_id: string | null };
}

export async function cancelPayoutV2(payoutId: string): Promise<void> {
  const { error } = await supabase
    .from("payouts")
    .update({ status: "cancelled" as PayoutV2Status })
    .eq("id", payoutId)
    .in("status", ["draft", "approved", "failed", "rejected", "error"]);
  if (error) throw error;
  // Release earnings back to accrued
  await supabase
    .from("driver_earnings")
    .update({ status: "accrued", payout_id: null, locked_reason: null })
    .eq("payout_id", payoutId);
}

