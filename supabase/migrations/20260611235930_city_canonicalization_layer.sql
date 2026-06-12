-- Camada de canonicalização de cidade: agrupa grafias livres em "macro-cidades"
-- por normalização + similaridade, sem limitar o cadastro. Cidades novas emergem
-- automaticamente conforme aparecem nos cadastros.
create extension if not exists pg_trgm;

create table if not exists public.cities (
  id uuid primary key default gen_random_uuid(),
  name text not null,                 -- nome de exibição (oficial)
  name_key text not null unique,      -- chave canônica normalizada
  aliases text[] not null default '{}', -- grafias normalizadas que mapeiam aqui
  uf text default 'SC',
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

alter table public.cities enable row level security;

drop policy if exists "cities read for authenticated" on public.cities;
create policy "cities read for authenticated"
  on public.cities for select to authenticated using (true);

drop policy if exists "cities staff write" on public.cities;
create policy "cities staff write"
  on public.cities for all to authenticated
  using (public.is_staff(auth.uid()))
  with check (public.is_staff(auth.uid()));

-- Resolve uma cidade em texto livre para a chave canônica.
-- Ordem: exato -> alias -> fuzzy (>=0.6) -> nova cidade (própria chave normalizada).
-- Retorna NULL para vazio/placeholder/estado.
create or replace function public.resolve_city_key(_raw text)
returns text
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  k text := public.normalize_vehicle_text(_raw);
  hit text;
begin
  if k is null or length(k) < 2 then return null; end if;
  if k in ('a definir','a definr','santa catarina','sc','nao informado','n a') then return null; end if;

  select name_key into hit from public.cities where name_key = k limit 1;
  if hit is not null then return hit; end if;

  select name_key into hit from public.cities where k = any(aliases) limit 1;
  if hit is not null then return hit; end if;

  select name_key into hit
  from (
    select c.name_key,
           greatest(
             similarity(c.name_key, k),
             coalesce((select max(similarity(a, k)) from unnest(c.aliases) a), 0)
           ) as sim
    from public.cities c
  ) s
  where s.sim >= 0.6
  order by s.sim desc
  limit 1;
  if hit is not null then return hit; end if;

  -- Cidade ainda não catalogada: agrupa por sua própria chave normalizada
  return k;
end;
$$;

grant execute on function public.resolve_city_key(text) to authenticated, anon;

-- Lista de cidades atendidas que EMERGE do volume de cadastros de motorista.
create or replace function public.list_service_cities()
returns table (city_key text, display_name text, drivers int)
language sql
stable
security definer
set search_path = public
as $$
  select key as city_key,
         coalesce(c.name, initcap(key)) as display_name,
         count(*)::int as drivers
  from (
    select public.resolve_city_key(d.city) as key
    from public.drivers d
    where d.status = 'approved'::public.driver_status
  ) g
  left join public.cities c on c.name_key = g.key
  where g.key is not null
  group by key, c.name
  order by drivers desc, display_name;
$$;

grant execute on function public.list_service_cities() to authenticated;

-- Seed das macro-cidades conhecidas (corrige clusters bagunçados).
-- Decisão do produto: todas as grafias do tipo "Camboriú/Camboriu/Camborio/Camburiu"
-- são tratadas como Balneário Camboriú.
insert into public.cities (name, name_key, aliases) values
  ('Florianópolis', 'florianopolis', '{}'),
  ('Balneário Camboriú', 'balneario camboriu',
     array['balneareo camboriu','balneario cambiriu','camboriu','camborio','camburiu','bc','balneario','balneario camburiu']),
  ('Itajaí', 'itajai', '{}'),
  ('Itapema', 'itapema', '{}'),
  ('Navegantes', 'navegantes', '{}'),
  ('Penha', 'penha', '{}')
on conflict (name_key) do nothing;
