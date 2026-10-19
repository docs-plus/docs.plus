-- Issue #321. Drops pg_net. The repo moved push and email to pgmq and no longer calls net.*.
-- pg_net is not relocatable, so it cannot move out of public. The guard refuses the drop
-- when a caller exists. Re-runs safely. Pair: packages/supabase/scripts/00-bootstrap.sql

set local lock_timeout = '5s';

do $$
begin
  if exists (select 1 from cron.job where command ~ '\mnet\.') then
    raise exception 'pg_net drop refused: a cron job calls net.*';
  end if;
  if exists (
    select 1
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname <> 'net'
      and p.prosrc ~ '\mnet\.'
      and (n.nspname, p.proname) not in (
        ('extensions', 'grant_pg_net_access'),
        ('supabase_functions', 'http_request')
      )
  ) then
    raise exception 'pg_net drop refused: a function body calls net.*';
  end if;
  if to_regclass('supabase_functions.hooks') is not null then
    if exists (select 1 from supabase_functions.hooks) then
      raise exception 'pg_net drop refused: a Database Webhook exists';
    end if;
  end if;
end;
$$;

drop extension if exists pg_net;
