-- Issue #396. A Private document's chat opens only for its owner. Hocuspocus copies
-- the Private flag and owner into public.document_access; a missing row means public.
-- Pairs with scripts 03-2-document_access, 07-bookmark-functions, 09-document-views,
-- 10-0-func-helpers, 10-functions, 10-func-notifications, 12-buckets, 13-RLS.
-- Idempotent. messages_self_update keeps every clause from #400 (20261008120000).

-- 1. Mirror table.
create table if not exists public.document_access (
    document_id varchar(36) primary key, -- The documentId verbatim, the same value as channels.workspace_id.
    is_private  boolean not null,
    owner_id    uuid, -- No foreign key: Prisma owns the owner fact.
    updated_at  timestamp with time zone not null default now()
);

comment on table public.document_access is
'Private flag and owner of a document, copied from Prisma by Hocuspocus with the service role. A missing row means public. Clients have no access.';

-- RLS with no policy, and no client grant. Hosted Supabase grants a new public
-- table to anon and authenticated, so the revoke is load-bearing.
alter table public.document_access enable row level security;
revoke all on public.document_access from anon, authenticated;
grant all on public.document_access to service_role;

-- 2. The helper, then the three primitives. They copy its predicate inline for speed.
-- Keep all four copies identical. SQL bodies resolve at create time, so the table comes first.
-- A Private document opens only for its owner (#396). No row means public.
-- An ownerless Private row opens for nobody, and a null user never owns one.
CREATE OR REPLACE FUNCTION internal.can_open_document(p_document_id varchar, p_user_id uuid)
RETURNS boolean
LANGUAGE sql STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT NOT EXISTS (
    SELECT 1 FROM public.document_access da
    WHERE da.document_id = p_document_id
      AND da.is_private
      AND coalesce(da.owner_id = p_user_id, false) = false
  );
$$;

COMMENT ON FUNCTION internal.can_open_document(varchar, uuid) IS
'False when the document is Private and the user is not its owner. Reads public.document_access.';

CREATE OR REPLACE FUNCTION internal.is_workspace_member(p_workspace_id varchar)
RETURNS boolean
LANGUAGE sql STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.workspace_members
    WHERE workspace_id = p_workspace_id
      AND member_id    = auth.uid()
      AND left_at IS NULL
  )
  AND NOT EXISTS (
    SELECT 1 FROM public.document_access da
    WHERE da.document_id = p_workspace_id
      AND da.is_private
      AND coalesce(da.owner_id = auth.uid(), false) = false
  );
$$;

COMMENT ON FUNCTION internal.is_workspace_member(varchar) IS
'Active workspace membership predicate for RLS policies. False on a Private document the caller does not own.';

CREATE OR REPLACE FUNCTION internal.is_channel_member(p_channel_id varchar)
RETURNS boolean
LANGUAGE sql STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.channel_members cm
    JOIN public.channels c ON c.id = cm.channel_id
    WHERE cm.channel_id = p_channel_id
      AND cm.member_id  = auth.uid()
      AND cm.left_at IS NULL
      AND NOT EXISTS (
        SELECT 1 FROM public.document_access da
        WHERE da.document_id = c.workspace_id
          AND da.is_private
          AND coalesce(da.owner_id = auth.uid(), false) = false
      )
  );
$$;

COMMENT ON FUNCTION internal.is_channel_member(varchar) IS
'Active channel membership predicate for RLS policies. False on a Private document the caller does not own.';

CREATE OR REPLACE FUNCTION internal.can_read_channel(p_channel_id varchar)
RETURNS boolean
LANGUAGE sql STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.channels c
    WHERE c.id = p_channel_id
      AND NOT EXISTS (
        SELECT 1 FROM public.document_access da
        WHERE da.document_id = c.workspace_id
          AND da.is_private
          AND coalesce(da.owner_id = auth.uid(), false) = false
      )
      AND (
        c.type = 'PUBLIC'
        OR EXISTS (
          SELECT 1 FROM public.channel_members cm
          WHERE cm.channel_id = c.id
            AND cm.member_id  = auth.uid()
            AND cm.left_at IS NULL
        )
      )
  );
$$;

COMMENT ON FUNCTION internal.can_read_channel(varchar) IS
'PUBLIC bypass + active channel membership; read-eligibility predicate. False on a Private document the caller does not own.';

-- 3. Grants come before the policies that call the helper. Anon policies need them too.
grant usage on schema internal to anon, authenticated, service_role;
grant execute on function internal.can_open_document(varchar, uuid) to anon, authenticated, service_role;

