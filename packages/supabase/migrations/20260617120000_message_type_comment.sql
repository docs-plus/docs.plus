-- Add document-comment message type for pad-anchored chat messages.
alter type public.message_type add value if not exists 'comment';
