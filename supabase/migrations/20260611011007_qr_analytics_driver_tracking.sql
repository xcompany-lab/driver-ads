-- QR analytics enrichment + driver operational tracking V1.
-- Public/raw location data is deliberately separated: advertisers read aggregate RPCs only.

ALTER TABLE public.campaign_qr_scans
  ADD COLUMN IF NOT EXISTS scan_key text,
  ADD COLUMN IF NOT EXISTS device_type text,
  ADD COLUMN IF NOT EXISTS browser_name text,
  ADD COLUMN IF NOT EXISTS os_name text,
  ADD COLUMN IF NOT EXISTS country text,
  ADD COLUMN IF NOT EXISTS region text,
  ADD COLUMN IF NOT EXISTS city text,
  ADD COLUMN IF NOT EXISTS latitude numeric(9,6),
  ADD COLUMN IF NOT EXISTS longitude numeric(9,6),
  ADD COLUMN IF NOT EXISTS geo_source text,
  ADD COLUMN IF NOT EXISTS destination_url text,
  ADD COLUMN IF NOT EXISTS processed_at timestamptz NOT NULL DEFAULT now();

CREATE INDEX IF NOT EXISTS idx_campaign_qr_scans_campaign_time
  ON public.campaign_qr_scans(campaign_id, scanned_at DESC);
CREATE INDEX IF NOT EXISTS idx_campaign_qr_scans_campaign_scan_key
  ON public.campaign_qr_scans(campaign_id, scan_key);
CREATE INDEX IF NOT EXISTS idx_campaign_qr_scans_campaign_city
  ON public.campaign_qr_scans(campaign_id, city);
CREATE INDEX IF NOT EXISTS idx_campaign_qr_scans_campaign_device
  ON public.campaign_qr_scans(campaign_id, device_type);

CREATE TABLE IF NOT EXISTS public.driver_location_consents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  driver_id uuid NOT NULL REFERENCES public.drivers(id) ON DELETE CASCADE,
  consented_at timestamptz NOT NULL DEFAULT now(),
  revoked_at timestamptz,
  terms_version text NOT NULL DEFAULT 'driver-location-v1',
  source text NOT NULL DEFAULT 'driver_portal',
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_driver_location_consents_active
  ON public.driver_location_consents(driver_id)
  WHERE revoked_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_driver_location_consents_driver
  ON public.driver_location_consents(driver_id, consented_at DESC);

CREATE TABLE IF NOT EXISTS public.driver_tracking_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  assignment_id uuid NOT NULL REFERENCES public.campaign_driver_assignments(id) ON DELETE CASCADE,
  driver_id uuid NOT NULL REFERENCES public.drivers(id) ON DELETE CASCADE,
  campaign_id uuid NOT NULL REFERENCES public.campaigns(id) ON DELETE CASCADE,
  vehicle_id uuid NOT NULL REFERENCES public.vehicles(id) ON DELETE CASCADE,
  consent_id uuid REFERENCES public.driver_location_consents(id) ON DELETE SET NULL,
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'completed', 'interrupted')),
  started_at timestamptz NOT NULL DEFAULT now(),
  ended_at timestamptz,
  source text NOT NULL DEFAULT 'web',
  start_lat numeric(9,6),
  start_lng numeric(9,6),
  end_lat numeric(9,6),
  end_lng numeric(9,6),
  total_distance_m numeric(12,2) NOT NULL DEFAULT 0,
  duration_seconds integer NOT NULL DEFAULT 0,
  points_count integer NOT NULL DEFAULT 0,
  last_point_at timestamptz,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_driver_tracking_sessions_active_assignment
  ON public.driver_tracking_sessions(assignment_id, driver_id)
  WHERE status = 'active';
CREATE INDEX IF NOT EXISTS idx_driver_tracking_sessions_driver_time
  ON public.driver_tracking_sessions(driver_id, started_at DESC);
CREATE INDEX IF NOT EXISTS idx_driver_tracking_sessions_campaign_time
  ON public.driver_tracking_sessions(campaign_id, started_at DESC);

