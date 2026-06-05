
-- ============================================================
-- FASE 1 — Fundação financeira Pagou.ai
-- ============================================================

-- ---------- ENUMS ----------
DO $$ BEGIN CREATE TYPE public.billing_status AS ENUM (
  'none','pending','paid','active','trialing','past_due',
  'payment_failed','cancel_scheduled','canceled','refunded',
  'chargedback','in_protest','manual_review'
); EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN CREATE TYPE public.operational_status_v2 AS ENUM (
  'draft','waiting_art','waiting_payment','waiting_assignment',
  'waiting_installation','active','removal_pending','removed',
  'blocked','completed','suspended'
); EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN CREATE TYPE public.payment_method_type AS ENUM (
  'credit_card_subscription','pix_prepaid','manual_adjustment'
); EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN CREATE TYPE public.driver_payout_method_status AS ENUM (
  'incomplete','pending_review','approved','rejected','blocked'
); EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN CREATE TYPE public.payout_status AS ENUM (
  'draft','approved','processing','in_analysis','paid',
  'rejected','failed','cancelled','error','unknown','manual_review'
); EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN CREATE TYPE public.earning_status AS ENUM (
  'estimated','accrued','locked','available','in_payout',
  'paid','reversed','canceled'
); EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN CREATE TYPE public.ledger_entry_type AS ENUM (
  'advertiser_payment','advertiser_refund','chargeback_lock',
  'chargeback_reversal','driver_earning_accrual','driver_earning_release',
  'driver_payout','driver_payout_reversal','manual_adjustment'
); EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN CREATE TYPE public.webhook_processing_status AS ENUM (
  'received','processed','ignored','failed','needs_reconciliation','unhandled'
); EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ---------- ALTER existing tables ----------
ALTER TABLE public.advertisers
  ADD COLUMN IF NOT EXISTS pagou_customer_id text,
  ADD COLUMN IF NOT EXISTS document_type text CHECK (document_type IN ('CPF','CNPJ')),
  ADD COLUMN IF NOT EXISTS address jsonb;

CREATE UNIQUE INDEX IF NOT EXISTS idx_advertisers_pagou_customer_id
  ON public.advertisers(pagou_customer_id) WHERE pagou_customer_id IS NOT NULL;

ALTER TABLE public.campaigns
  ADD COLUMN IF NOT EXISTS plan_id uuid,
  ADD COLUMN IF NOT EXISTS billing_status public.billing_status DEFAULT 'none',
  ADD COLUMN IF NOT EXISTS operational_status public.operational_status_v2 DEFAULT 'draft',
  ADD COLUMN IF NOT EXISTS current_period_start timestamptz,
  ADD COLUMN IF NOT EXISTS current_period_end timestamptz,
  ADD COLUMN IF NOT EXISTS payment_grace_until timestamptz,
  ADD COLUMN IF NOT EXISTS removal_required_at timestamptz;

-- ---------- campaign_plans ----------
CREATE TABLE IF NOT EXISTS public.campaign_plans (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  description text,
  monthly_price_cents integer NOT NULL CHECK (monthly_price_cents > 0),
  driver_payout_cents integer NOT NULL DEFAULT 0,
  currency text NOT NULL DEFAULT 'BRL',
  billing_interval text NOT NULL DEFAULT 'month',
  billing_interval_count integer NOT NULL DEFAULT 1,
  is_active boolean NOT NULL DEFAULT true,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.campaign_plans TO authenticated, anon;
GRANT ALL ON public.campaign_plans TO service_role;
ALTER TABLE public.campaign_plans ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Everyone reads active plans" ON public.campaign_plans FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admin manages plans (ins)" ON public.campaign_plans FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(),'admin'));
CREATE POLICY "Admin manages plans (upd)" ON public.campaign_plans FOR UPDATE TO authenticated USING (public.has_role(auth.uid(),'admin'));
CREATE POLICY "Admin manages plans (del)" ON public.campaign_plans FOR DELETE TO authenticated USING (public.has_role(auth.uid(),'admin'));
CREATE TRIGGER trg_campaign_plans_updated BEFORE UPDATE ON public.campaign_plans FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.campaigns
  ADD CONSTRAINT campaigns_plan_id_fkey FOREIGN KEY (plan_id) REFERENCES public.campaign_plans(id) ON DELETE SET NULL;

