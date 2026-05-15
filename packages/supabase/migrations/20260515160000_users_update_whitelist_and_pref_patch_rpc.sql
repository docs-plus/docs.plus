-- 20260515160000_users_update_whitelist_and_pref_patch_rpc.sql
--
-- 1. public.update_notification_preferences(p_patch jsonb) — partial
--    JSONB merge into users.profile_data.notification_preferences,
--    collapsing per-toggle PATCHes into one debounced RPC. `||` is
--    last-write-wins across concurrent tabs (acceptable).
--
-- 2. Column UPDATE whitelist on public.users. Mirrors the existing
--    SELECT whitelist so PostgREST cannot accept email, id, created_at,
--    etc. Ships in lockstep with the wave-3 FE narrowed save payload;
--    earlier deploy would 42501 the existing whole-row save.
--
-- Mirrors scripts/07-0-notifications.sql and scripts/13-RLS.sql.

create or replace function public.update_notification_preferences(p_patch jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
    v_user_id uuid := auth.uid();
    v_next jsonb;
begin
    if v_user_id is null then
        raise exception 'unauthenticated' using errcode = '42501';
    end if;
    if jsonb_typeof(p_patch) <> 'object' then
        raise exception 'patch_must_be_object' using errcode = '22023';
    end if;
    update public.users
       set profile_data = jsonb_set(
               coalesce(profile_data, '{}'::jsonb),
               array['notification_preferences'],
               coalesce(profile_data -> 'notification_preferences', '{}'::jsonb) || p_patch,
               true
           )
     where id = v_user_id
     returning profile_data -> 'notification_preferences' into v_next;
    return v_next;
end;
$$;

revoke all on function public.update_notification_preferences(jsonb) from public;
grant execute on function public.update_notification_preferences(jsonb) to authenticated;

-- `online_at` is excluded: trigger-maintained from `status` writes;
-- granting direct UPDATE would let a client antedate themselves and
-- skew the online-window used by push suppression.
REVOKE UPDATE ON public.users FROM authenticated;
GRANT UPDATE (
    username, full_name, avatar_url, avatar_updated_at, profile_data, status
) ON public.users TO authenticated;
