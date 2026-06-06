import { supabase } from "@/integrations/supabase/client";

export interface FinanceOverview {
  mrrCents: number;
  activeSubscriptions: number;
  monthRevenueCents: number;
  monthPaidTxCount: number;
  accruedCents: number;
  lockedCents: number;
  paidEarningsCents: number;
  payoutsPendingCents: number;
  payoutsPaidCents: number;
  reconciliationGapCents: number; // accrued+locked - payoutsPending (sanity)
  providerAvailableCents: number | null;
  providerPendingCents: number | null;
  providerSnapshotAt: string | null;
}

function startOfMonthIso(): string {
  const d = new Date();
  return new Date(d.getFullYear(), d.getMonth(), 1).toISOString();
}

export async function getFinanceOverview(): Promise<FinanceOverview> {
  const monthStart = startOfMonthIso();

  const [subs, monthTx, earnings, payoutsPending, payoutsPaid, balance] = await Promise.all([
    supabase
      .from("subscriptions")
      .select("amount_cents,status")
      .in("status", ["active", "trialing"]),
    supabase
      .from("billing_transactions")
      .select("paid_amount_cents,paid_at,status")
      .eq("status", "paid")
      .gte("paid_at", monthStart),
    supabase
      .from("driver_earnings")
      .select("amount_cents,status"),
    supabase
      .from("payouts")
      .select("amount_cents,status")
      .in("status", ["draft", "approved", "processing", "in_analysis"]),
    supabase
      .from("payouts")
      .select("amount_cents,status")
      .eq("status", "paid"),
    supabase
      .from("provider_balance_snapshots")
      .select("available_balance_cents,pending_balance_cents,captured_at")
      .order("captured_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
  ]);

  const sum = <T>(arr: T[] | null | undefined, k: keyof T) =>
    (arr ?? []).reduce((s, r) => s + Number((r as Record<string, unknown>)[k as string] ?? 0), 0);

  const accruedCents = (earnings.data ?? [])
    .filter((e) => e.status === "accrued")
    .reduce((s, e) => s + Number(e.amount_cents), 0);
  const lockedCents = (earnings.data ?? [])
    .filter((e) => e.status === "locked")
    .reduce((s, e) => s + Number(e.amount_cents), 0);
  const paidEarningsCents = (earnings.data ?? [])
    .filter((e) => e.status === "paid")
    .reduce((s, e) => s + Number(e.amount_cents), 0);

  const payoutsPendingCents = sum(payoutsPending.data, "amount_cents");
  const payoutsPaidCents = sum(payoutsPaid.data, "amount_cents");

  return {
    mrrCents: sum(subs.data, "amount_cents"),
    activeSubscriptions: subs.data?.length ?? 0,
    monthRevenueCents: sum(monthTx.data, "paid_amount_cents"),
    monthPaidTxCount: monthTx.data?.length ?? 0,
    accruedCents,
    lockedCents,
    paidEarningsCents,
    payoutsPendingCents,
    payoutsPaidCents,
    reconciliationGapCents: lockedCents - payoutsPendingCents,
    providerAvailableCents: balance.data?.available_balance_cents ?? null,
    providerPendingCents: balance.data?.pending_balance_cents ?? null,
    providerSnapshotAt: balance.data?.captured_at ?? null,
  };
}

/* ===== Reconciliation feed ===== */

export interface WebhookIssue {
  id: string;
  pagou_event_id: string;
  event_type: string | null;
  processing_status: string;
  received_at: string;
  error_message: string | null;
}

export async function listWebhookIssues(limit = 50): Promise<WebhookIssue[]> {
  const { data, error } = await supabase
    .from("pagou_webhook_events")
    .select("id,pagou_event_id,event_type,processing_status,received_at,error_message")
    .in("processing_status", ["error", "pending", "received"])
    .order("received_at", { ascending: false })
    .limit(limit);
  if (error) throw error;
  return (data ?? []) as WebhookIssue[];
}

export interface ReconJob {
  id: string;
  resource_type: string;
  pagou_resource_id: string | null;
  status: string;
  attempts: number;
  scheduled_at: string;
  last_error: string | null;
}

export async function listReconJobs(limit = 50): Promise<ReconJob[]> {
  const { data, error } = await supabase
    .from("pagou_reconciliation_jobs")
    .select("id,resource_type,pagou_resource_id,status,attempts,scheduled_at,last_error")
    .in("status", ["pending", "failed"])
    .order("scheduled_at", { ascending: false })
    .limit(limit);
  if (error) throw error;
  return (data ?? []) as ReconJob[];
}

export interface ApiErrorLog {
  id: string;
  created_at: string;
  endpoint: string;
  method: string;
  http_status: number | null;
  error_message: string | null;
  entity_type: string | null;
  entity_id: string | null;
}

export async function listApiErrors(limit = 50): Promise<ApiErrorLog[]> {
  const { data, error } = await supabase
    .from("pagou_api_logs")
    .select("id,created_at,endpoint,method,http_status,error_message,entity_type,entity_id")
    .gte("http_status", 400)
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) throw error;
  return (data ?? []) as ApiErrorLog[];
}

export interface BalanceSnapshot {
  id: string;
  captured_at: string;
  available_balance_cents: number | null;
  pending_balance_cents: number | null;
  source: string;
}

export async function listBalanceSnapshots(limit = 10): Promise<BalanceSnapshot[]> {
  const { data, error } = await supabase
    .from("provider_balance_snapshots")
    .select("id,captured_at,available_balance_cents,pending_balance_cents,source")
    .order("captured_at", { ascending: false })
    .limit(limit);
  if (error) throw error;
  return (data ?? []) as BalanceSnapshot[];
}

export async function insertBalanceSnapshot(input: {
  available_balance_cents: number;
  pending_balance_cents: number;
  notes?: string;
}) {
  const { data: u } = await supabase.auth.getUser();
  const { error } = await supabase.from("provider_balance_snapshots").insert({
    provider: "pagou",
    source: "manual",
    available_balance_cents: input.available_balance_cents,
    pending_balance_cents: input.pending_balance_cents,
    captured_by: u.user?.id ?? null,
    raw_payload: input.notes ? { notes: input.notes } : null,
  });
  if (error) throw error;
}
