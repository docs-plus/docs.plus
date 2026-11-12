-- #755: anon could run these three SECURITY INVOKER notification RPCs through the PUBLIC grant.
-- Only signed-in webapp hooks call them, so keep authenticated and close anon and public.
-- service_role may lose EXECUTE where it held it only through PUBLIC (ruling 2026-11-11).
-- Re-runs safely. Pairs with scripts/10-functions.sql and scripts/07-1-notification-functions.sql.

set local lock_timeout = '5s';

revoke execute on function public.get_unread_notifications_paginated(character varying, text, integer, integer) from public, anon;
grant execute on function public.get_unread_notifications_paginated(character varying, text, integer, integer) to authenticated;
revoke execute on function public.get_channel_notif_state(character varying) from public, anon;
grant execute on function public.get_channel_notif_state(character varying) to authenticated;
revoke execute on function public.get_workspace_notifications(uuid, character varying, integer, integer, boolean) from public, anon;
grant execute on function public.get_workspace_notifications(uuid, character varying, integer, integer, boolean) to authenticated;

-- A non-owner REVOKE only warns, so assert the result. service_role is recorded, not asserted.
do $$
declare
  f regprocedure;
  bad text[] := '{}';
begin
  foreach f in array array[
    'public.get_unread_notifications_paginated(character varying, text, integer, integer)'::regprocedure,
    'public.get_channel_notif_state(character varying)'::regprocedure,
    'public.get_workspace_notifications(uuid, character varying, integer, integer, boolean)'::regprocedure
  ]
  loop
    if has_function_privilege('anon', f, 'EXECUTE') then
      bad := bad || ('anon can still execute ' || f::text);
    end if;
    if not has_function_privilege('authenticated', f, 'EXECUTE') then
      bad := bad || ('authenticated cannot execute ' || f::text);
    end if;
  end loop;

  if cardinality(bad) > 0 then
    raise exception 'notification RPC grant check failed: %', bad;
  end if;
end $$;