-- ---------- subscriptions ----------
CREATE TABLE IF NOT EXISTS public.subscriptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  advertiser_id uuid NOT NULL REFERENCES public.advertisers(id) ON DELETE CASCADE,
  campaign_id uuid NOT NULL REFERENCES public.campaigns(id) ON DELETE CASCADE,
  plan_id uuid REFERENCES public.campaign_plans(id) ON DELETE SET NULL,
  pagou_customer_id text,
  pagou_subscription_id text UNIQUE,
  status text NOT NULL DEFAULT 'incomplete',
  payment_method public.payment_method_type NOT NULL DEFAULT 'credit_card_subscription',
  amount_cents integer NOT NULL,
  currency text NOT NULL DEFAULT 'BRL',
  interval text NOT NULL DEFAULT 'month',
  interval_count integer NOT NULL DEFAULT 1,
  current_period_start timestamptz,
  current_period_end timestamptz,
  cancel_at_period_end boolean NOT NULL DEFAULT false,
  canceled_at timestamptz,
  cancellation_reason text,
  failure_policy text DEFAULT 'retry_then_cancel',
  retry_offsets_days integer[] DEFAULT ARRAY[1,3,5],
  card_brand text,
  card_last4 text,
  card_exp_month text,
  card_exp_year text,
  latest_transaction_id text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  external_ref text UNIQUE,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_subscriptions_advertiser ON public.subscriptions(advertiser_id);
CREATE INDEX IF NOT EXISTS idx_subscriptions_campaign ON public.subscriptions(campaign_id);
GRANT SELECT ON public.subscriptions TO authenticated;
GRANT ALL ON public.subscriptions TO service_role;
ALTER TABLE public.subscriptions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Advertiser reads own subscriptions" ON public.subscriptions FOR SELECT TO authenticated
  USING (advertiser_id IN (SELECT id FROM public.advertisers WHERE user_id = auth.uid()));
CREATE POLICY "Staff reads all subscriptions" ON public.subscriptions FOR SELECT TO authenticated
  USING (public.is_staff(auth.uid()));
CREATE TRIGGER trg_subscriptions_updated BEFORE UPDATE ON public.subscriptions FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ---------- billing_transactions ----------
CREATE TABLE IF NOT EXISTS public.billing_transactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  advertiser_id uuid NOT NULL REFERENCES public.advertisers(id) ON DELETE CASCADE,
  campaign_id uuid REFERENCES public.campaigns(id) ON DELETE SET NULL,
  subscription_id uuid REFERENCES public.subscriptions(id) ON DELETE SET NULL,
  pagou_transaction_id text UNIQUE,
  pagou_subscription_id text,
  external_ref text UNIQUE,
  request_id text,
  method text NOT NULL,
  status text NOT NULL DEFAULT 'pending',
  amount_cents integer NOT NULL,
  paid_amount_cents integer DEFAULT 0,
  refunded_amount_cents integer DEFAULT 0,
  currency text NOT NULL DEFAULT 'BRL',
  billing_period_start timestamptz,
  billing_period_end timestamptz,
  paid_at timestamptz,
  expires_at timestamptz,
  pix_qr_code text,
  pix_qr_code_image text,
  failure_reason text,
  raw_payload jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_billing_tx_subscription ON public.billing_transactions(subscription_id);
CREATE INDEX IF NOT EXISTS idx_billing_tx_campaign ON public.billing_transactions(campaign_id);
GRANT SELECT ON public.billing_transactions TO authenticated;
GRANT ALL ON public.billing_transactions TO service_role;
ALTER TABLE public.billing_transactions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Advertiser reads own tx" ON public.billing_transactions FOR SELECT TO authenticated
  USING (advertiser_id IN (SELECT id FROM public.advertisers WHERE user_id = auth.uid()));
