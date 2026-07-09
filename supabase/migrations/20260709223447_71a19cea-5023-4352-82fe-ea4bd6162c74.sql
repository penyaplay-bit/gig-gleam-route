
REVOKE ALL ON FUNCTION public.refresh_artist_intel(UUID) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.refresh_artist_intel(UUID) TO service_role;

REVOKE ALL ON FUNCTION public.on_artist_performance_change() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.on_artist_performance_change() TO service_role;
