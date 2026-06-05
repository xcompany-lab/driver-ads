REVOKE ALL ON FUNCTION public.user_owns_advertiser(uuid, uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.user_owns_advertiser(uuid, uuid) FROM anon;
GRANT EXECUTE ON FUNCTION public.user_owns_advertiser(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.user_owns_advertiser(uuid, uuid) TO service_role;

REVOKE ALL ON FUNCTION public.user_owns_campaign(uuid, uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.user_owns_campaign(uuid, uuid) FROM anon;
GRANT EXECUTE ON FUNCTION public.user_owns_campaign(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.user_owns_campaign(uuid, uuid) TO service_role;

REVOKE ALL ON FUNCTION public.driver_is_assigned_to_campaign(uuid, uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.driver_is_assigned_to_campaign(uuid, uuid) FROM anon;
GRANT EXECUTE ON FUNCTION public.driver_is_assigned_to_campaign(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.driver_is_assigned_to_campaign(uuid, uuid) TO service_role;

REVOKE ALL ON FUNCTION public.driver_owns_assignment(uuid, uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.driver_owns_assignment(uuid, uuid) FROM anon;
GRANT EXECUTE ON FUNCTION public.driver_owns_assignment(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.driver_owns_assignment(uuid, uuid) TO service_role;