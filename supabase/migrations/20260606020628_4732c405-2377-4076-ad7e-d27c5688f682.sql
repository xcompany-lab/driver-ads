
-- 1. Drop broad public-listing SELECT policies on public buckets.
--    Files remain accessible via their public URL; only LIST is removed.
DROP POLICY IF EXISTS "Avatars public read" ON storage.objects;
DROP POLICY IF EXISTS "Vehicles public read" ON storage.objects;

-- 2. Fix broken campaign-arts policy: was using c.name (campaign text name)
--    instead of objects.name (file path). Files live under {advertiser_id}/...
DROP POLICY IF EXISTS "Driver reads campaign arts of assigned campaigns" ON storage.objects;
CREATE POLICY "Driver reads campaign arts of assigned campaigns"
ON storage.objects FOR SELECT
USING (
  bucket_id = 'campaign-arts'
  AND EXISTS (
    SELECT 1
    FROM campaign_driver_assignments cda
    JOIN drivers d ON d.id = cda.driver_id
    JOIN campaigns c ON c.id = cda.campaign_id
    WHERE d.user_id = auth.uid()
      AND (storage.foldername(objects.name))[1] = (c.advertiser_id)::text
  )
);

-- 3. Remove dead policies referencing non-existent 'driver-documents' bucket.
DROP POLICY IF EXISTS "Drivers can read own driver documents" ON storage.objects;
DROP POLICY IF EXISTS "Drivers can update own driver documents" ON storage.objects;
DROP POLICY IF EXISTS "Drivers can upload own driver documents" ON storage.objects;
DROP POLICY IF EXISTS "Staff can read driver documents" ON storage.objects;

-- 4. Allow drivers to read their own ledger entries.
CREATE POLICY "Drivers read own ledger entries"
ON public.ledger_entries FOR SELECT
TO authenticated
USING (
  driver_id IN (SELECT id FROM public.drivers WHERE user_id = auth.uid())
);
