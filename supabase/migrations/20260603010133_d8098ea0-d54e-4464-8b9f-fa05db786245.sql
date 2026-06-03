-- ENUMS
CREATE TYPE public.campaign_status AS ENUM ('draft','pending_review','approved','rejected','active','paused','completed','cancelled');
CREATE TYPE public.assignment_status AS ENUM ('invited','accepted','declined','awaiting_installation','active','paused','completed','cancelled');
CREATE TYPE public.proof_status AS ENUM ('pending_review','approved','rejected','resubmission_requested');
CREATE TYPE public.campaign_asset_type AS ENUM ('art','briefing','contract','other');

-- CAMPAIGNS
CREATE TABLE public.campaigns (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  advertiser_id uuid NOT NULL REFERENCES public.advertisers(id) ON DELETE CASCADE,
  name text NOT NULL,
  description text,
  city text NOT NULL,
  regions text[] NOT NULL DEFAULT '{}',
  vehicles_qty integer NOT NULL DEFAULT 1 CHECK (vehicles_qty > 0),
  period_start date NOT NULL,
  period_end date NOT NULL,
  plan_value numeric(12,2) NOT NULL DEFAULT 0 CHECK (plan_value >= 0),
  art_url text,
  observations text,
  status public.campaign_status NOT NULL DEFAULT 'pending_review',
  created_by uuid,
  approved_by uuid,
  approved_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK (period_end >= period_start)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.campaigns TO authenticated;
GRANT ALL ON public.campaigns TO service_role;
ALTER TABLE public.campaigns ENABLE ROW LEVEL SECURITY;
CREATE INDEX idx_campaigns_advertiser ON public.campaigns(advertiser_id);
CREATE INDEX idx_campaigns_status ON public.campaigns(status);
CREATE TRIGGER trg_campaigns_updated_at BEFORE UPDATE ON public.campaigns
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- CAMPAIGN ASSETS
CREATE TABLE public.campaign_assets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id uuid NOT NULL REFERENCES public.campaigns(id) ON DELETE CASCADE,
  file_url text NOT NULL,
  type public.campaign_asset_type NOT NULL DEFAULT 'art',
  uploaded_by uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.campaign_assets TO authenticated;
GRANT ALL ON public.campaign_assets TO service_role;
ALTER TABLE public.campaign_assets ENABLE ROW LEVEL SECURITY;
CREATE INDEX idx_campaign_assets_campaign ON public.campaign_assets(campaign_id);

-- ASSIGNMENTS
CREATE TABLE public.campaign_driver_assignments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id uuid NOT NULL REFERENCES public.campaigns(id) ON DELETE CASCADE,
  driver_id uuid NOT NULL REFERENCES public.drivers(id) ON DELETE CASCADE,
  vehicle_id uuid NOT NULL REFERENCES public.vehicles(id) ON DELETE RESTRICT,
  status public.assignment_status NOT NULL DEFAULT 'invited',
  monthly_payout numeric(12,2) NOT NULL DEFAULT 0 CHECK (monthly_payout >= 0),
  assigned_by uuid,
  notes text,
  responded_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (campaign_id, vehicle_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.campaign_driver_assignments TO authenticated;
GRANT ALL ON public.campaign_driver_assignments TO service_role;
ALTER TABLE public.campaign_driver_assignments ENABLE ROW LEVEL SECURITY;
CREATE INDEX idx_cda_campaign ON public.campaign_driver_assignments(campaign_id);
CREATE INDEX idx_cda_driver ON public.campaign_driver_assignments(driver_id);
CREATE INDEX idx_cda_status ON public.campaign_driver_assignments(status);
CREATE TRIGGER trg_cda_updated_at BEFORE UPDATE ON public.campaign_driver_assignments
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- INSTALLATION PROOFS
CREATE TABLE public.installation_proofs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  assignment_id uuid NOT NULL REFERENCES public.campaign_driver_assignments(id) ON DELETE CASCADE,
  photo_url text NOT NULL,
  submitted_at timestamptz NOT NULL DEFAULT now(),
  geo_lat numeric(9,6),
  geo_lng numeric(9,6),
  observation text,
  status public.proof_status NOT NULL DEFAULT 'pending_review',
  reviewed_by uuid,
  reviewed_at timestamptz,
  rejection_reason text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.installation_proofs TO authenticated;
GRANT ALL ON public.installation_proofs TO service_role;
ALTER TABLE public.installation_proofs ENABLE ROW LEVEL SECURITY;
CREATE INDEX idx_proofs_assignment ON public.installation_proofs(assignment_id);
CREATE INDEX idx_proofs_status ON public.installation_proofs(status);
CREATE TRIGGER trg_proofs_updated_at BEFORE UPDATE ON public.installation_proofs
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ===== POLICIES: CAMPAIGNS =====
CREATE POLICY "Staff read all campaigns" ON public.campaigns FOR SELECT TO authenticated USING (public.is_staff(auth.uid()));
CREATE POLICY "Advertiser reads own campaigns" ON public.campaigns FOR SELECT TO authenticated
  USING (advertiser_id IN (SELECT id FROM public.advertisers WHERE user_id = auth.uid()));
CREATE POLICY "Driver reads assigned campaigns" ON public.campaigns FOR SELECT TO authenticated
  USING (id IN (SELECT cda.campaign_id FROM public.campaign_driver_assignments cda JOIN public.drivers d ON d.id = cda.driver_id WHERE d.user_id = auth.uid()));
CREATE POLICY "Advertiser creates own campaign" ON public.campaigns FOR INSERT TO authenticated
  WITH CHECK (advertiser_id IN (SELECT id FROM public.advertisers WHERE user_id = auth.uid()));
CREATE POLICY "Advertiser updates own campaign" ON public.campaigns FOR UPDATE TO authenticated
  USING (advertiser_id IN (SELECT id FROM public.advertisers WHERE user_id = auth.uid()))
  WITH CHECK (advertiser_id IN (SELECT id FROM public.advertisers WHERE user_id = auth.uid()));
CREATE POLICY "Admin updates any campaign" ON public.campaigns FOR UPDATE TO authenticated USING (public.has_role(auth.uid(),'admin'));
CREATE POLICY "Admin deletes campaign" ON public.campaigns FOR DELETE TO authenticated USING (public.has_role(auth.uid(),'admin'));

-- ===== POLICIES: ASSETS =====
CREATE POLICY "Staff read all assets" ON public.campaign_assets FOR SELECT TO authenticated USING (public.is_staff(auth.uid()));
CREATE POLICY "Advertiser reads own campaign assets" ON public.campaign_assets FOR SELECT TO authenticated
  USING (campaign_id IN (SELECT c.id FROM public.campaigns c JOIN public.advertisers a ON a.id = c.advertiser_id WHERE a.user_id = auth.uid()));
CREATE POLICY "Driver reads assets of assigned campaigns" ON public.campaign_assets FOR SELECT TO authenticated
  USING (campaign_id IN (SELECT cda.campaign_id FROM public.campaign_driver_assignments cda JOIN public.drivers d ON d.id = cda.driver_id WHERE d.user_id = auth.uid()));
CREATE POLICY "Advertiser inserts assets on own campaign" ON public.campaign_assets FOR INSERT TO authenticated
  WITH CHECK (campaign_id IN (SELECT c.id FROM public.campaigns c JOIN public.advertisers a ON a.id = c.advertiser_id WHERE a.user_id = auth.uid()));
CREATE POLICY "Staff inserts assets" ON public.campaign_assets FOR INSERT TO authenticated WITH CHECK (public.is_staff(auth.uid()));
CREATE POLICY "Admin updates any asset" ON public.campaign_assets FOR UPDATE TO authenticated USING (public.has_role(auth.uid(),'admin'));
CREATE POLICY "Admin deletes asset" ON public.campaign_assets FOR DELETE TO authenticated USING (public.has_role(auth.uid(),'admin'));

-- ===== POLICIES: ASSIGNMENTS =====
CREATE POLICY "Staff read all assignments" ON public.campaign_driver_assignments FOR SELECT TO authenticated USING (public.is_staff(auth.uid()));
CREATE POLICY "Driver reads own assignments" ON public.campaign_driver_assignments FOR SELECT TO authenticated
  USING (driver_id IN (SELECT id FROM public.drivers WHERE user_id = auth.uid()));
CREATE POLICY "Advertiser reads assignments of own campaigns" ON public.campaign_driver_assignments FOR SELECT TO authenticated
  USING (campaign_id IN (SELECT c.id FROM public.campaigns c JOIN public.advertisers a ON a.id = c.advertiser_id WHERE a.user_id = auth.uid()));
CREATE POLICY "Staff inserts assignment" ON public.campaign_driver_assignments FOR INSERT TO authenticated WITH CHECK (public.is_staff(auth.uid()));
CREATE POLICY "Staff updates assignment" ON public.campaign_driver_assignments FOR UPDATE TO authenticated USING (public.is_staff(auth.uid()));
CREATE POLICY "Driver updates own assignment status" ON public.campaign_driver_assignments FOR UPDATE TO authenticated
  USING (driver_id IN (SELECT id FROM public.drivers WHERE user_id = auth.uid()))
  WITH CHECK (driver_id IN (SELECT id FROM public.drivers WHERE user_id = auth.uid()));
CREATE POLICY "Admin deletes assignment" ON public.campaign_driver_assignments FOR DELETE TO authenticated USING (public.has_role(auth.uid(),'admin'));

-- ===== POLICIES: PROOFS =====
CREATE POLICY "Staff read all proofs" ON public.installation_proofs FOR SELECT TO authenticated USING (public.is_staff(auth.uid()));
CREATE POLICY "Driver reads own proofs" ON public.installation_proofs FOR SELECT TO authenticated
  USING (assignment_id IN (SELECT cda.id FROM public.campaign_driver_assignments cda JOIN public.drivers d ON d.id = cda.driver_id WHERE d.user_id = auth.uid()));
CREATE POLICY "Advertiser reads proofs of own campaigns" ON public.installation_proofs FOR SELECT TO authenticated
  USING (assignment_id IN (SELECT cda.id FROM public.campaign_driver_assignments cda JOIN public.campaigns c ON c.id = cda.campaign_id JOIN public.advertisers a ON a.id = c.advertiser_id WHERE a.user_id = auth.uid()));
CREATE POLICY "Driver inserts own proof" ON public.installation_proofs FOR INSERT TO authenticated
  WITH CHECK (assignment_id IN (SELECT cda.id FROM public.campaign_driver_assignments cda JOIN public.drivers d ON d.id = cda.driver_id WHERE d.user_id = auth.uid()));
CREATE POLICY "Staff updates proof" ON public.installation_proofs FOR UPDATE TO authenticated USING (public.is_staff(auth.uid()));
CREATE POLICY "Admin deletes proof" ON public.installation_proofs FOR DELETE TO authenticated USING (public.has_role(auth.uid(),'admin'));