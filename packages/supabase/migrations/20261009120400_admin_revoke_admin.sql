-- Issue #412. Revoking admin access counts and deletes under one table lock, so two
-- admins who revoke each other at the same moment cannot leave zero admins.
-- Pairs with scripts/02-z-admin-users.sql. Service role only.

create or replace function public.admin_revoke_admin(p_user_id uuid)
returns boolean
language plpgsql
security invoker
set search_path = public
as $$
begin
  lock table public.admin_users in share row exclusive mode;

  if not exists (select 1 from public.admin_users where user_id = p_user_id) then
    return false;
  end if;

  if (select count(*) from public.admin_users) <= 1 then
    raise exception 'last_admin' using errcode = 'P0001';
  end if;

  delete from public.admin_users where user_id = p_user_id;
  return true;
end;
$$;

comment on function public.admin_revoke_admin(uuid) is 'Revoke admin access atomically; refuses to remove the last admin';

-- Hosted Supabase grants a new function to anon and authenticated, so revoke here.
revoke all on function public.admin_revoke_admin(uuid) from public, anon, authenticated;
grant execute on function public.admin_revoke_admin(uuid) to service_role;