CREATE POLICY "Staff reads all tx" ON public.billing_transactions FOR SELECT TO authenticated
  USING (public.is_staff(auth.uid()));
CREATE TRIGGER trg_billing_tx_updated BEFORE UPDATE ON public.billing_transactions FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ---------- pagou_webhook_events ----------
CREATE TABLE IF NOT EXISTS public.pagou_webhook_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  pagou_event_id text NOT NULL UNIQUE,
  event text,
  event_type text,
  api_version text,
  pagou_resource_id text,
  processing_status public.webhook_processing_status NOT NULL DEFAULT 'received',
  payload jsonb NOT NULL,
  headers jsonb,
  error_message text,
  processed_at timestamptz,
  received_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_pagou_webhook_event_type ON public.pagou_webhook_events(event_type);
CREATE INDEX IF NOT EXISTS idx_pagou_webhook_resource ON public.pagou_webhook_events(pagou_resource_id);
CREATE INDEX IF NOT EXISTS idx_pagou_webhook_status ON public.pagou_webhook_events(processing_status);
GRANT SELECT ON public.pagou_webhook_events TO authenticated;
GRANT ALL ON public.pagou_webhook_events TO service_role;
ALTER TABLE public.pagou_webhook_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Staff reads webhooks" ON public.pagou_webhook_events FOR SELECT TO authenticated USING (public.is_staff(auth.uid()));

-- ---------- pagou_api_logs ----------
CREATE TABLE IF NOT EXISTS public.pagou_api_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  endpoint text NOT NULL,
  method text NOT NULL,
  request_id text,
  http_status integer,
  entity_type text,
  entity_id text,
  error_message text,
  duration_ms integer,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_pagou_api_logs_entity ON public.pagou_api_logs(entity_type, entity_id);
GRANT SELECT ON public.pagou_api_logs TO authenticated;
GRANT ALL ON public.pagou_api_logs TO service_role;
ALTER TABLE public.pagou_api_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Staff reads api logs" ON public.pagou_api_logs FOR SELECT TO authenticated USING (public.is_staff(auth.uid()));

-- ---------- pagou_reconciliation_jobs ----------
CREATE TABLE IF NOT EXISTS public.pagou_reconciliation_jobs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  resource_type text NOT NULL CHECK (resource_type IN ('transaction','subscription','transfer')),
  pagou_resource_id text,
  internal_id uuid,
  status text NOT NULL DEFAULT 'pending',
  attempts integer NOT NULL DEFAULT 0,
  last_error text,
  scheduled_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz,
  metadata jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_recon_jobs_status ON public.pagou_reconciliation_jobs(status, scheduled_at);
GRANT SELECT ON public.pagou_reconciliation_jobs TO authenticated;
GRANT ALL ON public.pagou_reconciliation_jobs TO service_role;
ALTER TABLE public.pagou_reconciliation_jobs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Staff reads recon jobs" ON public.pagou_reconciliation_jobs FOR SELECT TO authenticated USING (public.is_staff(auth.uid()));

