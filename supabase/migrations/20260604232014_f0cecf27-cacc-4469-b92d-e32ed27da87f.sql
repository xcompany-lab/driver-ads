
-- ============================================================
-- 1) STORAGE RLS for avatars, vehicles, campaign-arts buckets
-- ============================================================

-- AVATARS (public read; user-scoped writes under folder = auth.uid())
DROP POLICY IF EXISTS "Avatars public read" ON storage.objects;
CREATE POLICY "Avatars public read"
ON storage.objects FOR SELECT
TO public
USING (bucket_id = 'avatars');

DROP POLICY IF EXISTS "Users upload own avatar" ON storage.objects;
CREATE POLICY "Users upload own avatar"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'avatars'
  AND (storage.foldername(name))[1] = (auth.uid())::text
);

DROP POLICY IF EXISTS "Users update own avatar" ON storage.objects;
CREATE POLICY "Users update own avatar"
ON storage.objects FOR UPDATE
TO authenticated
USING (
  bucket_id = 'avatars'
  AND (storage.foldername(name))[1] = (auth.uid())::text
)
WITH CHECK (
  bucket_id = 'avatars'
  AND (storage.foldername(name))[1] = (auth.uid())::text
);

DROP POLICY IF EXISTS "Users delete own avatar" ON storage.objects;
CREATE POLICY "Users delete own avatar"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'avatars'
  AND (storage.foldername(name))[1] = (auth.uid())::text
);

-- VEHICLES (public read; owner-scoped writes via drivers.user_id)
DROP POLICY IF EXISTS "Vehicles public read" ON storage.objects;
CREATE POLICY "Vehicles public read"
ON storage.objects FOR SELECT
TO public
USING (bucket_id = 'vehicles');

DROP POLICY IF EXISTS "Driver uploads own vehicle photo" ON storage.objects;
CREATE POLICY "Driver uploads own vehicle photo"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'vehicles'
  AND EXISTS (
    SELECT 1 FROM public.drivers d
    WHERE d.user_id = auth.uid()
      AND (storage.foldername(name))[1] = (d.id)::text
  )
);

DROP POLICY IF EXISTS "Driver updates own vehicle photo" ON storage.objects;
CREATE POLICY "Driver updates own vehicle photo"
ON storage.objects FOR UPDATE
TO authenticated
USING (
  bucket_id = 'vehicles'
  AND EXISTS (
    SELECT 1 FROM public.drivers d
    WHERE d.user_id = auth.uid()
      AND (storage.foldername(name))[1] = (d.id)::text
  )
)
WITH CHECK (
  bucket_id = 'vehicles'
  AND EXISTS (
    SELECT 1 FROM public.drivers d
    WHERE d.user_id = auth.uid()
      AND (storage.foldername(name))[1] = (d.id)::text
  )
);

DROP POLICY IF EXISTS "Driver deletes own vehicle photo" ON storage.objects;
CREATE POLICY "Driver deletes own vehicle photo"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'vehicles'
  AND EXISTS (
    SELECT 1 FROM public.drivers d
    WHERE d.user_id = auth.uid()
      AND (storage.foldername(name))[1] = (d.id)::text
  )
);

DROP POLICY IF EXISTS "Staff manages vehicle photos" ON storage.objects;
CREATE POLICY "Staff manages vehicle photos"
ON storage.objects FOR ALL
TO authenticated
USING (bucket_id = 'vehicles' AND public.is_staff(auth.uid()))
WITH CHECK (bucket_id = 'vehicles' AND public.is_staff(auth.uid()));

-- CAMPAIGN-ARTS (private; advertiser owner + staff)
-- Path convention: <advertiser_id>/<campaign_id>/...
DROP POLICY IF EXISTS "Advertiser reads own campaign arts" ON storage.objects;
CREATE POLICY "Advertiser reads own campaign arts"
ON storage.objects FOR SELECT
TO authenticated
USING (
  bucket_id = 'campaign-arts'
  AND EXISTS (
    SELECT 1 FROM public.advertisers a
    WHERE a.user_id = auth.uid()
      AND (storage.foldername(name))[1] = (a.id)::text
  )
);

DROP POLICY IF EXISTS "Advertiser uploads own campaign arts" ON storage.objects;
CREATE POLICY "Advertiser uploads own campaign arts"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'campaign-arts'
  AND EXISTS (
    SELECT 1 FROM public.advertisers a
    WHERE a.user_id = auth.uid()
      AND (storage.foldername(name))[1] = (a.id)::text
  )
);

