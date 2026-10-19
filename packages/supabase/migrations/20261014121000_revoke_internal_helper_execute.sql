-- Issue #469. Resets EXECUTE on every internal function, then grants back what policies, an
-- invoker body (normalize_chat_media_path) or a server path call. Re-runs safely.
-- Pairs with scripts 07-4, 07-5, 10-1, 10-3, 10-4 and 13-RLS.
-- Prod may hold internal functions the repo lacks. A NOTICE names each one closed to service_role.

set local lock_timeout = '5s';

do $$
declare
  f record;
  anon_ok text[] := array['can_open_document'];
  authenticated_ok text[] := array['can_open_document', 'is_workspace_member', 'is_channel_member',
                                   'can_read_channel', 'normalize_chat_media_path'];
  service_ok text[] := array['can_open_document', 'is_workspace_member', 'is_channel_member',
                             'can_read_channel', 'normalize_chat_media_path', 'is_user_online',
                             'is_email_suppressed', 'check_email_rate_limit',
                             'clear_email_bounce_info', 'cleanup_push_subscriptions',
                             'delete_chat_media_paths', 'cleanup_orphan_chat_media'];
  bad text[] := '{}';
begin
  for f in
    select p.oid, p.oid::regprocedure as sig, p.proname, pg_get_userbyid(p.proowner) as owner
    from pg_proc p
    where p.pronamespace = 'internal'::regnamespace
  loop
    if f.owner <> current_user then   -- a non-owner REVOKE only warns
      raise exception '% is owned by %, not %', f.sig, f.owner, current_user;
    end if;
    execute format('revoke all on function %s from public, anon, authenticated, service_role', f.sig);
    if f.proname <> all (service_ok) then
      raise notice 'service_role has no EXECUTE on %', f.sig;
    end if;
    if f.proname = any (anon_ok) then
      execute format('grant execute on function %s to anon', f.sig);
    end if;
    if f.proname = any (authenticated_ok) then
      execute format('grant execute on function %s to authenticated', f.sig);
    end if;
    if f.proname = any (service_ok) then
      execute format('grant execute on function %s to service_role', f.sig);
    end if;
  end loop;

  -- Assert both ways: nothing extra is open, and nothing a caller needs is closed.
  for f in
    select p.oid, p.oid::regprocedure as sig, p.proname
    from pg_proc p
    where p.pronamespace = 'internal'::regnamespace
  loop
    if has_function_privilege('anon', f.oid, 'EXECUTE') is distinct from (f.proname = any (anon_ok)) then
      bad := bad || ('anon grant is wrong on ' || f.sig::text);
    end if;
    if has_function_privilege('authenticated', f.oid, 'EXECUTE')
       is distinct from (f.proname = any (authenticated_ok)) then
      bad := bad || ('authenticated grant is wrong on ' || f.sig::text);
    end if;
    if has_function_privilege('service_role', f.oid, 'EXECUTE')
       is distinct from (f.proname = any (service_ok)) then
      bad := bad || ('service_role grant is wrong on ' || f.sig::text);
    end if;
  end loop;

  -- The policies and the media trigger need these five. A missing one is a broken chat.
  if (select count(distinct proname) from pg_proc
      where pronamespace = 'internal'::regnamespace
        and proname = any (authenticated_ok)) <> cardinality(authenticated_ok) then
    bad := bad || 'a required internal helper is missing'::text;
  end if;

  if cardinality(bad) > 0 then
    raise exception 'internal helper grant check failed: %', bad;
  end if;
end $$;
