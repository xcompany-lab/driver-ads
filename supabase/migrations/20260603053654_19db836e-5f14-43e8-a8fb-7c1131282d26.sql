ALTER TABLE public.drivers
  ADD COLUMN IF NOT EXISTS cnh_front_url text,
  ADD COLUMN IF NOT EXISTS selfie_doc_url text,
  ADD COLUMN IF NOT EXISTS address_proof_url text;

ALTER TABLE public.vehicles
  ADD COLUMN IF NOT EXISTS crlv_url text;

CREATE POLICY "Drivers can upload own driver documents"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'driver-documents'
  AND auth.uid()::text = (storage.foldername(name))[1]
);

CREATE POLICY "Drivers can update own driver documents"
ON storage.objects
FOR UPDATE
TO authenticated
USING (
  bucket_id = 'driver-documents'
  AND auth.uid()::text = (storage.foldername(name))[1]
)
WITH CHECK (
  bucket_id = 'driver-documents'
  AND auth.uid()::text = (storage.foldername(name))[1]
);

CREATE POLICY "Drivers can read own driver documents"
ON storage.objects
FOR SELECT
TO authenticated
USING (
  bucket_id = 'driver-documents'
  AND auth.uid()::text = (storage.foldername(name))[1]
);

CREATE POLICY "Staff can read driver documents"
ON storage.objects
FOR SELECT
TO authenticated
USING (
  bucket_id = 'driver-documents'
  AND public.is_staff(auth.uid())
);