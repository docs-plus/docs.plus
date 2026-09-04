-- Issue #203, part two of two. The follow column, the fan-out, the two follow
-- RPCs, the two type gates and the dedupe index. Depends on the enum value added
-- by the migration timestamped 20260904100000.
--
-- The grants are written here as well as in scripts/29-lint-hardening.sql. That
-- file is local-seed only: its §5 revoke sweep never runs on remote, so remote
-- needs the grant stated directly.
--
-- The two trigger functions are recreated in full. A new notification_category
-- value enrols in every type-blind consumer, and both consumers live in scripts
-- that no migration replays, so a scripts-only gate would never reach remote.

alter table public.workspace_members
    add column if not exists content_email_muted_at timestamp with time zone;

comment on column public.workspace_members.content_email_muted_at is 'Timestamp when this member muted content-change notifications for this document. Null means this member follows the document, but only while left_at is also null. Never trust this column for privacy: it is a delivery preference, not an access control, and it grants and removes no read rights.';

-- Serves the 24-hour dedupe below. Without it the planner de-correlates the
-- `not exists` into a Join Filter, measured at 2081 ms for 10,000 followers on a
-- 600k-row table; with it, a Hash Anti Join at 4.9 ms. Partial, so only open
-- carriers of this one type enter it: 592 kB measured over 21,110 rows.
create index if not exists idx_notifications_content_change_open
    on public.notifications (channel_id, receiver_user_id)
    where type = 'content_change' and readed_at is null;

create or replace function public.notify_document_content_change(
    p_document_id varchar(36),
    p_editor_ids uuid[] default '{}',
    p_only_user uuid default null,
    p_actor_id uuid default null,
    p_action_url text default null
)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
    -- A null inside the array makes `= any(...)` yield null, which rejects every
    -- candidate and fans out to nobody. Every REST write path sends [null].
    v_editor_ids uuid[] := array_remove(coalesce(p_editor_ids, '{}'::uuid[]), null::uuid);
    v_sender_user_id uuid;
    v_count integer := 0;
begin
    -- Ruled: a document no signed-in person has ever opened has no workspaces
    -- row, notifies nobody, and this read path must not create that row.
    if not exists (
        select 1
          from public.workspaces
         where id = p_document_id
           and deleted_at is null
    ) then
        return 0;
    end if;

    -- Same rule as the workspace guard above: this read path creates nothing.
    -- A workspaces row implies a channels row, because join_workspace is the
    -- only writer of workspaces and always follows it with a member insert,
    -- whose trigger mints the channel. A null here means a broken document.
    if not exists (select 1 from public.channels where id = p_document_id) then
        return 0;
    end if;

    -- Insert a null sender, do not skip the row and do not abort the call.
    -- A REST write has no acting person, and the FK would fail the insert.
    v_sender_user_id := (select u.id from public.users u where u.id = p_actor_id);

    with recipients as (
        select wm.member_id as receiver_user_id
          from public.workspace_members wm
         where p_only_user is null
           and wm.workspace_id = p_document_id
           and wm.left_at is null
           and wm.content_email_muted_at is null
        union all
        -- Membership is not required on this branch. An owner who opened the
        -- document but never joined the workspace must still be reached. A
        -- member who muted it, or who left it, is not: both arms read the mute
        -- column the same way, and it only means anything while left_at is null.
        select p_only_user
         where p_only_user is not null
           and exists (select 1 from public.users where id = p_only_user)
           and not exists (
               select 1
                 from public.workspace_members wm
                where wm.workspace_id = p_document_id
                  and wm.member_id = p_only_user
                  and (wm.content_email_muted_at is not null or wm.left_at is not null)
           )
    )
    insert into public.notifications (
        receiver_user_id,
        sender_user_id,
        type,
        message_id,
        channel_id,
        message_preview,
        action_url,
        created_at
    )
    -- The window keys on an unread carrier, so reading one re-arms it and the
    -- same person can be told again inside the same day.
    select
        r.receiver_user_id,
        v_sender_user_id,
        'content_change'::notification_category,
        null::uuid,
        p_document_id,
        'Document content updated',
        p_action_url,
        timezone('utc', now())
      from recipients r
     -- One home for the self-suppression rule, rather than one copy per arm.
     where not (r.receiver_user_id = any (v_editor_ids))
       and not exists (
         select 1
           from public.notifications n
          where n.receiver_user_id = r.receiver_user_id
            and n.type = 'content_change'
            and n.channel_id = p_document_id
            and n.readed_at is null
            and n.created_at > now() - interval '24 hours'
     );

    get diagnostics v_count = row_count;
    return v_count;
end;
$$;

comment on function public.notify_document_content_change(varchar, uuid[], uuid, uuid, text) is
'Service-role only fan-out of document content changes. Inserts one content_change notification per eligible follower and returns the row count. Editors, members who muted the document, and anyone already holding an unread carrier from the last 24 hours are skipped. Writes nothing but notifications: it returns 0 when the document has no workspaces row or no channels row.';

-- Server-side only: the hocuspocus worker fans out with the service_role key.
-- The webapp must never call it, so the browser roles stay revoked here too.
-- §5 of 29-lint-hardening revokes from public, anon and authenticated only,
-- so the service_role grant below survives that sweep.
revoke execute on function public.notify_document_content_change(varchar, uuid[], uuid, uuid, text)
    from public, anon, authenticated;
grant execute on function public.notify_document_content_change(varchar, uuid[], uuid, uuid, text)
    to service_role;

