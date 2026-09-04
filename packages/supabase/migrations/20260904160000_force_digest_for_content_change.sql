-- Issue #204. A content_change must always take the digest branch.
--
-- Migration 20260904100100 recreated this function with the content_change
-- preference case but without the pin, because the pin belongs to this issue.
-- Remote never runs db reset, so without this migration production keeps the
-- pre-pin body and can still write email_type = 'immediate' for the type.
--
-- Two constraints fix the placement, and both are privacy, not style. The
-- immediate consumer path has no send-time privacy re-check, so an immediate
-- carrier would mail a line about a document that is now private. And quiet
-- hours returns without inserting an email_queue row, which the 24-hour dedupe
-- would turn into a whole silent day.

create or replace function public.queue_email_notification()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
    prefs jsonb;
    email_frequency text;
    should_queue boolean := false;
    queue_type text;
    schedule_time timestamptz;
    user_tz text;
begin
    if tg_op != 'INSERT' then
        return new;
    end if;

    prefs := internal.get_email_preferences(new.receiver_user_id);

    if not coalesce((prefs->>'email_enabled')::boolean, false) then
        return new;
    end if;

    case new.type::text
        when 'mention' then
            should_queue := coalesce((prefs->>'email_mentions')::boolean, true);
        when 'reply' then
            should_queue := coalesce((prefs->>'email_replies')::boolean, true);
        when 'reaction' then
            should_queue := coalesce((prefs->>'email_reactions')::boolean, false);
        -- Named on purpose. Its push twin defaults off, so leaving this type on
        -- the unnamed `else` would give one new value two accidental defaults.
        -- Email is the channel this feature exists for, so it defaults on.
        when 'content_change' then
            should_queue := coalesce((prefs->>'email_content_changes')::boolean, true);
        else
            should_queue := true;
    end case;

    if not should_queue then
        return new;
    end if;

    email_frequency := coalesce(prefs->>'email_frequency', 'daily');
    user_tz := coalesce(prefs->>'timezone', 'UTC');

    case email_frequency
        when 'immediate' then
            queue_type := 'immediate';
            schedule_time := now() + interval '15 minutes';
        when 'daily' then
            queue_type := 'digest';
            begin
                schedule_time := (
                    date_trunc('day', now() at time zone user_tz) + interval '1 day' + interval '9 hours'
                ) at time zone user_tz;
            exception when others then
                schedule_time := date_trunc('day', now()) + interval '1 day' + interval '9 hours';
            end;
        when 'weekly' then
            queue_type := 'digest';
            begin
                schedule_time := (
                    date_trunc('week', now() at time zone user_tz) + interval '1 week' + interval '9 hours'
                ) at time zone user_tz;
            exception when others then
                schedule_time := date_trunc('week', now()) + interval '1 week' + interval '9 hours';
            end;
        else
            return new;
    end case;

    -- A privacy pin, not a rendering choice. The immediate consumer path has no
    -- send-time privacy re-check. Quiet hours also returns without inserting a
    -- row, and the 24-hour dedupe would then silence a whole day. Pinned between
    -- the two on purpose: the case above returns for email_frequency = 'never'.
    if new.type::text = 'content_change' then
        queue_type := 'digest';
    end if;

    -- Check quiet hours for immediate emails
    if queue_type = 'immediate' and coalesce((prefs->>'quiet_hours_enabled')::boolean, false) then
        declare
            now_time time;
            quiet_start time;
            quiet_end time;
        begin
            now_time := (now() at time zone user_tz)::time;
            quiet_start := (prefs->>'quiet_hours_start')::time;
            quiet_end := (prefs->>'quiet_hours_end')::time;

            if quiet_start > quiet_end then
                if now_time >= quiet_start or now_time <= quiet_end then
                    return new;
                end if;
            else
                if now_time >= quiet_start and now_time <= quiet_end then
                    return new;
                end if;
            end if;
        exception when others then
            null;
        end;
    end if;

    insert into public.email_queue (
        notification_id,
        user_id,
        email_type,
        scheduled_for
    ) values (
        new.id,
        new.receiver_user_id,
        queue_type,
        schedule_time
    );

    return new;
end;
$$;

-- The cap counts email_queue ROWS, and one digest marks one row per
-- notification 'sent'. Before the pin an immediate-frequency user had no digest
-- rows at all; now their content changes land there, so one digest could burn
-- the 50-a-day allowance and drop their mention emails. This LOOSENS the cap
-- for existing daily and weekly users, whose digest rows counted before. That
-- is intentional: the cap is a per-day email limit, not a per-row one.
create or replace function internal.check_email_rate_limit(
    p_user_id uuid,
    p_max_per_day int default 50
)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
    -- Counts immediate rows only. One digest marks one row per notification
    -- 'sent', so counting every row made a 60-notification digest read as 60
    -- emails. Since content_change is pinned to the digest branch, that would
    -- burn an immediate-frequency user's allowance and drop their mentions.
    select coalesce(
        (select count(*) < p_max_per_day
         from public.email_queue
         where user_id = p_user_id
           and status = 'sent'
           and email_type = 'immediate'
           and sent_at > now() - interval '24 hours'),
        true
    );
$$;
