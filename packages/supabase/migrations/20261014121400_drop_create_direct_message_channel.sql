-- Issue #319. Drops create_direct_message_channel. No caller in the repo, and its access
-- check let any user add any user to a DM. Every overload, no CASCADE, so an unknown
-- dependent stops the push. A no-op when the function is gone. Re-runs safely.
-- Pair: packages/supabase/scripts/10-functions.sql
do $$
declare
  f record;
begin
  for f in
    select p.proname, pg_get_function_identity_arguments(p.oid) as args
    from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.proname = 'create_direct_message_channel'
  loop
    execute format('drop function public.%I(%s)', f.proname, f.args);
  end loop;

  if exists (
    select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.proname = 'create_direct_message_channel'
  ) then
    raise exception 'create_direct_message_channel still exists';
  end if;
end
$$;
