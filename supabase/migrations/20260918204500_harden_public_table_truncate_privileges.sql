-- Gate D hardening: TRUNCATE is not protected by RLS.
--
-- Existing Supabase default privileges grant TRUNCATE on most public tables
-- to anon/authenticated. That lets those roles bypass row-level policies and
-- remove every row from a table. Revoke TRUNCATE on all existing public
-- tables and prevent postgres/supabase_admin from granting it by default to
-- future public tables.

REVOKE TRUNCATE ON ALL TABLES IN SCHEMA public FROM anon, authenticated;

ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public
  REVOKE TRUNCATE ON TABLES FROM anon, authenticated;

ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA public
  REVOKE TRUNCATE ON TABLES FROM anon, authenticated;