DROP TRIGGER IF EXISTS trg_driver_tracking_sessions_updated_at ON public.driver_tracking_sessions;
CREATE TRIGGER trg_driver_tracking_sessions_updated_at
  BEFORE UPDATE ON public.driver_tracking_sessions
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE IF NOT EXISTS public.driver_location_points (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id uuid NOT NULL REFERENCES public.driver_tracking_sessions(id) ON DELETE CASCADE,
  assignment_id uuid NOT NULL REFERENCES public.campaign_driver_assignments(id) ON DELETE CASCADE,
  driver_id uuid NOT NULL REFERENCES public.drivers(id) ON DELETE CASCADE,
  campaign_id uuid NOT NULL REFERENCES public.campaigns(id) ON DELETE CASCADE,
  vehicle_id uuid NOT NULL REFERENCES public.vehicles(id) ON DELETE CASCADE,
  recorded_at timestamptz NOT NULL,
  lat numeric(9,6) NOT NULL,
  lng numeric(9,6) NOT NULL,
  accuracy_m numeric(10,2),
  speed_mps numeric(10,2),
  heading numeric(10,2),
  distance_from_prev_m numeric(12,2) NOT NULL DEFAULT 0,
  accepted boolean NOT NULL DEFAULT true,
  rejection_reason text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_driver_location_points_session_time
  ON public.driver_location_points(session_id, recorded_at);
CREATE INDEX IF NOT EXISTS idx_driver_location_points_driver_time
  ON public.driver_location_points(driver_id, recorded_at DESC);
CREATE INDEX IF NOT EXISTS idx_driver_location_points_campaign_time
  ON public.driver_location_points(campaign_id, recorded_at DESC);
CREATE INDEX IF NOT EXISTS idx_driver_location_points_recorded_at
  ON public.driver_location_points(recorded_at);

CREATE TABLE IF NOT EXISTS public.driver_tracking_daily_summaries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  summary_date date NOT NULL,
  driver_id uuid NOT NULL REFERENCES public.drivers(id) ON DELETE CASCADE,
  campaign_id uuid NOT NULL REFERENCES public.campaigns(id) ON DELETE CASCADE,
  assignment_id uuid NOT NULL REFERENCES public.campaign_driver_assignments(id) ON DELETE CASCADE,
  vehicle_id uuid NOT NULL REFERENCES public.vehicles(id) ON DELETE CASCADE,
  distance_m numeric(12,2) NOT NULL DEFAULT 0,
  driving_seconds integer NOT NULL DEFAULT 0,
  points_count integer NOT NULL DEFAULT 0,
  sessions_count integer NOT NULL DEFAULT 0,
  first_seen_at timestamptz,
  last_seen_at timestamptz,
  peak_hour integer CHECK (peak_hour IS NULL OR (peak_hour >= 0 AND peak_hour <= 23)),
  city text,
  regions text[] NOT NULL DEFAULT '{}'::text[],
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(summary_date, assignment_id)
);

CREATE INDEX IF NOT EXISTS idx_driver_tracking_daily_campaign_date
  ON public.driver_tracking_daily_summaries(campaign_id, summary_date DESC);
CREATE INDEX IF NOT EXISTS idx_driver_tracking_daily_driver_date
  ON public.driver_tracking_daily_summaries(driver_id, summary_date DESC);

DROP TRIGGER IF EXISTS trg_driver_tracking_daily_summaries_updated_at ON public.driver_tracking_daily_summaries;
CREATE TRIGGER trg_driver_tracking_daily_summaries_updated_at
  BEFORE UPDATE ON public.driver_tracking_daily_summaries
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.driver_location_consents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.driver_tracking_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.driver_location_points ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.driver_tracking_daily_summaries ENABLE ROW LEVEL SECURITY;

GRANT SELECT ON public.driver_location_consents TO authenticated;
GRANT SELECT ON public.driver_tracking_sessions TO authenticated;
GRANT SELECT ON public.driver_location_points TO authenticated;
GRANT SELECT ON public.driver_tracking_daily_summaries TO authenticated;
GRANT ALL ON public.driver_location_consents TO service_role;
GRANT ALL ON public.driver_tracking_sessions TO service_role;
GRANT ALL ON public.driver_location_points TO service_role;
GRANT ALL ON public.driver_tracking_daily_summaries TO service_role;

