-- The bounce system_alert linked to /settings/notifications. The webapp has
-- no /settings route, so a push click opened a pad named "settings". It now
-- links to /#settings?tab=notifications, the hash the email footer uses.
-- Paired with scripts/07-5-email-notifications-pgmq.sql.
--
-- Replaces one function: record_email_bounce. Only the action_url changes.
-- create or replace keeps its security definer mode and its grants.

create or replace function public.record_email_bounce(
    p_email text,
    p_bounce_type text,
    p_provider text default null,
    p_reason text default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
    v_id uuid;
    v_user_id uuid;
    v_masked_email text;
begin
    if p_bounce_type not in ('hard', 'soft', 'complaint') then
        raise exception 'Invalid bounce_type: %. Must be hard, soft, or complaint.', p_bounce_type;
    end if;

    insert into public.email_bounces (email, bounce_type, provider, reason)
    values (lower(p_email), p_bounce_type, p_provider, p_reason)
    returning id into v_id;

    -- Auto-disable email notifications and notify user on hard bounce / complaint
    if p_bounce_type in ('hard', 'complaint') then
        -- Find the user
        select id into v_user_id
        from public.users
        where lower(email) = lower(p_email);

        if v_user_id is not null then
            v_masked_email := internal.mask_email(p_email);

            -- Disable email + store bounce info in preferences
            update public.users
            set profile_data = jsonb_set(
                jsonb_set(
                    coalesce(profile_data, '{}'::jsonb),
                    '{notification_preferences,email_enabled}',
                    'false'::jsonb
                ),
                '{notification_preferences,email_bounce_info}',
                jsonb_build_object(
                    'email', v_masked_email,
                    'reason', coalesce(p_reason, 'Email delivery failed'),
                    'bounced_at', now()::text
                )
            )
            where id = v_user_id;

            -- Insert system_alert notification so user sees it in-app.
            -- There is no /settings route: a path would open a pad named
            -- "settings". The hash opens the Settings panel, like the email footer.
            insert into public.notifications (
                receiver_user_id,
                sender_user_id,
                type,
                message_preview,
                action_url,
                created_at
            ) values (
                v_user_id,
                null,
                'system_alert',
                'Email delivery to ' || v_masked_email || ' failed. Your email notifications have been paused. Tap to review.',
                '/#settings?tab=notifications',
                now()
            );
        end if;
    end if;

    return v_id;
end;
$$;

comment on function public.record_email_bounce(text, text, text, text) is
'Records an email bounce/complaint. Hard bounces auto-disable email, store bounce info, and notify user.';
