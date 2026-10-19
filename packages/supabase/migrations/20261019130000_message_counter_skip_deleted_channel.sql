-- The message counter cron failed every minute on one queued event for a deleted channel.
-- The worker trusted the payload workspace_id, so its counter INSERT broke the channel_id FK.
-- One raise rolls back the whole run, so no channel count moved. The worker now reads the
-- live channel row and drops events whose channel is gone. Pairs with scripts/09-message_counter.sql.

set local lock_timeout = '5s';

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

      -- The live channel row decides, never the payload workspace_id. A
      -- payload outlives a channel delete, and its counter INSERT then fails
      -- the channel_id FK. One raise rolls back the whole run, so that event
      -- would block every later run.
      DECLARE
        v_channel_id   TEXT := rec.message->>'channel_id';
        v_op           TEXT := rec.message->>'op';
        v_workspace_id TEXT;
      BEGIN
        SELECT workspace_id INTO v_workspace_id
        FROM public.channels WHERE id = v_channel_id;

        -- Channel is gone. FK CASCADE already removed its counter row, so
        -- the event is a no-op; drop it from the queue and move on.
        IF NOT FOUND THEN
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

ALTER FUNCTION public.message_counter_batch_worker() SET search_path = public;
