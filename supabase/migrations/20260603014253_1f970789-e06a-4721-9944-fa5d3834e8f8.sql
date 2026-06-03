-- Financeiro: pagamentos de anunciantes e repasses para motoristas

CREATE TYPE public.advertiser_payment_status AS ENUM ('pending', 'paid', 'overdue', 'cancelled');
CREATE TYPE public.driver_payout_status AS ENUM ('pending', 'processing', 'paid', 'cancelled');

-- Faturas dos anunciantes por campanha
CREATE TABLE public.advertiser_payments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id uuid NOT NULL,
  advertiser_id uuid NOT NULL,
  amount numeric NOT NULL DEFAULT 0,
  due_date date NOT NULL,
  paid_at timestamptz,
  status public.advertiser_payment_status NOT NULL DEFAULT 'pending',
  receipt_url text,
  notes text,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.advertiser_payments TO authenticated;
GRANT ALL ON public.advertiser_payments TO service_role;

ALTER TABLE public.advertiser_payments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Staff read all advertiser payments" ON public.advertiser_payments
  FOR SELECT TO authenticated USING (public.is_staff(auth.uid()));

CREATE POLICY "Advertiser reads own payments" ON public.advertiser_payments
  FOR SELECT TO authenticated USING (
    advertiser_id IN (SELECT id FROM public.advertisers WHERE user_id = auth.uid())
  );

CREATE POLICY "Staff inserts advertiser payment" ON public.advertiser_payments
  FOR INSERT TO authenticated WITH CHECK (public.is_staff(auth.uid()));

CREATE POLICY "Staff updates advertiser payment" ON public.advertiser_payments
  FOR UPDATE TO authenticated USING (public.is_staff(auth.uid()));

CREATE POLICY "Admin deletes advertiser payment" ON public.advertiser_payments
  FOR DELETE TO authenticated USING (public.has_role(auth.uid(), 'admin'::app_role));

CREATE TRIGGER trg_advertiser_payments_updated
  BEFORE UPDATE ON public.advertiser_payments
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE INDEX idx_adv_payments_campaign ON public.advertiser_payments(campaign_id);
CREATE INDEX idx_adv_payments_advertiser ON public.advertiser_payments(advertiser_id);
CREATE INDEX idx_adv_payments_status ON public.advertiser_payments(status);

-- Repasses para motoristas (por assignment / mês de referência)
CREATE TABLE public.driver_payouts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  assignment_id uuid NOT NULL,
  driver_id uuid NOT NULL,
  reference_month date NOT NULL,
  amount numeric NOT NULL DEFAULT 0,
  status public.driver_payout_status NOT NULL DEFAULT 'pending',
  pix_key text,
  pix_key_type text,
  paid_at timestamptz,
  receipt_url text,
  notes text,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(assignment_id, reference_month)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.driver_payouts TO authenticated;
GRANT ALL ON public.driver_payouts TO service_role;

ALTER TABLE public.driver_payouts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Staff read all payouts" ON public.driver_payouts
  FOR SELECT TO authenticated USING (public.is_staff(auth.uid()));

CREATE POLICY "Driver reads own payouts" ON public.driver_payouts
  FOR SELECT TO authenticated USING (
    driver_id IN (SELECT id FROM public.drivers WHERE user_id = auth.uid())
  );

CREATE POLICY "Staff inserts payout" ON public.driver_payouts
  FOR INSERT TO authenticated WITH CHECK (public.is_staff(auth.uid()));

CREATE POLICY "Staff updates payout" ON public.driver_payouts
  FOR UPDATE TO authenticated USING (public.is_staff(auth.uid()));

CREATE POLICY "Admin deletes payout" ON public.driver_payouts
  FOR DELETE TO authenticated USING (public.has_role(auth.uid(), 'admin'::app_role));

CREATE TRIGGER trg_driver_payouts_updated
  BEFORE UPDATE ON public.driver_payouts
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE INDEX idx_payouts_assignment ON public.driver_payouts(assignment_id);
CREATE INDEX idx_payouts_driver ON public.driver_payouts(driver_id);
CREATE INDEX idx_payouts_status ON public.driver_payouts(status);
CREATE INDEX idx_payouts_month ON public.driver_payouts(reference_month);

-- Storage policies for payment-receipts bucket (private)
CREATE POLICY "Staff read receipts" ON storage.objects
  FOR SELECT TO authenticated
  USING (bucket_id = 'payment-receipts' AND public.is_staff(auth.uid()));

CREATE POLICY "Staff upload receipts" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'payment-receipts' AND public.is_staff(auth.uid()));

CREATE POLICY "Staff update receipts" ON storage.objects
  FOR UPDATE TO authenticated
  USING (bucket_id = 'payment-receipts' AND public.is_staff(auth.uid()));

CREATE POLICY "Staff delete receipts" ON storage.objects
  FOR DELETE TO authenticated
  USING (bucket_id = 'payment-receipts' AND public.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Advertiser reads own receipts" ON storage.objects
  FOR SELECT TO authenticated
  USING (
    bucket_id = 'payment-receipts'
    AND (storage.foldername(name))[1] = 'advertisers'
    AND EXISTS (
      SELECT 1 FROM public.advertisers a
      WHERE a.user_id = auth.uid()
      AND (storage.foldername(name))[2] = a.id::text
    )
  );

CREATE POLICY "Driver reads own receipts" ON storage.objects
  FOR SELECT TO authenticated
  USING (
    bucket_id = 'payment-receipts'
    AND (storage.foldername(name))[1] = 'drivers'
    AND EXISTS (
      SELECT 1 FROM public.drivers d
      WHERE d.user_id = auth.uid()
      AND (storage.foldername(name))[2] = d.id::text
    )
  );