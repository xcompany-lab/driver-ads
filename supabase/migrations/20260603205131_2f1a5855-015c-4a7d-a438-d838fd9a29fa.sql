
-- =====================================================================
-- Email outbox: fila de e-mails transacionais enviados via Resend
-- =====================================================================

CREATE TABLE IF NOT EXISTS public.email_outbox (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  template text NOT NULL,
  to_email text NOT NULL,
  to_name text,
  subject text,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  status text NOT NULL DEFAULT 'pending', -- pending | sent | failed | skipped
  attempts integer NOT NULL DEFAULT 0,
  last_error text,
  sent_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS email_outbox_status_idx ON public.email_outbox (status, created_at);

GRANT ALL ON public.email_outbox TO service_role;

ALTER TABLE public.email_outbox ENABLE ROW LEVEL SECURITY;

-- Apenas service_role acessa; nenhuma policy para anon/authenticated.
CREATE POLICY "service role full access"
  ON public.email_outbox
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

CREATE TRIGGER set_email_outbox_updated_at
  BEFORE UPDATE ON public.email_outbox
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- =====================================================================
-- Helper: enfileirar e-mail
-- =====================================================================

CREATE OR REPLACE FUNCTION public.enqueue_email(
  _template text,
  _to_email text,
  _to_name text,
  _payload jsonb
) RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_id uuid;
BEGIN
  IF _to_email IS NULL OR _to_email = '' THEN
    RETURN NULL;
  END IF;
  INSERT INTO public.email_outbox (template, to_email, to_name, payload)
  VALUES (_template, _to_email, _to_name, COALESCE(_payload, '{}'::jsonb))
  RETURNING id INTO v_id;
  RETURN v_id;
END $$;

-- =====================================================================
-- Triggers de e-mail nos eventos de negócio
-- =====================================================================

-- Advertiser: status approved/rejected
CREATE OR REPLACE FUNCTION public.email_on_advertiser_status()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'UPDATE' AND NEW.status IS DISTINCT FROM OLD.status THEN
    IF NEW.status::text IN ('approved','rejected') THEN
      PERFORM public.enqueue_email(
        'account-' || NEW.status::text,
        NEW.email,
        NEW.responsible,
        jsonb_build_object(
          'kind', 'advertiser',
          'name', NEW.responsible,
          'company', NEW.company_name,
          'portal_path', '/anunciante'
        )
      );
    END IF;
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_email_advertiser_status ON public.advertisers;
CREATE TRIGGER trg_email_advertiser_status
  AFTER UPDATE ON public.advertisers
  FOR EACH ROW EXECUTE FUNCTION public.email_on_advertiser_status();

-- Driver: status approved/rejected
CREATE OR REPLACE FUNCTION public.email_on_driver_status()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'UPDATE' AND NEW.status IS DISTINCT FROM OLD.status THEN
    IF NEW.status::text IN ('approved','rejected') THEN
      PERFORM public.enqueue_email(
        'account-' || NEW.status::text,
        NEW.email,
        NEW.full_name,
        jsonb_build_object(
          'kind', 'driver',
          'name', NEW.full_name,
          'portal_path', '/motorista'
        )
      );
    END IF;
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_email_driver_status ON public.drivers;
CREATE TRIGGER trg_email_driver_status
  AFTER UPDATE ON public.drivers
  FOR EACH ROW EXECUTE FUNCTION public.email_on_driver_status();

-- Campaign assignment: convite criado
CREATE OR REPLACE FUNCTION public.email_on_assignment_invite()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_driver record;
  v_campaign record;
BEGIN
  IF TG_OP = 'INSERT' AND NEW.status::text = 'invited' THEN
    SELECT full_name, email INTO v_driver FROM public.drivers WHERE id = NEW.driver_id;
    SELECT name, city, period_start, period_end INTO v_campaign
      FROM public.campaigns WHERE id = NEW.campaign_id;
    PERFORM public.enqueue_email(
      'campaign-invite',
      v_driver.email,
      v_driver.full_name,
      jsonb_build_object(
        'driver_name', v_driver.full_name,
        'campaign_name', v_campaign.name,
        'city', v_campaign.city,
        'period_start', v_campaign.period_start,
        'period_end', v_campaign.period_end,
        'monthly_payout', NEW.monthly_payout,
        'portal_path', '/motorista/campanhas'
      )
    );
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_email_assignment_invite ON public.campaign_driver_assignments;
CREATE TRIGGER trg_email_assignment_invite
  AFTER INSERT ON public.campaign_driver_assignments
  FOR EACH ROW EXECUTE FUNCTION public.email_on_assignment_invite();

-- Installation proof: revisada
CREATE OR REPLACE FUNCTION public.email_on_proof_reviewed()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_driver record;
  v_campaign_name text;
BEGIN
  IF TG_OP = 'UPDATE' AND NEW.status IS DISTINCT FROM OLD.status THEN
    IF NEW.status::text IN ('approved','rejected','resubmission_requested') THEN
      SELECT d.full_name, d.email, c.name
        INTO v_driver.full_name, v_driver.email, v_campaign_name
      FROM public.campaign_driver_assignments a
      JOIN public.drivers d ON d.id = a.driver_id
      JOIN public.campaigns c ON c.id = a.campaign_id
      WHERE a.id = NEW.assignment_id;
      PERFORM public.enqueue_email(
        'proof-reviewed',
        v_driver.email,
        v_driver.full_name,
        jsonb_build_object(
          'driver_name', v_driver.full_name,
          'campaign_name', v_campaign_name,
          'status', NEW.status::text,
          'reason', NEW.rejection_reason,
          'portal_path', '/motorista/campanhas'
        )
      );
    END IF;
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_email_proof_reviewed ON public.installation_proofs;
CREATE TRIGGER trg_email_proof_reviewed
  AFTER UPDATE ON public.installation_proofs
  FOR EACH ROW EXECUTE FUNCTION public.email_on_proof_reviewed();

-- Driver payout: paid
CREATE OR REPLACE FUNCTION public.email_on_payout_paid()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_driver record;
BEGIN
  IF TG_OP = 'UPDATE' AND NEW.status IS DISTINCT FROM OLD.status AND NEW.status::text = 'paid' THEN
    SELECT full_name, email INTO v_driver FROM public.drivers WHERE id = NEW.driver_id;
    PERFORM public.enqueue_email(
      'payout-paid',
      v_driver.email,
      v_driver.full_name,
      jsonb_build_object(
        'driver_name', v_driver.full_name,
        'amount', NEW.amount,
        'reference_month', NEW.reference_month,
        'paid_at', NEW.paid_at,
        'portal_path', '/motorista/ganhos'
      )
    );
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_email_payout_paid ON public.driver_payouts;
CREATE TRIGGER trg_email_payout_paid
  AFTER UPDATE ON public.driver_payouts
  FOR EACH ROW EXECUTE FUNCTION public.email_on_payout_paid();

-- Advertiser payment: nova fatura ou paga
CREATE OR REPLACE FUNCTION public.email_on_adv_payment()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_adv record;
  v_campaign_name text;
  v_template text;
BEGIN
  IF TG_OP = 'INSERT' THEN
    v_template := 'invoice-created';
  ELSIF TG_OP = 'UPDATE' AND NEW.status IS DISTINCT FROM OLD.status AND NEW.status::text = 'paid' THEN
    v_template := 'invoice-paid';
  ELSE
    RETURN NEW;
  END IF;

  SELECT responsible, email, company_name INTO v_adv
    FROM public.advertisers WHERE id = NEW.advertiser_id;
  SELECT name INTO v_campaign_name FROM public.campaigns WHERE id = NEW.campaign_id;

  PERFORM public.enqueue_email(
    v_template,
    v_adv.email,
    v_adv.responsible,
    jsonb_build_object(
      'name', v_adv.responsible,
      'company', v_adv.company_name,
      'campaign_name', v_campaign_name,
      'amount', NEW.amount,
      'due_date', NEW.due_date,
      'paid_at', NEW.paid_at,
      'portal_path', '/anunciante/financeiro'
    )
  );
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_email_adv_payment ON public.advertiser_payments;
CREATE TRIGGER trg_email_adv_payment
  AFTER INSERT OR UPDATE ON public.advertiser_payments
  FOR EACH ROW EXECUTE FUNCTION public.email_on_adv_payment();
