-- Catálogo de imagens por modelo de veículo + matching tolerante
create extension if not exists unaccent;

-- Normalização: minúsculas, sem acento, não-alfanumérico -> espaço, espaços colapsados, trim
create or replace function public.normalize_vehicle_text(_input text)
returns text
language sql
stable
as $$
  select trim(regexp_replace(lower(unaccent('unaccent', coalesce(_input, ''))), '[^a-z0-9]+', ' ', 'g'));
$$;

create table if not exists public.vehicle_model_images (
  id uuid primary key default gen_random_uuid(),
  display_brand text,
  display_model text,
  brand_key text,
  model_key text,
  aliases text[] not null default '{}',
  image_path text not null,
  is_default boolean not null default false,
  active boolean not null default true,
  priority int not null default 100,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Apenas um default
create unique index if not exists vehicle_model_images_one_default
  on public.vehicle_model_images (is_default) where is_default;

create index if not exists vehicle_model_images_model_key_idx
  on public.vehicle_model_images (model_key);

-- Trigger: mantém chaves normalizadas e updated_at
create or replace function public.vehicle_model_images_set_keys()
returns trigger
language plpgsql
as $$
begin
  new.brand_key := public.normalize_vehicle_text(new.display_brand);
  new.model_key := public.normalize_vehicle_text(new.display_model);
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists trg_vehicle_model_images_keys on public.vehicle_model_images;
create trigger trg_vehicle_model_images_keys
  before insert or update on public.vehicle_model_images
  for each row execute function public.vehicle_model_images_set_keys();

-- RLS
alter table public.vehicle_model_images enable row level security;

drop policy if exists "catalog read for authenticated" on public.vehicle_model_images;
create policy "catalog read for authenticated"
  on public.vehicle_model_images
  for select to authenticated
  using (true);

drop policy if exists "catalog staff insert" on public.vehicle_model_images;
create policy "catalog staff insert"
  on public.vehicle_model_images
  for insert to authenticated
  with check (public.is_staff(auth.uid()));

drop policy if exists "catalog staff update" on public.vehicle_model_images;
create policy "catalog staff update"
  on public.vehicle_model_images
  for update to authenticated
  using (public.is_staff(auth.uid()))
  with check (public.is_staff(auth.uid()));

drop policy if exists "catalog staff delete" on public.vehicle_model_images;
create policy "catalog staff delete"
  on public.vehicle_model_images
  for delete to authenticated
  using (public.is_staff(auth.uid()));

-- Storage: staff gerencia imagens do catálogo no bucket público 'vehicles' sob catalog/
drop policy if exists "staff manage vehicle catalog images insert" on storage.objects;
create policy "staff manage vehicle catalog images insert"
  on storage.objects
  for insert to authenticated
  with check (bucket_id = 'vehicles' and name like 'catalog/%' and public.is_staff(auth.uid()));

drop policy if exists "staff manage vehicle catalog images update" on storage.objects;
create policy "staff manage vehicle catalog images update"
  on storage.objects
  for update to authenticated
  using (bucket_id = 'vehicles' and name like 'catalog/%' and public.is_staff(auth.uid()))
  with check (bucket_id = 'vehicles' and name like 'catalog/%' and public.is_staff(auth.uid()));

drop policy if exists "staff manage vehicle catalog images delete" on storage.objects;
create policy "staff manage vehicle catalog images delete"
  on storage.objects
  for delete to authenticated
  using (bucket_id = 'vehicles' and name like 'catalog/%' and public.is_staff(auth.uid()));

-- Seed
insert into public.vehicle_model_images (display_brand, display_model, aliases, image_path, is_default, priority)
values
  (null, 'Genérico', '{}', 'catalog/_default.png', true, 1000),
  ('Hyundai', 'HB20', array['hb 20','hb20s','hb20s sense','hb20 sense','hunday hb20'], 'catalog/hyundai-hb20.png', false, 100),
  ('Chevrolet', 'Onix', array['onix plus','onix joy','onix lt','onix premier'], 'catalog/chevrolet-onix.png', false, 100)
on conflict do nothing;
