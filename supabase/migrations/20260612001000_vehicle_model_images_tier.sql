-- Categoria do modelo no catalogo: 'standard' ou 'black' (premium).
-- Usado para pre-visualizar os carros por plano (Standard x Black).
alter table public.vehicle_model_images
  add column if not exists tier text not null default 'standard';

create index if not exists vehicle_model_images_tier_idx
  on public.vehicle_model_images (tier) where active;
