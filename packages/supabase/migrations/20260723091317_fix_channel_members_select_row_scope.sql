-- Row-tighten channel_members SELECT: own row always, full roster to channel
-- members only. The prior internal.can_read_channel gate returned true for any
-- PUBLIC channel, exposing every peer's notif_state / mute_in_app_notifications
-- / read cursors to authenticated non-members (defeats the members-only
-- peer_max_read_seq gating). Mirrors packages/supabase/scripts/13-RLS.sql.
drop policy if exists channel_members_select on public.channel_members;

create policy channel_members_select on public.channel_members
  for select to authenticated
  using (member_id = (select auth.uid()) or internal.is_channel_member(channel_id));
