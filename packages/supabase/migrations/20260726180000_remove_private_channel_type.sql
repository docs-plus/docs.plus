-- Retire the PRIVATE channel type.
--
-- docs.plus no longer offers private channels. This removes the PRIVATE case of
-- a wider defect but does NOT fix the defect: `increment_unread_count_on_new_message`
-- (SECURITY DEFINER) still enrols every workspace member into a channel without
-- checking its type, so BROADCAST, ARCHIVE, DIRECT and GROUP would each be exposed
-- the same way. They carry no rows today, which is the only reason this is safe.
-- Add the type guard before any of them is used.
--
-- Postgres has no `ALTER TYPE ... DROP VALUE`, so this recreates the type. That
-- forces every dependent policy to be dropped and rebuilt: nine of them reference
-- `channels.type` through an enum literal (seven in public, two on storage.objects).
-- The bodies below are copied verbatim from the source-of-truth scripts
-- (`13-RLS.sql`, `12-buckets.sql`) minus PRIVATE, so the two stay in parity.
--
-- SAFETY: no data migration, and that is only correct while zero rows carry the
-- value. The assertion below fails the whole migration rather than silently
-- rewriting a PRIVATE channel into something else.

do $$
begin
  if exists (select 1 from public.channels where type = 'PRIVATE') then
    raise exception 'Refusing to drop PRIVATE from channel_type: % channel(s) still use it',
      (select count(*) from public.channels where type = 'PRIVATE');
  end if;
end
$$;

drop policy if exists channel_members_join_insert   on public.channel_members;
drop policy if exists channels_visible_select       on public.channels;
drop policy if exists channels_public_anon_select   on public.channels;
drop policy if exists messages_public_anon_select   on public.messages;
drop policy if exists counts_public_anon_select     on public.channel_message_counts;
drop policy if exists pinned_public_anon_select     on public.pinned_messages;
drop policy if exists workspaces_public_anon_select on public.workspaces;
drop policy if exists "Authed can read public channel chat media" on storage.objects;
drop policy if exists "Anon can read public channel chat media"   on storage.objects;

alter type public.channel_type rename to channel_type_old;

create type public.channel_type as enum (
    'PUBLIC',     -- PUBLIC: Open for all users. Any user of the application can join and participate.
    'BROADCAST',  -- BROADCAST: One-way communication channel where selected users can post, but all users can view.
    'ARCHIVE',    -- ARCHIVE: Read-only channel for historical/reference purposes. No new messages can be posted.
    'DIRECT',     -- DIRECT: One-on-one private conversation between two users.
    'GROUP'       -- GROUP: For a specific set of users, typically used for group discussions or team collaborations.
);

alter table public.channels alter column type drop default;
alter table public.channels
  alter column type type public.channel_type using type::text::public.channel_type;
alter table public.channels alter column type set default 'PUBLIC'::public.channel_type;

drop type public.channel_type_old;

comment on type public.channel_type is 'Defines the types of channels available in the application, each with specific accessibility and interaction rules.';

CREATE POLICY channels_visible_select ON public.channels
  FOR SELECT TO authenticated
  USING (type = 'PUBLIC' OR internal.is_channel_member(id));

CREATE POLICY channel_members_join_insert ON public.channel_members
  FOR INSERT TO authenticated
  WITH CHECK (
    member_id = (SELECT auth.uid())
    AND EXISTS (
      SELECT 1 FROM public.channels c
      WHERE c.id = channel_id
        AND c.deleted_at IS NULL
        AND c.type = 'PUBLIC'
        AND internal.is_workspace_member(c.workspace_id)
    )
  );

CREATE POLICY channels_public_anon_select ON public.channels
  FOR SELECT TO anon
  USING (type = 'PUBLIC' AND deleted_at IS NULL);

CREATE POLICY messages_public_anon_select ON public.messages
  FOR SELECT TO anon
  USING (
    deleted_at IS NULL
    AND EXISTS (
      SELECT 1 FROM public.channels c
      WHERE c.id = messages.channel_id
        AND c.type = 'PUBLIC'
        AND c.deleted_at IS NULL
    )
  );

CREATE POLICY counts_public_anon_select ON public.channel_message_counts
  FOR SELECT TO anon
  USING (
    EXISTS (
      SELECT 1 FROM public.channels c
      WHERE c.id = channel_message_counts.channel_id
        AND c.type = 'PUBLIC'
        AND c.deleted_at IS NULL
    )
  );

CREATE POLICY pinned_public_anon_select ON public.pinned_messages
  FOR SELECT TO anon
  USING (
    EXISTS (
      SELECT 1 FROM public.channels c
      WHERE c.id = pinned_messages.channel_id
        AND c.type = 'PUBLIC'
        AND c.deleted_at IS NULL
    )
  );

CREATE POLICY workspaces_public_anon_select ON public.workspaces
  FOR SELECT TO anon
  USING (
    deleted_at IS NULL
    AND EXISTS (
      SELECT 1 FROM public.channels c
      WHERE c.workspace_id = workspaces.id
        AND c.type = 'PUBLIC'
        AND c.deleted_at IS NULL
    )
  );

create policy "Authed can read public channel chat media" on storage.objects
    for select to authenticated using (
        bucket_id = 'media'
        and exists (
            select 1
              from public.channels c
             where c.id = (storage.foldername(objects.name))[2]
               and c.type = 'PUBLIC'
        )
    );

create policy "Anon can read public channel chat media" on storage.objects
    for select to anon using (
        bucket_id = 'media'
        and exists (
            select 1
              from public.channels c
             where c.id = (storage.foldername(objects.name))[2]
               and c.type = 'PUBLIC'
        )
    );
