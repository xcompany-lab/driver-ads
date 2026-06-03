
-- =========================================================
-- DRIVER ADS — FASE 2: Schema núcleo (perfis, papéis, anunciantes, motoristas, veículos)
-- =========================================================

-- ---------- ENUMS ----------
CREATE TYPE public.app_role AS ENUM ('admin', 'operator', 'advertiser', 'driver');

CREATE TYPE public.advertiser_status AS ENUM ('pending_review', 'approved', 'rejected', 'suspended');
CREATE TYPE public.driver_status     AS ENUM ('pending_review', 'approved', 'rejected', 'suspended', 'inactive');
CREATE TYPE public.vehicle_status    AS ENUM ('pending_review', 'approved', 'rejected', 'suspended');

-- ---------- TIMESTAMP HELPER ----------
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

-- =========================================================
-- 1) PROFILES — dados públicos do usuário autenticado
-- =========================================================
CREATE TABLE public.profiles (
  id           UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name    TEXT,
  phone        TEXT,
  avatar_url   TEXT,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

CREATE TRIGGER profiles_set_updated_at
BEFORE UPDATE ON public.profiles
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- =========================================================
-- 2) USER_ROLES — papéis (NUNCA armazenar role em profiles)
-- =========================================================
CREATE TABLE public.user_roles (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role       public.app_role NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, role)
);

GRANT SELECT ON public.user_roles TO authenticated;
GRANT ALL ON public.user_roles TO service_role;

ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

-- Security definer para evitar recursão em RLS
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role public.app_role)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role = _role
  );
$$;

CREATE OR REPLACE FUNCTION public.is_staff(_user_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role IN ('admin', 'operator')
  );
$$;

-- =========================================================
-- 3) ADVERTISERS — empresa anunciante
-- =========================================================
CREATE TABLE public.advertisers (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       UUID NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  company_name  TEXT NOT NULL,
  cnpj          TEXT NOT NULL UNIQUE,
  responsible   TEXT NOT NULL,
  email         TEXT NOT NULL,
  phone         TEXT NOT NULL,
  city          TEXT NOT NULL,
  segment       TEXT,
  status        public.advertiser_status NOT NULL DEFAULT 'pending_review',
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.advertisers TO authenticated;
GRANT ALL ON public.advertisers TO service_role;

ALTER TABLE public.advertisers ENABLE ROW LEVEL SECURITY;

CREATE INDEX advertisers_status_idx ON public.advertisers(status);
CREATE INDEX advertisers_city_idx ON public.advertisers(city);

CREATE TRIGGER advertisers_set_updated_at
BEFORE UPDATE ON public.advertisers
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- =========================================================
-- 4) DRIVERS — motorista
-- =========================================================
CREATE TABLE public.drivers (
  id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id            UUID NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name          TEXT NOT NULL,
  cpf                TEXT NOT NULL UNIQUE,
  birth_date         DATE,
  phone              TEXT NOT NULL,
  email              TEXT NOT NULL,
  city               TEXT NOT NULL,
  regions            TEXT[] NOT NULL DEFAULT '{}',
  pix_key            TEXT,
  pix_key_type       TEXT,
  photo_url          TEXT,
  status             public.driver_status NOT NULL DEFAULT 'pending_review',
  terms_accepted_at  TIMESTAMPTZ,
  created_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at         TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.drivers TO authenticated;
GRANT ALL ON public.drivers TO service_role;

ALTER TABLE public.drivers ENABLE ROW LEVEL SECURITY;

CREATE INDEX drivers_status_idx ON public.drivers(status);
CREATE INDEX drivers_city_idx ON public.drivers(city);

CREATE TRIGGER drivers_set_updated_at
BEFORE UPDATE ON public.drivers
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- =========================================================
-- 5) VEHICLES — veículo vinculado a um motorista
-- =========================================================
CREATE TABLE public.vehicles (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  driver_id   UUID NOT NULL REFERENCES public.drivers(id) ON DELETE CASCADE,
  plate       TEXT NOT NULL UNIQUE,
  model       TEXT NOT NULL,
  brand       TEXT,
  year        INT,
  color       TEXT,
  vehicle_type TEXT,
  photo_url   TEXT,
  status      public.vehicle_status NOT NULL DEFAULT 'pending_review',
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.vehicles TO authenticated;
GRANT ALL ON public.vehicles TO service_role;

ALTER TABLE public.vehicles ENABLE ROW LEVEL SECURITY;

CREATE INDEX vehicles_driver_idx ON public.vehicles(driver_id);
CREATE INDEX vehicles_status_idx ON public.vehicles(status);

CREATE TRIGGER vehicles_set_updated_at
BEFORE UPDATE ON public.vehicles
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- =========================================================
-- RLS POLICIES
-- =========================================================

-- ---------- PROFILES ----------
CREATE POLICY "Users read own profile" ON public.profiles
  FOR SELECT TO authenticated USING (id = auth.uid());

CREATE POLICY "Staff read all profiles" ON public.profiles
  FOR SELECT TO authenticated USING (public.is_staff(auth.uid()));

CREATE POLICY "Users insert own profile" ON public.profiles
  FOR INSERT TO authenticated WITH CHECK (id = auth.uid());

CREATE POLICY "Users update own profile" ON public.profiles
  FOR UPDATE TO authenticated USING (id = auth.uid()) WITH CHECK (id = auth.uid());

-- ---------- USER_ROLES ----------
CREATE POLICY "Users read own roles" ON public.user_roles
  FOR SELECT TO authenticated USING (user_id = auth.uid());

CREATE POLICY "Admins read all roles" ON public.user_roles
  FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));
