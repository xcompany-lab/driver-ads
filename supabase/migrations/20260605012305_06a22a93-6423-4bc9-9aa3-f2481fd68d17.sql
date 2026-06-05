
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
  v_cpf text;
  v_cnpj text;
BEGIN
  IF NEW.email_confirmed_at IS NULL THEN RETURN NEW; END IF;
  IF TG_OP = 'UPDATE' AND OLD.email_confirmed_at IS NOT NULL THEN RETURN NEW; END IF;
  IF v_type IS NULL THEN RETURN NEW; END IF;

  IF v_type = 'driver' THEN
    v_cpf := NULLIF(v_meta->>'cpf','');
    IF v_cpf IS NULL THEN v_cpf := 'PENDENTE-' || NEW.id::text; END IF;
    INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'driver')
      ON CONFLICT (user_id, role) DO NOTHING;
    INSERT INTO public.drivers (user_id, full_name, cpf, email, phone, city, regions)
    VALUES (NEW.id, v_full_name, v_cpf, NEW.email, v_phone,
            COALESCE(NULLIF(v_meta->>'city',''), 'A definir'), '{}'::text[])
    ON CONFLICT DO NOTHING;
  ELSIF v_type = 'advertiser' THEN
    v_cnpj := NULLIF(v_meta->>'cnpj','');
    IF v_cnpj IS NULL THEN v_cnpj := 'PENDENTE-' || NEW.id::text; END IF;
    INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'advertiser')
      ON CONFLICT (user_id, role) DO NOTHING;
    INSERT INTO public.advertisers (user_id, company_name, cnpj, responsible, email, phone, city, segment)
    VALUES (NEW.id,
            COALESCE(NULLIF(v_meta->>'company_name',''), 'A definir'),
            v_cnpj, v_full_name, NEW.email, v_phone,
            COALESCE(NULLIF(v_meta->>'city',''), 'A definir'),
            NULLIF(v_meta->>'segment',''))
    ON CONFLICT DO NOTHING;
  END IF;

  RETURN NEW;
END;
$$;
