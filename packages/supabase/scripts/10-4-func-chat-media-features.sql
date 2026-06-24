-- Chat media features (mirror migration 20260623120000_chat_media_attachments.sql).

create or replace function public.fetch_media_message_window(
  p_channel_id varchar,
  p_before_seq bigint default null,
  p_limit int default 40
) returns jsonb
language plpgsql
stable
security invoker
set search_path = ''
as $$
declare
  v_rows jsonb;
  v_min_seq bigint;
  v_has_more_before boolean;
begin
  select coalesce(jsonb_agg(row_to_json(t) order by t.seq asc), '[]'::jsonb)
    into v_rows
    from (
      select m.*,
        json_build_object(
          'id', u.id,
          'username', u.username,
          'fullname', u.full_name,
          'avatar_url', u.avatar_url,
          'avatar_updated_at', u.avatar_updated_at
        ) as user_details,
        (mb.id is not null and mb.archived_at is null and mb.marked_at is null) as is_bookmarked,
        mb.id as bookmark_id
      from public.messages m
      left join public.users u on u.id = m.user_id
      left join public.message_bookmarks mb
        on mb.message_id = m.id and mb.user_id = (select auth.uid())
      where m.channel_id = p_channel_id
        and m.deleted_at is null
        and m.medias is not null
        and jsonb_typeof(m.medias) = 'array'
        and jsonb_array_length(m.medias) > 0
        and (p_before_seq is null or m.seq < p_before_seq)
      order by m.seq desc
      limit greatest(p_limit, 1)
    ) t;

  if v_rows = '[]'::jsonb then
    return jsonb_build_object(
      'rows', '[]'::jsonb,
      'anchor_seq', null,
      'has_more_before', false,
      'has_more_after', false
    );
  end if;

  select min((elem->>'seq')::bigint)
    into v_min_seq
    from jsonb_array_elements(v_rows) elem;

  v_has_more_before := exists (
    select 1
    from public.messages m
    where m.channel_id = p_channel_id
      and m.deleted_at is null
      and m.medias is not null
      and jsonb_typeof(m.medias) = 'array'
      and jsonb_array_length(m.medias) > 0
      and m.seq < v_min_seq
  );

  return jsonb_build_object(
    'rows', v_rows,
    'anchor_seq', null,
    'has_more_before', v_has_more_before,
    'has_more_after', false
  );
end;
$$;

comment on function public.fetch_media_message_window(varchar, bigint, int) is
  'Returns a descending-fetched, ascending-ordered page of messages that have attachments.';

grant execute on function public.fetch_media_message_window(varchar, bigint, int) to authenticated, anon;

create or replace function public.fetch_media_messages_since(
  p_channel_id varchar(36),
  p_since_seq bigint,
  p_limit int default 100
) returns jsonb
language sql
stable
security invoker
set search_path = ''
as $$
  select coalesce(jsonb_agg(row_to_json(t) order by t.seq asc), '[]'::jsonb)
  from (
    select m.*,
      json_build_object(
        'id', u.id,
        'username', u.username,
        'fullname', u.full_name,
        'avatar_url', u.avatar_url,
        'avatar_updated_at', u.avatar_updated_at
      ) as user_details,
      (mb.id is not null and mb.archived_at is null and mb.marked_at is null) as is_bookmarked,
      mb.id as bookmark_id
    from public.messages m
    left join public.users u on u.id = m.user_id
    left join public.message_bookmarks mb
      on mb.message_id = m.id and mb.user_id = (select auth.uid())
    where m.channel_id = p_channel_id
      and m.seq > p_since_seq
      and m.deleted_at is null
      and m.medias is not null
      and jsonb_typeof(m.medias) = 'array'
      and jsonb_array_length(m.medias) > 0
    order by m.seq asc
    limit p_limit
  ) t;
$$;

comment on function public.fetch_media_messages_since(varchar, bigint, int) is
  'Catchup refetch for media-only feed: messages with attachments and seq > p_since_seq.';

grant execute on function public.fetch_media_messages_since(varchar, bigint, int) to authenticated, anon;

-- Chat media object paths: {userId}/{channelId}/{uuid}.ext — workspace via segment 2 = channel_id.

create or replace function internal.media_workspace_quota_bytes()
returns bigint
language sql
immutable
parallel safe
set search_path = ''
as $$
  select 10737418240::bigint;
$$;

comment on function internal.media_workspace_quota_bytes() is
  'Per-workspace chat media quota (10 GiB). Stats RPCs and enforce_media_workspace_quota read this.';

revoke all on function internal.media_workspace_quota_bytes() from public;

create or replace function internal.media_workspace_usage_rows()
returns table(
  workspace_id varchar(36),
  total_bytes bigint,
  object_count bigint
)
language sql
stable
security definer
set search_path = public, storage
as $$
  select
    c.workspace_id,
    coalesce(sum((o.metadata->>'size')::bigint), 0)::bigint as total_bytes,
    count(*)::bigint as object_count
  from storage.objects o
  inner join public.channels c on c.id = split_part(o.name, '/', 2)
  where o.bucket_id = 'media'
  group by c.workspace_id;
$$;

comment on function internal.media_workspace_usage_rows() is
  'Aggregates media bucket usage by workspace (channel_id = split_part(path, ''/'', 2)).';

revoke all on function internal.media_workspace_usage_rows() from public;

