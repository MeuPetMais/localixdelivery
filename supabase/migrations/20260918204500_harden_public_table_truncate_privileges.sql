-- Gate D hardening: TRUNCATE is not protected by RLS.
--
-- All current application tables in public are owned by postgres.
-- Supabase default privileges grant TRUNCATE on most of them to
-- anon/authenticated, which bypasses row-level policies.
--
-- Revoke TRUNCATE on all existing public tables and remove it from the
-- postgres defaults used by current Localix application migrations.
--
-- supabase_admin also has broad platform defaults in public, but the migration
-- role cannot change that role's defaults and no current public application
-- table is owned by supabase_admin. That platform default remains an explicit
-- audit item if the ownership model changes.

REVOKE TRUNCATE ON ALL TABLES IN SCHEMA public FROM anon, authenticated;

ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public
  REVOKE TRUNCATE ON TABLES FROM anon, authenticated;
