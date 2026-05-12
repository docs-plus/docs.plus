-- Mark create_direct_message_channel as SECURITY DEFINER. Mirrors
-- packages/supabase/scripts/10-functions.sql.
--
-- The function reads u.email (no longer granted to authenticated in
-- migration 094332) and writes a channel_members row with
-- `member_id != auth.uid()` (blocked by channel_members_join_insert in
-- 13-RLS.sql). Both bypasses are intended for the DM-create flow;
-- auth.uid()-based checks inside the function body enforce the actual
-- authorisation.

alter function public.create_direct_message_channel(varchar, uuid) set search_path = public;
alter function public.create_direct_message_channel(varchar, uuid) security definer;
