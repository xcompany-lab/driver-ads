-- Harden email triggers that previously used unassigned RECORD fields.
CREATE OR REPLACE FUNCTION public.email_on_assignment_invite()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_driver_name text;
  v_driver_email text;
  v_campaign_name text;
  v_campaign_city text;
  v_campaign_period_start date;
  v_campaign_period_end date;
BEGIN
  IF TG_OP = 'INSERT' AND NEW.status::text = 'invited' THEN
    SELECT d.full_name, d.email
      INTO v_driver_name, v_driver_email
    FROM public.drivers d
    WHERE d.id = NEW.driver_id;

    SELECT c.name, c.city, c.period_start, c.period_end
      INTO v_campaign_name, v_campaign_city, v_campaign_period_start, v_campaign_period_end
    FROM public.campaigns c
    WHERE c.id = NEW.campaign_id;

    IF v_driver_email IS NULL OR v_driver_email = '' THEN
      RETURN NEW;
    END IF;

    PERFORM public.enqueue_email(
      'campaign-invite',
      v_driver_email,
      v_driver_name,
      jsonb_build_object(
        'driver_name', v_driver_name,
        'campaign_name', v_campaign_name,
        'city', v_campaign_city,
        'period_start', v_campaign_period_start,
        'period_end', v_campaign_period_end,
        'monthly_payout', NEW.monthly_payout,
        'portal_path', '/motorista/campanhas'
      )
    );
  END IF;
  RETURN NEW;
END $$;

CREATE OR REPLACE FUNCTION public.email_on_proof_reviewed()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_driver_name text;
  v_driver_email text;
  v_campaign_name text;
