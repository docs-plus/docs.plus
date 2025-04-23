-- Table: public.channels
-- Description: Represents various channels in the application, similar to chat rooms or discussion groups.
-- Channels have attributes like privacy settings, member limits, activity timestamps, and user interaction settings.
create table public.channels (
    id                              varchar(36) default uuid_generate_v4() not null primary key,
    workspace_id                    varchar(36) not null references public.workspaces(id) on delete cascade,
    created_at                      timestamp with time zone default timezone('utc', now()) not null,
    updated_at                      timestamp with time zone default timezone('utc', now()) not null,
    slug                            text not null unique,
    name                            text not null check (length(name) <= 100),
    created_by                      uuid references public.users(id) on delete set null,
    description                     text check (length(description) <= 1000),
    member_limit                    int,
    last_activity_at                timestamp with time zone default timezone('utc', now()) not null,
    last_message_preview            text,
    is_avatar_set                   boolean default false,
    allow_emoji_reactions           boolean default true, -- Indicates if emoji reactions are allowed in the channel.
    mute_in_app_notifications       boolean default false, -- Indicates if notifications are muted for the channel.
    type                            channel_type default 'PUBLIC'::public.channel_type,
    metadata                        jsonb default '{}'::jsonb,
    member_count                    int default 0 not null, -- The number of members in the channel.
    deleted_at                      timestamp with time zone -- Tracks when the channel was soft deleted
);

-- Constraint: check_slug_format
alter table public.channels add constraint check_slug_format check (slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$');

comment on table public.channels is 'This table contains information about various channels used for group discussions and messaging in the application, including settings for user interactions and notifications.';

-- Column comments for better documentation
comment on column public.channels.id is 'Unique identifier for the channel';
comment on column public.channels.workspace_id is 'Reference to the workspace this channel belongs to';
comment on column public.channels.slug is 'URL-friendly identifier for the channel';
comment on column public.channels.name is 'Display name of the channel, limited to 100 characters';
comment on column public.channels.created_by is 'Reference to the user who created this channel';
comment on column public.channels.description is 'Description of the channel purpose, limited to 1000 characters';
comment on column public.channels.member_limit is 'Maximum number of users allowed in this channel, null means unlimited';
comment on column public.channels.last_activity_at is 'Timestamp of the most recent activity in this channel';
comment on column public.channels.last_message_preview is 'Preview text of the most recent message';
comment on column public.channels.is_avatar_set is 'Whether a custom avatar has been set for this channel';
comment on column public.channels.allow_emoji_reactions is 'Whether emoji reactions are enabled for messages in this channel';
comment on column public.channels.mute_in_app_notifications is 'Whether in-app notifications are muted for this channel';
comment on column public.channels.type is 'The type of channel determining visibility and access rules';
comment on column public.channels.metadata is 'Additional configurable properties for the channel';
comment on column public.channels.member_count is 'The current number of members in this channel';
comment on column public.channels.deleted_at is 'Timestamp when this channel was soft-deleted, null if active';

