-- Issue #320. Drops five prod-only objects that no repo file creates: four public
-- functions and the empty PushSentLog table. The 2026-10-21 prod read found no caller,
-- no dependent and 0 rows. Idempotent: a re-run drops nothing and the checks still pass.
-- Pair: scripts/07-4-push-notifications-pgmq.sql §9.

-- Prod-only leftovers that no repo file creates (#320). Schema public only:
-- internal.cleanup_push_subscriptions() runs the live cron job and must stay.
-- No CASCADE: a dependent object must stop this, not vanish with it.
do $$
declare
  f record;
begin
  for f in
    select p.oid::regprocedure as sig
    from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.proname = any (array['cleanup_push_subscriptions',
        'get_push_notification_stats','get_push_subscriptions',
        'reset_workspace_unread_counts'])
  loop
    execute format('drop function %s', f.sig);
  end loop;
end $$;

drop table if exists public."PushSentLog";

-- Fails the push if a drop missed, or if the cron job's function went with them.
do $$
begin
  if exists (select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace
             where n.nspname = 'public'
               and p.proname = any (array['cleanup_push_subscriptions',
                 'get_push_notification_stats','get_push_subscriptions',
                 'reset_workspace_unread_counts'])) then
    raise exception '#320: a dropped function still exists';
  end if;
  if to_regclass('public."PushSentLog"') is not null then
    raise exception '#320: public."PushSentLog" still exists';
  end if;
  if to_regprocedure('internal.cleanup_push_subscriptions()') is null then
    raise exception '#320: internal.cleanup_push_subscriptions() is missing';
  end if;
end $$;
