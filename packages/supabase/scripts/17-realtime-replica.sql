-- -----------------------------------------------------------------------------
-- Database Extensions and Supabase Realtime Configuration
-- -----------------------------------------------------------------------------
-- Description: Configures the Supabase Realtime publication for selected tables.
-- This enables real-time data synchronization for collaborative features.
-- -----------------------------------------------------------------------------

-- First drop the existing publication if it exists
drop publication if exists supabase_realtime;

-- Create a new publication named 'supabase_realtime'.
-- `users` is in the publication because the admin dashboard subscribes to
-- postgres_changes on it (packages/admin-dashboard/src/pages/users.tsx).
-- Webapp consumers use Realtime Presence (channel.track) instead, so the
-- per-cron-tick fanout cost only hits admin clients.
create publication supabase_realtime for table
  public.users,                 -- admin-dashboard users page
  public.channels,              -- Track changes in the 'channels' table
  public.messages,              -- Track changes in the 'messages' table
  public.channel_members,       -- Track changes in the 'channel_members' table
  public.channel_message_counts -- Track changes in the 'channel_message_counts' table
  -- NOTE: notifications uses broadcast trigger (07-3-notification-broadcast.sql)
  -- This is more efficient: O(1) routing vs O(n) filtering
    with (publish = 'insert, update, delete'); -- Publish insert, update, and delete events
