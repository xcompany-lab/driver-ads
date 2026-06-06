
CREATE POLICY "Staff updates earnings" ON public.driver_earnings
  FOR UPDATE TO authenticated
  USING (public.is_staff(auth.uid()))
  WITH CHECK (public.is_staff(auth.uid()));

CREATE POLICY "Staff deletes earnings" ON public.driver_earnings
  FOR DELETE TO authenticated
  USING (public.is_staff(auth.uid()));