DROP POLICY IF EXISTS "Staff read all location consents" ON public.driver_location_consents;
CREATE POLICY "Staff read all location consents"
ON public.driver_location_consents FOR SELECT TO authenticated
USING (public.is_staff(auth.uid()));

DROP POLICY IF EXISTS "Driver reads own location consents" ON public.driver_location_consents;
CREATE POLICY "Driver reads own location consents"
ON public.driver_location_consents FOR SELECT TO authenticated
USING (driver_id IN (SELECT d.id FROM public.drivers d WHERE d.user_id = auth.uid()));

DROP POLICY IF EXISTS "Staff read all tracking sessions" ON public.driver_tracking_sessions;
CREATE POLICY "Staff read all tracking sessions"
ON public.driver_tracking_sessions FOR SELECT TO authenticated
USING (public.is_staff(auth.uid()));

DROP POLICY IF EXISTS "Driver reads own tracking sessions" ON public.driver_tracking_sessions;
CREATE POLICY "Driver reads own tracking sessions"
ON public.driver_tracking_sessions FOR SELECT TO authenticated
USING (driver_id IN (SELECT d.id FROM public.drivers d WHERE d.user_id = auth.uid()));

DROP POLICY IF EXISTS "Staff read all location points" ON public.driver_location_points;
CREATE POLICY "Staff read all location points"
ON public.driver_location_points FOR SELECT TO authenticated
USING (public.is_staff(auth.uid()));

DROP POLICY IF EXISTS "Driver reads own location points" ON public.driver_location_points;
CREATE POLICY "Driver reads own location points"
ON public.driver_location_points FOR SELECT TO authenticated
USING (driver_id IN (SELECT d.id FROM public.drivers d WHERE d.user_id = auth.uid()));

DROP POLICY IF EXISTS "Staff read all tracking summaries" ON public.driver_tracking_daily_summaries;
CREATE POLICY "Staff read all tracking summaries"
ON public.driver_tracking_daily_summaries FOR SELECT TO authenticated
USING (public.is_staff(auth.uid()));

DROP POLICY IF EXISTS "Driver reads own tracking summaries" ON public.driver_tracking_daily_summaries;
CREATE POLICY "Driver reads own tracking summaries"
ON public.driver_tracking_daily_summaries FOR SELECT TO authenticated
USING (driver_id IN (SELECT d.id FROM public.drivers d WHERE d.user_id = auth.uid()));

DROP POLICY IF EXISTS "Advertiser reads aggregate tracking summaries" ON public.driver_tracking_daily_summaries;
CREATE POLICY "Advertiser reads aggregate tracking summaries"
ON public.driver_tracking_daily_summaries FOR SELECT TO authenticated
USING (public.user_owns_campaign(auth.uid(), campaign_id));

