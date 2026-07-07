
-- Trigger functions never need to be called directly by clients
REVOKE EXECUTE ON FUNCTION public.set_updated_at() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.grant_first_admin() FROM PUBLIC, anon, authenticated;

-- Role check helpers: only callable by signed-in users (RLS policies still work)
REVOKE EXECUTE ON FUNCTION public.has_role(uuid, app_role) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.is_admin() FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.is_staff_or_admin() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_staff_or_admin() TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.has_role(uuid, app_role) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_admin() TO authenticated;
