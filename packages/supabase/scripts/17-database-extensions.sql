-- -----------------------------------------------------------------------------
-- Database Extensions and Supabase Realtime Configuration
-- -----------------------------------------------------------------------------
-- Description: Configures the Supabase Realtime publication for selected tables.
-- This enables real-time data synchronization for collaborative features.
-- -----------------------------------------------------------------------------

-- First drop the existing publication if it exists
drop publication if exists supabase_realtime;

-- Create a new publication named 'supabase_realtime'
-- This publication will include the specified tables
-- and will track 'insert', 'update', and 'delete' events
create publication supabase_realtime for table
  public.users,                 -- Track changes in the 'users' table
  public.channels,              -- Track changes in the 'channels' table
  public.messages,              -- Track changes in the 'messages' table
  public.channel_members,       -- Track changes in the 'channel_members' table
  public.channel_message_counts -- Track changes in the 'channel_message_counts' table
  -- NOTE: notifications uses broadcast trigger (18-notification-broadcast.sql)
  -- This is more efficient: O(1) routing vs O(n) filtering
    with (publish = 'insert, update, delete'); -- Publish insert, update, and delete events