-- INSERT/UPDATE/DELETE de roles SOMENTE via service_role (não dar policies para authenticated)

-- ---------- ADVERTISERS ----------
CREATE POLICY "Advertiser reads own" ON public.advertisers
  FOR SELECT TO authenticated USING (user_id = auth.uid());

CREATE POLICY "Staff read all advertisers" ON public.advertisers
  FOR SELECT TO authenticated USING (public.is_staff(auth.uid()));

CREATE POLICY "Advertiser creates own" ON public.advertisers
  FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());

CREATE POLICY "Advertiser updates own" ON public.advertisers
  FOR UPDATE TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

CREATE POLICY "Admin updates any advertiser" ON public.advertisers
  FOR UPDATE TO authenticated USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admin deletes advertiser" ON public.advertisers
  FOR DELETE TO authenticated USING (public.has_role(auth.uid(), 'admin'));

-- ---------- DRIVERS ----------
CREATE POLICY "Driver reads own" ON public.drivers
  FOR SELECT TO authenticated USING (user_id = auth.uid());

CREATE POLICY "Staff read all drivers" ON public.drivers
  FOR SELECT TO authenticated USING (public.is_staff(auth.uid()));

CREATE POLICY "Driver creates own" ON public.drivers
  FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());

CREATE POLICY "Driver updates own" ON public.drivers
  FOR UPDATE TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

CREATE POLICY "Admin updates any driver" ON public.drivers
  FOR UPDATE TO authenticated USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admin deletes driver" ON public.drivers
  FOR DELETE TO authenticated USING (public.has_role(auth.uid(), 'admin'));

-- ---------- VEHICLES ----------
CREATE POLICY "Driver reads own vehicles" ON public.vehicles
  FOR SELECT TO authenticated USING (
    driver_id IN (SELECT id FROM public.drivers WHERE user_id = auth.uid())
  );

CREATE POLICY "Staff read all vehicles" ON public.vehicles
  FOR SELECT TO authenticated USING (public.is_staff(auth.uid()));

CREATE POLICY "Driver inserts own vehicle" ON public.vehicles
  FOR INSERT TO authenticated WITH CHECK (
    driver_id IN (SELECT id FROM public.drivers WHERE user_id = auth.uid())
  );

CREATE POLICY "Driver updates own vehicle" ON public.vehicles
  FOR UPDATE TO authenticated USING (
    driver_id IN (SELECT id FROM public.drivers WHERE user_id = auth.uid())
  );

CREATE POLICY "Admin updates any vehicle" ON public.vehicles
  FOR UPDATE TO authenticated USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admin deletes vehicle" ON public.vehicles
  FOR DELETE TO authenticated USING (public.has_role(auth.uid(), 'admin'));
