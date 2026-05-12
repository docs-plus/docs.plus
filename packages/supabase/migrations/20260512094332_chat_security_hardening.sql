-- Three small, defensive security tightenings. Mirrors changes in
-- packages/supabase/scripts/13-RLS.sql, 02-z-admin-users.sql, and
-- 07-5-email-notifications-pgmq.sql.
--
-- 1. users.email is no longer readable by authenticated PostgREST callers
--    (column-level GRANT mirrors the anon path). DEFINER RPCs bypass
--    column grants, so legitimate readers are unaffected.
-- 2. is_admin(uuid) becomes a self-check — prevents authenticated users
--    from probing which platform accounts hold admin status.
-- 3. internal.get_unsubscribe_secret() hard-fails when the GUC is unset
--    instead of falling back to a deterministic key derived from the
--    service-role key.

-- =====================================================================
-- 1. users.email column-level grant for authenticated
-- =====================================================================

revoke select on public.users from authenticated;
grant select (
    id, username, full_name, display_name, avatar_url, avatar_updated_at,
    profile_data, status, online_at, created_at, updated_at, deleted_at
) on public.users to authenticated;


-- =====================================================================
-- 2. is_admin self-check
-- =====================================================================

create or replace function public.is_admin(check_user_id uuid)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select check_user_id = auth.uid()
     and exists (select 1 from admin_users where user_id = auth.uid());
$$;


-- =====================================================================
-- 3. Unsubscribe secret hard-fails when unset
-- =====================================================================

create or replace function internal.get_unsubscribe_secret()
returns text
language plpgsql
stable
security definer
set search_path = public
as $$
declare
    v_secret text;
begin
    v_secret := current_setting('app.unsubscribe_secret', true);
    if v_secret is null or v_secret = '' then
        raise exception 'app.unsubscribe_secret is not configured';
    end if;
    return v_secret;
end;
$$;
