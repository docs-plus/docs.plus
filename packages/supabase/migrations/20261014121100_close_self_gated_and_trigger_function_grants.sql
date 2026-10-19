-- Issue #318. Grants only. Closes lint 0028 for the self-gated RPCs and the definer trigger
-- functions in public. Re-runs safely. Pairs with scripts 07-4, 07-bookmark-functions, 10-8,
-- 10-functions and 29-lint-hardening (§6). update_notification_preferences is closed by
-- 20260930120000. The internal helpers are in 20261014121000 (#469).

set local lock_timeout = '5s';

do $$
declare
  signed_in text[] := array[
    'admin_get_failed_push_subs', 'admin_get_recent_push_activity',
    'archive_bookmark', 'get_bookmark_stats', 'get_user_bookmarks',
    'mark_bookmark_as_read', 'toggle_message_bookmark',
    'get_document_follow_state', 'set_document_follow',
    'get_document_member_previews', 'get_document_members',
    'join_workspace', 'register_push_subscription', 'unregister_push_subscription'];
  service_only text[] := array['get_bookmark_count', 'admin_get_user_notification_subs'];
  f record;
  bad text[] := '{}';
begin
  -- A. Named RPCs, every overload. Grant first: prod may give EXECUTE only through PUBLIC.
  for f in
    select p.oid::regprocedure as sig, p.proname, pg_get_userbyid(p.proowner) as owner
    from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.proname = any (signed_in || service_only)
  loop
    if f.owner <> current_user then   -- a non-owner REVOKE only warns
      raise exception '% is owned by %, not %', f.sig, f.owner, current_user;
    end if;
    if f.proname = any (service_only) then
      execute format('grant execute on function %s to service_role', f.sig);
      execute format('revoke all on function %s from public, anon, authenticated', f.sig);
    else
      execute format('grant execute on function %s to authenticated, service_role', f.sig);
      execute format('revoke all on function %s from public, anon', f.sig);
    end if;
  end loop;

  -- B. Definer trigger and event-trigger functions. EXECUTE is checked at CREATE TRIGGER only.
  for f in
    select p.oid::regprocedure as sig, pg_get_userbyid(p.proowner) as owner
    from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.prosecdef
      and p.prorettype in ('trigger'::regtype, 'event_trigger'::regtype)
  loop
    if f.owner <> current_user then
      raise notice 'skipped, owned by %: %', f.owner, f.sig;
      continue;
    end if;
    execute format('revoke all on function %s from public, anon, authenticated', f.sig);
  end loop;

  -- C. Assert only what this migration touched. Prod-only definer functions are not judged here.
  for f in
    select p.oid, p.oid::regprocedure as sig, p.proname, p.prorettype
    from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.prosecdef and p.proowner = current_user::regrole
      and (p.proname = any (signed_in || service_only)
           or p.prorettype in ('trigger'::regtype, 'event_trigger'::regtype))
  loop
    if has_function_privilege('anon', f.oid, 'EXECUTE') then
      bad := bad || ('anon can execute ' || f.sig::text);
    end if;
    if f.prorettype in ('trigger'::regtype, 'event_trigger'::regtype)
       and has_function_privilege('authenticated', f.oid, 'EXECUTE') then
      bad := bad || ('authenticated can execute trigger fn ' || f.sig::text);
    end if;
    if f.proname = any (signed_in) and not has_function_privilege('authenticated', f.oid, 'EXECUTE') then
      bad := bad || ('authenticated lost ' || f.sig::text);
    end if;
    if f.proname = any (service_only) and (has_function_privilege('authenticated', f.oid, 'EXECUTE')
       or not has_function_privilege('service_role', f.oid, 'EXECUTE')) then
      bad := bad || ('service_role-only check failed: ' || f.sig::text);
    end if;
  end loop;
  if cardinality(bad) > 0 then raise exception 'grant assert failed: %', bad; end if;
end $$;
