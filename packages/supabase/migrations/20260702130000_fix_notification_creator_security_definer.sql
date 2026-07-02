-- 20260623120000_chat_media_attachments.sql recreated notification trigger
-- bodies without SECURITY DEFINER. CREATE OR REPLACE defaults to INVOKER, so
-- INSERT into public.notifications hits RLS (42501) and mention/reply sends fail.
-- Idempotent — safe if 20260625120000 already ran.

alter function public.create_mention_notifications() set search_path = public;
alter function public.create_reply_notification() set search_path = public;
alter function public.create_everyone_notifications() set search_path = public;
alter function public.create_regular_message_notifications() set search_path = public;
alter function public.create_reaction_notifications() set search_path = public;
alter function public.increment_unread_count_on_new_message() set search_path = public;

alter function public.create_mention_notifications() security definer;
alter function public.create_reply_notification() security definer;
alter function public.create_everyone_notifications() security definer;
alter function public.create_regular_message_notifications() security definer;
alter function public.create_reaction_notifications() security definer;
alter function public.increment_unread_count_on_new_message() security definer;
