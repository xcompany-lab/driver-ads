ALTER TABLE public.campaign_qr_codes
  DROP CONSTRAINT IF EXISTS campaign_qr_codes_campaign_id_key;

ALTER TABLE public.campaign_qr_codes
  ADD COLUMN IF NOT EXISTS assignment_id uuid REFERENCES public.campaign_driver_assignments(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS driver_id uuid REFERENCES public.drivers(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS vehicle_id uuid REFERENCES public.vehicles(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS qr_scope text NOT NULL DEFAULT 'campaign',
  ADD COLUMN IF NOT EXISTS kit_label text;

ALTER TABLE public.campaign_qr_codes
  DROP CONSTRAINT IF EXISTS campaign_qr_codes_scope_check;
ALTER TABLE public.campaign_qr_codes
  ADD CONSTRAINT campaign_qr_codes_scope_check
  CHECK (qr_scope IN ('campaign', 'assignment'));

ALTER TABLE public.campaign_qr_codes
  DROP CONSTRAINT IF EXISTS campaign_qr_codes_assignment_required_check;
ALTER TABLE public.campaign_qr_codes
  ADD CONSTRAINT campaign_qr_codes_assignment_required_check
  CHECK (
    qr_scope <> 'assignment'
    OR (assignment_id IS NOT NULL AND driver_id IS NOT NULL AND vehicle_id IS NOT NULL)
  );

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'campaign_qr_codes_assignment_id_key'
      AND conrelid = 'public.campaign_qr_codes'::regclass
  ) THEN
    ALTER TABLE public.campaign_qr_codes
      ADD CONSTRAINT campaign_qr_codes_assignment_id_key UNIQUE (assignment_id);
  END IF;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS idx_campaign_qr_codes_campaign_legacy_unique
  ON public.campaign_qr_codes(campaign_id)
  WHERE assignment_id IS NULL;
CREATE INDEX IF NOT EXISTS idx_campaign_qr_codes_assignment
  ON public.campaign_qr_codes(assignment_id);
CREATE INDEX IF NOT EXISTS idx_campaign_qr_codes_driver_vehicle
  ON public.campaign_qr_codes(driver_id, vehicle_id);

ALTER TABLE public.campaign_qr_scans
  ADD COLUMN IF NOT EXISTS assignment_id uuid REFERENCES public.campaign_driver_assignments(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS driver_id uuid REFERENCES public.drivers(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS vehicle_id uuid REFERENCES public.vehicles(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS approx_latitude numeric(9,6),
  ADD COLUMN IF NOT EXISTS approx_longitude numeric(9,6),
  ADD COLUMN IF NOT EXISTS approx_radius_m integer,
  ADD COLUMN IF NOT EXISTS approx_confidence numeric(4,3),
  ADD COLUMN IF NOT EXISTS approx_source text,
  ADD COLUMN IF NOT EXISTS location_processed_at timestamptz,
  ADD COLUMN IF NOT EXISTS location_candidate_count integer NOT NULL DEFAULT 0;

ALTER TABLE public.campaign_qr_scans
  DROP CONSTRAINT IF EXISTS campaign_qr_scans_approx_source_check;
ALTER TABLE public.campaign_qr_scans
  ADD CONSTRAINT campaign_qr_scans_approx_source_check
  CHECK (
    approx_source IS NULL
    OR approx_source IN ('driver_track_crossref', 'geoip_fallback', 'unavailable')
  );

CREATE INDEX IF NOT EXISTS idx_campaign_qr_scans_assignment_time
  ON public.campaign_qr_scans(assignment_id, scanned_at DESC)
  WHERE assignment_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_campaign_qr_scans_driver_vehicle_time
  ON public.campaign_qr_scans(driver_id, vehicle_id, scanned_at DESC)
  WHERE driver_id IS NOT NULL AND vehicle_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_campaign_qr_scans_approx_location
  ON public.campaign_qr_scans(campaign_id, scanned_at DESC)
  WHERE approx_latitude IS NOT NULL AND approx_longitude IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_campaign_qr_scans_location_pending
  ON public.campaign_qr_scans(scanned_at)
  WHERE location_processed_at IS NULL;

CREATE OR REPLACE FUNCTION public.ensure_assignment_qr_code(_assignment_id uuid)
RETURNS public.campaign_qr_codes
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_assignment public.campaign_driver_assignments%ROWTYPE;
  v_base_qr public.campaign_qr_codes%ROWTYPE;
  v_qr public.campaign_qr_codes%ROWTYPE;
  v_driver_name text;
  v_vehicle_label text;
BEGIN
  IF NOT (
    public.is_staff(auth.uid())
    OR current_setting('request.jwt.claim.role', true) = 'service_role'
  ) THEN
    RAISE EXCEPTION 'not authorized' USING ERRCODE = '42501';
  END IF;

  SELECT *
  INTO v_assignment
  FROM public.campaign_driver_assignments
  WHERE id = _assignment_id
  LIMIT 1;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'assignment not found' USING ERRCODE = '22023';
  END IF;

  SELECT *
  INTO v_base_qr
  FROM public.campaign_qr_codes
  WHERE campaign_id = v_assignment.campaign_id
    AND assignment_id IS NULL
    AND is_active = true
  ORDER BY created_at DESC
  LIMIT 1;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'configure the campaign QR destination before generating driver kits' USING ERRCODE = '22023';
  END IF;

  SELECT d.full_name
  INTO v_driver_name
  FROM public.drivers d
  WHERE d.id = v_assignment.driver_id;

  SELECT concat_ws(' ', nullif(v.brand, ''), nullif(v.model, ''), nullif(v.plate, ''))
  INTO v_vehicle_label
  FROM public.vehicles v
  WHERE v.id = v_assignment.vehicle_id;

  INSERT INTO public.campaign_qr_codes (
    campaign_id,
    advertiser_id,
    assignment_id,
    driver_id,
    vehicle_id,
    qr_scope,
    kit_label,
    destination_type,
    destination_url,
    whatsapp_phone,
    landing_page_url,
    is_active,
    qr_position,
    created_by
  )
  VALUES (
    v_assignment.campaign_id,
    v_base_qr.advertiser_id,
    v_assignment.id,
    v_assignment.driver_id,
    v_assignment.vehicle_id,
    'assignment',
    concat_ws(' - ', nullif(v_driver_name, ''), nullif(v_vehicle_label, '')),
    v_base_qr.destination_type,
    v_base_qr.destination_url,
    v_base_qr.whatsapp_phone,
    v_base_qr.landing_page_url,
    true,
    v_base_qr.qr_position,
    auth.uid()
  )
  ON CONFLICT (assignment_id)
  DO UPDATE SET
    advertiser_id = excluded.advertiser_id,
    driver_id = excluded.driver_id,
    vehicle_id = excluded.vehicle_id,
    qr_scope = 'assignment',
    kit_label = excluded.kit_label,
    destination_type = excluded.destination_type,
    destination_url = excluded.destination_url,
    whatsapp_phone = excluded.whatsapp_phone,
    landing_page_url = excluded.landing_page_url,
    is_active = true,
    qr_position = excluded.qr_position,
    updated_at = now()
  RETURNING * INTO v_qr;

  RETURN v_qr;
END;
$$;

CREATE OR REPLACE FUNCTION public.process_qr_scan_location(_scan_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_scan public.campaign_qr_scans%ROWTYPE;
  v_qr public.campaign_qr_codes%ROWTYPE;
  v_assignment_id uuid;
  v_driver_id uuid;
  v_vehicle_id uuid;
  v_prev public.driver_location_points%ROWTYPE;
  v_next public.driver_location_points%ROWTYPE;
  v_center_lat numeric(9,6);
  v_center_lng numeric(9,6);
  v_radius integer;
  v_confidence numeric(4,3);
  v_candidate_count integer := 0;
  v_prev_seconds numeric;
  v_next_seconds numeric;
  v_distance numeric;
BEGIN
  SELECT *
  INTO v_scan
  FROM public.campaign_qr_scans
  WHERE id = _scan_id
  LIMIT 1;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'scan not found' USING ERRCODE = '22023';
  END IF;

  SELECT *
  INTO v_qr
  FROM public.campaign_qr_codes
  WHERE id = v_scan.qr_code_id
  LIMIT 1;

  v_assignment_id := coalesce(v_scan.assignment_id, v_qr.assignment_id);
  v_driver_id := coalesce(v_scan.driver_id, v_qr.driver_id);
  v_vehicle_id := coalesce(v_scan.vehicle_id, v_qr.vehicle_id);

  IF v_assignment_id IS NOT NULL THEN
    SELECT *
    INTO v_prev
    FROM public.driver_location_points
    WHERE assignment_id = v_assignment_id
      AND accepted = true
      AND recorded_at <= v_scan.scanned_at
      AND recorded_at >= v_scan.scanned_at - interval '5 minutes'
    ORDER BY recorded_at DESC
    LIMIT 1;

    SELECT *
    INTO v_next
    FROM public.driver_location_points
    WHERE assignment_id = v_assignment_id
      AND accepted = true
      AND recorded_at >= v_scan.scanned_at
      AND recorded_at <= v_scan.scanned_at + interval '5 minutes'
    ORDER BY recorded_at ASC
    LIMIT 1;
  ELSIF v_driver_id IS NOT NULL THEN
    SELECT *
    INTO v_prev
    FROM public.driver_location_points
    WHERE campaign_id = v_scan.campaign_id
      AND driver_id = v_driver_id
      AND (v_vehicle_id IS NULL OR vehicle_id = v_vehicle_id)
      AND accepted = true
      AND recorded_at <= v_scan.scanned_at
      AND recorded_at >= v_scan.scanned_at - interval '5 minutes'
    ORDER BY recorded_at DESC
    LIMIT 1;

    SELECT *
    INTO v_next
    FROM public.driver_location_points
    WHERE campaign_id = v_scan.campaign_id
      AND driver_id = v_driver_id
      AND (v_vehicle_id IS NULL OR vehicle_id = v_vehicle_id)
      AND accepted = true
      AND recorded_at >= v_scan.scanned_at
      AND recorded_at <= v_scan.scanned_at + interval '5 minutes'
    ORDER BY recorded_at ASC
    LIMIT 1;
  END IF;

  IF v_prev.id IS NOT NULL THEN
    v_candidate_count := v_candidate_count + 1;
  END IF;
  IF v_next.id IS NOT NULL AND v_next.id IS DISTINCT FROM v_prev.id THEN
    v_candidate_count := v_candidate_count + 1;
  END IF;

  IF v_prev.id IS NOT NULL AND v_next.id IS NOT NULL AND v_next.id IS DISTINCT FROM v_prev.id THEN
    v_center_lat := round(((v_prev.lat + v_next.lat) / 2)::numeric, 6);
    v_center_lng := round(((v_prev.lng + v_next.lng) / 2)::numeric, 6);
    v_distance := public.haversine_meters(v_prev.lat, v_prev.lng, v_next.lat, v_next.lng);
    v_radius := least(
      5000,
      greatest(
        250,
        ceil((coalesce(v_prev.accuracy_m, 0) + coalesce(v_next.accuracy_m, 0)) / 2 + (v_distance / 2))::integer
      )
    );
    v_confidence := 0.900;
  ELSIF v_prev.id IS NOT NULL OR v_next.id IS NOT NULL THEN
    IF v_prev.id IS NOT NULL THEN
      v_center_lat := v_prev.lat;
      v_center_lng := v_prev.lng;
      v_prev_seconds := abs(extract(epoch FROM (v_scan.scanned_at - v_prev.recorded_at)));
      v_radius := least(5000, greatest(250, ceil(coalesce(v_prev.accuracy_m, 0) + 250 + (v_prev_seconds * 12))::integer));
      v_confidence := CASE WHEN v_prev_seconds <= 120 THEN 0.700 ELSE 0.450 END;
    ELSE
      v_center_lat := v_next.lat;
      v_center_lng := v_next.lng;
      v_next_seconds := abs(extract(epoch FROM (v_next.recorded_at - v_scan.scanned_at)));
      v_radius := least(5000, greatest(250, ceil(coalesce(v_next.accuracy_m, 0) + 250 + (v_next_seconds * 12))::integer));
      v_confidence := CASE WHEN v_next_seconds <= 120 THEN 0.700 ELSE 0.450 END;
    END IF;
  END IF;

  IF v_center_lat IS NOT NULL AND v_center_lng IS NOT NULL THEN
    UPDATE public.campaign_qr_scans
    SET
      assignment_id = coalesce(assignment_id, v_assignment_id),
      driver_id = coalesce(driver_id, v_driver_id),
      vehicle_id = coalesce(vehicle_id, v_vehicle_id),
      approx_latitude = v_center_lat,
      approx_longitude = v_center_lng,
      approx_radius_m = v_radius,
      approx_confidence = v_confidence,
      approx_source = 'driver_track_crossref',
      location_candidate_count = v_candidate_count,
      location_processed_at = now(),
      metadata = coalesce(metadata, '{}'::jsonb) || jsonb_build_object(
        'location_crossref', jsonb_build_object(
          'source', 'driver_track_crossref',
          'candidate_count', v_candidate_count,
          'processed_at', now()
        )
      )
    WHERE id = v_scan.id;

    RETURN jsonb_build_object('source', 'driver_track_crossref', 'candidate_count', v_candidate_count);
  END IF;

  IF v_scan.latitude IS NOT NULL AND v_scan.longitude IS NOT NULL THEN
    UPDATE public.campaign_qr_scans
    SET
      assignment_id = coalesce(assignment_id, v_assignment_id),
      driver_id = coalesce(driver_id, v_driver_id),
      vehicle_id = coalesce(vehicle_id, v_vehicle_id),
      approx_latitude = latitude,
      approx_longitude = longitude,
      approx_radius_m = 30000,
      approx_confidence = 0.200,
      approx_source = 'geoip_fallback',
      location_candidate_count = 0,
      location_processed_at = now(),
      metadata = coalesce(metadata, '{}'::jsonb) || jsonb_build_object(
        'location_crossref', jsonb_build_object(
          'source', 'geoip_fallback',
          'candidate_count', 0,
          'processed_at', now()
        )
      )
    WHERE id = v_scan.id;

    RETURN jsonb_build_object('source', 'geoip_fallback', 'candidate_count', 0);
  END IF;

  UPDATE public.campaign_qr_scans
  SET
    assignment_id = coalesce(assignment_id, v_assignment_id),
    driver_id = coalesce(driver_id, v_driver_id),
    vehicle_id = coalesce(vehicle_id, v_vehicle_id),
    approx_source = 'unavailable',
    location_candidate_count = 0,
    location_processed_at = now(),
    metadata = coalesce(metadata, '{}'::jsonb) || jsonb_build_object(
      'location_crossref', jsonb_build_object(
        'source', 'unavailable',
        'candidate_count', 0,
        'processed_at', now()
      )
    )
  WHERE id = v_scan.id;

  RETURN jsonb_build_object('source', 'unavailable', 'candidate_count', 0);
END;
$$;

CREATE OR REPLACE FUNCTION public.process_pending_qr_scan_locations(_limit integer DEFAULT 100)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_scan record;
  v_count integer := 0;
BEGIN
  IF NOT (
    public.is_staff(auth.uid())
    OR current_setting('request.jwt.claim.role', true) = 'service_role'
  ) THEN
    RAISE EXCEPTION 'not authorized' USING ERRCODE = '42501';
  END IF;

  FOR v_scan IN
    SELECT id
    FROM public.campaign_qr_scans
    WHERE location_processed_at IS NULL
    ORDER BY scanned_at DESC
    LIMIT greatest(coalesce(_limit, 100), 1)
  LOOP
    PERFORM public.process_qr_scan_location(v_scan.id);
    v_count := v_count + 1;
  END LOOP;

  RETURN v_count;
END;
$$;

CREATE OR REPLACE FUNCTION public.get_campaign_qr_analytics(_campaign_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_total integer := 0;
  v_unique integer := 0;
  v_is_staff boolean := false;
BEGIN
  v_is_staff := public.is_staff(auth.uid());

  IF NOT (
    v_is_staff
    OR public.user_owns_campaign(auth.uid(), _campaign_id)
  ) THEN
    RAISE EXCEPTION 'not authorized' USING ERRCODE = '42501';
  END IF;

  SELECT count(*)::integer, count(DISTINCT scan_key)::integer
  INTO v_total, v_unique
  FROM public.campaign_qr_scans
  WHERE campaign_id = _campaign_id;

  RETURN jsonb_build_object(
    'summary', jsonb_build_object(
      'total_scans', coalesce(v_total, 0),
      'unique_scans', coalesce(v_unique, 0),
      'last_scan_at', (
        SELECT max(scanned_at)
        FROM public.campaign_qr_scans
        WHERE campaign_id = _campaign_id
      )
    ),
    'by_day', coalesce((
      SELECT jsonb_agg(row_to_json(x) ORDER BY x.day)
      FROM (
        SELECT scanned_at::date AS day, count(*)::integer AS scans, count(DISTINCT scan_key)::integer AS unique_scans
        FROM public.campaign_qr_scans
        WHERE campaign_id = _campaign_id
        GROUP BY scanned_at::date
      ) x
    ), '[]'::jsonb),
    'by_hour', coalesce((
      SELECT jsonb_agg(row_to_json(x) ORDER BY x.hour)
      FROM (
        SELECT extract(hour FROM scanned_at)::integer AS hour, count(*)::integer AS scans
        FROM public.campaign_qr_scans
        WHERE campaign_id = _campaign_id
        GROUP BY extract(hour FROM scanned_at)::integer
      ) x
    ), '[]'::jsonb),
    'by_city', coalesce((
      SELECT jsonb_agg(row_to_json(x) ORDER BY x.scans DESC, x.city)
      FROM (
        SELECT
          coalesce(nullif(city, ''), 'Localizacao indisponivel') AS city,
          coalesce(nullif(region, ''), '') AS region,
          coalesce(nullif(country, ''), '') AS country,
          count(*)::integer AS scans
        FROM public.campaign_qr_scans
        WHERE campaign_id = _campaign_id
        GROUP BY coalesce(nullif(city, ''), 'Localizacao indisponivel'), coalesce(nullif(region, ''), ''), coalesce(nullif(country, ''), '')
        LIMIT 20
      ) x
    ), '[]'::jsonb),
    'by_device', coalesce((
      SELECT jsonb_agg(row_to_json(x) ORDER BY x.scans DESC, x.device_type)
      FROM (
        SELECT coalesce(nullif(device_type, ''), 'Desconhecido') AS device_type, count(*)::integer AS scans
        FROM public.campaign_qr_scans
        WHERE campaign_id = _campaign_id
        GROUP BY coalesce(nullif(device_type, ''), 'Desconhecido')
      ) x
    ), '[]'::jsonb),
    'latest_scans', coalesce((
      SELECT jsonb_agg(row_to_json(x) ORDER BY x.scanned_at DESC)
      FROM (
        SELECT
          s.scanned_at,
          coalesce(nullif(s.city, ''), 'Localizacao indisponivel') AS city,
          coalesce(nullif(s.region, ''), '') AS region,
          coalesce(nullif(s.country, ''), '') AS country,
          coalesce(nullif(s.device_type, ''), 'Desconhecido') AS device_type,
          coalesce(nullif(s.browser_name, ''), 'Desconhecido') AS browser_name,
          coalesce(nullif(s.os_name, ''), 'Desconhecido') AS os_name,
          s.referrer,
          s.approx_source,
          s.approx_radius_m,
          s.approx_confidence,
          concat_ws(' ', nullif(v.brand, ''), nullif(v.model, ''), nullif(v.plate, '')) AS vehicle_label,
          CASE WHEN v_is_staff THEN d.full_name ELSE NULL END AS driver_name
        FROM public.campaign_qr_scans s
        LEFT JOIN public.vehicles v ON v.id = s.vehicle_id
        LEFT JOIN public.drivers d ON d.id = s.driver_id
        WHERE s.campaign_id = _campaign_id
        ORDER BY s.scanned_at DESC
        LIMIT 12
      ) x
    ), '[]'::jsonb),
    'approx_locations', coalesce((
      SELECT jsonb_agg(row_to_json(x) ORDER BY x.scanned_at DESC)
      FROM (
        SELECT
          s.scanned_at,
          s.approx_latitude::double precision AS lat,
          s.approx_longitude::double precision AS lng,
          s.approx_radius_m AS radius_m,
          s.approx_confidence AS confidence,
          s.approx_source AS source,
          coalesce(nullif(s.device_type, ''), 'Desconhecido') AS device_type,
          concat_ws(' ', nullif(v.brand, ''), nullif(v.model, ''), nullif(v.plate, '')) AS vehicle_label,
          CASE WHEN v_is_staff THEN d.full_name ELSE NULL END AS driver_name
        FROM public.campaign_qr_scans s
        LEFT JOIN public.vehicles v ON v.id = s.vehicle_id
        LEFT JOIN public.drivers d ON d.id = s.driver_id
        WHERE s.campaign_id = _campaign_id
          AND s.approx_latitude IS NOT NULL
          AND s.approx_longitude IS NOT NULL
        ORDER BY s.scanned_at DESC
        LIMIT 200
      ) x
    ), '[]'::jsonb)
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.get_admin_driver_rankings(_limit integer DEFAULT 20)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  IF NOT public.is_staff(auth.uid()) THEN
    RAISE EXCEPTION 'not authorized' USING ERRCODE = '42501';
  END IF;

  RETURN coalesce((
    SELECT jsonb_agg(row_to_json(x) ORDER BY x.distance_m DESC)
    FROM (
      SELECT
        d.id AS driver_id,
        d.full_name,
        d.city,
        count(DISTINCT s.campaign_id)::integer AS campaigns_count,
        sum(s.distance_m)::numeric(12,2) AS distance_m,
        sum(s.driving_seconds)::integer AS driving_seconds,
        sum(s.sessions_count)::integer AS sessions_count,
        max(s.last_seen_at) AS last_seen_at,
        coalesce(q.scan_count, 0)::integer AS attributed_scans
      FROM public.driver_tracking_daily_summaries s
      JOIN public.drivers d ON d.id = s.driver_id
      LEFT JOIN (
        SELECT driver_id, count(*)::integer AS scan_count
        FROM public.campaign_qr_scans
        WHERE approx_source = 'driver_track_crossref'
          AND driver_id IS NOT NULL
        GROUP BY driver_id
      ) q ON q.driver_id = d.id
      GROUP BY d.id, d.full_name, d.city, q.scan_count
      ORDER BY sum(s.distance_m) DESC
      LIMIT greatest(coalesce(_limit, 20), 1)
    ) x
  ), '[]'::jsonb);
END;
$$;

REVOKE ALL ON FUNCTION public.ensure_assignment_qr_code(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.process_qr_scan_location(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.process_pending_qr_scan_locations(integer) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.get_campaign_qr_analytics(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.get_admin_driver_rankings(integer) FROM PUBLIC, anon;

GRANT EXECUTE ON FUNCTION public.ensure_assignment_qr_code(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.process_qr_scan_location(uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.process_pending_qr_scan_locations(integer) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.get_campaign_qr_analytics(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.get_admin_driver_rankings(integer) TO authenticated, service_role;
