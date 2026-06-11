CREATE OR REPLACE FUNCTION public.track_campaign_qr_scan(
  _short_code text,
  _user_agent text DEFAULT NULL,
  _referrer text DEFAULT NULL,
  _metadata jsonb DEFAULT '{}'::jsonb
)
RETURNS TABLE(destination_url text)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_qr public.campaign_qr_codes%ROWTYPE;
BEGIN
  _short_code := lower(trim(coalesce(_short_code, '')));

  IF _short_code !~ '^[a-z0-9]{6,32}$' THEN
    RETURN;
  END IF;

  SELECT *
  INTO v_qr
  FROM public.campaign_qr_codes
  WHERE short_code = _short_code
    AND is_active = true
  LIMIT 1;

  IF NOT FOUND THEN
    RETURN;
  END IF;

  INSERT INTO public.campaign_qr_scans (
    qr_code_id,
    campaign_id,
    advertiser_id,
    user_agent,
    referrer,
    metadata
  )
  VALUES (
    v_qr.id,
    v_qr.campaign_id,
    v_qr.advertiser_id,
    NULLIF(left(coalesce(_user_agent, ''), 500), ''),
    NULLIF(left(coalesce(_referrer, ''), 500), ''),
    coalesce(_metadata, '{}'::jsonb)
  );

  destination_url := v_qr.destination_url;
  RETURN NEXT;
END;
$$;

REVOKE ALL ON FUNCTION public.track_campaign_qr_scan(text, text, text, jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.track_campaign_qr_scan(text, text, text, jsonb) TO anon, authenticated, service_role;
