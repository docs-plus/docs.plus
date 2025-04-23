-- Table: public.pinned_messages
-- Description: Maintains a record of messages that are pinned in various channels. Pinned messages are typically important or frequently referenced.
create table public.pinned_messages (
    id            uuid default uuid_generate_v4() not null primary key,
    channel_id    varchar(36) not null references public.channels(id) on delete cascade, -- The ID of the channel in which the message is pinned.
    message_id    uuid not null references public.messages(id) on delete cascade, -- The ID of the message that is pinned.
    pinned_at     timestamp with time zone default timezone('utc', now()) not null, -- Timestamp when the message was pinned.
    pinned_by     uuid references public.users(id) on delete set null, -- The ID of the user who pinned the message.
    content       text not null, -- The content of the message that is pinned.
    unique (channel_id, message_id)
);

comment on table public.pinned_messages is 'Tracks messages that are pinned in each channel for easy access and reference.';

-- Column comments for better documentation
comment on column public.pinned_messages.id is 'Unique identifier for the pinned message record';
comment on column public.pinned_messages.channel_id is 'Reference to the channel where the message is pinned';
comment on column public.pinned_messages.message_id is 'Reference to the message that is pinned';
comment on column public.pinned_messages.pinned_at is 'Timestamp when the message was pinned';
comment on column public.pinned_messages.pinned_by is 'Reference to the user who pinned the message';
comment on column public.pinned_messages.content is 'Cached content of the pinned message for quick access';

-- NOTE: write more about the purpose of each column.
