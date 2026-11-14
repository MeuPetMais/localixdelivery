-- Gate 4 isolated homologation security hardening.
-- public.rls_auto_enable() is an internal event-trigger function. Its
-- EXECUTE must not be exposed through the Data API.
-- Do NOT change the function body or remove its event-trigger registration.
REVOKE EXECUTE ON FUNCTION public.rls_auto_enable() FROM PUBLIC, anon, authenticated;