-- 4. Policies that need an explicit check.
DROP POLICY IF EXISTS channels_visible_select ON public.channels;
CREATE POLICY channels_visible_select ON public.channels
  FOR SELECT TO authenticated
  USING (
    (type = 'PUBLIC' AND internal.can_open_document(workspace_id, (select auth.uid())))
    OR internal.is_channel_member(id)
  );

DROP POLICY IF EXISTS messages_self_update ON public.messages;
CREATE POLICY messages_self_update ON public.messages
  FOR UPDATE TO authenticated
  USING (
    user_id = (select auth.uid())
    AND type IS DISTINCT FROM 'notification'
    AND internal.can_read_channel(channel_id)
  )
  WITH CHECK (
    user_id = (select auth.uid())
    AND type IS DISTINCT FROM 'notification'
  );

DROP POLICY IF EXISTS channels_public_anon_select ON public.channels;
CREATE POLICY channels_public_anon_select ON public.channels
  FOR SELECT TO anon
  USING (
    type = 'PUBLIC'
    AND deleted_at IS NULL
    AND internal.can_open_document(workspace_id, null::uuid)
  );

DROP POLICY IF EXISTS messages_public_anon_select ON public.messages;
CREATE POLICY messages_public_anon_select ON public.messages
  FOR SELECT TO anon
  USING (
    deleted_at IS NULL
    AND EXISTS (
      SELECT 1 FROM public.channels c
      WHERE c.id = messages.channel_id
        AND c.type = 'PUBLIC'
        AND c.deleted_at IS NULL
        AND internal.can_open_document(c.workspace_id, null::uuid)
    )
  );

DROP POLICY IF EXISTS counts_public_anon_select ON public.channel_message_counts;
CREATE POLICY counts_public_anon_select ON public.channel_message_counts
  FOR SELECT TO anon
  USING (
    EXISTS (
      SELECT 1 FROM public.channels c
      WHERE c.id = channel_message_counts.channel_id
        AND c.type = 'PUBLIC'
        AND c.deleted_at IS NULL
        AND internal.can_open_document(c.workspace_id, null::uuid)
    )
  );

DROP POLICY IF EXISTS pinned_public_anon_select ON public.pinned_messages;
CREATE POLICY pinned_public_anon_select ON public.pinned_messages
  FOR SELECT TO anon
  USING (
    EXISTS (
      SELECT 1 FROM public.channels c
      WHERE c.id = pinned_messages.channel_id
        AND c.type = 'PUBLIC'
        AND c.deleted_at IS NULL
        AND internal.can_open_document(c.workspace_id, null::uuid)
    )
  );

DROP POLICY IF EXISTS workspaces_public_anon_select ON public.workspaces;
CREATE POLICY workspaces_public_anon_select ON public.workspaces
  FOR SELECT TO anon
  USING (
    deleted_at IS NULL
    AND internal.can_open_document(workspaces.id, null::uuid)
    AND EXISTS (
      SELECT 1 FROM public.channels c
      WHERE c.workspace_id = workspaces.id
        AND c.type = 'PUBLIC'
        AND c.deleted_at IS NULL
    )
  );

-- 5. Chat media. The path is <uploaderId>/<channelId>/<file>, so segment 2 is the channel.
-- One read policy for signed-in users replaces the member and the PUBLIC policies.
-- A past member (left_at set) loses read and upload. That is deliberate.
drop policy if exists "Channel members can read chat media" on storage.objects;
drop policy if exists "Authed can read public channel chat media" on storage.objects;
drop policy if exists "Authed can read chat media" on storage.objects;
create policy "Authed can read chat media" on storage.objects
    for select to authenticated using (
        bucket_id = 'media'
        and internal.can_read_channel((storage.foldername(objects.name))[2])
    );

-- Inside the EXISTS, objects.name names the storage row.
drop policy if exists "Anon can read public channel chat media" on storage.objects;
create policy "Anon can read public channel chat media" on storage.objects
    for select to anon using (
        bucket_id = 'media'
        and exists (
            select 1
              from public.channels c
             where c.id = (storage.foldername(objects.name))[2]
               and c.type = 'PUBLIC'
               and internal.can_open_document(c.workspace_id, null::uuid)
        )
    );

drop policy if exists "User can upload own channel chat media" on storage.objects;
create policy "User can upload own channel chat media" on storage.objects
    for insert to authenticated with check (
        bucket_id = 'media'
        and (storage.foldername(objects.name))[1] = (select auth.uid())::text
        and internal.is_channel_member((storage.foldername(objects.name))[2])
    );

