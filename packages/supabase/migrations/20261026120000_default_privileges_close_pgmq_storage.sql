-- #570 rows 4 and 5: new pgmq and storage objects start closed to anon and authenticated.
-- Storage creates its own objects as supabase_storage_admin. pgmq callers are definer RPCs on service_role.
-- Existing grants do not change. Re-runs safely. Pairs with scripts/29-lint-hardening.sql §9.
-- Never name supabase_admin: postgres cannot change its defaults.

alter default privileges for role postgres in schema pgmq
  revoke all on tables from anon, authenticated;
alter default privileges for role postgres in schema pgmq
  revoke all on sequences from anon, authenticated;
alter default privileges for role postgres in schema pgmq
  revoke execute on functions from anon, authenticated;
alter default privileges for role postgres in schema storage
  revoke all on tables from anon, authenticated;
alter default privileges for role postgres in schema storage
  revoke all on sequences from anon, authenticated;
alter default privileges for role postgres in schema storage
  revoke execute on functions from anon, authenticated;