-- Mutes or unmutes content-change mail for the caller on one document.
-- UPDATE-only: an upsert fires notify_on_workspace_join, which posts a
-- "joined" chat message. updated_at is join_workspace's last-visit stamp and
-- the roster renders it, so this never names that column.
create or replace function public.set_document_follow(
    p_document_id varchar(36),
    p_follow boolean
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
    v_user_id uuid := auth.uid();
begin
    if v_user_id is null then
        raise exception 'unauthenticated' using errcode = '42501';
    end if;
    -- An explicit null would fall to the else arm and mute. Fail loudly
    -- instead of stopping someone's mail without them asking.
    if p_follow is null then
        raise exception 'follow_must_be_boolean' using errcode = '22004';
    end if;

    update public.workspace_members
       set content_email_muted_at = case when p_follow then null else timezone('utc', now()) end
     where workspace_id = p_document_id
       and member_id = v_user_id
       and left_at is null;

    return found;
end;
$$;

comment on function public.set_document_follow(varchar, boolean) is
'Sets the caller''s content-change follow state for one document. p_document_id is the documentId verbatim, the value held in workspace_members.workspace_id and workspaces.id, never the lowercased workspaces.slug. UPDATE-only, and never writes updated_at. Returns true when a membership row matched, false when the caller has no active membership.';

-- Reads the same state back. Null means the caller has no active membership
-- row, which is a different answer from "muted".
create or replace function public.get_document_follow_state(p_document_id varchar(36))
returns boolean
language sql
stable
security definer
set search_path = public
as $$
    select wm.content_email_muted_at is null
    from public.workspace_members wm
    where wm.workspace_id = p_document_id
      and wm.member_id = auth.uid()
      and wm.left_at is null;
$$;

comment on function public.get_document_follow_state(varchar) is
'Returns the caller''s content-change follow state for one document: true when following, false when muted, null when the caller has no active membership. p_document_id is the documentId verbatim, the value held in workspace_members.workspace_id, never the lowercased workspaces.slug that get_document_members takes.';

-- Stated here like every other browser-facing function in this file. §5 of
-- 29-lint-hardening sweeps it away on a local seed and §6 restores it, but the
-- migration path never runs that sweep, so remote needs the grant written down.
revoke execute on function public.set_document_follow(varchar, boolean) from anon;
grant execute on function public.set_document_follow(varchar, boolean) to authenticated;
revoke execute on function public.get_document_follow_state(varchar) from anon;
grant execute on function public.get_document_follow_state(varchar) to authenticated;

-- The push gate. Without it content_change falls through the three type
-- checks, which have no else arm, and pushes with no per-type preference.
create or replace function public.enqueue_push_notification()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
    v_receiver_id uuid;
    v_sender_name text;
    v_sender_avatar text;
    v_prefs jsonb;
    v_notify_type text;
    v_has_subscriptions boolean;
    v_action_url text;
begin
    -- Get receiver ID
    v_receiver_id := new.receiver_user_id;

    -- Don't notify self
    if v_receiver_id = new.sender_user_id then
        return new;
    end if;

    -- Check if user has push enabled
    if not internal.is_push_enabled(v_receiver_id) then
        return new;
    end if;

    -- Check if user is online (skip push if online)
    if internal.is_user_online(v_receiver_id) then
        return new;
    end if;

    -- Check quiet hours
    if internal.is_quiet_hours(v_receiver_id) then
        return new;
    end if;

    -- Get user preferences
    v_prefs := internal.get_push_preferences(v_receiver_id);
    v_notify_type := new.type;

    -- Check if this notification type is enabled
    if v_notify_type = 'mention' and not coalesce((v_prefs->>'push_mentions')::boolean, true) then
        return new;
    end if;
    if v_notify_type = 'reply' and not coalesce((v_prefs->>'push_replies')::boolean, true) then
        return new;
    end if;
    if v_notify_type = 'reaction' and not coalesce((v_prefs->>'push_reactions')::boolean, true) then
        return new;
    end if;
    -- content_change is the only type here that defaults off. There is no
    -- push UI toggle for it, so it must be opt-in. The three gates above
    -- have no else, so without this gate it reaches the queue with no
    -- per-type preference check.
    if v_notify_type = 'content_change' and not coalesce((v_prefs->>'push_content_changes')::boolean, false) then
        return new;
    end if;

    -- Check if user has any active push subscriptions
    select exists(
        select 1 from public.push_subscriptions
        where user_id = v_receiver_id and is_active = true
    ) into v_has_subscriptions;

    if not v_has_subscriptions then
        return new;
    end if;

    -- Get sender info
    select
        coalesce(full_name, username, 'Someone'),
        avatar_url
    into v_sender_name, v_sender_avatar
    from public.users
    where id = new.sender_user_id;

    -- Build action URL
    v_action_url := coalesce(new.action_url, '');

    -- =========================================================================
    -- ENQUEUE TO pgmq (instead of pg_net HTTP call)
    -- Backend consumer will process this and send via Web Push API
    -- =========================================================================

    perform pgmq.send(
        queue_name := 'push_notifications',
        msg := jsonb_build_object(
            'notification_id', new.id,
            'user_id', v_receiver_id,
            'type', v_notify_type,
            'sender_name', v_sender_name,
            'sender_avatar', v_sender_avatar,
            'message_preview', coalesce(new.message_preview, ''),
            'action_url', v_action_url,
            'channel_id', new.channel_id,
            'enqueued_at', now()
        )
    );

    return new;
end;
$$;

-- The email arm. Its else defaults to sending, so the new type needs a name.
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