-- 6. Read cursor.
create or replace function public.advance_read_cursor(
  p_channel_id varchar(36),
  p_up_to_seq  bigint
) returns void
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_uid uuid := (select auth.uid());
  v_new_seq bigint;
  v_unread int;
begin
  if v_uid is null then
    raise exception 'not authenticated' using errcode = '42501';
  end if;

  -- A past member of a Private document keeps a row, but must not learn its unread count.
  if not internal.can_read_channel(p_channel_id) then
    return;
  end if;

  -- FOR UPDATE locks the row so concurrent advances (open tab + mobile)
  -- cannot interleave SELECT/UPDATE and flap unread_message_count.
  select greatest(last_read_seq, p_up_to_seq) into v_new_seq
  from public.channel_members
  where channel_id = p_channel_id and member_id = v_uid
  for update;

  if v_new_seq is null then
    return;
  end if;

  -- Exclude the reader's own messages: the increment trigger never counts a
  -- sender's own message as unread, so the recompute must not either (a stale
  -- debounced advance could otherwise transiently show your own send as unread).
  select coalesce(count(*), 0) into v_unread
  from public.messages
  where channel_id = p_channel_id
    and deleted_at is null
    and seq > v_new_seq
    and user_id <> v_uid;

  update public.channel_members
  set last_read_seq = v_new_seq,
      unread_message_count = v_unread,
      last_read_update_at = (now() at time zone 'utc')
  where channel_id = p_channel_id and member_id = v_uid;

  -- Private topic `chatroom-read:{id}` gated by chatroom_read_topic_access
  -- on realtime.messages (members-only). The cursor write is the durable
  -- contract; broadcast failure (broker hiccup, missing extension) must
  -- not roll back the UPDATE.
  begin
    perform realtime.send(
      jsonb_build_object('user_id', v_uid, 'seq', v_new_seq),
      'read:advanced',
      'chatroom-read:' || p_channel_id,
      true
    );
  exception when others then
    raise warning 'read:advanced broadcast failed: %', sqlerrm;
  end;
end;
$$;

grant execute on function public.advance_read_cursor(varchar, bigint) to authenticated;
revoke execute on function public.advance_read_cursor(varchar, bigint) from anon, public;

-- 7. Read receipts topic. Line comments only: realtime.messages refuses comment on policy.
drop policy if exists "chatroom_read_topic_access" on realtime.messages;

create policy "chatroom_read_topic_access"
on realtime.messages
for select
to authenticated
using (
  realtime.messages.topic like 'chatroom-read:%'
  and internal.is_channel_member(substr(realtime.messages.topic, 15))
);

