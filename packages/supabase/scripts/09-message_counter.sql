/****************************************************************************
 * Document Title: Channel Message Counting with pgmq and pg_cron
 *
 * Overview:
 *   This SQL file implements a strategy to keep track of message counts
 *   across channels using:
 *     - A "message_counter" queue (from pgmq)
 *     - Trigger-based event enqueueing on the messages table
 *     - A batch worker function scheduled by pg_cron
 *
 * Why this Strategy?
 *   1. Decoupled Inserts:
 *      - The main INSERT path (when new messages are created) only enqueues
 *        a small event. This avoids expensive updates in real-time.
 *   2. Batched Updates:
 *      - The worker function processes multiple queued events in a loop,
 *        updating channel counts in batches. This reduces row-level
 *        contention.
 *   3. Near-Real-Time:
 *      - The pg_cron job runs every minute (`* * * * *`, portable 5-field),
 *        so the aggregate counter can trail realtime by up to ~60s; messages
 *        still arrive live via Supabase Realtime.
 *   4. Simpler Maintenance:
 *      - All logic is contained in the database. You do not need an external
 *        worker service.
 *
 * Schema and Steps:
 *   1. channel_message_counts Table
 *      - Stores the cumulative message count per channel (tied to a workspace).
 *   2. pgmq Queue ("message_counter")
 *      - Holds small JSON events whenever a message is inserted or deleted.
 *   3. Triggers (on_message_insert_queue / on_message_delete_queue)
 *      - Enqueue "increment" or "decrement" events on the queue.
 *   4. message_counter_batch_worker()
 *      - Reads events in batches from the queue (via pgmq.read).
 *      - Updates channel_message_counts accordingly.
 *      - Deletes processed messages from the queue.
 *   5. pg_cron Schedule
 *      - Runs message_counter_batch_worker() on the schedule defined at the
 *        bottom of this file (today: every minute). Sub-minute 6-field cron
 *        requires `cron.use_background_workers = on` and a Postgres restart;
 *        see the comment block above `cron.schedule` in this file.
 *
 * Maintenance Notes:
 *   - Tune read_limit / max_loops in the worker before shortening the cron.
 *   - Ensure you have granted privileges on the pgmq schema and the
 *     underlying queue table (pgmq.q_message_counter) to the role executing
 *     these operations.
 ****************************************************************************/


-- 1. Table to store message counts per channel
--    We add 'workspace_id' for grouping or filtering by workspace.
--    'channel_id' is the primary key, referencing public.channels(id).
--    'workspace_id' references public.workspaces(id).
CREATE TABLE IF NOT EXISTS public.channel_message_counts (
  channel_id    TEXT PRIMARY KEY REFERENCES public.channels(id) ON DELETE CASCADE,
  workspace_id  TEXT NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  message_count BIGINT NOT NULL DEFAULT 0
);

-- 1a. Index on workspace_id for fast queries by workspace
CREATE INDEX IF NOT EXISTS idx_channel_msg_counts_workspace_id
  ON public.channel_message_counts (workspace_id);


-- 2. Create or ensure the pgmq extension is enabled (uncomment if needed)
-- CREATE EXTENSION IF NOT EXISTS pgmq;

-- 3. Create the queue
SELECT FROM pgmq.create('message_counter');

-- 4. Trigger function to enqueue an increment event on message insert.
-- Resolves workspace_id at enqueue time so a later hard-delete of the
-- channel doesn't poison the worker (channels.workspace_id is NULL after
-- the row is gone). Lookup is a PK probe on channels and adds < 1ms to
-- the message INSERT path.
CREATE OR REPLACE FUNCTION public.on_message_insert_queue()
RETURNS TRIGGER AS $$
DECLARE
    v_workspace_id text;
BEGIN
    SELECT workspace_id INTO v_workspace_id
    FROM public.channels WHERE id = NEW.channel_id;

    PERFORM pgmq.send(
      'message_counter',
      jsonb_build_object(
        'channel_id',   NEW.channel_id,
        'workspace_id', v_workspace_id,
        'op',           'increment'
      )
    );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 5. Apply the insert trigger to the messages table
CREATE TRIGGER trigger_on_message_insert
AFTER INSERT ON public.messages
FOR EACH ROW
EXECUTE FUNCTION public.on_message_insert_queue();

-- 6. Trigger function to enqueue a decrement event on message delete.
CREATE OR REPLACE FUNCTION public.on_message_delete_queue()
RETURNS TRIGGER AS $$
DECLARE
    v_workspace_id text;
BEGIN
    SELECT workspace_id INTO v_workspace_id
    FROM public.channels WHERE id = OLD.channel_id;

    PERFORM pgmq.send(
      'message_counter',
      jsonb_build_object(
        'channel_id',   OLD.channel_id,
        'workspace_id', v_workspace_id,
        'op',           'decrement'
      )
    );
  RETURN OLD;
END;
$$ LANGUAGE plpgsql;

-- 7. Apply the delete trigger to the messages table
CREATE TRIGGER trigger_on_message_delete
AFTER DELETE ON public.messages
FOR EACH ROW
EXECUTE FUNCTION public.on_message_delete_queue();

-- 7a. Soft-delete decrement.
-- The product path is `UPDATE deleted_at`, not hard DELETE. Without this,
-- channel_message_counts.message_count drifts upward forever. Fires only on
-- the NULL -> NOT NULL transition so repeated UPDATEs don't double-count.
CREATE OR REPLACE FUNCTION public.on_message_soft_delete_queue()
RETURNS TRIGGER AS $$
DECLARE
    v_workspace_id text;
