/*https://github.com/orgs/supabase/discussions/5152*/
/*----------------  Events TABLE  ---------------------*/


create table public.events ( 
  -- a primary key is necessary for realtime RLS to work 
  id int generated always as identity primary key, 
  -- `null` if the event is public, and the `auth.uid` if the event is for specific user. 
  uid uuid,
  -- customized topic including filters (e.g. "messages_view|{otherUID}" or "comments|{postID}") 
  topic text, 
  -- The inserted/updated data wrapped in a json object
  data json,
  -- `INSERT`, `UPDATE`, or `DELETE` 
  event_type text,
  -- used to delete old events by a cron job
  created_at timestamp with time zone DEFAULT now() NOT NULL

);

/*----------------  REALTIME SETUP  ---------------------*/

-- clients can only listen to the events table and only for insert events. 
ALTER PUBLICATION supabase_realtime SET (publish = 'insert');
ALTER PUBLICATION supabase_realtime ADD TABLE events;


/*----------------- SECURITY  ---------------------*/

-- RLS not good for performance

-- ALTER TABLE public.events ENABLE ROW LEVEL SECURITY;

-- CREATE POLICY events_policy
-- ON public.events
-- FOR SELECT USING (
--   events.uid is NULL OR events.uid = auth.uid()
-- );


/*----------------- INDEXES  ---------------------*/

CREATE INDEX events_topic_idx ON public.events (topic);
CREATE INDEX events_uid_idx ON public.events (uid);
CREATE INDEX events_created_at_idx ON public.events (created_at);

COMMENT ON TABLE public.events IS 'Stores all changes to the database. Used for realtime and to trigger webhooks.';

/*----------------- TRIGGERS  ---------------------*/