-- ---------- driver_payout_methods ----------
CREATE TABLE IF NOT EXISTS public.driver_payout_methods (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  driver_id uuid NOT NULL REFERENCES public.drivers(id) ON DELETE CASCADE,
  pix_key_type text NOT NULL CHECK (pix_key_type IN ('CPF','CNPJ','EMAIL','PHONE','EVP')),
  pix_key_value text NOT NULL,
  pix_key_value_masked text,
  legal_name text,
  document_type text CHECK (document_type IN ('CPF','CNPJ')),
  document_number text,
  status public.driver_payout_method_status NOT NULL DEFAULT 'pending_review',
  is_default boolean NOT NULL DEFAULT true,
  reviewed_at timestamptz,
  reviewed_by uuid,
  rejection_reason text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_driver_default_payout_method
  ON public.driver_payout_methods(driver_id) WHERE is_default = true;
GRANT SELECT, INSERT, UPDATE ON public.driver_payout_methods TO authenticated;
GRANT ALL ON public.driver_payout_methods TO service_role;
ALTER TABLE public.driver_payout_methods ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Driver reads own pix" ON public.driver_payout_methods FOR SELECT TO authenticated
  USING (driver_id IN (SELECT id FROM public.drivers WHERE user_id = auth.uid()));
CREATE POLICY "Driver inserts own pix" ON public.driver_payout_methods FOR INSERT TO authenticated
  WITH CHECK (driver_id IN (SELECT id FROM public.drivers WHERE user_id = auth.uid()));
CREATE POLICY "Driver updates own pix" ON public.driver_payout_methods FOR UPDATE TO authenticated
  USING (driver_id IN (SELECT id FROM public.drivers WHERE user_id = auth.uid()));
CREATE POLICY "Staff reads all pix" ON public.driver_payout_methods FOR SELECT TO authenticated
  USING (public.is_staff(auth.uid()));
CREATE POLICY "Admin updates pix review" ON public.driver_payout_methods FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(),'admin'));
CREATE TRIGGER trg_driver_pix_updated BEFORE UPDATE ON public.driver_payout_methods FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ---------- driver_earnings ----------
CREATE TABLE IF NOT EXISTS public.driver_earnings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  driver_id uuid NOT NULL REFERENCES public.drivers(id) ON DELETE CASCADE,
  campaign_id uuid NOT NULL REFERENCES public.campaigns(id) ON DELETE CASCADE,
  assignment_id uuid REFERENCES public.campaign_driver_assignments(id) ON DELETE SET NULL,
  subscription_id uuid REFERENCES public.subscriptions(id) ON DELETE SET NULL,
  billing_transaction_id uuid REFERENCES public.billing_transactions(id) ON DELETE SET NULL,
  period_start timestamptz NOT NULL,
  period_end timestamptz NOT NULL,
  amount_cents integer NOT NULL CHECK (amount_cents >= 0),
  status public.earning_status NOT NULL DEFAULT 'estimated',
  available_at timestamptz,
  locked_reason text,
  paid_at timestamptz,
  payout_id uuid,
  metadata jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_driver_earnings_driver_status ON public.driver_earnings(driver_id, status);
CREATE UNIQUE INDEX IF NOT EXISTS idx_driver_earnings_unique_period
  ON public.driver_earnings(assignment_id, period_start) WHERE assignment_id IS NOT NULL;
GRANT SELECT ON public.driver_earnings TO authenticated;
GRANT ALL ON public.driver_earnings TO service_role;
ALTER TABLE public.driver_earnings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Driver reads own earnings" ON public.driver_earnings FOR SELECT TO authenticated
  USING (driver_id IN (SELECT id FROM public.drivers WHERE user_id = auth.uid()));
CREATE POLICY "Advertiser reads earnings of own campaigns" ON public.driver_earnings FOR SELECT TO authenticated
  USING (campaign_id IN (SELECT c.id FROM public.campaigns c JOIN public.advertisers a ON a.id=c.advertiser_id WHERE a.user_id = auth.uid()));
CREATE POLICY "Staff reads all earnings" ON public.driver_earnings FOR SELECT TO authenticated
  USING (public.is_staff(auth.uid()));
CREATE TRIGGER trg_driver_earnings_updated BEFORE UPDATE ON public.driver_earnings FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ---------- payouts + payout_items ----------
CREATE TABLE IF NOT EXISTS public.payouts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  driver_id uuid NOT NULL REFERENCES public.drivers(id) ON DELETE CASCADE,
  payout_method_id uuid REFERENCES public.driver_payout_methods(id) ON DELETE SET NULL,
  amount_cents integer NOT NULL CHECK (amount_cents > 0),
  status public.payout_status NOT NULL DEFAULT 'draft',
  external_ref text UNIQUE,
  request_id text,
  pagou_transfer_id text UNIQUE,
  pix_key_type text,
  pix_key_value_masked text,
  description text,
  approved_by uuid,
  approved_at timestamptz,
  paid_at timestamptz,
  failed_at timestamptz,
  failure_reason text,
  raw_payload jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.payouts TO authenticated;
