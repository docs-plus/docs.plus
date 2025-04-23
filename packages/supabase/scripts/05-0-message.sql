-- Table: public.messages
-- Description: Stores all messages exchanged in the application. This includes various types of messages like text, image, video, or audio.
-- The table also tracks message status (edited, deleted) and associations (user, channel, replies, and forwardings).
create table public.messages (
    id                     uuid default uuid_generate_v4() not null primary key,
    created_at             timestamp with time zone default timezone('utc', now()) not null, -- Creation timestamp of the message.
    updated_at             timestamp with time zone default timezone('utc', now()) not null, -- Last update timestamp of the message.
    deleted_at             timestamp with time zone, -- Timestamp for when the message was marked as deleted.
    edited_at              timestamp with time zone, -- Timestamp for when the message was edited.
    content                text check (length(content) <= 3000),  -- The actual text content of the message.
    html                   text check (length(html) <= 3000), -- The actual HTML content of the message.
    medias                 jsonb, -- Stores URLs to media (images, videos, etc.) associated with the message.
    user_id                uuid not null references public.users(id), -- The ID of the user who sent the message.
    channel_id             varchar(36) not null references public.channels(id) on delete cascade, -- The ID of the channel where the message was sent.
    reactions              jsonb, -- JSONB field storing user reactions to the message.
    type                   message_type default 'text', -- Enumerated type of the message (text, image, video, etc.).
    metadata               jsonb, -- Additional metadata about the message in JSONB format.
    reply_to_message_id    uuid references public.messages(id) on delete set null, -- The ID of the message this message is replying to, if any.
    replied_message_preview text, -- Preview text of the message being replied to.
    origin_message_id      uuid references public.messages(id) on delete set null, -- ID of the original message if this is a forwarded message.
    thread_id              uuid references public.messages(id) on delete set null, -- ID of the thread this message belongs to.
    thread_depth           int default 0, -- Depth of the message in the thread.
    is_thread_root         boolean default false, -- Indicates if the message is the root of a thread.
    thread_owner_id        uuid references public.users(id) on delete set null, -- ID of the user who owns/opens the thread.
    readed_at              timestamp with time zone -- Timestamp for when the message was read by a user.
);

comment on table public.messages is 'Contains individual messages sent by users, including their content, type, and associated metadata.';

-- Column comments for better documentation
comment on column public.messages.id is 'Unique identifier for the message';
comment on column public.messages.created_at is 'Timestamp when the message was created';
comment on column public.messages.updated_at is 'Timestamp when the message was last updated';
comment on column public.messages.deleted_at is 'Timestamp when the message was soft-deleted, null if active';
comment on column public.messages.edited_at is 'Timestamp when the message content was last edited';
comment on column public.messages.content is 'Text content of the message, limited to 3000 characters';
comment on column public.messages.html is 'HTML formatted content of the message, limited to 3000 characters';
comment on column public.messages.medias is 'JSON array of media attachments with URLs and metadata';
comment on column public.messages.user_id is 'Reference to the user who sent this message';
comment on column public.messages.channel_id is 'Reference to the channel where this message was posted';
comment on column public.messages.reactions is 'JSON object mapping emoji reactions to arrays of user IDs';
comment on column public.messages.type is 'The type of message (text, image, video, etc.)';
comment on column public.messages.metadata is 'Additional configurable properties for the message';
comment on column public.messages.reply_to_message_id is 'Reference to the message being replied to, if any';
comment on column public.messages.replied_message_preview is 'Preview text of the message being replied to';
comment on column public.messages.origin_message_id is 'Reference to the original message if this is a forwarded message';
comment on column public.messages.thread_id is 'Reference to the thread this message belongs to';
comment on column public.messages.thread_depth is 'Nesting level within the thread hierarchy';
comment on column public.messages.is_thread_root is 'Whether this message is the starting point of a thread';
comment on column public.messages.thread_owner_id is 'Reference to the user who started the thread';
comment on column public.messages.readed_at is 'Timestamp when the message was last read';

-- TODO: partition by channel_id and created_at

-- Example JSON structures for reference:

-- Metadata example
-- {
--   "replied": [
--     "68d37413-e405-40e8-aec6-4a741be8982b"
--   ],
--   "is_important": true,
--   "forwarding_chain": [
--     {
--       "user_id": "35477c6b-f9a0-4bad-af0b-545c99b33fae",
--       "username": "philip",
--       "full_name": null
--     },
--     {
--       "user_id": "1059dbd0-3478-46f9-b8a9-dcd23ed0a23a",
--       "username": "emma",
--       "full_name": null
--     }
--   ],
--   "thread": {
--     "count": 0,
--   }
-- }

-- Media example
-- [
--   {
--     "url": "https://www.youtube.com/watch?v=9bZkp7q19f0",
--     "type": "video",
--     "description": "Gangnam Style"
--   },
--   {
--     "url": "https://www.youtube.com/watch?v=9bZkp7q19f0",
--     "type": "video",
--     "description": "Gangnam Style"
--   }
-- ]

-- Reactions example
-- {
--   "👍": [
--     {
--       "user_id": "35477c6b-f9a0-4bad-af0b-545c99b33fae",
--       "created_at": "2023-11-29T18:38:50.60264+00:00"
--     }
--   ],
--   "😄": [
--     {
--       "user_id": "c2e3e9e7-d0e8-4960-9b05-d263deb2722f",
--       "created_at": "2023-11-29T18:38:50.60264+00:00"
--     }
--   ]
-- }
