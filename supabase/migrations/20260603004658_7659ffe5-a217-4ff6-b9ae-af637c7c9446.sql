
-- has_role / is_staff: usadas em policies RLS; basta authenticated executar.
REVOKE EXECUTE ON FUNCTION public.has_role(UUID, public.app_role) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.is_staff(UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.has_role(UUID, public.app_role) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.is_staff(UUID) TO authenticated, service_role;

-- set_updated_at: trigger interno; ninguém precisa chamar diretamente.
REVOKE EXECUTE ON FUNCTION public.set_updated_at() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.set_updated_at() TO service_role;
