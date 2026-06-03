-- Storage policies for the `installation-proofs` bucket.
-- Driver folder convention: `<user_id>/<assignment_id>/<file>`

CREATE POLICY "Driver uploads own installation proof"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'installation-proofs'
  AND auth.uid()::text = (storage.foldername(name))[1]
);

CREATE POLICY "Driver reads own installation proof"
ON storage.objects FOR SELECT TO authenticated
USING (
  bucket_id = 'installation-proofs'
  AND auth.uid()::text = (storage.foldername(name))[1]
);

CREATE POLICY "Driver updates own installation proof"
ON storage.objects FOR UPDATE TO authenticated
USING (
  bucket_id = 'installation-proofs'
  AND auth.uid()::text = (storage.foldername(name))[1]
);

CREATE POLICY "Staff reads all installation proofs"
ON storage.objects FOR SELECT TO authenticated
USING (bucket_id = 'installation-proofs' AND public.is_staff(auth.uid()));

CREATE POLICY "Staff manages installation proofs"
ON storage.objects FOR ALL TO authenticated
USING (bucket_id = 'installation-proofs' AND public.is_staff(auth.uid()))
WITH CHECK (bucket_id = 'installation-proofs' AND public.is_staff(auth.uid()));
