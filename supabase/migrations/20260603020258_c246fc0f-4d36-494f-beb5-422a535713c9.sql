-- Seed three demo accounts (idempotent)
DO $$
DECLARE
  v_password text := 'DriverAds@2026';
  v_uid uuid;
  rec record;
BEGIN
  FOR rec IN
    SELECT * FROM (VALUES
      ('madaraxcompany@gmail.com',   'Madara Company',     'advertiser'::public.app_role),
      ('madaraschumacher@gmail.com', 'Madara Schumacher',  'driver'::public.app_role),
      ('lowjuliano@gmail.com',       'Juliano Low',        'admin'::public.app_role)
    ) AS t(email, full_name, role)
  LOOP
    SELECT id INTO v_uid FROM auth.users WHERE email = rec.email;

    IF v_uid IS NULL THEN
      v_uid := gen_random_uuid();
      INSERT INTO auth.users (
        instance_id, id, aud, role, email,
        encrypted_password, email_confirmed_at,
        raw_app_meta_data, raw_user_meta_data,
        created_at, updated_at,
        confirmation_token, recovery_token,
        email_change, email_change_token_new
      ) VALUES (
        '00000000-0000-0000-0000-000000000000', v_uid, 'authenticated', 'authenticated', rec.email,
        crypt(v_password, gen_salt('bf')), now(),
        '{"provider":"email","providers":["email"]}'::jsonb,
        jsonb_build_object('full_name', rec.full_name),
        now(), now(),
        '', '', '', ''
      );
      INSERT INTO auth.identities (
        id, user_id, provider_id, identity_data, provider,
        last_sign_in_at, created_at, updated_at
      ) VALUES (
        gen_random_uuid(), v_uid, v_uid::text,
        jsonb_build_object('sub', v_uid::text, 'email', rec.email, 'email_verified', true),
        'email', now(), now(), now()
      );
    ELSE
      UPDATE auth.users
         SET encrypted_password = crypt(v_password, gen_salt('bf')),
             email_confirmed_at = COALESCE(email_confirmed_at, now()),
             updated_at = now()
       WHERE id = v_uid;
    END IF;

    -- ensure profile exists (handle_new_user trigger usually does this, but be safe)
    INSERT INTO public.profiles (id, full_name)
    VALUES (v_uid, rec.full_name)
    ON CONFLICT (id) DO UPDATE SET full_name = EXCLUDED.full_name;

    -- ensure role assignment
    INSERT INTO public.user_roles (user_id, role)
    VALUES (v_uid, rec.role)
    ON CONFLICT (user_id, role) DO NOTHING;
  END LOOP;
END $$;