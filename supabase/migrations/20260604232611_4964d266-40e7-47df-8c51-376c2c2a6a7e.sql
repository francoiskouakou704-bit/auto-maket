
REVOKE EXECUTE ON FUNCTION public.get_user_plan(UUID) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.count_searches_today(UUID) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_user_plan(UUID) TO service_role;
GRANT EXECUTE ON FUNCTION public.count_searches_today(UUID) TO service_role;
