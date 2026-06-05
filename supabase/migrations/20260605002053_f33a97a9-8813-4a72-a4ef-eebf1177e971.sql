CREATE TABLE public.email_diagnostics (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  flow text NOT NULL,
  step text NOT NULL,
  status text NOT NULL CHECK (status IN ('started', 'success', 'skipped', 'failed')),
  recipient_email text,
  error_message text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.email_diagnostics TO authenticated;
GRANT ALL ON public.email_diagnostics TO service_role;

ALTER TABLE public.email_diagnostics ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Staff can read email diagnostics"
ON public.email_diagnostics
FOR SELECT
TO authenticated
USING (public.is_staff(auth.uid()));

CREATE OR REPLACE FUNCTION public.log_email_diagnostic(
  _flow text,
  _step text,
  _status text,
  _recipient_email text DEFAULT NULL,
  _error_message text DEFAULT NULL,
  _metadata jsonb DEFAULT '{}'::jsonb
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_id uuid;
BEGIN
  IF _flow IS NULL OR length(_flow) < 1 OR length(_flow) > 80 THEN
    RAISE EXCEPTION 'Invalid flow';
  END IF;
  IF _step IS NULL OR length(_step) < 1 OR length(_step) > 80 THEN
    RAISE EXCEPTION 'Invalid step';
  END IF;
  IF _status NOT IN ('started', 'success', 'skipped', 'failed') THEN
    RAISE EXCEPTION 'Invalid status';
  END IF;

  INSERT INTO public.email_diagnostics (flow, step, status, recipient_email, error_message, metadata)
  VALUES (
    left(_flow, 80),
    left(_step, 80),
    _status,
    nullif(left(coalesce(_recipient_email, ''), 254), ''),
    nullif(left(coalesce(_error_message, ''), 1000), ''),
    coalesce(_metadata, '{}'::jsonb)
  )
  RETURNING id INTO v_id;

  RETURN v_id;
END;
$$;

REVOKE ALL ON FUNCTION public.log_email_diagnostic(text, text, text, text, text, jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.log_email_diagnostic(text, text, text, text, text, jsonb) TO anon;
GRANT EXECUTE ON FUNCTION public.log_email_diagnostic(text, text, text, text, text, jsonb) TO authenticated;
GRANT EXECUTE ON FUNCTION public.log_email_diagnostic(text, text, text, text, text, jsonb) TO service_role;