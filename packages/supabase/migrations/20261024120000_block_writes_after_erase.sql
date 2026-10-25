-- #579, maintainer ruling 2026-10-24. An erased account keeps a live access token for up to
-- an hour. These checks stop it from writing back its profile, preferences and push devices.
-- Pairs with scripts/13-RLS.sql, 07-0-notifications.sql and 07-4-push-notifications-pgmq.sql.
-- Grants and security modes stay the same.

set local lock_timeout = '5s';

drop policy if exists users_self_update on public.users;
create policy users_self_update on public.users
  for update to authenticated
  using      (id = (select auth.uid()) and deleted_at is null)
  with check (id = (select auth.uid()));

drop policy if exists "Users can manage own subscriptions" on public.push_subscriptions;
create policy "Users can manage own subscriptions" on public.push_subscriptions
    for all using (
        (select auth.uid()) = user_id
        and exists (
            select 1
              from public.users u
             where u.id = (select auth.uid())
               and u.deleted_at is null
        )
    );

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
       and deleted_at is null  -- definer skips RLS; an erased account writes nothing (#579)
     returning notification_preferences into v_next;
    return v_next;
end;
$$;

revoke all on function public.update_notification_preferences(jsonb) from public, anon;
grant execute on function public.update_notification_preferences(jsonb) to authenticated;

create or replace function public.register_push_subscription(
    p_device_id text,
    p_device_name text,
    p_platform text,
    p_push_credentials jsonb
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
    v_subscription_id uuid;
begin
    -- Definer skips the policy, so refuse an erased account here too (#579).
    if exists (
        select 1
          from public.users u
         where u.id = auth.uid()
           and u.deleted_at is not null
    ) then
        return null;
    end if;
    insert into public.push_subscriptions (
        user_id, device_id, device_name, platform, push_credentials, is_active
    ) values (
        auth.uid(), p_device_id, p_device_name, p_platform, p_push_credentials, true
    )
    on conflict (user_id, device_id) do update set
        device_name = excluded.device_name,
        platform = excluded.platform,
        push_credentials = excluded.push_credentials,
        is_active = true,
        failed_count = 0,
        last_error = null,
        updated_at = now()
    returning id into v_subscription_id;

    return v_subscription_id;
end;
$$;

revoke all on function public.register_push_subscription(text, text, text, jsonb) from public, anon;
grant execute on function public.register_push_subscription(text, text, text, jsonb) to authenticated, service_role;