CREATE OR REPLACE FUNCTION public.haversine_meters(
  lat1 numeric,
  lng1 numeric,
  lat2 numeric,
  lng2 numeric
)
RETURNS numeric
LANGUAGE sql
IMMUTABLE
SET search_path = public, pg_temp
AS $$
  SELECT (
    6371000 * 2 * asin(
      sqrt(
        power(sin(radians(($3 - $1)::double precision) / 2), 2) +
        cos(radians($1::double precision)) *
        cos(radians($3::double precision)) *
        power(sin(radians(($4 - $2)::double precision) / 2), 2)
      )
    )
  )::numeric;
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
BEGIN
  IF NOT (
    public.is_staff(auth.uid())
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
          scanned_at,
          coalesce(nullif(city, ''), 'Localizacao indisponivel') AS city,
          coalesce(nullif(region, ''), '') AS region,
          coalesce(nullif(country, ''), '') AS country,
          coalesce(nullif(device_type, ''), 'Desconhecido') AS device_type,
          coalesce(nullif(browser_name, ''), 'Desconhecido') AS browser_name,
          coalesce(nullif(os_name, ''), 'Desconhecido') AS os_name,
          referrer
        FROM public.campaign_qr_scans
        WHERE campaign_id = _campaign_id
        ORDER BY scanned_at DESC
        LIMIT 12
      ) x
    ), '[]'::jsonb)
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.start_driver_tracking_session(
  _assignment_id uuid,
  _terms_version text DEFAULT 'driver-location-v1'
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_assignment public.campaign_driver_assignments%ROWTYPE;
  v_driver public.drivers%ROWTYPE;
  v_consent_id uuid;
  v_session_id uuid;
BEGIN
  SELECT cda.*
  INTO v_assignment
  FROM public.campaign_driver_assignments cda
  JOIN public.drivers d ON d.id = cda.driver_id
  WHERE cda.id = _assignment_id
    AND d.user_id = auth.uid()
  LIMIT 1;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'assignment not found' USING ERRCODE = '42501';
  END IF;

  IF v_assignment.status NOT IN ('accepted', 'awaiting_installation', 'active') THEN
    RAISE EXCEPTION 'tracking unavailable for assignment status %', v_assignment.status USING ERRCODE = '22023';
  END IF;

  SELECT *
  INTO v_driver
  FROM public.drivers
  WHERE id = v_assignment.driver_id
  LIMIT 1;

  IF v_driver.status <> 'approved' THEN
    RAISE EXCEPTION 'driver not approved' USING ERRCODE = '22023';
  END IF;

  SELECT id
  INTO v_consent_id
  FROM public.driver_location_consents
  WHERE driver_id = v_assignment.driver_id
    AND revoked_at IS NULL
  ORDER BY consented_at DESC
  LIMIT 1;

  IF v_consent_id IS NULL THEN
    INSERT INTO public.driver_location_consents (driver_id, terms_version, source)
    VALUES (v_assignment.driver_id, coalesce(nullif(_terms_version, ''), 'driver-location-v1'), 'driver_portal')
    RETURNING id INTO v_consent_id;
  END IF;

  SELECT id
  INTO v_session_id
  FROM public.driver_tracking_sessions
  WHERE assignment_id = v_assignment.id
    AND driver_id = v_assignment.driver_id
    AND status = 'active'
  LIMIT 1;

  IF v_session_id IS NOT NULL THEN
    RETURN v_session_id;
  END IF;

  INSERT INTO public.driver_tracking_sessions (
    assignment_id,
    driver_id,
    campaign_id,
    vehicle_id,
    consent_id,
    status,
    source
  )
  VALUES (
    v_assignment.id,
    v_assignment.driver_id,
    v_assignment.campaign_id,
    v_assignment.vehicle_id,
    v_consent_id,
    'active',
    'web'
  )
  RETURNING id INTO v_session_id;

  RETURN v_session_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.ingest_driver_location_point(
  _session_id uuid,
  _lat numeric,
  _lng numeric,
  _accuracy_m numeric DEFAULT NULL,
  _speed_mps numeric DEFAULT NULL,
  _heading numeric DEFAULT NULL,
  _recorded_at timestamptz DEFAULT now(),
  _metadata jsonb DEFAULT '{}'::jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_session public.driver_tracking_sessions%ROWTYPE;
  v_driver_user_id uuid;
  v_prev public.driver_location_points%ROWTYPE;
  v_recorded_at timestamptz := coalesce(_recorded_at, now());
  v_distance numeric(12,2) := 0;
  v_delta_seconds integer := 0;
  v_calc_speed numeric := 0;
  v_accepted boolean := true;
  v_rejection text := null;
  v_campaign public.campaigns%ROWTYPE;
BEGIN
  SELECT s.*
  INTO v_session
  FROM public.driver_tracking_sessions s
  WHERE s.id = _session_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'session not found' USING ERRCODE = '42501';
  END IF;

  SELECT d.user_id
  INTO v_driver_user_id
  FROM public.drivers d
  WHERE d.id = v_session.driver_id;

  IF v_driver_user_id <> auth.uid() THEN
    RAISE EXCEPTION 'session not found' USING ERRCODE = '42501';
  END IF;

  IF v_session.status <> 'active' THEN
    RAISE EXCEPTION 'tracking session is not active' USING ERRCODE = '22023';
  END IF;

  IF _lat IS NULL OR _lng IS NULL OR _lat < -90 OR _lat > 90 OR _lng < -180 OR _lng > 180 THEN
    v_accepted := false;
    v_rejection := 'invalid_coordinates';
  ELSIF _accuracy_m IS NOT NULL AND _accuracy_m > 100 THEN
    v_accepted := false;
    v_rejection := 'low_accuracy';
  END IF;

  IF v_recorded_at > now() + interval '5 minutes' THEN
    v_recorded_at := now();
  END IF;

  SELECT *
  INTO v_prev
  FROM public.driver_location_points
  WHERE session_id = _session_id
    AND accepted = true
  ORDER BY recorded_at DESC
  LIMIT 1;

  IF v_accepted AND FOUND THEN
    v_distance := round(public.haversine_meters(v_prev.lat, v_prev.lng, _lat, _lng)::numeric, 2);
    v_delta_seconds := greatest(extract(epoch FROM (v_recorded_at - v_prev.recorded_at))::integer, 0);

    IF v_delta_seconds > 0 THEN
      v_calc_speed := v_distance / v_delta_seconds;
    END IF;

    IF v_delta_seconds > 0 AND v_distance > 30 AND v_calc_speed > 45 THEN
      v_accepted := false;
      v_rejection := 'impossible_speed';
      v_distance := 0;
    ELSIF v_delta_seconds > 900 THEN
      v_delta_seconds := 0;
      v_distance := 0;
    END IF;
  END IF;

  INSERT INTO public.driver_location_points (
    session_id,
    assignment_id,
    driver_id,
    campaign_id,
    vehicle_id,
    recorded_at,
    lat,
    lng,
    accuracy_m,
    speed_mps,
    heading,
    distance_from_prev_m,
    accepted,
    rejection_reason,
    metadata
  )
  VALUES (
    v_session.id,
    v_session.assignment_id,
    v_session.driver_id,
    v_session.campaign_id,
    v_session.vehicle_id,
    v_recorded_at,
    _lat,
    _lng,
    _accuracy_m,
    _speed_mps,
    _heading,
    v_distance,
    v_accepted,
    v_rejection,
    coalesce(_metadata, '{}'::jsonb)
  );

  IF v_accepted THEN
    SELECT *
    INTO v_campaign
    FROM public.campaigns
    WHERE id = v_session.campaign_id
    LIMIT 1;

    UPDATE public.driver_tracking_sessions
    SET
      start_lat = coalesce(start_lat, _lat),
      start_lng = coalesce(start_lng, _lng),
      end_lat = _lat,
      end_lng = _lng,
      total_distance_m = total_distance_m + v_distance,
      points_count = points_count + 1,
      last_point_at = v_recorded_at,
      duration_seconds = greatest(extract(epoch FROM (v_recorded_at - started_at))::integer, duration_seconds)
    WHERE id = v_session.id;

    INSERT INTO public.driver_tracking_daily_summaries (
      summary_date,
      driver_id,
      campaign_id,
      assignment_id,
      vehicle_id,
      distance_m,
      driving_seconds,
      points_count,
      sessions_count,
      first_seen_at,
      last_seen_at,
      peak_hour,
      city,
      regions
    )
    VALUES (
      v_recorded_at::date,
      v_session.driver_id,
      v_session.campaign_id,
      v_session.assignment_id,
      v_session.vehicle_id,
      v_distance,
      v_delta_seconds,
      1,
      1,
      v_recorded_at,
      v_recorded_at,
      extract(hour FROM v_recorded_at)::integer,
      v_campaign.city,
      coalesce(v_campaign.regions, '{}'::text[])
    )
    ON CONFLICT (summary_date, assignment_id)
    DO UPDATE SET
      distance_m = public.driver_tracking_daily_summaries.distance_m + excluded.distance_m,
      driving_seconds = public.driver_tracking_daily_summaries.driving_seconds + excluded.driving_seconds,
      points_count = public.driver_tracking_daily_summaries.points_count + 1,
      first_seen_at = least(public.driver_tracking_daily_summaries.first_seen_at, excluded.first_seen_at),
      last_seen_at = greatest(public.driver_tracking_daily_summaries.last_seen_at, excluded.last_seen_at),
      peak_hour = excluded.peak_hour,
      updated_at = now();
  END IF;

  RETURN jsonb_build_object(
    'accepted', v_accepted,
    'rejection_reason', v_rejection,
    'distance_from_prev_m', v_distance,
    'recorded_at', v_recorded_at
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.end_driver_tracking_session(_session_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_session public.driver_tracking_sessions%ROWTYPE;
  v_driver_user_id uuid;
BEGIN
  SELECT s.*
  INTO v_session
  FROM public.driver_tracking_sessions s
  WHERE s.id = _session_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'session not found' USING ERRCODE = '42501';
  END IF;

  SELECT d.user_id
  INTO v_driver_user_id
  FROM public.drivers d
  WHERE d.id = v_session.driver_id;

  IF v_driver_user_id <> auth.uid() THEN
    RAISE EXCEPTION 'session not found' USING ERRCODE = '42501';
  END IF;

  UPDATE public.driver_tracking_sessions
  SET
    status = CASE WHEN status = 'active' THEN 'completed' ELSE status END,
    ended_at = coalesce(ended_at, now()),
    duration_seconds = greatest(
      duration_seconds,
      extract(epoch FROM (coalesce(last_point_at, now()) - started_at))::integer
    )
  WHERE id = _session_id
  RETURNING * INTO v_session;

  RETURN jsonb_build_object(
    'session_id', v_session.id,
    'status', v_session.status,
    'total_distance_m', v_session.total_distance_m,
    'duration_seconds', v_session.duration_seconds,
    'points_count', v_session.points_count
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.get_my_tracking_status(_assignment_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_assignment public.campaign_driver_assignments%ROWTYPE;
  v_session public.driver_tracking_sessions%ROWTYPE;
  v_consent public.driver_location_consents%ROWTYPE;
BEGIN
  SELECT cda.*
  INTO v_assignment
  FROM public.campaign_driver_assignments cda
  JOIN public.drivers d ON d.id = cda.driver_id
  WHERE cda.id = _assignment_id
    AND d.user_id = auth.uid()
  LIMIT 1;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'assignment not found' USING ERRCODE = '42501';
  END IF;

  SELECT *
  INTO v_consent
  FROM public.driver_location_consents
  WHERE driver_id = v_assignment.driver_id
    AND revoked_at IS NULL
  ORDER BY consented_at DESC
  LIMIT 1;

  SELECT *
  INTO v_session
  FROM public.driver_tracking_sessions
  WHERE assignment_id = v_assignment.id
    AND driver_id = v_assignment.driver_id
    AND status = 'active'
  ORDER BY started_at DESC
  LIMIT 1;

  RETURN jsonb_build_object(
    'has_consent', v_consent.id IS NOT NULL,
    'active_session_id', v_session.id,
    'active_started_at', v_session.started_at,
    'total_distance_m', coalesce(v_session.total_distance_m, 0),
    'duration_seconds', coalesce(v_session.duration_seconds, 0),
    'points_count', coalesce(v_session.points_count, 0)
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.revoke_driver_location_consent()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_driver_id uuid;
BEGIN
  SELECT id INTO v_driver_id
  FROM public.drivers
  WHERE user_id = auth.uid()
  LIMIT 1;

  IF v_driver_id IS NULL THEN
    RAISE EXCEPTION 'driver not found' USING ERRCODE = '42501';
  END IF;

  UPDATE public.driver_location_consents
  SET revoked_at = now()
  WHERE driver_id = v_driver_id
    AND revoked_at IS NULL;

  UPDATE public.driver_tracking_sessions
  SET status = 'interrupted',
      ended_at = coalesce(ended_at, now())
  WHERE driver_id = v_driver_id
    AND status = 'active';

  RETURN jsonb_build_object('revoked', true);
END;
$$;

CREATE OR REPLACE FUNCTION public.get_driver_tracking_analytics(_campaign_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  IF NOT (
    public.is_staff(auth.uid())
    OR public.user_owns_campaign(auth.uid(), _campaign_id)
  ) THEN
    RAISE EXCEPTION 'not authorized' USING ERRCODE = '42501';
  END IF;

  RETURN jsonb_build_object(
    'summary', coalesce((
      SELECT jsonb_build_object(
        'distance_m', coalesce(sum(distance_m), 0),
        'driving_seconds', coalesce(sum(driving_seconds), 0),
        'active_drivers', count(DISTINCT driver_id),
        'sessions_count', coalesce(sum(sessions_count), 0),
        'points_count', coalesce(sum(points_count), 0)
      )
      FROM public.driver_tracking_daily_summaries
      WHERE campaign_id = _campaign_id
    ), '{"distance_m":0,"driving_seconds":0,"active_drivers":0,"sessions_count":0,"points_count":0}'::jsonb),
    'by_day', coalesce((
      SELECT jsonb_agg(row_to_json(x) ORDER BY x.day)
      FROM (
        SELECT summary_date AS day, sum(distance_m)::numeric(12,2) AS distance_m, sum(driving_seconds)::integer AS driving_seconds
        FROM public.driver_tracking_daily_summaries
        WHERE campaign_id = _campaign_id
        GROUP BY summary_date
      ) x
    ), '[]'::jsonb),
    'by_hour', coalesce((
      SELECT jsonb_agg(row_to_json(x) ORDER BY x.hour)
      FROM (
        SELECT extract(hour FROM recorded_at)::integer AS hour, count(*)::integer AS points, sum(distance_from_prev_m)::numeric(12,2) AS distance_m
        FROM public.driver_location_points
        WHERE campaign_id = _campaign_id
          AND accepted = true
        GROUP BY extract(hour FROM recorded_at)::integer
      ) x
    ), '[]'::jsonb),
    'by_city', coalesce((
      SELECT jsonb_agg(row_to_json(x) ORDER BY x.distance_m DESC)
      FROM (
        SELECT coalesce(nullif(city, ''), 'Sem cidade') AS city, sum(distance_m)::numeric(12,2) AS distance_m, sum(driving_seconds)::integer AS driving_seconds
        FROM public.driver_tracking_daily_summaries
        WHERE campaign_id = _campaign_id
        GROUP BY coalesce(nullif(city, ''), 'Sem cidade')
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
        max(s.last_seen_at) AS last_seen_at
      FROM public.driver_tracking_daily_summaries s
      JOIN public.drivers d ON d.id = s.driver_id
      GROUP BY d.id, d.full_name, d.city
      ORDER BY sum(s.distance_m) DESC
      LIMIT greatest(coalesce(_limit, 20), 1)
    ) x
  ), '[]'::jsonb);
END;
$$;

CREATE OR REPLACE FUNCTION public.purge_old_driver_location_points()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_deleted integer := 0;
BEGIN
  IF NOT (
    public.is_staff(auth.uid())
    OR current_user IN ('postgres', 'service_role', 'supabase_admin')
    OR session_user IN ('postgres', 'service_role', 'supabase_admin')
  ) THEN
    RAISE EXCEPTION 'not authorized' USING ERRCODE = '42501';
  END IF;

  DELETE FROM public.driver_location_points
  WHERE recorded_at < now() - interval '90 days';

  GET DIAGNOSTICS v_deleted = ROW_COUNT;
  RETURN v_deleted;
END;
$$;

REVOKE ALL ON FUNCTION public.haversine_meters(numeric, numeric, numeric, numeric) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.get_campaign_qr_analytics(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.start_driver_tracking_session(uuid, text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.ingest_driver_location_point(uuid, numeric, numeric, numeric, numeric, numeric, timestamptz, jsonb) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.end_driver_tracking_session(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.get_my_tracking_status(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.revoke_driver_location_consent() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.get_driver_tracking_analytics(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.get_admin_driver_rankings(integer) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.purge_old_driver_location_points() FROM PUBLIC, anon;

GRANT EXECUTE ON FUNCTION public.haversine_meters(numeric, numeric, numeric, numeric) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.get_campaign_qr_analytics(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.start_driver_tracking_session(uuid, text) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.ingest_driver_location_point(uuid, numeric, numeric, numeric, numeric, numeric, timestamptz, jsonb) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.end_driver_tracking_session(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.get_my_tracking_status(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.revoke_driver_location_consent() TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.get_driver_tracking_analytics(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.get_admin_driver_rankings(integer) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.purge_old_driver_location_points() TO authenticated, service_role;

DO $$
BEGIN
  PERFORM cron.unschedule('driver_ads_purge_old_location_points');
EXCEPTION
  WHEN others THEN
    NULL;
END $$;

SELECT cron.schedule(
  'driver_ads_purge_old_location_points',
  '15 3 * * *',
  $$SELECT public.purge_old_driver_location_points();$$
);
