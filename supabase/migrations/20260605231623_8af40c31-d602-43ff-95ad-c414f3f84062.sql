CREATE OR REPLACE FUNCTION public.user_owns_advertiser(_user_id uuid, _advertiser_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.advertisers a
    WHERE a.id = _advertiser_id
      AND a.user_id = _user_id
  )
$$;

CREATE OR REPLACE FUNCTION public.user_owns_campaign(_user_id uuid, _campaign_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.campaigns c
    JOIN public.advertisers a ON a.id = c.advertiser_id
    WHERE c.id = _campaign_id
      AND a.user_id = _user_id
  )
$$;

CREATE OR REPLACE FUNCTION public.driver_is_assigned_to_campaign(_user_id uuid, _campaign_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.campaign_driver_assignments cda
    JOIN public.drivers d ON d.id = cda.driver_id
    WHERE cda.campaign_id = _campaign_id
      AND d.user_id = _user_id
  )
$$;

CREATE OR REPLACE FUNCTION public.driver_owns_assignment(_user_id uuid, _assignment_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.campaign_driver_assignments cda
    JOIN public.drivers d ON d.id = cda.driver_id
    WHERE cda.id = _assignment_id
      AND d.user_id = _user_id
  )
$$;

DROP POLICY IF EXISTS "Advertiser reads own campaigns" ON public.campaigns;
DROP POLICY IF EXISTS "Driver reads assigned campaigns" ON public.campaigns;
DROP POLICY IF EXISTS "Advertiser creates own campaign" ON public.campaigns;
DROP POLICY IF EXISTS "Advertiser updates own campaign" ON public.campaigns;

CREATE POLICY "Advertiser reads own campaigns" ON public.campaigns
FOR SELECT TO authenticated
USING (public.user_owns_advertiser(auth.uid(), advertiser_id));

CREATE POLICY "Driver reads assigned campaigns" ON public.campaigns
FOR SELECT TO authenticated
USING (public.driver_is_assigned_to_campaign(auth.uid(), id));

CREATE POLICY "Advertiser creates own campaign" ON public.campaigns
FOR INSERT TO authenticated
WITH CHECK (public.user_owns_advertiser(auth.uid(), advertiser_id));

CREATE POLICY "Advertiser updates own campaign" ON public.campaigns
FOR UPDATE TO authenticated
USING (public.user_owns_advertiser(auth.uid(), advertiser_id))
WITH CHECK (public.user_owns_advertiser(auth.uid(), advertiser_id));

DROP POLICY IF EXISTS "Advertiser reads own campaign assets" ON public.campaign_assets;
DROP POLICY IF EXISTS "Driver reads assets of assigned campaigns" ON public.campaign_assets;
DROP POLICY IF EXISTS "Advertiser inserts assets on own campaign" ON public.campaign_assets;

CREATE POLICY "Advertiser reads own campaign assets" ON public.campaign_assets
FOR SELECT TO authenticated
USING (public.user_owns_campaign(auth.uid(), campaign_id));

CREATE POLICY "Driver reads assets of assigned campaigns" ON public.campaign_assets
FOR SELECT TO authenticated
USING (public.driver_is_assigned_to_campaign(auth.uid(), campaign_id));

CREATE POLICY "Advertiser inserts assets on own campaign" ON public.campaign_assets
FOR INSERT TO authenticated
WITH CHECK (public.user_owns_campaign(auth.uid(), campaign_id));

DROP POLICY IF EXISTS "Advertiser reads assignments of own campaigns" ON public.campaign_driver_assignments;
DROP POLICY IF EXISTS "Driver reads own assignments" ON public.campaign_driver_assignments;
DROP POLICY IF EXISTS "Driver updates own assignment status" ON public.campaign_driver_assignments;

CREATE POLICY "Advertiser reads assignments of own campaigns" ON public.campaign_driver_assignments
FOR SELECT TO authenticated
USING (public.user_owns_campaign(auth.uid(), campaign_id));

CREATE POLICY "Driver reads own assignments" ON public.campaign_driver_assignments
FOR SELECT TO authenticated
USING (driver_id IN (SELECT d.id FROM public.drivers d WHERE d.user_id = auth.uid()));

CREATE POLICY "Driver updates own assignment status" ON public.campaign_driver_assignments
FOR UPDATE TO authenticated
USING (driver_id IN (SELECT d.id FROM public.drivers d WHERE d.user_id = auth.uid()))
WITH CHECK (driver_id IN (SELECT d.id FROM public.drivers d WHERE d.user_id = auth.uid()));

DROP POLICY IF EXISTS "Driver reads own proofs" ON public.installation_proofs;
DROP POLICY IF EXISTS "Advertiser reads proofs of own campaigns" ON public.installation_proofs;
DROP POLICY IF EXISTS "Driver inserts own proof" ON public.installation_proofs;

CREATE POLICY "Driver reads own proofs" ON public.installation_proofs
FOR SELECT TO authenticated
USING (public.driver_owns_assignment(auth.uid(), assignment_id));

CREATE POLICY "Advertiser reads proofs of own campaigns" ON public.installation_proofs
FOR SELECT TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.campaign_driver_assignments cda
    WHERE cda.id = assignment_id
      AND public.user_owns_campaign(auth.uid(), cda.campaign_id)
  )
);

CREATE POLICY "Driver inserts own proof" ON public.installation_proofs
FOR INSERT TO authenticated
WITH CHECK (public.driver_owns_assignment(auth.uid(), assignment_id));