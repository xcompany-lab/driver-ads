DROP POLICY IF EXISTS "Admin creates any campaign" ON public.campaigns;

CREATE POLICY "Admin creates any campaign"
ON public.campaigns
FOR INSERT
TO authenticated
WITH CHECK (public.has_role(auth.uid(), 'admin'));
