-- First drop the existing publication if it exists
DROP PUBLICATION IF EXISTS supabase_realtime;

-- Create a new publication named 'supabase_realtime'
-- This publication will include the specified tables
-- and will track 'insert', 'update', and 'delete' events
CREATE PUBLICATION supabase_realtime FOR TABLE
  public.users,                 -- Track changes in the 'users' table
  public.channels,              -- Track changes in the 'channels' table
  public.messages,              -- Track changes in the 'messages' table
  public.channel_members,       -- Track changes in the 'channel_members' table
  public.channel_message_counts -- Track changes in the 'channel_message_counts' table
    WITH (publish = 'insert, update, delete'); -- Publish insert, update, and delete events
