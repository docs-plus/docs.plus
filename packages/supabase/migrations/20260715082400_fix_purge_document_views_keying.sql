-- Fix: purge_document_footprint deleted zero document-view rows.
-- enqueue_document_view keys document_views / document_view_stats /
-- document_views_daily by lower(trim(<WS room name>)) and the room name IS the
-- 19-char documentId, while the purge matched the human slug — so soft-deleted
-- documents left their analytics footprint behind. The deletes now match
-- lower(p_document_id), keeping lower(p_slug) as belt-and-braces.
-- Paired source of truth: packages/supabase/scripts/09-document-views.sql.

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

    -- Cascades every chat table (channels, messages, members, bookmarks, …).
    delete from public.workspaces where id = p_document_id;
end;
$$;

comment on function public.purge_document_footprint(varchar, text) is
'Service-role GC for a soft-deleted document: storage objects first, chat/analytics rows, workspace cascade last.';

revoke all on function public.purge_document_footprint(varchar, text) from public;
revoke all on function public.purge_document_footprint(varchar, text) from anon;
grant execute on function public.purge_document_footprint(varchar, text) to service_role;
