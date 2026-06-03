-- =========================================================
-- Fase 14: Notifications, Activity Logs & LGPD primitives
-- =========================================================

CREATE TABLE public.notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  type text NOT NULL,
  title text NOT NULL,
  body text,
  link text,
  read_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, UPDATE, DELETE ON public.notifications TO authenticated;
GRANT ALL ON public.notifications TO service_role;

ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users read own notifications" ON public.notifications
  FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY "Staff read all notifications" ON public.notifications
  FOR SELECT TO authenticated USING (public.is_staff(auth.uid()));
CREATE POLICY "Users update own notifications" ON public.notifications
  FOR UPDATE TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
CREATE POLICY "Users delete own notifications" ON public.notifications
  FOR DELETE TO authenticated USING (user_id = auth.uid());

CREATE INDEX idx_notifications_user ON public.notifications(user_id, created_at DESC);
CREATE INDEX idx_notifications_unread ON public.notifications(user_id) WHERE read_at IS NULL;

-- Audit log
CREATE TABLE public.activity_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_id uuid,
  action text NOT NULL,
  entity_type text NOT NULL,
  entity_id uuid,
  payload jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.activity_logs TO authenticated;
GRANT ALL ON public.activity_logs TO service_role;

ALTER TABLE public.activity_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Staff read activity logs" ON public.activity_logs
  FOR SELECT TO authenticated USING (public.is_staff(auth.uid()));

CREATE INDEX idx_logs_entity ON public.activity_logs(entity_type, entity_id, created_at DESC);
CREATE INDEX idx_logs_actor ON public.activity_logs(actor_id, created_at DESC);

-- =====================================
-- Helper: enqueue notification (definer)
-- =====================================
CREATE OR REPLACE FUNCTION public.notify_user(
  _user_id uuid, _type text, _title text, _body text, _link text
) RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF _user_id IS NULL THEN RETURN; END IF;
  INSERT INTO public.notifications (user_id, type, title, body, link)
  VALUES (_user_id, _type, _title, _body, _link);
END $$;

-- =====================================
-- Triggers per entity
-- =====================================

-- Campaigns: notify advertiser owner + log
CREATE OR REPLACE FUNCTION public.emit_campaign_event()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_user uuid;
  v_label text;
BEGIN
  SELECT user_id INTO v_user FROM public.advertisers WHERE id = NEW.advertiser_id;
  IF TG_OP = 'INSERT' THEN
    INSERT INTO public.activity_logs(actor_id, action, entity_type, entity_id, payload)
    VALUES (auth.uid(), 'campaign.created', 'campaign', NEW.id, jsonb_build_object('status', NEW.status, 'name', NEW.name));
    PERFORM public.notify_user(v_user, 'campaign', 'Campanha criada', NEW.name || ' — em análise', '/anunciante');
    RETURN NEW;
  END IF;
  IF TG_OP = 'UPDATE' AND NEW.status IS DISTINCT FROM OLD.status THEN
    INSERT INTO public.activity_logs(actor_id, action, entity_type, entity_id, payload)
    VALUES (auth.uid(), 'campaign.status:' || NEW.status, 'campaign', NEW.id,
            jsonb_build_object('from', OLD.status, 'to', NEW.status));
    v_label := CASE NEW.status
      WHEN 'approved' THEN 'Campanha aprovada'
      WHEN 'active' THEN 'Campanha ativa'
      WHEN 'paused' THEN 'Campanha pausada'
      WHEN 'completed' THEN 'Campanha encerrada'
      WHEN 'canceled' THEN 'Campanha cancelada'
      ELSE 'Campanha atualizada' END;
    PERFORM public.notify_user(v_user, 'campaign', v_label, NEW.name, '/anunciante');
  END IF;
  RETURN NEW;
END $$;

CREATE TRIGGER trg_campaign_events
AFTER INSERT OR UPDATE ON public.campaigns
FOR EACH ROW EXECUTE FUNCTION public.emit_campaign_event();

-- Assignments: notify driver
CREATE OR REPLACE FUNCTION public.emit_assignment_event()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_user uuid;
  v_campaign text;
  v_label text;
BEGIN
  SELECT user_id INTO v_user FROM public.drivers WHERE id = NEW.driver_id;
  SELECT name INTO v_campaign FROM public.campaigns WHERE id = NEW.campaign_id;
  IF TG_OP = 'INSERT' THEN
    INSERT INTO public.activity_logs(actor_id, action, entity_type, entity_id, payload)
    VALUES (auth.uid(), 'assignment.created', 'assignment', NEW.id,
            jsonb_build_object('driver', NEW.driver_id, 'campaign', NEW.campaign_id));
    PERFORM public.notify_user(v_user, 'assignment', 'Novo convite de campanha', v_campaign, '/motorista/campanhas');
    RETURN NEW;
  END IF;
  IF TG_OP = 'UPDATE' AND NEW.status IS DISTINCT FROM OLD.status THEN
    INSERT INTO public.activity_logs(actor_id, action, entity_type, entity_id, payload)
    VALUES (auth.uid(), 'assignment.status:' || NEW.status, 'assignment', NEW.id,
            jsonb_build_object('from', OLD.status, 'to', NEW.status));
    v_label := CASE NEW.status
      WHEN 'awaiting_installation' THEN 'Instalação liberada'
      WHEN 'active' THEN 'Campanha ativa'
      WHEN 'declined' THEN 'Vínculo recusado'
      WHEN 'completed' THEN 'Vínculo encerrado'
      ELSE 'Vínculo atualizado' END;
    PERFORM public.notify_user(v_user, 'assignment', v_label, v_campaign, '/motorista/campanhas');
  END IF;
  RETURN NEW;
