
-- 1. Storage policies for deposits bucket
CREATE POLICY "deposits admin read" ON storage.objects
  FOR SELECT TO authenticated
  USING (bucket_id = 'deposits' AND public.is_staff_or_admin());

CREATE POLICY "deposits admin write" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'deposits' AND public.is_staff_or_admin());

CREATE POLICY "deposits admin update" ON storage.objects
  FOR UPDATE TO authenticated
  USING (bucket_id = 'deposits' AND public.is_staff_or_admin())
  WITH CHECK (bucket_id = 'deposits' AND public.is_staff_or_admin());

CREATE POLICY "deposits admin delete" ON storage.objects
  FOR DELETE TO authenticated
  USING (bucket_id = 'deposits' AND public.is_staff_or_admin());

-- 2. manager_profiles: replace public read with authenticated-only
DROP POLICY IF EXISTS "manager_profiles public read" ON public.manager_profiles;
CREATE POLICY "manager_profiles authenticated read"
  ON public.manager_profiles FOR SELECT TO authenticated
  USING (true);

-- 3. promoter_profiles: replace overly permissive public read
DROP POLICY IF EXISTS "promoter_profiles public read verified" ON public.promoter_profiles;
CREATE POLICY "promoter_profiles authenticated read verified"
  ON public.promoter_profiles FOR SELECT TO authenticated
  USING (verified = true OR auth.uid() = user_id OR public.is_staff_or_admin());

-- 4. gig_status_history INSERT: restrict to admins/staff or gig-owning promoter
DROP POLICY IF EXISTS "gig_status_history admin insert" ON public.gig_status_history;
CREATE POLICY "gig_status_history participant insert"
  ON public.gig_status_history FOR INSERT TO authenticated
  WITH CHECK (
    public.is_staff_or_admin()
    OR gig_id IN (
      SELECT g.id FROM public.gigs g
      JOIN public.promoter_profiles p ON p.id = g.promoter_id
      WHERE p.user_id = auth.uid()
    )
  );

-- 5. Lock down SECURITY DEFINER functions
-- Trigger functions: never called directly; revoke from all app roles
REVOKE ALL ON FUNCTION public.grant_first_admin() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.mark_event_health_stale() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.log_gig_status_change() FROM PUBLIC, anon, authenticated;

-- Role check helpers: only needed by RLS (runs as caller). Revoke anon; keep authenticated.
REVOKE ALL ON FUNCTION public.is_admin() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.is_staff_or_admin() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.has_role(uuid, public.app_role) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_admin() TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_staff_or_admin() TO authenticated;
GRANT EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) TO authenticated;