-- 8. join_workspace.
CREATE OR REPLACE FUNCTION join_workspace(
    _workspace_id VARCHAR(36)
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    user_id UUID;
BEGIN
    -- Get the current user ID
    user_id := auth.uid();

    -- Check if the user ID is valid
    IF user_id IS NULL THEN
        RAISE EXCEPTION 'Authentication required. User ID is NULL.';
    END IF;

    -- Refuse before the lazy workspace row, the joined notice and the channel enrolment.
    IF NOT internal.can_open_document(_workspace_id, user_id) THEN
        RAISE EXCEPTION 'Access denied' USING ERRCODE = '42501';
    END IF;

    -- Check if the workspace exists and is not deleted, create if it doesn't exist
    IF NOT EXISTS (
        SELECT 1 FROM public.workspaces
        WHERE id = _workspace_id AND deleted_at IS NULL
    ) THEN
        -- Create the workspace with the given ID
        INSERT INTO public.workspaces (id, name, slug, created_by)
        VALUES (_workspace_id, _workspace_id, lower(_workspace_id), user_id);
    END IF;

    -- Check if user is already a member of this workspace
    IF EXISTS (
        SELECT 1 FROM public.workspace_members
        WHERE workspace_id = _workspace_id AND member_id = user_id
    ) THEN
        -- Refresh "last visit" so the member roster shows a real last-seen time.
        UPDATE public.workspace_members
        SET updated_at = timezone('utc', now())
        WHERE workspace_id = _workspace_id AND member_id = user_id;
        -- Return true if the user is already a member
        RETURN TRUE;
    END IF;

    -- Insert new workspace member record
    INSERT INTO public.workspace_members (workspace_id, member_id)
    VALUES (_workspace_id, user_id);

        -- For new workspace members, create channel_members entries for all channels in this workspace
    -- Use a single INSERT with CTEs for optimal performance
    INSERT INTO public.channel_members (
        channel_id,
        member_id,
        unread_message_count,
        last_read_message_id,
        last_read_update_at
    )
    WITH channel_data AS (
        SELECT
            cmc.channel_id,
            cmc.message_count,
            c.created_at as channel_created_at
        FROM public.channel_message_counts cmc
        JOIN public.channels c ON c.id = cmc.channel_id
        WHERE cmc.workspace_id = _workspace_id
          AND c.deleted_at IS NULL
    ),
    first_messages AS (
        SELECT DISTINCT ON (m.channel_id)
            m.channel_id,
            m.id as first_message_id
        FROM public.messages m
        WHERE m.channel_id IN (SELECT channel_id FROM channel_data)
          AND m.deleted_at IS NULL
        ORDER BY m.channel_id, m.created_at ASC
    )
    SELECT
        cd.channel_id,
        user_id,
        cd.message_count,
        fm.first_message_id,
        cd.channel_created_at
    FROM channel_data cd
    LEFT JOIN first_messages fm ON fm.channel_id = cd.channel_id
    ON CONFLICT (channel_id, member_id) DO NOTHING;

    RETURN TRUE;
END;
$$;

COMMENT ON FUNCTION join_workspace(VARCHAR(36)) IS
'Adds the currently authenticated user to the specified workspace.
Returns TRUE if successful or if user is already a member.
Raises 42501 for a Private document the caller does not own.';

-- 9. One receiver gate for every notification row. It drops a row whose receiver
-- cannot open the document, so the bell, push and email (all AFTER INSERT) never fire.
-- A chat channel and a content_change row both resolve through channels.workspace_id.
-- A row with no channel is account-wide and always passes.
create or replace function internal.skip_unopenable_notification()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
    if exists (
        select 1
          from public.channels c
         where c.id = new.channel_id
           and not internal.can_open_document(c.workspace_id, new.receiver_user_id)
    ) then
        return null;
    end if;
    return new;
end;
$$;

revoke all on function internal.skip_unopenable_notification() from public, anon, authenticated;

drop trigger if exists skip_unopenable_notification on public.notifications;
create trigger skip_unopenable_notification
    before insert on public.notifications
    for each row
    when (new.channel_id is not null)
    execute function internal.skip_unopenable_notification();

-- Unread fan-out. The body sets neither security definer nor search_path, and
-- create or replace resets both, so the two alter lines after it are load-bearing.
CREATE OR REPLACE FUNCTION increment_unread_count_on_new_message() RETURNS TRIGGER AS $$
DECLARE
    workspace_id_var VARCHAR(36);
    channel_type_var public.channel_type;
BEGIN
    -- Skip if message type is notification
    IF NEW.type = 'notification' THEN
        RETURN NEW;
    END IF;

    -- Get the workspace ID and type for the channel where the message was posted
    SELECT workspace_id, type INTO workspace_id_var, channel_type_var
    FROM public.channels
    WHERE id = NEW.channel_id;

    -- If channel doesn't exist or has no workspace, exit early
    IF workspace_id_var IS NULL THEN
        RETURN NEW;
    END IF;

    -- Auto-enrolment is PUBLIC-only, because internal.can_read_channel grants read
    -- on an active channel_members row: enrolling the workspace into a DIRECT or
    -- GROUP channel would publish it to everyone. PUBLIC already reads via its type,
    -- so the row it creates grants nothing and only carries the unread badge.
    IF channel_type_var = 'PUBLIC' THEN
        -- Seed unread at 0, not 1: the increment UPDATE below always re-matches
        -- this fresh row (its last_read_update_at is < NEW.created_at) and brings
        -- it to 1 in the same transaction, so seeding 1 double-counts to 2.
        INSERT INTO public.channel_members (channel_id, member_id, unread_message_count, last_read_update_at)
        SELECT
            NEW.channel_id,
            wm.member_id,
            0,
            COALESCE((SELECT created_at FROM public.messages
                     WHERE channel_id = NEW.channel_id
                     ORDER BY created_at DESC
                     LIMIT 1 OFFSET 1),
                     timezone('utc', now()) - interval '1 second')
        FROM public.workspace_members wm
        WHERE wm.workspace_id = workspace_id_var
          AND wm.left_at IS NULL
          AND wm.member_id != NEW.user_id
          AND internal.can_open_document(workspace_id_var, wm.member_id)
          AND NOT EXISTS (
              SELECT 1
              FROM public.channel_members cm
              WHERE cm.channel_id = NEW.channel_id
                AND cm.member_id = wm.member_id
          )
        ON CONFLICT (channel_id, member_id) DO NOTHING;
    END IF;

    -- Then, increment unread message count for all existing channel members
    -- who are also active workspace members (excluding the sender)
    UPDATE public.channel_members cm
    SET unread_message_count = unread_message_count + 1
    FROM public.workspace_members wm
    WHERE cm.channel_id = NEW.channel_id
      AND cm.member_id != NEW.user_id
      AND wm.workspace_id = workspace_id_var
      AND wm.member_id = cm.member_id
      AND wm.left_at IS NULL
      AND cm.last_read_update_at < NEW.created_at
      AND internal.can_open_document(workspace_id_var, cm.member_id);

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

ALTER FUNCTION public.increment_unread_count_on_new_message() SET search_path = public;
ALTER FUNCTION public.increment_unread_count_on_new_message() SECURITY DEFINER;

-- 10. Bookmark toggle.
create or replace function public.toggle_message_bookmark(
    p_message_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
    v_user_id uuid;
    v_bookmark_id bigint;
    v_action text;
begin
    -- Get the current user ID
    v_user_id := auth.uid();

    if v_user_id is null then
        raise exception 'User not authenticated';
    end if;

    -- Check if bookmark already exists
    select id into v_bookmark_id
    from message_bookmarks
    where user_id = v_user_id and message_id = p_message_id;

    if v_bookmark_id is not null then
        -- Unbookmark path: do NOT gate on visibility. Users must be able
        -- to clean up bookmarks pointing at messages that have since been
        -- soft-deleted or whose channel they've left.
        delete from message_bookmarks
        where id = v_bookmark_id;
        v_action := 'removed';
    else
        -- Bookmark path: gate on read access, which includes the Private
        -- gate (#396), and on a live message. Closes the message-id
        -- existence probe via FK-error-vs-success.
        if not exists (
            select 1
            from public.messages m
            where m.id = p_message_id
              and m.deleted_at is null
              and internal.can_read_channel(m.channel_id)
        ) then
            raise exception 'Access denied: message % is not visible to this user.', p_message_id;
        end if;

        insert into message_bookmarks (user_id, message_id)
        values (v_user_id, p_message_id)
        returning id into v_bookmark_id;
        v_action := 'added';
    end if;

    return jsonb_build_object(
        'action', v_action,
        'bookmark_id', v_bookmark_id,
        'message_id', p_message_id
    );
end;
$$;

-- 11. Purge also deletes the Private mirror row, so no Private flag or owner outlives the document.
-- Erases a soft-deleted document's cross-store footprint. Ordering is
-- load-bearing: capture channel ids and delete storage BEFORE the workspace
-- cascade removes the channels those media paths are keyed by.
create or replace function public.purge_document_footprint(
    p_document_id varchar(36),
    p_slug text
)
returns void
language plpgsql
security definer
set search_path = public, storage
as $$
declare
    v_channel_ids varchar(36)[];
begin
    -- storage.protect_delete blocks raw DELETEs unless this GUC is set (the same
    -- flag the Storage API uses); scope it to this transaction.
    perform set_config('storage.allow_delete_query', 'true', true);

    -- Capture channel ids before the cascade drops them; media object paths are
    -- '<uploaderId>/<channelId>/<file>', so segment 2 is the channel id.
    select array_agg(id) into v_channel_ids
    from public.channels
    where workspace_id = p_document_id;

    delete from storage.objects
    where bucket_id = 'media'
      and split_part(name, '/', 2) = any(v_channel_ids);

    -- View rows are keyed by lower(documentId): enqueue_document_view stores
    -- lower(trim(<WS room name>)) and the room name IS the documentId, so a
    -- slug-only match deletes nothing. p_slug stays as belt-and-braces.
    delete from public.document_views
    where document_slug in (lower(p_document_id), lower(p_slug));
    delete from public.document_view_stats
    where document_slug in (lower(p_document_id), lower(p_slug));
    delete from public.document_views_daily
    where document_slug in (lower(p_document_id), lower(p_slug));

    -- The Private mirror stores the documentId verbatim, so match it without lower() (#396).
    delete from public.document_access where document_id = p_document_id;

    -- Cascades every chat table (channels, messages, members, bookmarks, …).
    delete from public.workspaces where id = p_document_id;
end;
$$;

comment on function public.purge_document_footprint(varchar, text) is
'Service-role GC for a soft-deleted document: storage objects first, analytics and Private mirror rows, workspace cascade last.';

revoke all on function public.purge_document_footprint(varchar, text) from public, anon, authenticated;
grant execute on function public.purge_document_footprint(varchar, text) to service_role;
