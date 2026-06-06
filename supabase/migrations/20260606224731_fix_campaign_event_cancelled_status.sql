CREATE OR REPLACE FUNCTION public.emit_campaign_event()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_user uuid;
  v_label text;
BEGIN
  SELECT user_id INTO v_user
  FROM public.advertisers
  WHERE id = NEW.advertiser_id;

  IF TG_OP = 'INSERT' THEN
    INSERT INTO public.activity_logs(actor_id, action, entity_type, entity_id, payload)
    VALUES (
      auth.uid(),
      'campaign.created',
      'campaign',
      NEW.id,
      jsonb_build_object('status', NEW.status, 'name', NEW.name)
    );

    PERFORM public.notify_user(
      v_user,
      'campaign',
      'Campanha criada',
      NEW.name || ' - em analise',
      '/anunciante'
    );

    RETURN NEW;
  END IF;

  IF TG_OP = 'UPDATE' AND NEW.status IS DISTINCT FROM OLD.status THEN
    INSERT INTO public.activity_logs(actor_id, action, entity_type, entity_id, payload)
    VALUES (
      auth.uid(),
      'campaign.status:' || NEW.status,
      'campaign',
      NEW.id,
      jsonb_build_object('from', OLD.status, 'to', NEW.status)
    );

    v_label := CASE NEW.status::text
      WHEN 'approved' THEN 'Campanha aprovada'
      WHEN 'active' THEN 'Campanha ativa'
      WHEN 'paused' THEN 'Campanha pausada'
      WHEN 'completed' THEN 'Campanha encerrada'
      WHEN 'cancelled' THEN 'Campanha cancelada'
      ELSE 'Campanha atualizada'
    END;

    PERFORM public.notify_user(v_user, 'campaign', v_label, NEW.name, '/anunciante');
  END IF;

  RETURN NEW;
END;
$function$;
