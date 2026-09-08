-- Last left. Adds public.workspace_members.last_connection_closed_at and the
-- one writer, public.mark_document_connection_closed. The Hocuspocus worker
-- calls the writer with the service-role key when a member's last live socket
-- on a document closes.
--
-- The column ends one session, not the membership. left_at ends the membership,
-- and updated_at is join_workspace's arrival stamp that the member roster
-- renders as "Last seen". The writer therefore names neither of those columns.
--
-- The grant is written here as well as in scripts/10-8-func-workspace_members.sql,
-- because remote never runs `db reset` and so never replays that script. The
-- §5 revoke sweep in scripts/29-lint-hardening.sql revokes from public, anon and
-- authenticated only, so a service_role grant needs no §6 whitelist entry.
--
-- Idempotent: `add column if not exists` plus `create or replace function`, so a
-- re-apply over a partially present state is safe.

alter table public.workspace_members
    add column if not exists last_connection_closed_at timestamp with time zone;

comment on column public.workspace_members.last_connection_closed_at is 'Timestamp when this member''s last live session on this document closed. It ends one session while the membership continues, so it is not left_at, which ends the membership. It is not updated_at either: join_workspace writes updated_at when the member arrives, and the roster renders that as "Last seen". Written only by public.mark_document_connection_closed.';

-- Stamps the instant one live document session ended, for the worker only.
-- UPDATE-only: an upsert fires notify_on_workspace_join, which posts a "joined"
-- chat message. updated_at is join_workspace's arrival stamp and the roster
-- renders it as "Last seen", so this never names that column.
create or replace function public.mark_document_connection_closed(
    p_document_id varchar(36),
    p_user_id uuid,
    p_closed_at timestamptz
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
    v_closed_at timestamptz;
begin
    -- least() ignores a null, so an unclamped null argument would stamp now().
    -- Stamping now() at disconnect is the behaviour this column replaces.
    if p_closed_at is null then
        raise exception 'closed_at_required' using errcode = '22004';
    end if;

    -- greatest() below can never be undone, so a client clock ahead of the
    -- server would freeze the column at a future instant. now() is timestamptz,
    -- so this bound does not shift with the session TimeZone.
    v_closed_at := least(p_closed_at, now());

    update public.workspace_members
       set last_connection_closed_at = greatest(coalesce(last_connection_closed_at, v_closed_at), v_closed_at)
     where workspace_id = p_document_id
       and member_id = p_user_id
       and left_at is null;

    return found;
end;
$$;

comment on function public.mark_document_connection_closed(varchar, uuid, timestamptz) is
'Stamps the instant one live document session ended for one member. p_document_id is the documentId verbatim, the value held in workspace_members.workspace_id and workspaces.id, never the lowercased workspaces.slug. UPDATE-only, so it never mints a membership row, and it never writes updated_at. The write is monotone, so a p_closed_at older than the stored value leaves the value alone. A p_closed_at after now() is clamped to now(). Returns true when an active membership row matched, which does not say the stamp advanced.';

revoke execute on function public.mark_document_connection_closed(varchar, uuid, timestamptz) from public, anon, authenticated;
grant  execute on function public.mark_document_connection_closed(varchar, uuid, timestamptz) to service_role;
