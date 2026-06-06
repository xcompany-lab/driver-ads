
-- payouts: admin write
CREATE POLICY "Admins manage payouts" ON public.payouts
  FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'))
  WITH CHECK (has_role(auth.uid(), 'admin'));

-- payout_items: admin write
CREATE POLICY "Admins manage payout items" ON public.payout_items
  FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'))
  WITH CHECK (has_role(auth.uid(), 'admin'));
