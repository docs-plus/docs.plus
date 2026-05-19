-- Defensive re-grant for the two v2 chat write RPCs that the
-- §6 lint-hardening whitelist sweep would otherwise revoke:
-- `add_reaction` and `remove_reaction`. `advance_read_cursor` is granted
-- inline in 20260519053356 and is intentionally not repeated here.
-- The script doesn't ship via migration today, so the §5/§6 gap bites
-- only on local `db reset`; this lock-in is idempotent protection in
-- case any future port of that sweep makes it into a migration.
-- Paired with packages/supabase/scripts/29-lint-hardening.sql §6.

GRANT EXECUTE ON FUNCTION public.add_reaction(uuid, text)    TO authenticated;
GRANT EXECUTE ON FUNCTION public.remove_reaction(uuid, text) TO authenticated;
