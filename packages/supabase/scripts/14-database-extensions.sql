-- add tables to the publication
-- reflace the tables changes to all subscribers
alter publication supabase_realtime add table public.users;
alter publication supabase_realtime add table public.channels;
alter publication supabase_realtime add table public.messages;
alter publication supabase_realtime add table public.channel_members;

-- Send "previous data" on change
-- for tracking row changed in realtime
alter table public.users replica identity full;
alter table public.channels replica identity full;
alter table public.messages replica identity full;
