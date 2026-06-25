-- 20260623120000_chat_media_attachments.sql recreated the message notification
-- trigger bodies (media-aware previews) but omitted SECURITY DEFINER. Those
-- functions INSERT into public.notifications, which has no authenticated INSERT
-- policy — only definer bypass is allowed (see scripts/13-RLS.sql §2i).

alter function public.create_mention_notifications() set search_path = public;
alter function public.create_reply_notification() set search_path = public;
alter function public.create_everyone_notifications() set search_path = public;
alter function public.create_regular_message_notifications() set search_path = public;

alter function public.create_mention_notifications() security definer;
alter function public.create_reply_notification() security definer;
alter function public.create_everyone_notifications() security definer;
alter function public.create_regular_message_notifications() security definer;
