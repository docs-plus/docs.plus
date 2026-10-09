-- Issue #314. Ports the 2026-09-28 production hand fix for grants and partition RLS.
-- No-op on production except partitions made after 2026-09-28. Re-runs safely.
-- Pairs with scripts 02-z-admin-users, 09-document-views, 10-functions, 27-failed-notifications-audit
-- and 29-lint-hardening.
-- Migration 20261006130000 already closed 14 of the functions in that fix, so they are not repeated here.

set local lock_timeout = '5s';

do $$
declare r record;
begin
  for r in
    select c.relname
    from pg_class c join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public' and c.relkind = 'r'
      and c.relname ~ '^document_views_[0-9]{4}_[0-9]{2}$'
  loop
    execute format('alter table public.%I enable row level security', r.relname);
    execute format('revoke all on public.%I from public, anon, authenticated', r.relname);
  end loop;
end $$;

-- Analytics and admin tables.
revoke all on public.document_views, public.document_views_daily,
              public.document_view_stats, public.email_bounces
  from public, anon, authenticated;
revoke all on public.admin_users from anon;

-- A guest reads users through a column list without email. The table revoke also clears column grants.
revoke all on public.users from anon;
grant select (id, username, full_name, display_name, avatar_url, avatar_updated_at,
              profile_data, status, online_at, created_at, updated_at, deleted_at)
  on public.users to anon;

-- Service role or pg_cron only.
grant execute on function public.get_push_failure_summary() to service_role;
grant execute on function public.get_email_failure_summary() to service_role;
grant execute on function public.get_failed_push_subscriptions(integer, integer) to service_role;
grant execute on function public.get_email_bounces(text, integer, integer) to service_role;
grant execute on function public.get_notification_health() to service_role;
grant execute on function public.disable_failed_subscriptions(integer, text, uuid[]) to service_role;
grant execute on function public.aggregate_document_view_stats() to service_role;
grant execute on function public.cleanup_old_document_views() to service_role;
grant execute on function public.create_document_views_partitions() to service_role;

revoke all on function public.get_push_failure_summary() from public, anon, authenticated;
revoke all on function public.get_email_failure_summary() from public, anon, authenticated;
revoke all on function public.get_failed_push_subscriptions(integer, integer) from public, anon, authenticated;
revoke all on function public.get_email_bounces(text, integer, integer) from public, anon, authenticated;
revoke all on function public.get_notification_health() from public, anon, authenticated;
revoke all on function public.disable_failed_subscriptions(integer, text, uuid[]) from public, anon, authenticated;
revoke all on function public.aggregate_document_view_stats() from public, anon, authenticated;
revoke all on function public.cleanup_old_document_views() from public, anon, authenticated;
revoke all on function public.create_document_views_partitions() from public, anon, authenticated;

-- Invoker RPCs the browser calls, guests included. Name the grants, so access does not rest on default privileges (#316).
grant execute on function public.get_channel_aggregate_data(character varying, integer, uuid) to anon, authenticated, service_role;
grant execute on function public.notifications_summary(character varying) to anon, authenticated, service_role;
grant execute on function public.get_channel_members_by_last_read_update(character varying, timestamp with time zone) to anon, authenticated, service_role;
grant execute on function public.get_unread_notif_count(character varying) to anon, authenticated, service_role;
grant execute on function public.fetch_mentioned_users(character varying, text) to anon, authenticated, service_role;

-- The admin_users policies call is_admin for signed-in users only.
grant execute on function public.is_admin(uuid) to authenticated, service_role;
revoke all on function public.is_admin(uuid) from public, anon;

-- A revoke by a non-owner only warns, so check the result and fail loudly.
do $$
declare
  t record;
  fn text;
  bad text[] := '{}';
begin
  for t in
    select c.oid, c.relname, c.relrowsecurity
    from pg_class c join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public'
      and (c.relname ~ '^document_views_[0-9]{4}_[0-9]{2}$'
           or c.relname in ('document_views', 'document_views_daily', 'document_view_stats',
                            'email_bounces', 'admin_users'))
  loop
    if has_table_privilege('anon', t.oid, 'SELECT,INSERT,UPDATE,DELETE,TRUNCATE') then
      bad := bad || ('anon has rights on ' || t.relname);
    end if;
    if t.relname <> 'admin_users'
       and has_table_privilege('authenticated', t.oid, 'SELECT,INSERT,UPDATE,DELETE,TRUNCATE') then
      bad := bad || ('authenticated has rights on ' || t.relname);
    end if;
    if t.relname ~ '^document_views_[0-9]{4}_[0-9]{2}$' and not t.relrowsecurity then
      bad := bad || ('RLS off on ' || t.relname);
    end if;
  end loop;

  if has_table_privilege('anon', 'public.users', 'INSERT,UPDATE,DELETE,TRUNCATE') then
    bad := bad || 'anon can write users'::text;
  end if;
  if has_column_privilege('anon', 'public.users', 'email', 'SELECT') then
    bad := bad || 'anon can read users.email'::text;
  end if;
  if not has_column_privilege('anon', 'public.users', 'username', 'SELECT') then
    bad := bad || 'anon cannot read users.username'::text;
  end if;

  foreach fn in array array[
    'public.get_push_failure_summary()', 'public.get_email_failure_summary()',
    'public.get_failed_push_subscriptions(integer, integer)',
    'public.get_email_bounces(text, integer, integer)', 'public.get_notification_health()',
    'public.disable_failed_subscriptions(integer, text, uuid[])',
    'public.aggregate_document_view_stats()', 'public.cleanup_old_document_views()',
    'public.create_document_views_partitions()']
  loop
    if has_function_privilege('anon', fn, 'EXECUTE')
       or has_function_privilege('authenticated', fn, 'EXECUTE')
       or not has_function_privilege('service_role', fn, 'EXECUTE') then
      bad := bad || ('not service_role only: ' || fn);
    end if;
  end loop;

  if has_function_privilege('anon', 'public.is_admin(uuid)', 'EXECUTE') then
    bad := bad || 'anon can call public.is_admin'::text;
  end if;
  if not has_function_privilege('authenticated', 'public.is_admin(uuid)', 'EXECUTE') then
    bad := bad || 'authenticated cannot call public.is_admin'::text;
  end if;

  if cardinality(bad) > 0 then
    raise exception 'grant check failed: %', bad;
  end if;
end $$;