END $$;

CREATE TRIGGER trg_assignment_events
AFTER INSERT OR UPDATE ON public.campaign_driver_assignments
FOR EACH ROW EXECUTE FUNCTION public.emit_assignment_event();

-- Installation proofs: notify driver on review
CREATE OR REPLACE FUNCTION public.emit_proof_event()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_user uuid;
  v_label text;
BEGIN
  SELECT d.user_id INTO v_user
  FROM public.campaign_driver_assignments a
  JOIN public.drivers d ON d.id = a.driver_id
  WHERE a.id = NEW.assignment_id;
  IF TG_OP = 'INSERT' THEN
    INSERT INTO public.activity_logs(actor_id, action, entity_type, entity_id, payload)
    VALUES (auth.uid(), 'proof.submitted', 'proof', NEW.id, jsonb_build_object('assignment', NEW.assignment_id));
    RETURN NEW;
  END IF;
  IF TG_OP = 'UPDATE' AND NEW.status IS DISTINCT FROM OLD.status THEN
    INSERT INTO public.activity_logs(actor_id, action, entity_type, entity_id, payload)
    VALUES (auth.uid(), 'proof.status:' || NEW.status, 'proof', NEW.id,
            jsonb_build_object('from', OLD.status, 'to', NEW.status, 'reason', NEW.rejection_reason));
    v_label := CASE NEW.status
      WHEN 'approved' THEN 'Comprovante aprovado'
      WHEN 'rejected' THEN 'Comprovante reprovado'
      WHEN 'resubmission_requested' THEN 'Reenvio de foto solicitado'
      ELSE 'Comprovante atualizado' END;
    PERFORM public.notify_user(v_user, 'proof', v_label, COALESCE(NEW.rejection_reason, 'Confira na área do motorista.'), '/motorista/comprovacoes');
  END IF;
  RETURN NEW;
END $$;

CREATE TRIGGER trg_proof_events
AFTER INSERT OR UPDATE ON public.installation_proofs
FOR EACH ROW EXECUTE FUNCTION public.emit_proof_event();

-- Advertiser payments: notify advertiser
CREATE OR REPLACE FUNCTION public.emit_adv_payment_event()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_user uuid;
BEGIN
  SELECT user_id INTO v_user FROM public.advertisers WHERE id = NEW.advertiser_id;
  IF TG_OP = 'INSERT' THEN
    INSERT INTO public.activity_logs(actor_id, action, entity_type, entity_id, payload)
    VALUES (auth.uid(), 'invoice.created', 'invoice', NEW.id, jsonb_build_object('amount', NEW.amount, 'due', NEW.due_date));
    PERFORM public.notify_user(v_user, 'invoice', 'Nova fatura',
      'R$ ' || NEW.amount::text || ' — vence em ' || NEW.due_date::text, '/anunciante/financeiro');
    RETURN NEW;
  END IF;
  IF TG_OP = 'UPDATE' AND NEW.status IS DISTINCT FROM OLD.status THEN
    INSERT INTO public.activity_logs(actor_id, action, entity_type, entity_id, payload)
    VALUES (auth.uid(), 'invoice.status:' || NEW.status, 'invoice', NEW.id,
            jsonb_build_object('from', OLD.status, 'to', NEW.status));
    IF NEW.status = 'paid' THEN
      PERFORM public.notify_user(v_user, 'invoice', 'Fatura quitada',
        'Recebemos o pagamento da fatura.', '/anunciante/financeiro');
    END IF;
  END IF;
  RETURN NEW;
END $$;

CREATE TRIGGER trg_adv_payment_events
AFTER INSERT OR UPDATE ON public.advertiser_payments
FOR EACH ROW EXECUTE FUNCTION public.emit_adv_payment_event();

-- Driver payouts: notify driver
CREATE OR REPLACE FUNCTION public.emit_payout_event()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_user uuid;
BEGIN
  SELECT user_id INTO v_user FROM public.drivers WHERE id = NEW.driver_id;
  IF TG_OP = 'INSERT' THEN
    INSERT INTO public.activity_logs(actor_id, action, entity_type, entity_id, payload)
    VALUES (auth.uid(), 'payout.created', 'payout', NEW.id, jsonb_build_object('amount', NEW.amount, 'month', NEW.reference_month));
    RETURN NEW;
  END IF;
  IF TG_OP = 'UPDATE' AND NEW.status IS DISTINCT FROM OLD.status THEN
    INSERT INTO public.activity_logs(actor_id, action, entity_type, entity_id, payload)
    VALUES (auth.uid(), 'payout.status:' || NEW.status, 'payout', NEW.id,
            jsonb_build_object('from', OLD.status, 'to', NEW.status));
    IF NEW.status = 'paid' THEN
      PERFORM public.notify_user(v_user, 'payout', 'Repasse enviado',
        'R$ ' || NEW.amount::text || ' referente a ' || to_char(NEW.reference_month, 'MM/YYYY'),
        '/motorista/ganhos');
    END IF;
  END IF;
  RETURN NEW;
END $$;

CREATE TRIGGER trg_payout_events
AFTER INSERT OR UPDATE ON public.driver_payouts
FOR EACH ROW EXECUTE FUNCTION public.emit_payout_event();