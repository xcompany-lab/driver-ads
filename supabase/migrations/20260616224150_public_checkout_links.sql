-- Public checkout links let staff send a campaign payment URL to an advertiser
-- without requiring the advertiser to log in. The token is validated only by
-- Edge Functions using service role; anon gets no direct table access.

CREATE TABLE IF NOT EXISTS public.campaign_checkout_links (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id uuid NOT NULL REFERENCES public.campaigns(id) ON DELETE CASCADE,
  advertiser_id uuid NOT NULL REFERENCES public.advertisers(id) ON DELETE CASCADE,
  token text NOT NULL UNIQUE DEFAULT (
    replace(gen_random_uuid()::text, '-', '') || replace(gen_random_uuid()::text, '-', '')
  ),
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  expires_at timestamptz DEFAULT (now() + interval '30 days'),
  revoked_at timestamptz,
  last_accessed_at timestamptz,
  access_count integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_campaign_checkout_links_campaign
  ON public.campaign_checkout_links(campaign_id);

CREATE INDEX IF NOT EXISTS idx_campaign_checkout_links_token_active
  ON public.campaign_checkout_links(token)
  WHERE revoked_at IS NULL;

DROP TRIGGER IF EXISTS trg_campaign_checkout_links_updated ON public.campaign_checkout_links;
CREATE TRIGGER trg_campaign_checkout_links_updated
  BEFORE UPDATE ON public.campaign_checkout_links
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.campaign_checkout_links ENABLE ROW LEVEL SECURITY;

GRANT SELECT, INSERT, UPDATE ON public.campaign_checkout_links TO authenticated;
GRANT ALL ON public.campaign_checkout_links TO service_role;

DROP POLICY IF EXISTS "Staff manages campaign checkout links" ON public.campaign_checkout_links;
CREATE POLICY "Staff manages campaign checkout links"
  ON public.campaign_checkout_links
  FOR ALL
  TO authenticated
  USING (public.is_staff(auth.uid()))
  WITH CHECK (public.is_staff(auth.uid()));

CREATE OR REPLACE FUNCTION public.ensure_campaign_checkout_link(_campaign_id uuid)
RETURNS TABLE (
  token text,
  campaign_id uuid,
  advertiser_id uuid,
  expires_at timestamptz
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_campaign public.campaigns%ROWTYPE;
  v_link public.campaign_checkout_links%ROWTYPE;
BEGIN
  IF NOT public.is_staff(auth.uid()) THEN
    RAISE EXCEPTION 'forbidden';
  END IF;

  SELECT *
    INTO v_campaign
  FROM public.campaigns
  WHERE id = _campaign_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'campaign_not_found';
  END IF;

  SELECT *
    INTO v_link
  FROM public.campaign_checkout_links l
  WHERE l.campaign_id = _campaign_id
    AND l.revoked_at IS NULL
    AND (l.expires_at IS NULL OR l.expires_at > now())
  ORDER BY l.created_at DESC
  LIMIT 1;

  IF NOT FOUND THEN
    INSERT INTO public.campaign_checkout_links (
      campaign_id,
      advertiser_id,
      created_by
    )
    VALUES (
      v_campaign.id,
      v_campaign.advertiser_id,
      auth.uid()
    )
    RETURNING * INTO v_link;
  END IF;

  RETURN QUERY
  SELECT v_link.token, v_link.campaign_id, v_link.advertiser_id, v_link.expires_at;
END;
$$;

REVOKE ALL ON FUNCTION public.ensure_campaign_checkout_link(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.ensure_campaign_checkout_link(uuid) TO authenticated;
