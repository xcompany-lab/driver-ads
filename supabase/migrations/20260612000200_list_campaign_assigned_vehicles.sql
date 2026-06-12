-- Veiculos vinculados a uma campanha, visiveis ao DONO da campanha (anunciante)
-- ou a staff. Retorna apenas info minima do veiculo + status + primeiro nome do
-- motorista (sem dados pessoais sensiveis).
create or replace function public.list_campaign_assigned_vehicles(_campaign_id uuid)
returns table (
  vehicle_id uuid,
  brand text,
  model text,
  plate text,
  status public.assignment_status,
  driver_first_name text
)
language sql
stable
security definer
set search_path = public
as $$
  select v.id, v.brand, v.model, v.plate, a.status,
         split_part(coalesce(d.full_name, ''), ' ', 1) as driver_first_name
  from public.campaign_driver_assignments a
  join public.vehicles v on v.id = a.vehicle_id
  join public.drivers d on d.id = a.driver_id
  where a.campaign_id = _campaign_id
    and a.status not in ('declined'::public.assignment_status, 'cancelled'::public.assignment_status)
    and (
      public.user_owns_campaign(auth.uid(), _campaign_id)
      or public.is_staff(auth.uid())
    )
  order by a.created_at desc;
$$;

grant execute on function public.list_campaign_assigned_vehicles(uuid) to authenticated;
