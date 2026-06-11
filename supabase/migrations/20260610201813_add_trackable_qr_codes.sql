DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'qr_destination_type') THEN
    CREATE TYPE public.qr_destination_type AS ENUM ('whatsapp', 'landing_page');
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS public.campaign_qr_codes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id uuid NOT NULL UNIQUE REFERENCES public.campaigns(id) ON DELETE CASCADE,
  advertiser_id uuid NOT NULL REFERENCES public.advertisers(id) ON DELETE CASCADE,
  destination_type public.qr_destination_type NOT NULL,
  destination_url text NOT NULL,
  whatsapp_phone text,
  landing_page_url text,
  short_code text NOT NULL UNIQUE DEFAULT lower(substr(replace(gen_random_uuid()::text, '-', ''), 1, 12)),
  is_active boolean NOT NULL DEFAULT true,
  qr_position jsonb NOT NULL DEFAULT '{"x":0.76,"y":0.68,"size":0.18}'::jsonb,
  final_image_url text,
  final_pdf_url text,
  generated_at timestamptz,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT campaign_qr_codes_destination_url_check CHECK (destination_url ~* '^https?://'),
  CONSTRAINT campaign_qr_codes_landing_required_check CHECK (
    destination_type <> 'landing_page'::public.qr_destination_type
    OR (landing_page_url IS NOT NULL AND landing_page_url ~* '^https?://')
  ),
  CONSTRAINT campaign_qr_codes_whatsapp_required_check CHECK (
    destination_type <> 'whatsapp'::public.qr_destination_type
    OR (whatsapp_phone IS NOT NULL AND whatsapp_phone ~ '^[0-9]{10,15}$')
  )
);

CREATE INDEX IF NOT EXISTS idx_campaign_qr_codes_campaign ON public.campaign_qr_codes(campaign_id);
CREATE INDEX IF NOT EXISTS idx_campaign_qr_codes_advertiser ON public.campaign_qr_codes(advertiser_id);
CREATE INDEX IF NOT EXISTS idx_campaign_qr_codes_short_code ON public.campaign_qr_codes(short_code);

DROP TRIGGER IF EXISTS trg_campaign_qr_codes_updated_at ON public.campaign_qr_codes;
CREATE TRIGGER trg_campaign_qr_codes_updated_at
  BEFORE UPDATE ON public.campaign_qr_codes
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE IF NOT EXISTS public.campaign_qr_scans (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  qr_code_id uuid NOT NULL REFERENCES public.campaign_qr_codes(id) ON DELETE CASCADE,
  campaign_id uuid NOT NULL REFERENCES public.campaigns(id) ON DELETE CASCADE,
  advertiser_id uuid NOT NULL REFERENCES public.advertisers(id) ON DELETE CASCADE,
  scanned_at timestamptz NOT NULL DEFAULT now(),
  user_agent text,
  referrer text,
  ip_hash text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb
);

CREATE INDEX IF NOT EXISTS idx_campaign_qr_scans_qr_code ON public.campaign_qr_scans(qr_code_id);
CREATE INDEX IF NOT EXISTS idx_campaign_qr_scans_campaign ON public.campaign_qr_scans(campaign_id);
CREATE INDEX IF NOT EXISTS idx_campaign_qr_scans_advertiser_time ON public.campaign_qr_scans(advertiser_id, scanned_at DESC);

ALTER TABLE public.campaign_qr_codes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.campaign_qr_scans ENABLE ROW LEVEL SECURITY;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.campaign_qr_codes TO authenticated;
GRANT SELECT ON public.campaign_qr_scans TO authenticated;
GRANT ALL ON public.campaign_qr_codes TO service_role;
GRANT ALL ON public.campaign_qr_scans TO service_role;

DROP POLICY IF EXISTS "Staff read all campaign qr codes" ON public.campaign_qr_codes;
CREATE POLICY "Staff read all campaign qr codes"
ON public.campaign_qr_codes FOR SELECT
TO authenticated
USING (public.is_staff(auth.uid()));

DROP POLICY IF EXISTS "Advertiser reads own campaign qr codes" ON public.campaign_qr_codes;
CREATE POLICY "Advertiser reads own campaign qr codes"
ON public.campaign_qr_codes FOR SELECT
TO authenticated
USING (advertiser_id IN (SELECT id FROM public.advertisers WHERE user_id = auth.uid()));

DROP POLICY IF EXISTS "Advertiser upserts own campaign qr codes" ON public.campaign_qr_codes;
CREATE POLICY "Advertiser upserts own campaign qr codes"
ON public.campaign_qr_codes FOR INSERT
TO authenticated
WITH CHECK (
  advertiser_id IN (SELECT id FROM public.advertisers WHERE user_id = auth.uid())
  AND campaign_id IN (
    SELECT c.id
    FROM public.campaigns c
    WHERE c.advertiser_id = campaign_qr_codes.advertiser_id
  )
);

DROP POLICY IF EXISTS "Advertiser updates own campaign qr codes" ON public.campaign_qr_codes;
CREATE POLICY "Advertiser updates own campaign qr codes"
ON public.campaign_qr_codes FOR UPDATE
TO authenticated
USING (advertiser_id IN (SELECT id FROM public.advertisers WHERE user_id = auth.uid()))
WITH CHECK (
  advertiser_id IN (SELECT id FROM public.advertisers WHERE user_id = auth.uid())
  AND campaign_id IN (
    SELECT c.id
    FROM public.campaigns c
    WHERE c.advertiser_id = campaign_qr_codes.advertiser_id
  )
);

DROP POLICY IF EXISTS "Staff manage all campaign qr codes" ON public.campaign_qr_codes;
CREATE POLICY "Staff manage all campaign qr codes"
ON public.campaign_qr_codes FOR ALL
TO authenticated
USING (public.is_staff(auth.uid()))
WITH CHECK (public.is_staff(auth.uid()));

DROP POLICY IF EXISTS "Staff read all campaign qr scans" ON public.campaign_qr_scans;
CREATE POLICY "Staff read all campaign qr scans"
ON public.campaign_qr_scans FOR SELECT
TO authenticated
USING (public.is_staff(auth.uid()));

DROP POLICY IF EXISTS "Advertiser reads own campaign qr scans" ON public.campaign_qr_scans;
CREATE POLICY "Advertiser reads own campaign qr scans"
ON public.campaign_qr_scans FOR SELECT
TO authenticated
USING (advertiser_id IN (SELECT id FROM public.advertisers WHERE user_id = auth.uid()));