GRANT ALL ON public.payouts TO service_role;
ALTER TABLE public.payouts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Driver reads own payouts v2" ON public.payouts FOR SELECT TO authenticated
  USING (driver_id IN (SELECT id FROM public.drivers WHERE user_id = auth.uid()));
CREATE POLICY "Staff reads all payouts v2" ON public.payouts FOR SELECT TO authenticated
  USING (public.is_staff(auth.uid()));
CREATE TRIGGER trg_payouts_updated BEFORE UPDATE ON public.payouts FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE IF NOT EXISTS public.payout_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  payout_id uuid NOT NULL REFERENCES public.payouts(id) ON DELETE CASCADE,
  driver_earning_id uuid NOT NULL REFERENCES public.driver_earnings(id) ON DELETE CASCADE,
  amount_cents integer NOT NULL CHECK (amount_cents > 0),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(payout_id, driver_earning_id)
);
GRANT SELECT ON public.payout_items TO authenticated;
GRANT ALL ON public.payout_items TO service_role;
ALTER TABLE public.payout_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Driver reads own payout items" ON public.payout_items FOR SELECT TO authenticated
  USING (payout_id IN (SELECT id FROM public.payouts WHERE driver_id IN (SELECT id FROM public.drivers WHERE user_id = auth.uid())));
CREATE POLICY "Staff reads payout items" ON public.payout_items FOR SELECT TO authenticated
  USING (public.is_staff(auth.uid()));

-- ---------- ledger_entries ----------
CREATE TABLE IF NOT EXISTS public.ledger_entries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  entry_type public.ledger_entry_type NOT NULL,
  direction text NOT NULL CHECK (direction IN ('credit','debit')),
  amount_cents integer NOT NULL CHECK (amount_cents >= 0),
  currency text NOT NULL DEFAULT 'BRL',
  advertiser_id uuid REFERENCES public.advertisers(id) ON DELETE SET NULL,
  driver_id uuid REFERENCES public.drivers(id) ON DELETE SET NULL,
  campaign_id uuid REFERENCES public.campaigns(id) ON DELETE SET NULL,
  subscription_id uuid REFERENCES public.subscriptions(id) ON DELETE SET NULL,
  billing_transaction_id uuid REFERENCES public.billing_transactions(id) ON DELETE SET NULL,
  driver_earning_id uuid REFERENCES public.driver_earnings(id) ON DELETE SET NULL,
  payout_id uuid REFERENCES public.payouts(id) ON DELETE SET NULL,
  status text NOT NULL DEFAULT 'posted',
  available_for_payout boolean NOT NULL DEFAULT false,
  locked_until timestamptz,
  description text,
  external_ref text,
  metadata jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_ledger_campaign ON public.ledger_entries(campaign_id);
CREATE INDEX IF NOT EXISTS idx_ledger_driver ON public.ledger_entries(driver_id);
CREATE INDEX IF NOT EXISTS idx_ledger_available ON public.ledger_entries(available_for_payout, status);
GRANT SELECT ON public.ledger_entries TO authenticated;
GRANT ALL ON public.ledger_entries TO service_role;
ALTER TABLE public.ledger_entries ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Staff reads ledger" ON public.ledger_entries FOR SELECT TO authenticated USING (public.is_staff(auth.uid()));

-- ---------- operational_tasks ----------
CREATE TABLE IF NOT EXISTS public.operational_tasks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  task_type text NOT NULL,
  title text NOT NULL,
  description text,
  campaign_id uuid REFERENCES public.campaigns(id) ON DELETE CASCADE,
  driver_id uuid REFERENCES public.drivers(id) ON DELETE SET NULL,
  assignment_id uuid REFERENCES public.campaign_driver_assignments(id) ON DELETE SET NULL,
  priority text NOT NULL DEFAULT 'normal',
  status text NOT NULL DEFAULT 'open',
  due_at timestamptz,
  assigned_to uuid,
  created_by uuid,
  completed_by uuid,
  completed_at timestamptz,
  metadata jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_op_tasks_status ON public.operational_tasks(status, priority);