BEGIN
    SELECT workspace_id INTO v_workspace_id
    FROM public.channels WHERE id = OLD.channel_id;

    PERFORM pgmq.send(
      'message_counter',
      jsonb_build_object(
        'channel_id',   OLD.channel_id,
        'workspace_id', v_workspace_id,
        'op',           'decrement'
      )
    );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_on_message_soft_delete
AFTER UPDATE OF deleted_at ON public.messages
FOR EACH ROW
WHEN (OLD.deleted_at IS NULL AND NEW.deleted_at IS NOT NULL)
EXECUTE FUNCTION public.on_message_soft_delete_queue();

-- 8. Batch worker function to process queued events
CREATE OR REPLACE FUNCTION public.message_counter_batch_worker()
RETURNS void
LANGUAGE plpgsql
AS $$
DECLARE
  rec             pgmq.message_record;   -- Each row from the queue
  max_loops       INT := 10;            -- Safeguard to prevent infinite loops
  loop_count      INT := 0;
  read_limit      INT := 100;           -- Batch size for each read
  row_count       INT;
BEGIN
  LOOP
    loop_count := loop_count + 1;
    row_count  := 0;

    IF loop_count > max_loops THEN
      EXIT;
    END IF;

    -- Read events from the queue in a batch
    FOR rec IN
      SELECT *
      FROM pgmq.read(
        queue_name => 'message_counter',
        vt         => 30,
        qty        => read_limit
      )
    LOOP
      row_count := row_count + 1;

      -- Read the event payload. workspace_id is captured at enqueue time
      -- by the triggers above; we still fall back to a channel lookup to
      -- handle legacy events (pre-`workspace_id`-in-payload) gracefully.
      DECLARE
        v_channel_id   TEXT := rec.message->>'channel_id';
        v_op           TEXT := rec.message->>'op';
        v_workspace_id TEXT := rec.message->>'workspace_id';
      BEGIN
        IF v_workspace_id IS NULL THEN
          SELECT workspace_id INTO v_workspace_id
          FROM public.channels WHERE id = v_channel_id;
        END IF;

        -- Channel was hard-deleted before the event was processed. The
        -- counter row is removed by FK CASCADE, so the event is a no-op;
        -- drop it from the queue and move on. Without this branch, a
        -- single orphan event poisons every subsequent cron run via the
        -- channel_message_counts.workspace_id NOT NULL constraint.
        IF v_workspace_id IS NULL THEN
          PERFORM pgmq.delete('message_counter', rec.msg_id);
          CONTINUE;
        END IF;

        IF v_op = 'increment' THEN
          INSERT INTO public.channel_message_counts (channel_id, workspace_id, message_count)
          VALUES (v_channel_id, v_workspace_id, 1)
          ON CONFLICT (channel_id)
          DO UPDATE
            SET message_count = public.channel_message_counts.message_count + 1,
                workspace_id  = EXCLUDED.workspace_id;

        ELSIF v_op = 'decrement' THEN
          INSERT INTO public.channel_message_counts (channel_id, workspace_id, message_count)
          VALUES (v_channel_id, v_workspace_id, 0)
          ON CONFLICT (channel_id)
          DO UPDATE
            SET message_count = GREATEST(public.channel_message_counts.message_count - 1, 0),
                workspace_id  = EXCLUDED.workspace_id;
        END IF;
      END;

      -- Delete processed message so it doesn't appear again
      PERFORM pgmq.delete('message_counter', rec.msg_id);
    END LOOP;

    -- If no rows were read, the queue is empty; exit early
    IF row_count = 0 THEN
      EXIT;
    END IF;
  END LOOP;
END;
$$;

-- 9. Schedule the worker. Default = every minute (portable 5-field cron).
--
-- pg_cron only honors sub-minute schedules ("*/10 * * * * *", 6-field
-- form including seconds) when `cron.use_background_workers = on` in
-- postgresql.conf — that setting requires a server restart since
-- pg_cron is in shared_preload_libraries. With the launcher-only mode
-- (the default on local Supabase Docker), a 6-field schedule gets
-- silently truncated to 5 fields and "*/10 * * * * *" is interpreted as
-- "*/10 * * * *" = every 10 minutes, which is way too laggy for the
-- unread badge UX.
--
-- A 1-minute cadence covers chat unread display fine: messages still
-- propagate live via realtime; only the aggregate counter trails by up
-- to 60s. To upgrade to ~10s on a host that supports it:
--   ALTER SYSTEM SET cron.use_background_workers = 'on';
--   -- then restart Postgres and reschedule with '*/10 * * * * *'
SELECT cron.unschedule('message_counter_batch_job')
FROM cron.job WHERE jobname = 'message_counter_batch_job';

SELECT cron.schedule(
            'message_counter_batch_job',      -- A job name for reference
            '* * * * *',                      -- Every minute (portable)
    $$
            SELECT public.message_counter_batch_worker();
    $$
        );

-- ============================================================
-- Hardening: pin search_path = public on functions defined above
-- (idempotent — safe to re-run)
-- ============================================================
ALTER FUNCTION public.on_message_insert_queue() SET search_path = public;
ALTER FUNCTION public.on_message_delete_queue() SET search_path = public;
ALTER FUNCTION public.on_message_soft_delete_queue() SET search_path = public;
ALTER FUNCTION public.message_counter_batch_worker() SET search_path = public;

-- Trigger functions run as postgres (DEFINER) so internal side effects
-- (counters, previews, notifications) bypass RLS on side-effect tables.
-- search_path is already pinned above; flipping security mode is safe.
ALTER FUNCTION public.on_message_insert_queue() SECURITY DEFINER;
ALTER FUNCTION public.on_message_delete_queue() SECURITY DEFINER;
ALTER FUNCTION public.on_message_soft_delete_queue() SECURITY DEFINER;
