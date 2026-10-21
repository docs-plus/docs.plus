-- Issue #316 (Option A, fail closed). New tables, sequences and functions start closed to
-- anon on prod. The global statement removes the built-in PUBLIC EXECUTE, which a per-schema
-- row cannot. A new function in any schema then needs an explicit grant to each caller role.
-- Existing objects do not change. Re-runs safely. Pair: scripts/29-lint-hardening.sql §9
-- Never name supabase_admin: postgres cannot change its defaults.

alter default privileges for role postgres in schema public
  revoke execute on functions from anon, authenticated;
alter default privileges for role postgres in schema public
  revoke all on tables from anon;
alter default privileges for role postgres in schema public
  revoke all on sequences from anon;
alter default privileges for role postgres
  revoke execute on functions from public;
