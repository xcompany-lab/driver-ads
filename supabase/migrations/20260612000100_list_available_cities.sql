-- Cidades disponíveis para o anunciante escolher ao criar campanha:
-- união das cidades cadastradas (cities ativas) com as cidades que têm motorista
-- aprovado (emergentes do volume). Mostra a contagem de motoristas.
create or replace function public.list_available_cities()
returns table (city_key text, display_name text, drivers int)
language sql
stable
security definer
set search_path = public
as $$
  with driver_cities as (
    select public.resolve_city_key(d.city) as key, count(*)::int as drivers
    from public.drivers d
    where d.status = 'approved'::public.driver_status
      and public.resolve_city_key(d.city) is not null
    group by 1
  )
  select coalesce(c.name_key, dc.key) as city_key,
         coalesce(c.name, initcap(dc.key)) as display_name,
         coalesce(dc.drivers, 0) as drivers
  from public.cities c
  full outer join driver_cities dc on dc.key = c.name_key
  where (c.id is null or c.is_active)
    and coalesce(c.name_key, dc.key) is not null
  order by drivers desc, display_name;
$$;

grant execute on function public.list_available_cities() to authenticated;
