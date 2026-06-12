-- Resolve a categoria (tier) de um veiculo pelo modelo casado no catalogo.
create or replace function public.resolve_vehicle_tier(_brand text, _model text)
returns text
language sql
stable
security definer
set search_path = public
as $$
  with nm as (select public.normalize_vehicle_text(_model) as k)
  select coalesce((
    select c.tier
    from public.vehicle_model_images c, nm
    where c.active and not c.is_default and length(nm.k) > 0
      and (
        c.model_key = nm.k
        or nm.k = any(c.aliases)
        or similarity(c.model_key, nm.k) >= 0.45
      )
    order by
      (c.model_key = nm.k) desc,
      (nm.k = any(c.aliases)) desc,
      similarity(c.model_key, nm.k) desc,
      c.priority asc
    limit 1
  ), 'standard');
$$;

grant execute on function public.resolve_vehicle_tier(text, text) to authenticated;

-- Candidatura do motorista: campanha Black exige veiculo de modelo Black.
CREATE OR REPLACE FUNCTION public.apply_driver_to_campaign(
  _campaign_id uuid,
  _driver_id uuid,
  _vehicle_id uuid
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_assignment_id uuid;
  v_payout numeric;
  v_plan_tier text;
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.drivers d
    WHERE d.id = _driver_id AND d.user_id = auth.uid()
      AND d.status = 'approved'::public.driver_status
  ) THEN
    RAISE EXCEPTION 'Motorista nao aprovado ou nao pertence ao usuario atual.' USING ERRCODE = '42501';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.vehicles v
    WHERE v.id = _vehicle_id AND v.driver_id = _driver_id
      AND (
        v.status = 'approved'::public.vehicle_status
        OR v.crlv_status = 'approved'::public.doc_review_status
      )
  ) THEN
    RAISE EXCEPTION 'Cadastre e aprove um veiculo antes de se candidatar.' USING ERRCODE = '42501';
  END IF;

  IF NOT public.driver_can_view_available_campaign(auth.uid(), _campaign_id) THEN
    RAISE EXCEPTION 'Campanha indisponivel para este motorista.' USING ERRCODE = '42501';
  END IF;

  SELECT COALESCE(cp.metadata->>'vehicle_tier', 'standard')
    INTO v_plan_tier
  FROM public.campaigns c
  LEFT JOIN public.campaign_plans cp ON cp.id = c.plan_id
  WHERE c.id = _campaign_id;

  IF v_plan_tier = 'black' THEN
    IF (
      SELECT public.resolve_vehicle_tier(v.brand, v.model)
      FROM public.vehicles v WHERE v.id = _vehicle_id
    ) <> 'black' THEN
      RAISE EXCEPTION 'Esta campanha Black exige um veiculo de modelo Black.' USING ERRCODE = '42501';
    END IF;
  END IF;

  SELECT round(COALESCE(NULLIF(cp.driver_payout_cents, 0)::numeric / 100, c.plan_value * 0.60), 2)
    INTO v_payout
  FROM public.campaigns c
  LEFT JOIN public.campaign_plans cp ON cp.id = c.plan_id
  WHERE c.id = _campaign_id;

  INSERT INTO public.campaign_driver_assignments (
    campaign_id, driver_id, vehicle_id, monthly_payout, assigned_by, status, responded_at, notes
  ) VALUES (
    _campaign_id, _driver_id, _vehicle_id, COALESCE(v_payout, 0), auth.uid(),
    'accepted'::public.assignment_status, now(), 'Candidatura criada pelo motorista no marketplace.'
  )
  RETURNING id INTO v_assignment_id;

  RETURN v_assignment_id;
END $function$;

GRANT EXECUTE ON FUNCTION public.apply_driver_to_campaign(uuid, uuid, uuid) TO authenticated;

-- Marketplace passa a retornar a categoria do plano da campanha.
drop function if exists public.list_available_campaigns_for_driver(uuid);

CREATE FUNCTION public.list_available_campaigns_for_driver(_driver_id uuid)
 RETURNS TABLE(id uuid, name text, city text, period_start date, period_end date, description text, art_url text, plan_value numeric, monthly_payout numeric, available_slots integer, vehicle_tier text)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT
    c.id, c.name, c.city, c.period_start, c.period_end, c.description, c.art_url, c.plan_value,
    round(COALESCE(NULLIF(cp.driver_payout_cents, 0)::numeric / 100, c.plan_value * 0.60), 2) AS monthly_payout,
    (
      c.vehicles_qty
      - (
        SELECT count(*)::integer
        FROM public.campaign_driver_assignments cda
        WHERE cda.campaign_id = c.id
          AND cda.status NOT IN ('declined'::public.assignment_status, 'cancelled'::public.assignment_status)
      )
    )::integer AS available_slots,
    COALESCE(cp.metadata->>'vehicle_tier', 'standard') AS vehicle_tier
  FROM public.campaigns c
  JOIN public.drivers d ON d.id = _driver_id
  LEFT JOIN public.campaign_plans cp ON cp.id = c.plan_id
  WHERE d.user_id = auth.uid()
    AND public.driver_can_view_available_campaign(auth.uid(), c.id)
  ORDER BY c.created_at DESC
$function$;

grant execute on function public.list_available_campaigns_for_driver(uuid) to authenticated;
