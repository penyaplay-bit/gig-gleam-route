
-- Remove anon-facing broad SELECT on artists; restrict to authenticated
DROP POLICY IF EXISTS "Anyone can view active artists" ON public.artists;
CREATE POLICY "Signed-in users can view active artists"
  ON public.artists
  FOR SELECT
  TO authenticated
  USING ((active = true) OR public.is_staff_or_admin());
REVOKE SELECT ON public.artists FROM anon;

-- Remove anon-facing SELECT on artist_owner_profiles (use performer_public view instead)
DROP POLICY IF EXISTS "performer profile public columns" ON public.artist_owner_profiles;
REVOKE SELECT ON public.artist_owner_profiles FROM anon;

-- Restrict artist_profiles SELECT to staff/admin only (removes banking/rider exposure to random authenticated users)
DROP POLICY IF EXISTS "Signed-in users can view active artist profiles" ON public.artist_profiles;
CREATE POLICY "Staff and admins view artist profiles"
  ON public.artist_profiles
  FOR SELECT
  TO authenticated
  USING (public.is_staff_or_admin());

-- Revoke EXECUTE on SECURITY DEFINER functions that should not be user-callable.
-- Keep has_role/is_admin/is_staff_or_admin executable — required by RLS policies at runtime.
REVOKE EXECUTE ON FUNCTION public.refresh_artist_intel(uuid) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.grant_first_admin() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.mark_event_health_stale() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.on_artist_performance_change() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.log_gig_status_change() FROM PUBLIC, anon, authenticated;
