-- Passa a casar motorista x campanha pela cidade canônica (resolve_city_key),
-- tolerando grafias diferentes. Demais regras inalteradas.
CREATE OR REPLACE FUNCTION public.list_eligible_drivers_for_campaign(_campaign_id uuid)
RETURNS TABLE (
  id uuid,
  full_name text,
  city text,
  regions text[],
  phone text,
  vehicles jsonb
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    d.id,
    d.full_name,
    d.city,
    d.regions,
    d.phone,
    COALESCE(
      jsonb_agg(
        jsonb_build_object(
          'id', v.id,
          'plate', v.plate,
          'model', v.model,
          'brand', v.brand,
          'status', v.status,
          'crlv_status', v.crlv_status
        )
        ORDER BY v.created_at DESC
      ) FILTER (WHERE v.id IS NOT NULL),
      '[]'::jsonb
    ) AS vehicles
  FROM public.campaigns c
  JOIN public.drivers d
    ON d.status = 'approved'::public.driver_status
   AND public.resolve_city_key(d.city) IS NOT NULL
   AND public.resolve_city_key(d.city) = public.resolve_city_key(c.city)
  JOIN public.vehicles v
    ON v.driver_id = d.id
   AND (
      v.status = 'approved'::public.vehicle_status
      OR v.crlv_status = 'approved'::public.doc_review_status
   )
  WHERE c.id = _campaign_id
    AND public.is_staff(auth.uid())
  GROUP BY d.id, d.full_name, d.city, d.regions, d.phone;
$$;

GRANT EXECUTE ON FUNCTION public.list_eligible_drivers_for_campaign(uuid) TO authenticated;
