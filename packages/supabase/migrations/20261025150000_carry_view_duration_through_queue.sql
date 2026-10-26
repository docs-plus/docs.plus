-- #603: a visit that closed before the view queue drained lost its duration.
-- update_view_duration now also patches the queued message, and the drain
-- copies that duration into the new row. Pairs with scripts/09-document-views.sql.

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
                    -- duration_ms is set when the visit closed before this drain (#603).
                    insert into public.document_views (
                        id, document_slug, user_id, session_id, viewed_at, view_date,
                        is_anonymous, is_authenticated, device_type,
                        duration_ms, is_bounce
                    ) values (
                        v_view_id, v_document_slug, v_user_id, v_session_id, v_viewed_at, v_view_date,
                        v_is_anonymous, v_is_authenticated, v_device_type,
                        coalesce((rec.message->>'duration_ms')::integer, 0),
                        coalesce((rec.message->>'duration_ms')::integer < 3000, true)
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

create or replace function public.update_view_duration(
    p_view_id uuid,
    p_duration_ms integer
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
    v_queued boolean;
begin
    if p_view_id is null or p_duration_ms is null then
        return false;
    end if;

    -- Cap duration at 30 minutes
    p_duration_ms := least(greatest(p_duration_ms, 0), 1800000);

    -- Queue first, then the table (#603). If a drain holds this message,
    -- this update waits for it and then matches 0 rows. The table update
    -- below takes a new snapshot, so it sees the drained row.
    update pgmq.q_document_views
    set message = message || jsonb_build_object('duration_ms', p_duration_ms)
    where message->>'view_id' = p_view_id::text;
    v_queued := found;

    -- Update by view_id (works across partitions)
    update public.document_views
    set
        duration_ms = p_duration_ms,
        is_bounce = p_duration_ms < 3000
    where id = p_view_id
      and viewed_at > now() - interval '24 hours';

    return v_queued or found;
end;
$$;

comment on function public.update_view_duration(uuid, integer) is
'Updates duration for a view by view_id, in the queued message and in the table. Called by Hocuspocus on disconnect.';

-- Service role and pg_cron only. Neither name goes in the user_facing_names array.
revoke all on function public.process_document_views_queue() from public, anon, authenticated;
grant execute on function public.process_document_views_queue() to service_role;
revoke all on function public.update_view_duration(uuid, integer) from public, anon, authenticated;
grant execute on function public.update_view_duration(uuid, integer) to service_role;