DROP POLICY IF EXISTS "Advertiser updates own campaign arts" ON storage.objects;
CREATE POLICY "Advertiser updates own campaign arts"
ON storage.objects FOR UPDATE
TO authenticated
USING (
  bucket_id = 'campaign-arts'
  AND EXISTS (
    SELECT 1 FROM public.advertisers a
    WHERE a.user_id = auth.uid()
      AND (storage.foldername(name))[1] = (a.id)::text
  )
)
WITH CHECK (
  bucket_id = 'campaign-arts'
  AND EXISTS (
    SELECT 1 FROM public.advertisers a
    WHERE a.user_id = auth.uid()
      AND (storage.foldername(name))[1] = (a.id)::text
  )
);

DROP POLICY IF EXISTS "Advertiser deletes own campaign arts" ON storage.objects;
CREATE POLICY "Advertiser deletes own campaign arts"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'campaign-arts'
  AND EXISTS (
    SELECT 1 FROM public.advertisers a
    WHERE a.user_id = auth.uid()
      AND (storage.foldername(name))[1] = (a.id)::text
  )
);

DROP POLICY IF EXISTS "Driver reads campaign arts of assigned campaigns" ON storage.objects;
CREATE POLICY "Driver reads campaign arts of assigned campaigns"
ON storage.objects FOR SELECT
TO authenticated
USING (
  bucket_id = 'campaign-arts'
  AND EXISTS (
    SELECT 1
    FROM public.campaign_driver_assignments cda
    JOIN public.drivers d ON d.id = cda.driver_id
    JOIN public.campaigns c ON c.id = cda.campaign_id
    WHERE d.user_id = auth.uid()
      AND (storage.foldername(name))[2] = (c.id)::text
  )
);

DROP POLICY IF EXISTS "Staff manages campaign arts" ON storage.objects;
CREATE POLICY "Staff manages campaign arts"
ON storage.objects FOR ALL
TO authenticated
USING (bucket_id = 'campaign-arts' AND public.is_staff(auth.uid()))
WITH CHECK (bucket_id = 'campaign-arts' AND public.is_staff(auth.uid()));


-- ============================================================
-- 2) Lock down driver updates on campaign_driver_assignments
-- ============================================================
CREATE OR REPLACE FUNCTION public.guard_driver_assignment_update()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Staff can change anything
  IF public.is_staff(auth.uid()) THEN
    RETURN NEW;
  END IF;

  -- Drivers (non-staff) may only touch status / responded_at / notes / updated_at.
  -- Any change to other columns is rejected.
  IF NEW.campaign_id     IS DISTINCT FROM OLD.campaign_id
     OR NEW.driver_id    IS DISTINCT FROM OLD.driver_id
     OR NEW.vehicle_id   IS DISTINCT FROM OLD.vehicle_id
     OR NEW.assigned_by  IS DISTINCT FROM OLD.assigned_by
     OR NEW.monthly_payout IS DISTINCT FROM OLD.monthly_payout
     OR NEW.created_at   IS DISTINCT FROM OLD.created_at
  THEN
    RAISE EXCEPTION 'Drivers may only update status, notes and responded_at'
      USING ERRCODE = '42501';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_guard_driver_assignment_update ON public.campaign_driver_assignments;
CREATE TRIGGER trg_guard_driver_assignment_update
BEFORE UPDATE ON public.campaign_driver_assignments
FOR EACH ROW
EXECUTE FUNCTION public.guard_driver_assignment_update();


-- ============================================================
-- 3) Revoke EXECUTE on internal SECURITY DEFINER helpers that
--    should only be invoked from triggers/server code, not API.
-- ============================================================
REVOKE EXECUTE ON FUNCTION public.enqueue_email(text, text, text, jsonb)
  FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.notify_user(uuid, text, text, text, text)
  FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.handle_new_user()
  FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.set_updated_at()
  FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.emit_campaign_event()
  FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.emit_assignment_event()
  FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.emit_proof_event()
  FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.emit_adv_payment_event()
  FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.emit_payout_event()
  FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.email_on_advertiser_status()
  FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.email_on_driver_status()
  FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.email_on_assignment_invite()
  FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.email_on_proof_reviewed()
  FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.email_on_payout_paid()
  FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.email_on_adv_payment()
  FROM PUBLIC, anon, authenticated;
