-- Anonymous document views were dropped silently. `document_views.user_id`
-- referenced `public.users`, which never holds a row for a Supabase Anonymous
-- Auth user, so every logged-out view failed the FK and the queue worker
-- `pgmq.delete`d the evidence. Repoints the FK at `auth.users` (the identity
-- table the pipeline actually sends ids from) and archives unprocessable
-- messages instead of deleting them.
-- Objects: public.document_views (constraint swap), public.process_document_views_queue().
-- Rider, documentation only: corrects the misleading public.workspaces.created_by
-- column comment. No data is backfilled, synced, or dropped.
-- Mirrors scripts/09-document-views.sql and scripts/03-0-workspaces.sql. Idempotent.
-- Safety: the ADD CONSTRAINT validation scan briefly holds SHARE ROW EXCLUSIVE
-- on auth.users, so sign-ins queue for its duration.

-- -----------------------------------------------------------------------------
-- 1. Repoint document_views.user_id at auth.users
-- -----------------------------------------------------------------------------
-- Existing user_ids all come from public.users, whose own id FKs to
-- auth.users, so validation cannot fail. ON DELETE SET NULL is preserved:
-- deleting the auth user still erases the id from the analytics row.

alter table public.document_views
    drop constraint if exists document_views_user_id_fkey;

alter table public.document_views
    add constraint document_views_user_id_fkey
    foreign key (user_id) references auth.users(id) on delete set null;

-- -----------------------------------------------------------------------------
-- 2. Stop the worker from swallowing unprocessable views
-- -----------------------------------------------------------------------------

create or replace function public.process_document_views_queue()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
    rec pgmq.message_record;
    v_processed integer := 0;
    v_duplicates integer := 0;
    v_errors integer := 0;
    max_loops integer := 10;
    loop_count integer := 0;
    batch_size integer := 100;
    row_count integer;
begin
    loop
        loop_count := loop_count + 1;
        row_count := 0;

        if loop_count > max_loops then
            exit;
        end if;

        -- Read batch from queue
        for rec in
            select * from pgmq.read(
                queue_name => 'document_views',
                vt => 30,
                qty => batch_size
            )
        loop
            row_count := row_count + 1;

            declare
                v_view_id uuid := (rec.message->>'view_id')::uuid;
                v_document_slug text := rec.message->>'document_slug';
                v_session_id text := rec.message->>'session_id';
                v_user_id uuid := (rec.message->>'user_id')::uuid;
                v_is_anonymous boolean := (rec.message->>'is_anonymous')::boolean;
                v_is_authenticated boolean := (rec.message->>'is_authenticated')::boolean;
                v_device_type text := rec.message->>'device_type';
                v_viewed_at timestamptz := (rec.message->>'viewed_at')::timestamptz;
                v_view_date date := (v_viewed_at at time zone 'UTC')::date;  -- Use UTC for consistency
            begin
                -- Check for duplicate (same session + document + day)
                if exists (
                    select 1 from public.document_views
                    where session_id = v_session_id
                      and document_slug = v_document_slug
                      and view_date = v_view_date
                    limit 1
                ) then
                    v_duplicates := v_duplicates + 1;
                else
                    -- Insert the view
                    insert into public.document_views (
                        id, document_slug, user_id, session_id, viewed_at, view_date,
                        is_anonymous, is_authenticated, device_type
                    ) values (
                        v_view_id, v_document_slug, v_user_id, v_session_id, v_viewed_at, v_view_date,
                        v_is_anonymous, v_is_authenticated, v_device_type
                    );
                    v_processed := v_processed + 1;
                end if;

                -- Delete from queue
                perform pgmq.delete('document_views', rec.msg_id);

            exception when others then
                v_errors := v_errors + 1;
                -- Archive rather than delete: a dropped view is otherwise
                -- invisible. The payload stays queryable in
                -- pgmq.a_document_views (same pattern as push_notifications).
                raise warning 'document_views worker: archiving msg % (%: %)',
                    rec.msg_id, sqlstate, sqlerrm;
                perform pgmq.archive('document_views', rec.msg_id);
            end;
        end loop;

        -- Exit if queue is empty
        if row_count = 0 then
            exit;
        end if;
    end loop;

    return jsonb_build_object(
        'success', true,
        'processed', v_processed,
        'duplicates', v_duplicates,
        'errors', v_errors
    );
end;
$$;

comment on function public.process_document_views_queue() is
'Batch processes document views from pgmq queue.
Handles deduplication and inserts valid views.
Unprocessable messages are archived to pgmq.a_document_views, never dropped.
Run every 10 minutes via pg_cron.';

-- -----------------------------------------------------------------------------
-- 3. Say what workspaces.created_by actually holds
-- -----------------------------------------------------------------------------

comment on column public.workspaces.created_by is
'First signed-in visitor to open the document: join_workspace() auto-bootstraps the workspace row and stamps auth.uid() of whoever got there first. NOT ownership — that is Prisma DocumentMetadata.ownerId. Nothing reads this column; workspaces_creator_insert only checks it on INSERT.';