GRANT SELECT, INSERT, UPDATE ON public.operational_tasks TO authenticated;
GRANT ALL ON public.operational_tasks TO service_role;
ALTER TABLE public.operational_tasks ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Staff reads op tasks" ON public.operational_tasks FOR SELECT TO authenticated USING (public.is_staff(auth.uid()));
CREATE POLICY "Staff updates op tasks" ON public.operational_tasks FOR UPDATE TO authenticated USING (public.is_staff(auth.uid()));
CREATE POLICY "Staff inserts op tasks" ON public.operational_tasks FOR INSERT TO authenticated WITH CHECK (public.is_staff(auth.uid()));
CREATE TRIGGER trg_op_tasks_updated BEFORE UPDATE ON public.operational_tasks FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ---------- provider_balance_snapshots ----------
CREATE TABLE IF NOT EXISTS public.provider_balance_snapshots (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  provider text NOT NULL DEFAULT 'pagou',
  available_balance_cents integer,
  pending_balance_cents integer,
  raw_payload jsonb,
  source text NOT NULL DEFAULT 'manual',
  captured_by uuid,
  captured_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT ON public.provider_balance_snapshots TO authenticated;
GRANT ALL ON public.provider_balance_snapshots TO service_role;
ALTER TABLE public.provider_balance_snapshots ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Staff reads balance" ON public.provider_balance_snapshots FOR SELECT TO authenticated USING (public.is_staff(auth.uid()));
CREATE POLICY "Admin inserts balance" ON public.provider_balance_snapshots FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(),'admin'));

-- ---------- audit_logs (financeiro) ----------
CREATE TABLE IF NOT EXISTS public.audit_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_id uuid,
  actor_role text,
  action text NOT NULL,
  entity_type text NOT NULL,
  entity_id text,
  before_data jsonb,
  after_data jsonb,
  metadata jsonb DEFAULT '{}'::jsonb,
  ip_address text,
  user_agent text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_audit_logs_entity ON public.audit_logs(entity_type, entity_id);
GRANT SELECT, INSERT ON public.audit_logs TO authenticated;
GRANT ALL ON public.audit_logs TO service_role;
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Staff reads audit logs" ON public.audit_logs FOR SELECT TO authenticated USING (public.is_staff(auth.uid()));

-- ---------- VIEWS ----------
CREATE OR REPLACE VIEW public.admin_finance_summary AS
SELECT
  COALESCE(SUM(CASE WHEN entry_type = 'advertiser_payment' AND direction='credit' AND status='posted' THEN amount_cents ELSE 0 END),0) AS confirmed_revenue_cents,
  COALESCE(SUM(CASE WHEN entry_type = 'chargeback_lock' AND status='posted' THEN amount_cents ELSE 0 END),0) AS locked_revenue_cents,
  COALESCE(SUM(CASE WHEN entry_type = 'driver_earning_release' AND available_for_payout=true AND status='posted' THEN amount_cents ELSE 0 END),0) AS driver_available_cents,
  COALESCE(SUM(CASE WHEN entry_type = 'driver_payout' AND status='posted' THEN amount_cents ELSE 0 END),0) AS driver_paid_cents,
  COALESCE(SUM(CASE WHEN direction='credit' AND status='posted' THEN amount_cents ELSE 0 END),0)
  - COALESCE(SUM(CASE WHEN direction='debit' AND status='posted' THEN amount_cents ELSE 0 END),0) AS internal_net_balance_cents
FROM public.ledger_entries;

CREATE OR REPLACE VIEW public.driver_available_earnings AS
SELECT driver_id, SUM(amount_cents)::bigint AS available_cents, COUNT(*)::bigint AS earnings_count
FROM public.driver_earnings
WHERE status = 'available'
GROUP BY driver_id;

GRANT SELECT ON public.admin_finance_summary TO authenticated;
GRANT SELECT ON public.driver_available_earnings TO authenticated;
