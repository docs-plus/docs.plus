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
 *      - The pg_cron job runs frequently (every 10 seconds here), providing
 *        near-real-time counts without a long-lived process.
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
 *      - Runs message_counter_batch_worker() every 10 seconds to process
 *        any queued events.
 *
 * Maintenance Notes:
 *   - You can adjust the pg_cron schedule ('* * * * * *') to meet your
 *     performance needs. If performance is an issue, consider changing:
 *       * The frequency of the schedule.
 *       * The read_limit (batch size) in the worker function.
 *       * The max_loops to process more events per run if needed.
 *   - Ensure you have granted privileges on the pgmq schema and the
 *     underlying queue table (pgmq.q_message_counter) to the role executing
 *     these operations.
 *   - If you only need updates every minute or less, you can change the
 *     cron pattern. Some Supabase plans may not support sub-minute intervals.
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

-- 4. Trigger function to enqueue an increment event on message insert
CREATE OR REPLACE FUNCTION public.on_message_insert_queue()
RETURNS TRIGGER AS $$
BEGIN
    PERFORM pgmq.send(
      'message_counter',
      jsonb_build_object(
        'channel_id', NEW.channel_id,
        'op', 'increment'
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

-- 6. Trigger function to enqueue a decrement event on message delete
CREATE OR REPLACE FUNCTION public.on_message_delete_queue()
RETURNS TRIGGER AS $$
BEGIN
    PERFORM pgmq.send(
      'message_counter',
      jsonb_build_object(
        'channel_id', OLD.channel_id,
        'op', 'decrement'
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

      -- Extract channel_id and operation from the event payload
      DECLARE
        v_channel_id   TEXT := rec.message->>'channel_id';
        v_op           TEXT := rec.message->>'op';
        v_workspace_id TEXT;
      BEGIN
        /*
          1. Look up the workspace_id from channels (assuming "workspace_id"
             is a column in public.channels).
        */
        SELECT workspace_id
          INTO v_workspace_id
          FROM public.channels
         WHERE id = v_channel_id
         LIMIT 1;

        /*
          If no row is found, v_workspace_id will be null.
          You can decide how you want to handle that (raise an error,
          skip, or default to something).
        */

        IF v_op = 'increment' THEN
          /*
            2. Upsert: if channel_id does not exist, create row.
               If it does exist, increment the count.
          */
          INSERT INTO public.channel_message_counts (channel_id, workspace_id, message_count)
          VALUES (v_channel_id, v_workspace_id, 1)
          ON CONFLICT (channel_id)
          DO UPDATE
            SET message_count = public.channel_message_counts.message_count + 1,
                -- Optionally sync workspace_id if channels can move between workspaces
                workspace_id   = EXCLUDED.workspace_id;

        ELSIF v_op = 'decrement' THEN
          /*
            If the row doesn’t exist, create it with a count of 0.
            Otherwise, decrement (but not below zero).
          */
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

-- 9. Schedule the worker function to run every 10 seconds
-- CREATE EXTENSION IF NOT EXISTS pg_cron;
SELECT cron.schedule(
            'message_counter_batch_job',      -- A job name for reference
            '*/10 * * * * *',                 -- Run every 10 seconds (if supported)
    $$
            SELECT public.message_counter_batch_worker();
    $$
        );
