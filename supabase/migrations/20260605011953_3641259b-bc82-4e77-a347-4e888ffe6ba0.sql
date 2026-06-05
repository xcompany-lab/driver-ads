
CREATE OR REPLACE FUNCTION public.finalize_signup_profile()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_meta jsonb := COALESCE(NEW.raw_user_meta_data, '{}'::jsonb);
  v_type text := v_meta->>'account_type';
  v_full_name text := COALESCE(v_meta->>'full_name', '');
  v_phone text := COALESCE(v_meta->>'phone', '');
BEGIN
  -- Only fire when email is (now) confirmed
  IF NEW.email_confirmed_at IS NULL THEN RETURN NEW; END IF;
  IF TG_OP = 'UPDATE' AND OLD.email_confirmed_at IS NOT NULL THEN RETURN NEW; END IF;
  IF v_type IS NULL THEN RETURN NEW; END IF;

  IF v_type = 'driver' THEN
    INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'driver')
      ON CONFLICT (user_id, role) DO NOTHING;
    INSERT INTO public.drivers (user_id, full_name, cpf, email, phone, city, regions)
    VALUES (
      NEW.id,
      v_full_name,
      COALESCE(v_meta->>'cpf', ''),
      NEW.email,
      v_phone,
      COALESCE(v_meta->>'city', ''),
      '{}'::text[]
    )
    ON CONFLICT DO NOTHING;
  ELSIF v_type = 'advertiser' THEN
    INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'advertiser')
      ON CONFLICT (user_id, role) DO NOTHING;
    INSERT INTO public.advertisers (user_id, company_name, cnpj, responsible, email, phone, city, segment)
    VALUES (
      NEW.id,
      COALESCE(v_meta->>'company_name', 'A definir'),
      COALESCE(v_meta->>'cnpj', ''),
      v_full_name,
      NEW.email,
      v_phone,
      COALESCE(v_meta->>'city', 'A definir'),
      NULLIF(v_meta->>'segment','')
    )
    ON CONFLICT DO NOTHING;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS finalize_signup_profile_on_insert ON auth.users;
CREATE TRIGGER finalize_signup_profile_on_insert
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.finalize_signup_profile();

DROP TRIGGER IF EXISTS finalize_signup_profile_on_update ON auth.users;
CREATE TRIGGER finalize_signup_profile_on_update
  AFTER UPDATE OF email_confirmed_at ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.finalize_signup_profile();