drop function if exists public.get_workspace_media_storage_stats(uuid);
drop function if exists public.get_all_workspace_media_storage_stats();
drop function if exists public.get_workspace_media_storage_summary();

create or replace function public.get_workspace_media_storage_stats(p_workspace_id varchar(36))
returns jsonb
language sql
stable
security definer
set search_path = public, storage
as $$
  with quota as (
    select internal.media_workspace_quota_bytes() as q
  )
  select jsonb_build_object(
    'workspace_id', w.id,
    'slug', w.slug,
    'name', w.name,
    'total_bytes', coalesce(u.total_bytes, 0),
    'object_count', coalesce(u.object_count, 0),
    'quota_bytes', quota.q,
    'usage_percent', case
      when quota.q > 0
      then round((coalesce(u.total_bytes, 0)::numeric / quota.q) * 100)::int
      else 0
    end
  )
  from public.workspaces w
  cross join quota
  left join internal.media_workspace_usage_rows() u on u.workspace_id = w.id
  where w.id = p_workspace_id;
$$;

comment on function public.get_workspace_media_storage_stats(varchar) is
  'Per-workspace chat media usage row (same shape as fleet RPC rows).';

revoke all on function public.get_workspace_media_storage_stats(varchar) from public;
grant execute on function public.get_workspace_media_storage_stats(varchar) to service_role;

create or replace function public.get_all_workspace_media_storage_stats()
returns table(
  workspace_id varchar(36),
  slug text,
  name text,
  total_bytes bigint,
  object_count bigint,
  quota_bytes bigint,
  usage_percent int
)
language sql
stable
security definer
set search_path = public, storage
as $$
  with quota as (
    select internal.media_workspace_quota_bytes() as q
  )
  select
    u.workspace_id,
    w.slug,
    w.name,
    u.total_bytes,
    u.object_count,
    quota.q as quota_bytes,
    case
      when quota.q > 0
      then round((u.total_bytes::numeric / quota.q) * 100)::int
      else 0
    end as usage_percent
  from internal.media_workspace_usage_rows() u
  left join public.workspaces w on w.id = u.workspace_id
  cross join quota
  order by u.total_bytes desc;
$$;

comment on function public.get_all_workspace_media_storage_stats() is
  'Fleet list of workspaces with chat media (admin service reads once, paginates in TS).';

revoke all on function public.get_all_workspace_media_storage_stats() from public;
grant execute on function public.get_all_workspace_media_storage_stats() to service_role;

create or replace function public.get_workspace_media_storage_summary()
returns jsonb
language sql
stable
security definer
set search_path = public, storage
as $$
  with usage as (
    select * from internal.media_workspace_usage_rows()
  ),
  quota as (
    select internal.media_workspace_quota_bytes() as q
  )
  select jsonb_build_object(
    'total_bytes', coalesce((select sum(total_bytes) from usage), 0),
    'total_objects', coalesce((select sum(object_count) from usage), 0),
    'workspace_count', coalesce((select count(*)::int from usage), 0),
    'over_quota_count', coalesce((
      select count(*)::int
      from usage u
      cross join quota q
      where q.q > 0
        and round((u.total_bytes::numeric / q.q) * 100)::int >= 100
    ), 0),
    'quota_bytes', (select q from quota)
  );
$$;

comment on function public.get_workspace_media_storage_summary() is
  'Fleet rollup for admin media storage StatCards.';

revoke all on function public.get_workspace_media_storage_summary() from public;
grant execute on function public.get_workspace_media_storage_summary() to service_role;

alter function public.fetch_media_message_window(varchar, bigint, int) set search_path = public;
alter function public.fetch_media_messages_since(varchar, bigint, int) set search_path = public;
alter function public.get_workspace_media_storage_stats(varchar) set search_path = public, storage;

-- Rejects uploads that would push a workspace past internal.media_workspace_quota_bytes().
create or replace function internal.enforce_media_workspace_quota()
returns trigger
language plpgsql
security definer
set search_path = public, storage
as $$
declare
    v_workspace_id text;
    v_used bigint;
    v_incoming bigint;
    v_quota bigint;
begin
    select c.workspace_id into v_workspace_id
    from public.channels c
    where c.id = split_part(new.name, '/', 2);

    if v_workspace_id is null then
        return new;
    end if;

    v_incoming := coalesce((new.metadata->>'size')::bigint, 0);
    v_quota := internal.media_workspace_quota_bytes();

    select coalesce(sum((o.metadata->>'size')::bigint), 0) into v_used
    from storage.objects o
    inner join public.channels c on c.id = split_part(o.name, '/', 2)
    where o.bucket_id = 'media'
      and c.workspace_id = v_workspace_id;

    if v_used + v_incoming > v_quota then
        raise exception 'Workspace media storage quota exceeded (10 GiB limit)'
            using errcode = 'check_violation';
    end if;

    return new;
end;
$$;

comment on function internal.enforce_media_workspace_quota() is
'Rejects media uploads that would push a workspace past the 10 GiB storage quota.';

revoke all on function internal.enforce_media_workspace_quota() from public;

drop trigger if exists enforce_media_workspace_quota on storage.objects;
create trigger enforce_media_workspace_quota
before insert on storage.objects
for each row
when (new.bucket_id = 'media')
execute function internal.enforce_media_workspace_quota();
