-- Issue #417. Two push fixes; both function signatures stay the same.
-- 1. update_user_online_at stamps online_at on every status write. The 60 s heartbeat keeps it fresh, so is_user_online suppression holds.
-- 2. update_notification_preferences checks the values the push and email triggers cast. A bad value used to raise inside them and abort message inserts.
-- Pairs with scripts/10-1-func-users.sql and scripts/07-0-notifications.sql.


-- 1. online_at follows the heartbeat. users_profile_changed does not list online_at, so it still skips heartbeats.

create or replace function public.update_user_online_at()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
    -- Stamp even when status is unchanged, so is_user_online sees the heartbeat.
    -- now() is timestamptz, which matches online_at whatever the session TimeZone.
    new.online_at := now();
    return new;
end;
$$;

comment on function public.update_user_online_at() is 'Stamps online_at on every status write, so the heartbeat keeps it fresh for is_user_online.';
comment on trigger trigger_update_user_online_at on public.users is 'Stamps online_at on every status write, so the heartbeat keeps it fresh.';


-- 2. Check the keys the triggers read. Unknown keys and JSON null pass, because the client clears email_bounce_info with null.

create or replace function public.update_notification_preferences(p_patch jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
    v_user_id uuid := auth.uid();
    v_next jsonb;
    v_key text;
    v_value jsonb;
    v_ok boolean;
begin
    if v_user_id is null then
        raise exception 'unauthenticated' using errcode = '42501';
    end if;
    if jsonb_typeof(p_patch) <> 'object' then
        raise exception 'patch_must_be_object' using errcode = '22023';
    end if;
    for v_key, v_value in select key, value from jsonb_each(p_patch) loop
        -- Null clears a key; the readers coalesce it.
        continue when jsonb_typeof(v_value) = 'null';
        v_ok := case
            when v_key in (
                'push_enabled', 'push_mentions', 'push_replies', 'push_reactions', 'push_content_changes',
                'quiet_hours_enabled',
                'email_enabled', 'email_mentions', 'email_replies', 'email_reactions', 'email_content_changes'
            ) then jsonb_typeof(v_value) = 'boolean'
            when v_key = 'email_frequency' then v_value #>> '{}' in ('immediate', 'daily', 'weekly', 'never')
            when v_key in ('quiet_hours_start', 'quiet_hours_end', 'timezone') then jsonb_typeof(v_value) = 'string'
            else true
        end;
        -- Run the same cast the readers run, so we accept exactly what will not crash them.
        if v_ok and v_key in ('quiet_hours_start', 'quiet_hours_end', 'timezone') then
            begin
                if v_key = 'timezone' then
                    perform now() at time zone (v_value #>> '{}');
                else
                    perform (v_value #>> '{}')::time;
                end if;
            exception when data_exception then
                v_ok := false;
            end;
        end if;
        if not v_ok then
            raise exception 'invalid_preference_value' using errcode = '22023', detail = v_key;
        end if;
    end loop;
    update public.users
       set notification_preferences = notification_preferences || p_patch
     where id = v_user_id
     returning notification_preferences into v_next;
    return v_next;
end;
$$;

revoke all on function public.update_notification_preferences(jsonb) from public, anon;
grant execute on function public.update_notification_preferences(jsonb) to authenticated;
