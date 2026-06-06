CREATE OR REPLACE FUNCTION public.guard_campaign_active_requires_assignment()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $function$
BEGIN
  IF NEW.status = 'active'::public.campaign_status
     AND OLD.status IS DISTINCT FROM NEW.status
     AND NOT EXISTS (
       SELECT 1
       FROM public.campaign_driver_assignments cda
       WHERE cda.campaign_id = NEW.id
         AND cda.status IN (
           'accepted'::public.assignment_status,
           'awaiting_installation'::public.assignment_status,
           'active'::public.assignment_status
         )
     ) THEN
    RAISE EXCEPTION 'A campanha precisa ter motorista vinculado e aceito antes de iniciar.'
      USING ERRCODE = 'P0001';
  END IF;

  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS trg_guard_campaign_active_requires_assignment ON public.campaigns;

CREATE TRIGGER trg_guard_campaign_active_requires_assignment
BEFORE UPDATE OF status ON public.campaigns
FOR EACH ROW
EXECUTE FUNCTION public.guard_campaign_active_requires_assignment();