BEGIN
  IF TG_OP = 'UPDATE' AND NEW.status IS DISTINCT FROM OLD.status THEN
    IF NEW.status::text IN ('approved','rejected','resubmission_requested') THEN
      SELECT d.full_name, d.email, c.name
        INTO v_driver_name, v_driver_email, v_campaign_name
      FROM public.campaign_driver_assignments a
      JOIN public.drivers d ON d.id = a.driver_id
      JOIN public.campaigns c ON c.id = a.campaign_id
      WHERE a.id = NEW.assignment_id;

      IF v_driver_email IS NULL OR v_driver_email = '' THEN
        RETURN NEW;
      END IF;

      PERFORM public.enqueue_email(
        'proof-reviewed',
        v_driver_email,
        v_driver_name,
        jsonb_build_object(
          'driver_name', v_driver_name,
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

CREATE OR REPLACE FUNCTION public.email_on_payout_paid()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_driver_name text;
  v_driver_email text;
BEGIN
  IF TG_OP = 'UPDATE' AND NEW.status IS DISTINCT FROM OLD.status AND NEW.status::text = 'paid' THEN
    SELECT d.full_name, d.email
      INTO v_driver_name, v_driver_email
    FROM public.drivers d
    WHERE d.id = NEW.driver_id;

    IF v_driver_email IS NULL OR v_driver_email = '' THEN
      RETURN NEW;
    END IF;

    PERFORM public.enqueue_email(
      'payout-paid',
      v_driver_email,
      v_driver_name,
      jsonb_build_object(
        'driver_name', v_driver_name,
        'amount', NEW.amount,
        'reference_month', NEW.reference_month,
        'paid_at', NEW.paid_at,
        'portal_path', '/motorista/ganhos'
      )
    );
  END IF;
  RETURN NEW;
END $$;

CREATE OR REPLACE FUNCTION public.email_on_adv_payment()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_adv_name text;
  v_adv_email text;
  v_adv_company text;
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

  SELECT a.responsible, a.email, a.company_name
    INTO v_adv_name, v_adv_email, v_adv_company
  FROM public.advertisers a
  WHERE a.id = NEW.advertiser_id;

  SELECT c.name
    INTO v_campaign_name
  FROM public.campaigns c
  WHERE c.id = NEW.campaign_id;

  IF v_adv_email IS NULL OR v_adv_email = '' THEN
    RETURN NEW;
  END IF;

  PERFORM public.enqueue_email(
    v_template,
    v_adv_email,
    v_adv_name,
    jsonb_build_object(
      'name', v_adv_name,
      'company', v_adv_company,
      'campaign_name', v_campaign_name,
      'amount', NEW.amount,
      'due_date', NEW.due_date,
      'paid_at', NEW.paid_at,
      'portal_path', '/anunciante/financeiro'
    )
  );
  RETURN NEW;
END $$;

REVOKE EXECUTE ON FUNCTION public.email_on_assignment_invite() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.email_on_proof_reviewed() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.email_on_payout_paid() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.email_on_adv_payment() FROM PUBLIC, anon, authenticated;

-- Helper used by marketplace RPCs and storage policies.
CREATE OR REPLACE FUNCTION public.driver_can_view_available_campaign(_user_id uuid, _campaign_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.campaigns c
    JOIN public.drivers d ON d.user_id = _user_id
    WHERE c.id = _campaign_id
      AND d.status = 'approved'::public.driver_status
      AND c.status = 'approved'::public.campaign_status
      AND COALESCE(c.billing_status, 'none'::public.billing_status) IN (
        'paid'::public.billing_status,
        'active'::public.billing_status,
        'trialing'::public.billing_status
      )
      AND lower(c.city) = lower(d.city)
      AND NOT EXISTS (
        SELECT 1
        FROM public.campaign_driver_assignments cda
        WHERE cda.campaign_id = c.id
          AND cda.driver_id = d.id
          AND cda.status NOT IN (
            'declined'::public.assignment_status,
            'cancelled'::public.assignment_status
          )
      )
      AND (
        SELECT count(*)::integer
        FROM public.campaign_driver_assignments cda2
        WHERE cda2.campaign_id = c.id
          AND cda2.status NOT IN (
            'declined'::public.assignment_status,
            'cancelled'::public.assignment_status
          )
      ) < c.vehicles_qty
  )
$$;

CREATE OR REPLACE FUNCTION public.list_available_campaigns_for_driver(_driver_id uuid)
RETURNS TABLE (
  id uuid,
  name text,
  city text,
  period_start date,
  period_end date,
  description text,
  art_url text,
  plan_value numeric,
  monthly_payout numeric,
  available_slots integer
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    c.id,
    c.name,
    c.city,
    c.period_start,
    c.period_end,
    c.description,
    c.art_url,
    c.plan_value,
    round(COALESCE(NULLIF(cp.driver_payout_cents, 0)::numeric / 100, c.plan_value * 0.60), 2) AS monthly_payout,
    (
      c.vehicles_qty
      - (
        SELECT count(*)::integer
        FROM public.campaign_driver_assignments cda
        WHERE cda.campaign_id = c.id
          AND cda.status NOT IN (
            'declined'::public.assignment_status,
            'cancelled'::public.assignment_status
          )
      )
    )::integer AS available_slots
  FROM public.campaigns c
  JOIN public.drivers d ON d.id = _driver_id
  LEFT JOIN public.campaign_plans cp ON cp.id = c.plan_id
  WHERE d.user_id = auth.uid()
    AND public.driver_can_view_available_campaign(auth.uid(), c.id)
  ORDER BY c.created_at DESC
$$;

CREATE OR REPLACE FUNCTION public.apply_driver_to_campaign(
  _campaign_id uuid,
  _driver_id uuid,
  _vehicle_id uuid
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_assignment_id uuid;
  v_payout numeric;
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM public.drivers d
    WHERE d.id = _driver_id
      AND d.user_id = auth.uid()
      AND d.status = 'approved'::public.driver_status
  ) THEN
    RAISE EXCEPTION 'Motorista nao aprovado ou nao pertence ao usuario atual.'
      USING ERRCODE = '42501';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.vehicles v
    WHERE v.id = _vehicle_id
      AND v.driver_id = _driver_id
      AND (
        v.status = 'approved'::public.vehicle_status
        OR v.crlv_status = 'approved'::public.doc_review_status
      )
  ) THEN
    RAISE EXCEPTION 'Cadastre e aprove um veiculo antes de se candidatar.'
      USING ERRCODE = '42501';
  END IF;

  IF NOT public.driver_can_view_available_campaign(auth.uid(), _campaign_id) THEN
    RAISE EXCEPTION 'Campanha indisponivel para este motorista.'
      USING ERRCODE = '42501';
  END IF;

  SELECT round(COALESCE(NULLIF(cp.driver_payout_cents, 0)::numeric / 100, c.plan_value * 0.60), 2)
    INTO v_payout
  FROM public.campaigns c
  LEFT JOIN public.campaign_plans cp ON cp.id = c.plan_id
  WHERE c.id = _campaign_id;

  INSERT INTO public.campaign_driver_assignments (
    campaign_id,
    driver_id,
    vehicle_id,
    monthly_payout,
    assigned_by,
    status,
    responded_at,
    notes
  ) VALUES (
    _campaign_id,
    _driver_id,
    _vehicle_id,
    COALESCE(v_payout, 0),
    auth.uid(),
    'accepted'::public.assignment_status,
    now(),
    'Candidatura criada pelo motorista no marketplace.'
  )
  RETURNING id INTO v_assignment_id;

  RETURN v_assignment_id;
END $$;

GRANT EXECUTE ON FUNCTION public.list_available_campaigns_for_driver(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.apply_driver_to_campaign(uuid, uuid, uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.list_eligible_drivers_for_campaign(_campaign_id uuid)
RETURNS TABLE (
  id uuid,
  full_name text,
  city text,
  regions text[],
  phone text,
  vehicles jsonb
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    d.id,
    d.full_name,
    d.city,
    d.regions,
    d.phone,
    COALESCE(
      jsonb_agg(
        jsonb_build_object(
          'id', v.id,
          'plate', v.plate,
          'model', v.model,
          'brand', v.brand,
          'status', v.status,
          'crlv_status', v.crlv_status
        )
        ORDER BY v.created_at DESC
      ) FILTER (WHERE v.id IS NOT NULL),
      '[]'::jsonb
    ) AS vehicles
  FROM public.campaigns c
  JOIN public.drivers d
    ON d.status = 'approved'::public.driver_status
   AND lower(d.city) = lower(c.city)
  JOIN public.vehicles v
    ON v.driver_id = d.id
   AND (
      v.status = 'approved'::public.vehicle_status
      OR v.crlv_status = 'approved'::public.doc_review_status
   )
  WHERE c.id = _campaign_id
    AND public.is_staff(auth.uid())
    AND NOT EXISTS (
      SELECT 1
      FROM public.campaign_driver_assignments cda
      WHERE cda.campaign_id = c.id
        AND cda.driver_id = d.id
        AND cda.status NOT IN (
          'declined'::public.assignment_status,
          'cancelled'::public.assignment_status
        )
    )
  GROUP BY d.id, d.full_name, d.city, d.regions, d.phone
  ORDER BY d.full_name
$$;

GRANT EXECUTE ON FUNCTION public.list_eligible_drivers_for_campaign(uuid) TO authenticated;

DROP POLICY IF EXISTS "Driver reads assets of available campaigns" ON public.campaign_assets;
CREATE POLICY "Driver reads assets of available campaigns"
ON public.campaign_assets
FOR SELECT TO authenticated
USING (public.driver_can_view_available_campaign(auth.uid(), campaign_id));

DROP POLICY IF EXISTS "Driver reads campaign arts by campaign art_url" ON storage.objects;
CREATE POLICY "Driver reads campaign arts by campaign art_url"
ON storage.objects
FOR SELECT TO authenticated
USING (
  bucket_id = 'campaign-arts'
  AND EXISTS (
    SELECT 1
    FROM public.campaigns c
    WHERE c.art_url = name
      AND (
        public.driver_is_assigned_to_campaign(auth.uid(), c.id)
        OR public.driver_can_view_available_campaign(auth.uid(), c.id)
      )
  )
);
