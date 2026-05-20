-- ============================================================================
-- AUTO-GENERATED SEED FILE
-- DO NOT EDIT MANUALLY - This file is generated from scripts/*.sql
-- Run: bun generate-seed.ts
-- ============================================================================

-- ============================================================================
-- File: 01-enum.sql
-- ============================================================================

-- Custom types

-- Define various permissions for app functionality.
-- This includes creating, deleting, and editing channels and messages,
-- as well as viewing, editing, and deleting users, and creating, editing, and deleting roles.
create type public.app_permission as enum (
  'channels.create', 'channels.delete', 'channels.edit',
  'messages.create', 'messages.delete', 'messages.edit',
  'users.view', 'users.edit', 'users.delete',
  'roles.create', 'roles.edit', 'roles.delete'
);

-- Define roles within the app.
-- 'admin' has the highest level of access,
-- 'moderator' has limited administrative capabilities,
-- 'member' is a standard user role,
-- 'guest' has restricted access, usually for temporary or limited users.
create type public.app_role as enum ('admin', 'moderator', 'member', 'guest');

-- Define the status of the users.
-- 'ONLINE' indicates the user is actively using the app,
-- 'OFFLINE' indicates the user is not currently using the app,
-- 'AWAY' signifies the user is temporarily away,
-- 'BUSY' shows the user is occupied and might not respond promptly,
-- 'INVISIBLE' allows users to use the app without appearing online.
create type public.user_status as enum ('ONLINE', 'OFFLINE', 'AWAY', 'BUSY', 'INVISIBLE', 'TYPING');

-- Define the types of messages that can be sent.
-- 'text' is a standard text message,
-- 'image' is a message with an image attachment,
-- 'video' is a message with a video attachment,
-- 'audio' is a message with an audio attachment.
create type public.message_type as enum ('text', 'image', 'video', 'audio', 'link', 'giphy', 'file', 'notification');


-- NOTE: The following types are not currently used in the schema.
-- Define the types of notifications that can be sent.
create type public.notification_type as enum (
  'message', 'channel_invite', 'mention', 'reply',
  'channel_update', 'member_join', 'member_leave', 'user_activity',
  'task_assignment', 'event_reminder', 'system_update', 'security_alert',
  'like_reaction', 'feedback_request', 'performance_insight'
);

-- Type: public.channel_type
-- Description: Enumeration of different types of channels supported in the application.
-- Each type defines the purpose and accessibility of the channel.

create type public.channel_type as enum (
    'PUBLIC',     -- PUBLIC: Open for all users. Any user of the application can join and participate.
    'PRIVATE',    -- PRIVATE: Restricted access. Users can join only by invitation or approval.
    'BROADCAST',  -- BROADCAST: One-way communication channel where selected users can post, but all users can view.
    'ARCHIVE',    -- ARCHIVE: Read-only channel for historical/reference purposes. No new messages can be posted.
    'DIRECT',     -- DIRECT: One-on-one private conversation between two users.
    'GROUP'       -- GROUP: For a specific set of users, typically used for group discussions or team collaborations.
);

comment on type public.channel_type is 'Defines the types of channels available in the application, each with specific accessibility and interaction rules.';

-- Type: public.channel_member_role
-- Description: Enumeration of different roles that a member can have within a channel.
create type public.channel_member_role as enum (
    'MEMBER',    -- Regular member with standard privileges.
    'ADMIN',     -- Administrator with elevated privileges like managing channel settings and members.
    'MODERATOR', -- Moderator with privileges like moderating content and managing user interactions.
    'GUEST'      -- Guest with limited privileges, typically read-only access.
);

comment on type public.channel_member_role is 'Defines the roles of channel members, determining their privileges and access within the channel.';

-- Create the enumeration type for notification categories
create type notification_category as enum (
    'mention',
    'message',
    'reply',
    'reaction',
    'channel_event',
    'direct_message',
    'invitation',
    'system_alert'
);

-- COMMENT ON TYPE notification_category IS 'Enumeration of different types of notifications in the application, categorizing the context and purpose of each notification.';

-- COMMENT ON ENUM LABEL notification_category.'mention' IS 'Triggered when a user is mentioned in a message, indicated with "@" followed by the username.';
-- COMMENT ON ENUM LABEL notification_category.'message' IS 'Sent for new messages in a conversation or channel where the user is a participant.';
-- COMMENT ON ENUM LABEL notification_category.'reaction' IS 'Occurs when someone reacts to a user''s message, such as using an emoji.';
-- COMMENT ON ENUM LABEL notification_category.'channel_event' IS 'Covers notifications related to significant events within a channel, like new members joining or settings changes.';
-- COMMENT ON ENUM LABEL notification_category.'direct_message' IS 'For new direct messages received from other users, distinguishing these from general channel communications.';
-- COMMENT ON ENUM LABEL notification_category.'invitation' IS 'Sent when a user receives an invitation to join a channel, group, or event.';
-- COMMENT ON ENUM LABEL notification_category.'system_alert' IS 'Related to system-wide updates or changes, such as maintenance notices, security alerts, or policy updates.';

-- Define the notification preferences for channels
create type public.channel_notification_state as enum (
    'MENTIONS',  -- Only receive notifications for @mentions
    'ALL',      -- Receive all notifications from the channel
    'MUTED'     -- Receive no notifications from the channel
);

comment on type public.channel_notification_state is 'Defines the notification preferences for a user in a channel';


-- ============================================================================
-- File: 02-users.sql
-- ============================================================================

-- -----------------------------------------------------------------------------
-- Table: public.users
-- -----------------------------------------------------------------------------
-- Description: Core user profile table that maintains essential user information,
-- authentication linkage, and profile data. This table serves as the central
-- reference for user management within the application.
-- -----------------------------------------------------------------------------

create table public.users (
    -- Core Identity Fields
    id              uuid not null primary key
                    references auth.users(id) on delete cascade,
    username        text not null unique
                    check (
                        username ~ '^[a-z][a-z0-9_-]{2,29}$' and  -- Format validation
                        username = lower(username)                 -- Enforce lowercase
                    ),
    email           text unique not null,                         -- Required email address

    -- Profile Information
    full_name       text,
    display_name    text generated always as (coalesce(full_name, username)) stored, -- Virtual column
    avatar_url      text check (
                        avatar_url is null or
                        avatar_url ~ '^(https?://\S+|http://localhost(:[0-9]+)?/\S+)$'  -- Validate URL format including localhost
                    ),
    avatar_updated_at timestamp with time zone,                 -- New field for avatar updates
    profile_data    jsonb default '{}'::jsonb not null,         -- Structured profile data

    -- Status Management
    status          user_status not null
                    default 'OFFLINE'::public.user_status,
    online_at       timestamp with time zone,
    deleted_at      timestamp with time zone,                    -- Soft delete timestamp

    -- Audit Timestamps
    created_at      timestamp with time zone not null
                    default timezone('utc', now()),
    updated_at      timestamp with time zone not null
                    default timezone('utc', now()),

    -- Constraints
    constraint username_length
        check (char_length(username) >= 3),
    constraint valid_profile_data
        check (jsonb_typeof(profile_data) = 'object'),
    constraint valid_deletion
        check (
            (deleted_at is null) or
            (deleted_at > created_at)
        )
);

-- Table Comments
comment on table public.users is 'Core user profiles table linking authentication with application user data';

-- Column Comments
comment on column public.users.id is 'Primary key linked to auth.users, ensuring authentication system integration';
comment on column public.users.username is 'Unique username (3-30 chars, lowercase alphanumeric with underscore/hyphen, must start with letter)';
comment on column public.users.email is 'User''s verified email address';
comment on column public.users.full_name is 'User''s full display name';
comment on column public.users.display_name is 'Virtual column that returns full_name or falls back to username';
comment on column public.users.avatar_url is 'URL to user''s profile picture (must be valid HTTP/HTTPS URL)';
comment on column public.users.avatar_updated_at is 'Timestamp of when the user''s avatar was last updated';
comment on column public.users.profile_data is 'Extensible JSON profile data including social links, bio, and preferences';
comment on column public.users.status is 'Current user online status (ONLINE/OFFLINE/AWAY/DND)';
comment on column public.users.online_at is 'Timestamp of user''s last online presence';
comment on column public.users.deleted_at is 'Soft deletion timestamp - null indicates active user';
comment on column public.users.created_at is 'Account creation timestamp (UTC)';
comment on column public.users.updated_at is 'Last profile update timestamp (UTC)';

-- Profile Data Schema Documentation, it's just example, you can add more fields
comment on column public.users.profile_data is E'Expected schema:\n{
  "job_title": string?,
  "company": string?,
  "about": string?,
  "website": string?,
  "social_links": [{
    "url": string,
    "type": "github" | "twitter" | "linkedin" | "other"
  }]
}';

-- Partial index for efficient online user queries
-- Only indexes users with status='ONLINE', keeping the index small and fast
create index if not exists idx_users_online_status
    on public.users (id, online_at)
    where status = 'ONLINE';


-- ============================================================================
-- File: 02-z-admin-users.sql
-- ============================================================================

-- -----------------------------------------------------------------------------
-- Table: public.admin_users
-- -----------------------------------------------------------------------------
-- Description: Tracks users who have admin dashboard access. This table is
-- separate from the main users table to avoid confusion with channel/document
-- roles and to provide clear separation of concerns.
-- -----------------------------------------------------------------------------

create table public.admin_users (
    -- Primary Key (references users table)
    user_id         uuid not null primary key
                    references public.users(id) on delete cascade,

    -- Audit Fields
    created_at      timestamp with time zone not null
                    default timezone('utc', now()),
    created_by      uuid references public.users(id)
                    on delete set null                           -- Who granted admin access
);

-- Table Comments
comment on table public.admin_users is 'Tracks users with admin dashboard access, separate from app/channel roles';
comment on column public.admin_users.user_id is 'Reference to the user who has admin access';
comment on column public.admin_users.created_at is 'When admin access was granted';
comment on column public.admin_users.created_by is 'Who granted the admin access (null if system/migration)';

-- Index for quick lookups
create index if not exists idx_admin_users_created_at
    on public.admin_users (created_at desc);

-- -----------------------------------------------------------------------------
-- Function: public.is_admin
-- -----------------------------------------------------------------------------
-- Security definer function to check admin status without RLS recursion
-- -----------------------------------------------------------------------------
-- Self-check only: the parameter is kept for backward compatibility with
-- callers that pass `auth.uid()` explicitly, but `is_admin(other_uuid)`
-- now always returns false. Prevents authenticated users from probing
-- which platform users hold admin status.
create or replace function public.is_admin(check_user_id uuid)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select check_user_id = auth.uid()
     and exists (select 1 from admin_users where user_id = auth.uid());
$$;

comment on function public.is_admin(uuid) is 'Check if a user has admin dashboard access';

-- Grant execute to authenticated users
grant execute on function public.is_admin(uuid) to authenticated;

-- -----------------------------------------------------------------------------
-- RLS Policies
-- -----------------------------------------------------------------------------
alter table public.admin_users enable row level security;

-- Users can check their own admin status (for auth check)
create policy "Users can check own admin status"
    on public.admin_users for select
    using (user_id = auth.uid());

-- Admins can view all admin users
create policy "Admins can view all"
    on public.admin_users for select
    using (public.is_admin(auth.uid()));

-- Admins can add new admins
create policy "Admins can insert"
    on public.admin_users for insert
    with check (public.is_admin(auth.uid()));

-- Admins can remove other admins (not themselves to prevent lockout)
create policy "Admins can delete others"
    on public.admin_users for delete
    using (
        user_id != auth.uid() and 
        public.is_admin(auth.uid())
    );

-- ============================================================
-- Hardening: pin search_path = public on functions defined above
-- (idempotent — safe to re-run)
-- ============================================================
ALTER FUNCTION public.is_admin(check_user_id uuid) SET search_path = public;


-- ============================================================================
-- File: 03-0-workspaces.sql
-- ============================================================================

-- Table: public.workspaces
-- Description: Represents various workspaces. Each workspace can contain multiple channels.
create table public.workspaces (
    id                varchar(36) default uuid_generate_v4() not null primary key,
    name              text not null check (length(name) <= 100), -- Workspace name, limited to 100 characters.
    slug              text not null unique check (length(slug) <= 100), -- Unique slug for the workspace, used for user-friendly URLs, limited to 100 characters.
    description       text check (length(description) <= 1000), -- Optional description of the workspace, limited to 1000 characters.
    metadata          jsonb default '{}'::jsonb, -- Optional metadata about the workspace in JSONB format.
    created_by        uuid references public.users(id) on delete set null, -- The ID of the user who created the workspace.
    created_at        timestamp with time zone default timezone('utc', now()) not null, -- The timestamp when the workspace was created, set to the current UTC time.
    updated_at        timestamp with time zone default timezone('utc', now()), -- The timestamp when the workspace was last updated, set to the current UTC time.
    deleted_at        timestamp with time zone -- The timestamp when the workspace was soft deleted, NULL if not deleted.
);

-- Constraint: check_slug_format
alter table public.workspaces add constraint check_slug_format check (slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$');

comment on table public.workspaces is 'This table contains information about various workspaces, which are collections of channels for group discussions and messaging. Workspaces provide a higher-level organization structure within the application, allowing for segregation and grouping of channels.';


-- ============================================================================
-- File: 03-1-workspace_members.sql
-- ============================================================================

-- Table: public.workspace_members
-- Description: Manages the membership of users within workspaces. This table tracks when users joined or left a workspace,
-- enabling the application to maintain workspace membership records.
create table public.workspace_members (
    id                uuid default uuid_generate_v4() not null primary key, -- Unique ID for the workspace member record.
    workspace_id      varchar(36) not null references public.workspaces(id) on delete cascade, -- The ID of the workspace. If the workspace is deleted, associated member records are also deleted.
    member_id         uuid not null references public.users(id) on delete cascade, -- The ID of the workspace member (user). If the user is deleted, their membership records are also deleted.
    left_at           timestamp with time zone, -- Timestamp when the user left the workspace.
    created_at        timestamp with time zone default timezone('utc', now()) not null, -- Timestamp when the membership record was created.
    updated_at        timestamp with time zone default timezone('utc', now()) -- Timestamp when the membership record was last updated.
);

comment on table public.workspace_members is 'Tracks user membership in workspaces, including when users joined or left specific workspaces. The created_at and updated_at columns help monitor the history and changes in user-workspace relationships.';

-- Column comments for better documentation
comment on column public.workspace_members.id is 'Unique identifier for this workspace membership record';
comment on column public.workspace_members.workspace_id is 'Reference to the workspace this membership belongs to';
comment on column public.workspace_members.member_id is 'Reference to the user who is a member of the workspace';
comment on column public.workspace_members.left_at is 'Timestamp when the user left this workspace, null if still active';
comment on column public.workspace_members.created_at is 'Timestamp when this membership record was created';
comment on column public.workspace_members.updated_at is 'Timestamp when this membership record was last updated';

-- Create a unique constraint to prevent duplicate memberships
alter table public.workspace_members add constraint workspace_members_workspace_id_member_id_key unique (workspace_id, member_id);


-- ============================================================================
-- File: 04-channels.sql
-- ============================================================================

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


-- ============================================================================
-- File: 05-0-message.sql
-- ============================================================================

-- Table: public.messages
-- Description: Stores all messages exchanged in the application. This includes various types of messages like text, image, video, or audio.
-- The table also tracks message status (edited, deleted) and associations (user, channel, replies).

-- Live sequence for messages.seq starts at 1_000_000_000; backfill sequence in the
-- paired migration is bounded below it so historical rows sort before any live insert.
create sequence if not exists public.messages_seq_seq start with 1000000000;

create table public.messages (
    id                     uuid default uuid_generate_v4() not null primary key,
    seq                    bigint not null default nextval('public.messages_seq_seq'), -- Global monotonic ordering cursor for v2 paging and realtime gap detection.
    client_id              text, -- Idempotency token from utils/clientMessageId.ts for optimistic-send dedupe.
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
    readed_at              timestamp with time zone -- Timestamp for when the message was read by a user.
);

alter sequence public.messages_seq_seq owned by public.messages.seq;
alter table public.messages add constraint messages_seq_key unique (seq);
create unique index if not exists idx_messages_client_id
  on public.messages (client_id)
  where client_id is not null;

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
comment on column public.messages.readed_at is 'Timestamp when the message was last read';

-- TODO: partition by channel_id and created_at

-- Example JSON structures for reference:

-- Metadata example
-- {
--   "replied": [
--     "68d37413-e405-40e8-aec6-4a741be8982b"
--   ],
--   "is_important": true
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


-- ============================================================================
-- File: 06-message-bookmarks.sql
-- ============================================================================

-- Table: public.message_bookmarks
-- Description: Stores user bookmarks for messages. Allows users to save messages for later reference and organize them.
create table public.message_bookmarks (
    id bigint generated always as identity primary key,
    user_id uuid not null references public.users(id) on delete cascade,
    message_id uuid not null references public.messages(id) on delete cascade,
    created_at timestamp with time zone default timezone('utc', now()) not null,
    updated_at timestamp with time zone default timezone('utc', now()) not null,
    archived_at timestamp with time zone, -- When the bookmark was archived by the user
    marked_at timestamp with time zone, -- When the bookmark was marked as read by the user
    metadata jsonb default '{}'::jsonb, -- For future features like folders, tags, priority levels, etc.
    unique(user_id, message_id) -- Prevent users from bookmarking the same message multiple times
);

comment on table public.message_bookmarks is 'Stores user bookmarks for messages, allowing users to save and organize messages for later reference with archive and read status tracking.';

-- Column comments for better documentation
comment on column public.message_bookmarks.id is 'Unique identifier for the bookmark';
comment on column public.message_bookmarks.user_id is 'Reference to the user who created this bookmark';
comment on column public.message_bookmarks.message_id is 'Reference to the bookmarked message';
comment on column public.message_bookmarks.created_at is 'Timestamp when the message was bookmarked';
comment on column public.message_bookmarks.updated_at is 'Timestamp when the bookmark was last updated';
comment on column public.message_bookmarks.archived_at is 'Timestamp when the bookmark was archived, null if active';
comment on column public.message_bookmarks.marked_at is 'Timestamp when the bookmark was marked as read, null if unread';
comment on column public.message_bookmarks.metadata is 'Additional configurable properties for organizing bookmarks (folders, tags, etc.)';

-- Indexes for performance
create index message_bookmarks_user_id_idx on public.message_bookmarks (user_id);
create index message_bookmarks_message_id_idx on public.message_bookmarks (message_id);
create index message_bookmarks_created_at_idx on public.message_bookmarks (created_at desc);
create index message_bookmarks_archived_at_idx on public.message_bookmarks (archived_at) where archived_at is not null;
create index message_bookmarks_marked_at_idx on public.message_bookmarks (marked_at) where marked_at is not null;

-- Trigger to automatically update updated_at timestamp
create or replace function update_message_bookmarks_updated_at()
returns trigger as $$
begin
    new.updated_at = timezone('utc', now());
    return new;
end;
$$ language plpgsql;

create trigger update_message_bookmarks_updated_at
    before update on public.message_bookmarks
    for each row
    execute function update_message_bookmarks_updated_at();

-- Enable Row Level Security
alter table public.message_bookmarks enable row level security;

-- RLS Policies
create policy "Users can view their own bookmarks"
    on public.message_bookmarks
    for select
    using (auth.uid() = user_id);

create policy "Users can create their own bookmarks"
    on public.message_bookmarks
    for insert
    with check (auth.uid() = user_id);

create policy "Users can update their own bookmarks"
    on public.message_bookmarks
    for update
    using (auth.uid() = user_id)
    with check (auth.uid() = user_id);

create policy "Users can delete their own bookmarks"
    on public.message_bookmarks
    for delete
    using (auth.uid() = user_id);

-- ============================================================
-- Hardening: pin search_path = public on functions defined above
-- (idempotent — safe to re-run)
-- ============================================================
ALTER FUNCTION public.update_message_bookmarks_updated_at() SET search_path = public;

-- Trigger functions run as postgres (DEFINER) so internal side effects
-- (counters, previews, notifications) bypass RLS on side-effect tables.
-- search_path is already pinned above; flipping security mode is safe.
ALTER FUNCTION public.update_message_bookmarks_updated_at() SECURITY DEFINER;


-- ============================================================================
-- File: 06-pinned_message.sql
-- ============================================================================

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


-- ============================================================================
-- File: 07-0-notifications.sql
-- ============================================================================

-- Notification pipeline:
--   07-0  this file — notifications table & enums
--   07-1  notification read RPCs (used by FE)
--   07-3  in-app realtime broadcast (private topic per user)
--   07-4  web-push PGMQ producer (consumer in hocuspocus.server)
--   07-5  email PGMQ producer (consumer in hocuspocus.server)
-- Fan-out triggers live in 10-func-notifications.sql.

create table public.notifications (
    id                  uuid default uuid_generate_v4() not null primary key,
    type                notification_category not null, -- Type of the notification (e.g., message, invite, mention).
    sender_user_id      uuid references public.users(id) on delete set null, -- ID of the user who sent the notification (if applicable).
    receiver_user_id    uuid not null references public.users(id) on delete cascade, -- The ID of the user who will receive the notification.
    message_id          uuid references public.messages(id) on delete cascade,  -- ID of the associated message, if the notification is message-related.
    channel_id          varchar(36) references public.channels(id) on delete cascade, -- ID of the associated channel, if the notification is channel-related.
    message_preview     text, -- Preview of the content related to the notification (if applicable).
    created_at          timestamp with time zone default timezone('utc', now()) not null, -- Timestamp when the notification was created.
    readed_at           timestamp with time zone, -- Timestamp when the notification was marked as read by the user.
    action_url          text -- URL or deep link to direct the user to a specific page or action in the application.
);

comment on table public.notifications is 'Table to store and manage notifications for various user interactions and activities within the application.';

-- Column comments for better documentation
comment on column public.notifications.id is 'Unique identifier for the notification';
comment on column public.notifications.type is 'Category of notification based on its purpose and context';
comment on column public.notifications.sender_user_id is 'Reference to the user who triggered the notification, if applicable';
comment on column public.notifications.receiver_user_id is 'Reference to the user who should receive this notification';
comment on column public.notifications.message_id is 'Reference to the associated message, if this notification is message-related';
comment on column public.notifications.channel_id is 'Reference to the associated channel, if this notification is channel-related';
comment on column public.notifications.message_preview is 'Short preview of the relevant content for display in notifications';
comment on column public.notifications.created_at is 'Timestamp when this notification was created';
comment on column public.notifications.readed_at is 'Timestamp when the user viewed/read this notification, null if unread';
comment on column public.notifications.action_url is 'Link to navigate to the relevant content when the notification is clicked';

-- update_notification_preferences — partial JSONB merge into
-- public.users.profile_data->'notification_preferences'. Collapses
-- per-toggle PATCHes into one debounced RPC. `||` is last-write-wins
-- across concurrent tabs (acceptable for single-user preference editing).

create or replace function public.update_notification_preferences(p_patch jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
    v_user_id uuid := auth.uid();
    v_next jsonb;
begin
    if v_user_id is null then
        raise exception 'unauthenticated' using errcode = '42501';
    end if;
    if jsonb_typeof(p_patch) <> 'object' then
        raise exception 'patch_must_be_object' using errcode = '22023';
    end if;
    update public.users
       set profile_data = jsonb_set(
               coalesce(profile_data, '{}'::jsonb),
               array['notification_preferences'],
               coalesce(profile_data -> 'notification_preferences', '{}'::jsonb) || p_patch,
               true
           )
     where id = v_user_id
     returning profile_data -> 'notification_preferences' into v_next;
    return v_next;
end;
$$;

revoke all on function public.update_notification_preferences(jsonb) from public;
grant execute on function public.update_notification_preferences(jsonb) to authenticated;


-- ============================================================================
-- File: 07-1-notification-functions.sql
-- ============================================================================

/*
 * Notification Functions
 * This file contains functions related to notification management:
 * - Retrieving workspace-specific notifications
 * - Filtering by read/unread status
 * - Pagination support for notification listings
 */

/**
 * Function: get_workspace_notifications
 * Description: Retrieves notifications for a specific user filtered by workspace
 * Parameters:
 *   - p_user_id: UUID of the user to get notifications for
 *   - p_workspace_id: ID of the workspace to filter notifications by
 *   - p_limit: Maximum number of notifications to return (default: 10)
 *   - p_offset: Number of notifications to skip for pagination (default: 0)
 *   - p_is_read: Whether to return read (true) or unread (false) notifications (default: true)
 * Returns: A set of JSON objects containing notification data with sender information
 */
create or replace function get_workspace_notifications(
  p_user_id uuid,
  p_workspace_id varchar,
  p_limit int default 10,
  p_offset int default 0,
  p_is_read boolean default true
)
returns setof json as $$
begin
  -- Return filtered notifications based on workspace and read status
  if p_is_read then
    return query
    with workspace_channels as (
      select id from channels where workspace_id = p_workspace_id
    ),
    workspace_messages as (
      select m.id
      from messages m
      join workspace_channels wc on m.channel_id = wc.id
    )
    select json_build_object(
      'id', n.id,
      'type', n.type,
      'sender_user_id', n.sender_user_id,
      'receiver_user_id', n.receiver_user_id,
      'message_id', n.message_id,
      'channel_id', n.channel_id,
      'message_preview', n.message_preview,
      'created_at', n.created_at,
      'readed_at', n.readed_at,
      'action_url', n.action_url,
      'sender', json_build_object(
        'id', u.id,
        'avatar_updated_at', u.avatar_updated_at,
        'avatar_url', u.avatar_url,
        'display_name', u.display_name,
        'full_name', u.full_name,
        'username', u.username
      )
    )
    from notifications n
    left join users u on n.sender_user_id = u.id
    where n.receiver_user_id = p_user_id
    and n.readed_at is not null
    and (
      -- Include system notifications (no channel or message)
      (n.channel_id is null and n.message_id is null)
      -- Include notifications for channels in this workspace
      or n.channel_id in (select id from workspace_channels)
      -- Include notifications for messages in channels in this workspace
      or n.message_id in (select id from workspace_messages)
    )
    order by n.created_at desc
    limit p_limit offset p_offset;
  else
    return query
    with workspace_channels as (
      select id from channels where workspace_id = p_workspace_id
    ),
    workspace_messages as (
      select m.id
      from messages m
      join workspace_channels wc on m.channel_id = wc.id
    )
    select json_build_object(
      'id', n.id,
      'type', n.type,
      'sender_user_id', n.sender_user_id,
      'receiver_user_id', n.receiver_user_id,
      'message_id', n.message_id,
      'channel_id', n.channel_id,
      'message_preview', n.message_preview,
      'created_at', n.created_at,
      'readed_at', n.readed_at,
      'action_url', n.action_url,
      'sender', json_build_object(
        'id', u.id,
        'avatar_updated_at', u.avatar_updated_at,
        'avatar_url', u.avatar_url,
        'display_name', u.display_name,
        'full_name', u.full_name,
        'username', u.username
      )
    )
    from notifications n
    left join users u on n.sender_user_id = u.id
    where n.receiver_user_id = p_user_id
    and n.readed_at is null
    and (
      -- Include system notifications (no channel or message)
      (n.channel_id is null and n.message_id is null)
      -- Include notifications for channels in this workspace
      or n.channel_id in (select id from workspace_channels)
      -- Include notifications for messages in channels in this workspace
      or n.message_id in (select id from workspace_messages)
    )
    order by n.created_at desc
    limit p_limit offset p_offset;
  end if;
end;
$$ language plpgsql;

comment on function get_workspace_notifications(uuid, varchar, int, int, boolean) is
'Returns notifications for a specific user filtered by workspace, with pagination and read/unread filtering options.';

-- ============================================================
-- Hardening: pin search_path = public on functions defined above
-- (idempotent — safe to re-run)
-- ============================================================
ALTER FUNCTION public.get_workspace_notifications(p_user_id uuid, p_workspace_id character varying, p_limit integer, p_offset integer, p_is_read boolean) SET search_path = public;


-- ============================================================================
-- File: 07-3-notification-broadcast.sql
-- ============================================================================

-- -----------------------------------------------------------------------------
-- Notification Broadcast Trigger
-- -----------------------------------------------------------------------------
-- Description: Broadcasts notification changes to user-specific topics for
-- efficient realtime updates with workspace context.
--
-- Architecture Choice: User-Specific Broadcast (Option C)
--
-- Why this approach:
--   1. O(1) routing per event - no server-side filtering overhead
--   2. Events go ONLY to the intended user's topic
--   3. Includes workspace_id so client can filter by workspace if needed
--   4. More efficient than postgres_changes at scale
--
-- Trade-off: Uses separate channel from workspace channel, but this is
-- the most efficient approach for user-specific notifications.
--
-- Reference: https://supabase.com/blog/realtime-broadcast-from-database
-- -----------------------------------------------------------------------------

-- Trigger function to broadcast notification changes to user-specific topics
CREATE OR REPLACE FUNCTION public.broadcast_notification_changes()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  topic TEXT;
  user_id UUID;
  workspace_id_val VARCHAR(36);
  payload JSONB;
BEGIN
  -- Determine the user ID based on the operation
  IF TG_OP = 'DELETE' THEN
    user_id := OLD.receiver_user_id;
  ELSE
    user_id := NEW.receiver_user_id;
  END IF;

  -- Get workspace_id from the channel (for workspace context)
  IF TG_OP = 'DELETE' THEN
    SELECT c.workspace_id INTO workspace_id_val
    FROM public.channels c
    WHERE c.id = OLD.channel_id;
  ELSE
    SELECT c.workspace_id INTO workspace_id_val
    FROM public.channels c
    WHERE c.id = NEW.channel_id;
  END IF;

  -- Build the topic for this user's notifications
  topic := 'notifications:' || user_id::TEXT;

  -- Build payload with workspace context
  payload := jsonb_build_object(
    'event', TG_OP,
    'workspace_id', workspace_id_val,
    'record', CASE WHEN TG_OP = 'DELETE' THEN NULL ELSE to_jsonb(NEW) END,
    'old_record', CASE WHEN TG_OP = 'INSERT' THEN NULL ELSE to_jsonb(OLD) END
  );

  -- Private broadcast: subscribers are authorized via the
  -- `notifications_topic_access` policy on realtime.messages below.
  -- Without `private := TRUE`, anyone who learns a user UUID (logs,
  -- attribution headers, public profile, invite links) can subscribe
  -- to `notifications:<uid>` and receive that user's notifications.
  PERFORM realtime.send(
    payload,
    TG_OP,      -- event name: INSERT, UPDATE, DELETE
    topic,      -- topic: notifications:{user_id}
    TRUE        -- private: true (auth-gated by RLS on realtime.messages)
  );

  RETURN NULL;
END;
$$;

COMMENT ON FUNCTION public.broadcast_notification_changes() IS
'Broadcasts notification changes to private user-specific topics with workspace context.
Benefits:
- O(1) routing per event (no server-side filtering)
- Includes workspace_id for client-side filtering if needed
- Direct delivery to intended recipient only
- Subscribers authorized by realtime.messages RLS (notifications_topic_access).';

-- Create the trigger on notifications table
DROP TRIGGER IF EXISTS broadcast_notification_changes_trigger ON public.notifications;

CREATE TRIGGER broadcast_notification_changes_trigger
AFTER INSERT OR UPDATE OR DELETE
ON public.notifications
FOR EACH ROW
EXECUTE FUNCTION public.broadcast_notification_changes();

COMMENT ON TRIGGER broadcast_notification_changes_trigger ON public.notifications IS
'Triggers broadcast of notification changes to the receiver user topic with workspace context.';

-- -----------------------------------------------------------------------------
-- Authorization for private notification topic subscriptions
-- -----------------------------------------------------------------------------
-- When `realtime.send(..., private := TRUE)` writes to a topic, Supabase
-- Realtime gates subscriptions through RLS on `realtime.messages`. Without
-- a policy, all private subscriptions for `notifications:*` are denied.
--
-- Rule: an authenticated user may subscribe ONLY to their own per-user
-- topic, i.e. `notifications:<auth.uid()>`. No cross-user leakage.

ALTER TABLE realtime.messages ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "notifications_topic_access" ON realtime.messages;

CREATE POLICY "notifications_topic_access"
ON realtime.messages
FOR SELECT
TO authenticated
USING (
  realtime.messages.topic = 'notifications:' || auth.uid()::text
);

COMMENT ON POLICY "notifications_topic_access" ON realtime.messages IS
'Allows authenticated users to subscribe to their own per-user notification topic
(notifications:<auth.uid()>). Pairs with broadcast_notification_changes() which
sends with private := TRUE.';

-- ============================================================
-- Hardening: pin search_path = public on functions defined above
-- (idempotent — safe to re-run)
-- ============================================================
ALTER FUNCTION public.broadcast_notification_changes() SET search_path = public;


-- ============================================================================
-- File: 07-4-push-notifications-pgmq.sql
-- ============================================================================

-- -----------------------------------------------------------------------------
-- Push Notifications Schema (pgmq Consumer Architecture)
-- -----------------------------------------------------------------------------
-- Production-ready push notification system using pgmq for reliability.
--
-- ARCHITECTURE (v2 - pgmq Consumer):
--   Database Trigger → pgmq queue → Backend Consumer → BullMQ → Web Push API
--
-- WHY pgmq INSTEAD OF pg_net?
--   ✅ Never lose messages (queue persists even if backend is down)
--   ✅ No exposed HTTP endpoint (security improvement)
--   ✅ Auto-retry built into queue semantics
--   ✅ Same pattern as document_views and message_counter (consistency)
--   ✅ $0 cost at any scale
--   ⚠️ 2-5 second delay (acceptable for push notifications)
--
-- MIGRATION FROM v1 (pg_net):
--   - Old trigger replaced with enqueue_push_notification
--   - Backend consumer polls queue every 2 seconds
--   - HTTP endpoint (/api/push/send) has been removed
--
-- DEPLOYMENT CHECKLIST:
--   1. Run this migration
--   2. Deploy backend with pgmq consumer
--   3. Verify queue is being consumed (check queue depth)
--   4. Remove pg_net dependency after 1 week of stable operation
--
-- @see docs/PUSH_NOTIFICATION_PGMQ.md for detailed architecture
-- -----------------------------------------------------------------------------

-- =============================================================================
-- 1. Create pgmq Queue for Push Notifications
-- =============================================================================
-- Queue stores notification events until backend consumes them

select from pgmq.create('push_notifications');

comment on table pgmq.q_push_notifications is
'Queue for push notification events. Consumed by hocuspocus.server backend.
Events are processed in order and archived after successful processing.';

-- =============================================================================
-- 2. Push Subscriptions Table
-- =============================================================================
-- Stores browser/device push subscription credentials per user

create table if not exists public.push_subscriptions (
    id uuid default gen_random_uuid() primary key,
    user_id uuid not null references public.users(id) on delete cascade,
    device_id text not null,
    device_name text,
    platform text check (platform in ('web', 'ios', 'android', 'desktop')),
    push_credentials jsonb not null,
    is_active boolean default true not null,
    failed_count int default 0 not null,
    last_error text,
    last_used_at timestamptz,
    created_at timestamptz default now() not null,
    updated_at timestamptz default now() not null,

    constraint unique_user_device unique (user_id, device_id)
);

create index if not exists idx_push_subscriptions_user_active
    on public.push_subscriptions(user_id)
    where is_active = true;

create index if not exists idx_push_subscriptions_cleanup
    on public.push_subscriptions(is_active, failed_count)
    where is_active = false or failed_count > 3;

alter table public.push_subscriptions enable row level security;

drop policy if exists "Users can manage own subscriptions" on public.push_subscriptions;
create policy "Users can manage own subscriptions" on public.push_subscriptions
    for all using (auth.uid() = user_id);

comment on table public.push_subscriptions is
'Browser/device push notification subscriptions per user';

-- Updated_at trigger
create or replace function update_push_subscriptions_updated_at()
returns trigger as $$
begin
    new.updated_at = now();
    return new;
end;
$$ language plpgsql;

drop trigger if exists trigger_push_subscriptions_updated_at on public.push_subscriptions;
create trigger trigger_push_subscriptions_updated_at
    before update on public.push_subscriptions
    for each row execute function update_push_subscriptions_updated_at();


-- =============================================================================
-- 3. Helper Functions
-- =============================================================================

-- Check if user has push notifications enabled
create or replace function internal.is_push_enabled(p_user_id uuid)
returns boolean
language sql
stable
set search_path = public
as $$
    select coalesce(
        (profile_data->'notification_preferences'->>'push_enabled')::boolean,
        true  -- Default to enabled
    )
    from public.users
    where id = p_user_id;
$$;

-- Get user's notification preferences
create or replace function internal.get_push_preferences(p_user_id uuid)
returns jsonb
language sql
stable
set search_path = public
as $$
    select coalesce(
        profile_data->'notification_preferences',
        '{}'::jsonb
    )
    from public.users
    where id = p_user_id;
$$;

-- Check if current time is within user's quiet hours
create or replace function internal.is_quiet_hours(p_user_id uuid)
returns boolean
language sql
stable
set search_path = public
as $$
    with user_prefs as (
        select
            coalesce((profile_data->'notification_preferences'->>'quiet_hours_enabled')::boolean, false) as enabled,
            coalesce(profile_data->'notification_preferences'->>'quiet_hours_start', '22:00') as start_time,
            coalesce(profile_data->'notification_preferences'->>'quiet_hours_end', '08:00') as end_time,
            coalesce(profile_data->'notification_preferences'->>'timezone', 'UTC') as tz
        from public.users
        where id = p_user_id
    )
    select
        case
            when not enabled then false
            else (
                (now() at time zone tz)::time
                between start_time::time and end_time::time
                or (
                    start_time::time > end_time::time
                    and (
                        (now() at time zone tz)::time >= start_time::time
                        or (now() at time zone tz)::time <= end_time::time
                    )
                )
            )
        end
    from user_prefs;
$$;

-- Check if user is currently online (suppress push if online)
create or replace function internal.is_user_online(p_user_id uuid)
returns boolean
language sql
stable
set search_path = public
as $$
    select exists (
        select 1
        from public.users
        where id = p_user_id
        and status = 'ONLINE'
        and online_at > now() - interval '2 minutes'
    );
$$;


-- =============================================================================
-- 4. Enqueue Push Notification (replaces pg_net HTTP call)
-- =============================================================================
-- Trigger function that enqueues notification to pgmq instead of HTTP

create or replace function public.enqueue_push_notification()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
    v_receiver_id uuid;
    v_sender_name text;
    v_sender_avatar text;
    v_prefs jsonb;
    v_notify_type text;
    v_has_subscriptions boolean;
    v_action_url text;
begin
    -- Get receiver ID
    v_receiver_id := new.receiver_user_id;

    -- Don't notify self
    if v_receiver_id = new.sender_user_id then
        return new;
    end if;

    -- Check if user has push enabled
    if not internal.is_push_enabled(v_receiver_id) then
        return new;
    end if;

    -- Check if user is online (skip push if online)
    if internal.is_user_online(v_receiver_id) then
        return new;
    end if;

    -- Check quiet hours
    if internal.is_quiet_hours(v_receiver_id) then
        return new;
    end if;

    -- Get user preferences
    v_prefs := internal.get_push_preferences(v_receiver_id);
    v_notify_type := new.type;

    -- Check if this notification type is enabled
    if v_notify_type = 'mention' and not coalesce((v_prefs->>'push_mentions')::boolean, true) then
        return new;
    end if;
    if v_notify_type = 'reply' and not coalesce((v_prefs->>'push_replies')::boolean, true) then
        return new;
    end if;
    if v_notify_type = 'reaction' and not coalesce((v_prefs->>'push_reactions')::boolean, true) then
        return new;
    end if;

    -- Check if user has any active push subscriptions
    select exists(
        select 1 from public.push_subscriptions
        where user_id = v_receiver_id and is_active = true
    ) into v_has_subscriptions;

    if not v_has_subscriptions then
        return new;
    end if;

    -- Get sender info
    select
        coalesce(full_name, username, 'Someone'),
        avatar_url
    into v_sender_name, v_sender_avatar
    from public.users
    where id = new.sender_user_id;

    -- Build action URL
    v_action_url := coalesce(new.action_url, '');

    -- =========================================================================
    -- ENQUEUE TO pgmq (instead of pg_net HTTP call)
    -- Backend consumer will process this and send via Web Push API
    -- =========================================================================

    perform pgmq.send(
        queue_name := 'push_notifications',
        msg := jsonb_build_object(
            'notification_id', new.id,
            'user_id', v_receiver_id,
            'type', v_notify_type,
            'sender_name', v_sender_name,
            'sender_avatar', v_sender_avatar,
            'message_preview', coalesce(new.message_preview, ''),
            'action_url', v_action_url,
            'channel_id', new.channel_id,
            'enqueued_at', now()
        )
    );

    return new;
end;
$$;

comment on function public.enqueue_push_notification() is
'Enqueues push notification to pgmq queue for backend consumption.
Replaces pg_net HTTP approach for better reliability and security.';

-- Drop old trigger and create new one
drop trigger if exists trigger_send_push_notification on public.notifications;
drop trigger if exists trigger_enqueue_push_notification on public.notifications;
create trigger trigger_enqueue_push_notification
    after insert on public.notifications
    for each row execute function public.enqueue_push_notification();


-- =============================================================================
-- 5. Consumer RPC Functions (called by backend)
-- =============================================================================
-- Backend calls this RPC to read and process queue messages

create or replace function public.consume_push_queue(
    p_batch_size int default 50,
    p_visibility_timeout int default 30
)
returns table (
    msg_id bigint,
    payload jsonb,
    enqueued_at timestamptz
)
language sql
security definer
set search_path = public
as $$
    select
        msg_id,
        message as payload,
        enqueued_at
    from pgmq.read(
        queue_name := 'push_notifications',
        vt := p_visibility_timeout,
        qty := p_batch_size
    );
$$;

comment on function public.consume_push_queue(int, int) is
'Reads push notification messages from pgmq queue.
Called by backend consumer service every 2 seconds.
Returns batch of messages with visibility timeout.';

-- Grant execute to service_role (backend uses service_role key)
grant execute on function public.consume_push_queue(int, int) to service_role;


-- Acknowledge processed message (archive to pgmq.a_push_notifications for stats)
create or replace function public.ack_push_message(p_msg_id bigint)
returns boolean
language sql
security definer
set search_path = public
as $$
    select pgmq.archive('push_notifications', p_msg_id);
$$;

comment on function public.ack_push_message(bigint) is
'Acknowledges a push notification message was processed successfully.
Archives the message (moves to pgmq.a_push_notifications) for stats tracking.';

grant execute on function public.ack_push_message(bigint) to service_role;


-- =============================================================================
-- 6. Subscription Management Functions
-- =============================================================================

create or replace function public.register_push_subscription(
    p_device_id text,
    p_device_name text,
    p_platform text,
    p_push_credentials jsonb
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
    v_subscription_id uuid;
begin
    insert into public.push_subscriptions (
        user_id, device_id, device_name, platform, push_credentials, is_active
    ) values (
        auth.uid(), p_device_id, p_device_name, p_platform, p_push_credentials, true
    )
    on conflict (user_id, device_id) do update set
        device_name = excluded.device_name,
        platform = excluded.platform,
        push_credentials = excluded.push_credentials,
        is_active = true,
        failed_count = 0,
        last_error = null,
        updated_at = now()
    returning id into v_subscription_id;

    return v_subscription_id;
end;
$$;

comment on function public.register_push_subscription(text, text, text, jsonb) is
'Registers or updates a push subscription for the current user.';


create or replace function public.unregister_push_subscription(p_device_id text)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
begin
    update public.push_subscriptions
    set is_active = false, updated_at = now()
    where user_id = auth.uid() and device_id = p_device_id;

    return found;
end;
$$;

comment on function public.unregister_push_subscription(text) is
'Deactivates a push subscription for the current user.';


-- =============================================================================
-- 7. Admin/Monitoring Functions
-- =============================================================================

-- 7a. Push queue stats (pipeline health, archive counts, last push sent)
create or replace function public.get_push_queue_stats()
returns jsonb
language sql
security definer
set search_path = public
as $$
    with queue_stats as (
        select
            count(*) as queue_length,
            extract(epoch from (now() - min(enqueued_at))) as oldest_msg_age_sec
        from pgmq.q_push_notifications
    ),
    archive_stats as (
        select
            count(*) as messages_processed,
            max(archived_at) as last_archived_at
        from pgmq.a_push_notifications
    ),
    subscription_stats as (
        select
            count(*) filter (where is_active) as active_subscriptions,
            count(*) filter (where not is_active) as inactive_subscriptions,
            count(*) filter (where failed_count > 0) as failed_subscriptions,
            max(last_used_at) as last_push_sent
        from public.push_subscriptions
    )
    select jsonb_build_object(
        'queue_length', coalesce(q.queue_length, 0),
        'oldest_message_age_seconds', coalesce(q.oldest_msg_age_sec, 0),
        'active_subscriptions', coalesce(s.active_subscriptions, 0),
        'inactive_subscriptions', coalesce(s.inactive_subscriptions, 0),
        'failed_subscriptions', coalesce(s.failed_subscriptions, 0),
        'messages_processed', coalesce(a.messages_processed, 0),
        'last_push_sent', coalesce(s.last_push_sent, a.last_archived_at),
        'consumer_status', case
            when coalesce(q.queue_length, 0) = 0 then 'idle'
            when coalesce(q.queue_length, 0) < 100 then 'healthy'
            when coalesce(q.queue_length, 0) < 1000 then 'backlog'
            else 'critical'
        end
    )
    from queue_stats q, archive_stats a, subscription_stats s;
$$;

comment on function public.get_push_queue_stats() is
'Returns push notification system health including queue status, archive stats, and subscription stats.';

-- Admin-only: queue depth + global subscription stats are not for any
-- authenticated user. Admin gating happens at the Hocuspocus controller
-- (service_role key); revoke the default public grant so the explicit
-- service_role grant is exclusive.
revoke execute on function public.get_push_queue_stats() from public, anon, authenticated;
grant  execute on function public.get_push_queue_stats() to service_role;


-- 7b. Admin: aggregated push subscription platforms per user (bypasses RLS)
create or replace function public.admin_get_user_notification_subs()
returns table (
    user_id uuid,
    platforms text[]
)
language sql
stable
security definer
set search_path = public
as $$
    select
        ps.user_id,
        array_agg(distinct ps.platform) as platforms
    from public.push_subscriptions ps
    where ps.is_active = true
      and public.is_admin(auth.uid())
    group by ps.user_id;
$$;

comment on function public.admin_get_user_notification_subs() is
'Returns aggregated push subscription platforms per user. Admin-only, bypasses RLS.';

revoke execute on function public.admin_get_user_notification_subs() from anon;
grant execute on function public.admin_get_user_notification_subs() to authenticated;


-- 7c. Admin: recent push activity across all users (bypasses RLS)
create or replace function public.admin_get_recent_push_activity(p_limit int default 10)
returns table (
    id uuid,
    user_id uuid,
    username text,
    device_name text,
    platform text,
    is_active boolean,
    failed_count int,
    last_error text,
    last_used_at timestamptz,
    created_at timestamptz
)
language plpgsql
security definer
set search_path = public
as $$
begin
    if not public.is_admin(auth.uid()) then
        raise exception 'Access denied: user is not an admin.';
    end if;

    return query
    select
        ps.id,
        ps.user_id,
        u.username,
        ps.device_name,
        ps.platform,
        ps.is_active,
        ps.failed_count,
        ps.last_error,
        ps.last_used_at,
        ps.created_at
    from public.push_subscriptions ps
    join public.users u on ps.user_id = u.id
    where ps.is_active = true
    order by ps.last_used_at desc nulls last
    limit p_limit;
end;
$$;

comment on function public.admin_get_recent_push_activity(int) is
'Returns recent push subscription activity across all users. Admin-only, bypasses RLS.';

revoke execute on function public.admin_get_recent_push_activity(int) from anon;
grant execute on function public.admin_get_recent_push_activity(int) to authenticated;


-- 7d. Admin: failed push subscriptions across all users (bypasses RLS)
create or replace function public.admin_get_failed_push_subs(p_limit int default 10)
returns table (
    id uuid,
    user_id uuid,
    username text,
    device_name text,
    platform text,
    is_active boolean,
    failed_count int,
    last_error text,
    last_used_at timestamptz,
    created_at timestamptz
)
language plpgsql
security definer
set search_path = public
as $$
begin
    if not public.is_admin(auth.uid()) then
        raise exception 'Access denied: user is not an admin.';
    end if;

    return query
    select
        ps.id,
        ps.user_id,
        u.username,
        ps.device_name,
        ps.platform,
        ps.is_active,
        ps.failed_count,
        ps.last_error,
        ps.last_used_at,
        ps.created_at
    from public.push_subscriptions ps
    join public.users u on ps.user_id = u.id
    where ps.failed_count > 0
    order by ps.failed_count desc
    limit p_limit;
end;
$$;

comment on function public.admin_get_failed_push_subs(int) is
'Returns failed push subscriptions across all users. Admin-only, bypasses RLS.';

revoke execute on function public.admin_get_failed_push_subs(int) from anon;
grant execute on function public.admin_get_failed_push_subs(int) to authenticated;


-- =============================================================================
-- 8. Cleanup Stale Subscriptions (pg_cron job)
-- =============================================================================

create or replace function internal.cleanup_push_subscriptions()
returns int
language plpgsql
security definer
set search_path = public
as $$
declare
    v_deleted int;
begin
    -- Deactivate subscriptions that have failed too many times
    update public.push_subscriptions
    set is_active = false
    where is_active = true and failed_count >= 5;

    -- Delete very old inactive subscriptions
    delete from public.push_subscriptions
    where is_active = false
    and updated_at < now() - interval '30 days';

    get diagnostics v_deleted = row_count;
    return v_deleted;
end;
$$;

comment on function internal.cleanup_push_subscriptions() is
'Cleans up stale push subscriptions. Run via pg_cron every 5 minutes.';


-- =============================================================================
-- 9. Drop Deprecated Functions (from pg_net architecture)
-- =============================================================================
-- These functions are no longer needed with pgmq Consumer architecture

drop function if exists public.send_push_notification() cascade;
drop function if exists internal.get_push_config() cascade;
drop function if exists public.set_push_config(text, text) cascade;


-- =============================================================================
-- 10. Enable Realtime for Notification Tables
-- =============================================================================
-- NOTE: `notifications` is delivered to clients via the per-user broadcast
-- trigger in 07-3-notification-broadcast.sql (`realtime.send` -> topic
-- `notifications:<user_id>`). Do not also add it to `supabase_realtime`;
-- that double-fans every notification through both postgres_changes and
-- broadcast. Drop it defensively here in case an earlier run added it.

do $$
begin
    if exists (
        select 1 from pg_publication_tables
        where pubname = 'supabase_realtime' and tablename = 'notifications'
    ) then
        alter publication supabase_realtime drop table notifications;
    end if;

    if not exists (
        select 1 from pg_publication_tables
        where pubname = 'supabase_realtime' and tablename = 'push_subscriptions'
    ) then
        alter publication supabase_realtime add table push_subscriptions;
    end if;
end $$;

-- ============================================================
-- Hardening: pin search_path = public on functions defined above
-- (idempotent — safe to re-run). supabase_admin-owned functions
-- (enqueue_push_notification, consume_push_queue) are pinned by
-- 29-lint-hardening.sql under the appropriate role context.
-- ============================================================
ALTER FUNCTION public.update_push_subscriptions_updated_at() SET search_path = public;
ALTER FUNCTION public.ack_push_message(p_msg_id bigint) SET search_path = public;
ALTER FUNCTION public.register_push_subscription(p_device_id text, p_device_name text, p_platform text, p_push_credentials jsonb) SET search_path = public;
ALTER FUNCTION public.unregister_push_subscription(p_device_id text) SET search_path = public;
ALTER FUNCTION public.get_push_queue_stats() SET search_path = public;
ALTER FUNCTION public.admin_get_user_notification_subs() SET search_path = public;
ALTER FUNCTION public.admin_get_recent_push_activity(p_limit integer) SET search_path = public;
ALTER FUNCTION public.admin_get_failed_push_subs(p_limit integer) SET search_path = public;

-- Trigger functions run as postgres (DEFINER) so internal side effects
-- (counters, previews, notifications) bypass RLS on side-effect tables.
-- search_path is already pinned above; flipping security mode is safe.
ALTER FUNCTION public.update_push_subscriptions_updated_at() SECURITY DEFINER;


-- ============================================================================
-- File: 07-5-email-notifications-pgmq.sql
-- ============================================================================

-- =============================================================================
-- Email Notifications Schema (pgmq Architecture)
-- =============================================================================
--
-- ARCHITECTURE:
--   Notification Insert → email_queue table → pgmq queue → Backend Consumer → SMTP
--
-- WHY pgmq INSTEAD OF pg_net?
--   ✅ Never lose messages (queue persists even if backend is down)
--   ✅ No exposed HTTP endpoint (security improvement)
--   ✅ Auto-retry built into queue semantics
--   ✅ Same pattern as push notifications (consistency)
--   ✅ $0 cost at any scale
--
-- REQUIRES:
--   - 14-realtime-replica.sql (pgmq extension)
--
-- @see docs/NOTIFICATION_ARCHITECTURE_COMPARISON.md
-- =============================================================================


-- =============================================================================
-- 1. Email Queue Table (source of truth for scheduled emails)
-- =============================================================================

create table if not exists public.email_queue (
    id uuid default gen_random_uuid() primary key,
    notification_id uuid references public.notifications(id) on delete cascade,
    user_id uuid not null references public.users(id) on delete cascade,
    email_type text not null check (email_type in ('immediate', 'digest', 'fallback')),
    status text not null default 'pending' check (status in ('pending', 'processing', 'sent', 'failed', 'skipped')),
    scheduled_for timestamptz not null default now(),
    attempts int default 0 not null,
    sent_at timestamptz,
    error_message text,
    created_at timestamptz default now() not null
);

create index if not exists idx_email_queue_pending
    on public.email_queue(scheduled_for)
    where status = 'pending';

create index if not exists idx_email_queue_user
    on public.email_queue(user_id, status);

alter table public.email_queue enable row level security;

drop policy if exists "Users can view own email queue" on public.email_queue;
create policy "Users can view own email queue" on public.email_queue
    for select using (auth.uid() = user_id);

comment on table public.email_queue is 'Queue for email notifications with scheduling support';


-- =============================================================================
-- 1b. Email Bounces Table (deliverability tracking)
-- =============================================================================
-- Tracks hard/soft bounces and complaints from email providers.
-- Hard bounces auto-suppress future sends to that address.

create table if not exists public.email_bounces (
    id uuid default gen_random_uuid() primary key,
    email text not null,
    bounce_type text not null check (bounce_type in ('hard', 'soft', 'complaint')),
    provider text,
    reason text,
    created_at timestamptz default now() not null
);

create index if not exists idx_email_bounces_email
    on public.email_bounces(email, bounce_type)
    where bounce_type = 'hard';

alter table public.email_bounces enable row level security;

comment on table public.email_bounces is 'Tracks email bounces and complaints for deliverability management';


-- =============================================================================
-- 2. Create pgmq Queue for Email
-- =============================================================================

select pgmq.create_non_partitioned('email_notifications_queue');

comment on table pgmq.q_email_notifications_queue is
'pgmq queue for email notification delivery. Consumed by hocuspocus-worker.';


-- =============================================================================
-- 3. Helper Functions
-- =============================================================================

create or replace function internal.is_email_enabled(p_user_id uuid)
returns boolean
language sql
stable
set search_path = public
as $$
    select coalesce(
        (profile_data->'notification_preferences'->>'email_enabled')::boolean,
        false
    )
    from public.users
    where id = p_user_id;
$$;

create or replace function internal.get_email_preferences(p_user_id uuid)
returns jsonb
language sql
stable
set search_path = public
as $$
    select coalesce(
        profile_data->'notification_preferences',
        '{}'::jsonb
    )
    from public.users
    where id = p_user_id;
$$;


-- Check if an email address is suppressed due to hard bounces (last 90 days)
create or replace function internal.is_email_suppressed(p_email text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
    select exists(
        select 1 from public.email_bounces
        where email = lower(p_email)
          and bounce_type = 'hard'
          and created_at > now() - interval '90 days'
    );
$$;


-- Per-user daily email rate limit check
create or replace function internal.check_email_rate_limit(
    p_user_id uuid,
    p_max_per_day int default 50
)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
    select coalesce(
        (select count(*) < p_max_per_day
         from public.email_queue
         where user_id = p_user_id
           and status = 'sent'
           and sent_at > now() - interval '24 hours'),
        true
    );
$$;


-- Mask an email address for display: john.doe@example.com → j***@example.com
create or replace function internal.mask_email(p_email text)
returns text
language sql
immutable
as $$
    select
        case
            when p_email is null or p_email = '' then ''
            when position('@' in p_email) = 0 then '***'
            else left(split_part(p_email, '@', 1), 1) || '***@' || split_part(p_email, '@', 2)
        end;
$$;

comment on function internal.mask_email(text) is
'Masks an email address for display, showing only first char and domain.';


-- Clear bounce info from a user's notification preferences
create or replace function internal.clear_email_bounce_info(p_user_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
    update public.users
    set profile_data = jsonb_set(
        coalesce(profile_data, '{}'::jsonb),
        '{notification_preferences}',
        (coalesce(profile_data->'notification_preferences', '{}'::jsonb) - 'email_bounce_info')
    )
    where id = p_user_id
      and profile_data->'notification_preferences' ? 'email_bounce_info';
end;
$$;

comment on function internal.clear_email_bounce_info(uuid) is
'Removes email_bounce_info from user notification preferences after re-enable or email update.';


-- Record a bounce event and auto-suppress on hard bounce
create or replace function public.record_email_bounce(
    p_email text,
    p_bounce_type text,
    p_provider text default null,
    p_reason text default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
    v_id uuid;
    v_user_id uuid;
    v_masked_email text;
begin
    if p_bounce_type not in ('hard', 'soft', 'complaint') then
        raise exception 'Invalid bounce_type: %. Must be hard, soft, or complaint.', p_bounce_type;
    end if;

    insert into public.email_bounces (email, bounce_type, provider, reason)
    values (lower(p_email), p_bounce_type, p_provider, p_reason)
    returning id into v_id;

    -- Auto-disable email notifications and notify user on hard bounce / complaint
    if p_bounce_type in ('hard', 'complaint') then
        -- Find the user
        select id into v_user_id
        from public.users
        where lower(email) = lower(p_email);

        if v_user_id is not null then
            v_masked_email := internal.mask_email(p_email);

            -- Disable email + store bounce info in preferences
            update public.users
            set profile_data = jsonb_set(
                jsonb_set(
                    coalesce(profile_data, '{}'::jsonb),
                    '{notification_preferences,email_enabled}',
                    'false'::jsonb
                ),
                '{notification_preferences,email_bounce_info}',
                jsonb_build_object(
                    'email', v_masked_email,
                    'reason', coalesce(p_reason, 'Email delivery failed'),
                    'bounced_at', now()::text
                )
            )
            where id = v_user_id;

            -- Insert system_alert notification so user sees it in-app
            insert into public.notifications (
                receiver_user_id,
                sender_user_id,
                type,
                message_preview,
                action_url,
                created_at
            ) values (
                v_user_id,
                null,
                'system_alert',
                'Email delivery to ' || v_masked_email || ' failed. Your email notifications have been paused. Tap to review.',
                '/settings/notifications',
                now()
            );
        end if;
    end if;

    return v_id;
end;
$$;

comment on function public.record_email_bounce(text, text, text, text) is
'Records an email bounce/complaint. Hard bounces auto-disable email, store bounce info, and notify user.';


-- =============================================================================
-- 4. Queue Email on Notification Insert
-- =============================================================================

create or replace function public.queue_email_notification()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
    prefs jsonb;
    email_frequency text;
    should_queue boolean := false;
    queue_type text;
    schedule_time timestamptz;
    user_tz text;
begin
    if tg_op != 'INSERT' then
        return new;
    end if;

    prefs := internal.get_email_preferences(new.receiver_user_id);

    if not coalesce((prefs->>'email_enabled')::boolean, false) then
        return new;
    end if;

    case new.type::text
        when 'mention' then
            should_queue := coalesce((prefs->>'email_mentions')::boolean, true);
        when 'reply' then
            should_queue := coalesce((prefs->>'email_replies')::boolean, true);
        when 'reaction' then
            should_queue := coalesce((prefs->>'email_reactions')::boolean, false);
        else
            should_queue := true;
    end case;

    if not should_queue then
        return new;
    end if;

    email_frequency := coalesce(prefs->>'email_frequency', 'daily');
    user_tz := coalesce(prefs->>'timezone', 'UTC');

    case email_frequency
        when 'immediate' then
            queue_type := 'immediate';
            schedule_time := now() + interval '15 minutes';
        when 'daily' then
            queue_type := 'digest';
            begin
                schedule_time := (
                    date_trunc('day', now() at time zone user_tz) + interval '1 day' + interval '9 hours'
                ) at time zone user_tz;
            exception when others then
                schedule_time := date_trunc('day', now()) + interval '1 day' + interval '9 hours';
            end;
        when 'weekly' then
            queue_type := 'digest';
            begin
                schedule_time := (
                    date_trunc('week', now() at time zone user_tz) + interval '1 week' + interval '9 hours'
                ) at time zone user_tz;
            exception when others then
                schedule_time := date_trunc('week', now()) + interval '1 week' + interval '9 hours';
            end;
        else
            return new;
    end case;

    -- Check quiet hours for immediate emails
    if queue_type = 'immediate' and coalesce((prefs->>'quiet_hours_enabled')::boolean, false) then
        declare
            now_time time;
            quiet_start time;
            quiet_end time;
        begin
            now_time := (now() at time zone user_tz)::time;
            quiet_start := (prefs->>'quiet_hours_start')::time;
            quiet_end := (prefs->>'quiet_hours_end')::time;

            if quiet_start > quiet_end then
                if now_time >= quiet_start or now_time <= quiet_end then
                    return new;
                end if;
            else
                if now_time >= quiet_start and now_time <= quiet_end then
                    return new;
                end if;
            end if;
        exception when others then
            null;
        end;
    end if;

    insert into public.email_queue (
        notification_id,
        user_id,
        email_type,
        scheduled_for
    ) values (
        new.id,
        new.receiver_user_id,
        queue_type,
        schedule_time
    );

    return new;
end;
$$;

drop trigger if exists trigger_queue_email_notification on public.notifications;
create trigger trigger_queue_email_notification
    after insert on public.notifications
    for each row execute function public.queue_email_notification();


-- =============================================================================
-- 5. Process Email Queue → Enqueue to pgmq (pg_cron)
-- =============================================================================
-- This function moves due emails from email_queue to pgmq for backend processing

create or replace function public.process_email_queue()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
    pending_email record;
    enqueued int := 0;
    skipped int := 0;
    doc_slug text;
begin
    for pending_email in
        select
            eq.id as queue_id,
            eq.notification_id,
            eq.user_id,
            eq.email_type,
            n.type as notification_type,
            n.message_preview,
            n.channel_id,
            n.sender_user_id,
            n.readed_at,
            u.email as recipient_email,
            u.id as recipient_id,
            u.display_name as recipient_name,
            s.display_name as sender_name,
            s.id as sender_id,
            s.avatar_url as sender_avatar_url
        from public.email_queue eq
        join public.notifications n on n.id = eq.notification_id
        join public.users u on u.id = eq.user_id
        left join public.users s on s.id = n.sender_user_id
        where eq.status = 'pending'
          and eq.email_type = 'immediate'
          and eq.scheduled_for <= now()
          and eq.attempts < 3
        order by eq.scheduled_for
        limit 100
        for update of eq skip locked
    loop
        -- Skip if already read
        if pending_email.readed_at is not null then
            update public.email_queue
            set status = 'skipped',
                error_message = 'Notification already read'
            where id = pending_email.queue_id;
            skipped := skipped + 1;
            continue;
        end if;

        -- Skip if email address is suppressed (hard bounced)
        if internal.is_email_suppressed(pending_email.recipient_email) then
            update public.email_queue
            set status = 'skipped',
                error_message = 'Email address suppressed (hard bounce)'
            where id = pending_email.queue_id;
            skipped := skipped + 1;
            continue;
        end if;

        -- Skip if user exceeded daily rate limit
        if not internal.check_email_rate_limit(pending_email.user_id) then
            update public.email_queue
            set status = 'skipped',
                error_message = 'Daily email rate limit exceeded'
            where id = pending_email.queue_id;
            skipped := skipped + 1;
            continue;
        end if;

        -- Get document slug
        doc_slug := null;
        if pending_email.channel_id is not null then
            begin
                select slug into doc_slug
                from public.channels
                where id = pending_email.channel_id
                limit 1;
            exception when others then
                null;
            end;
        end if;

        -- Mark as processing
        update public.email_queue
        set status = 'processing',
            attempts = attempts + 1
        where id = pending_email.queue_id;

        -- Enqueue to pgmq for backend consumption
        perform pgmq.send(
            'email_notifications_queue',
            jsonb_build_object(
                'queue_id', pending_email.queue_id::text,
                'to', pending_email.recipient_email,
                'recipient_name', coalesce(pending_email.recipient_name, ''),
                'recipient_id', pending_email.recipient_id::text,
                'sender_name', coalesce(pending_email.sender_name, 'Someone'),
                'sender_id', pending_email.sender_id::text,
                'sender_avatar_url', pending_email.sender_avatar_url,
                'notification_type', pending_email.notification_type,
                'message_preview', coalesce(pending_email.message_preview, ''),
                'channel_id', pending_email.channel_id,
                'document_slug', doc_slug,
                'enqueued_at', now()::text
            )
        );

        enqueued := enqueued + 1;
    end loop;

    return jsonb_build_object(
        'enqueued', enqueued,
        'skipped', skipped,
        'timestamp', now()
    );
end;
$$;

comment on function public.process_email_queue() is
'Moves due immediate emails from email_queue to pgmq for backend consumption. Run via pg_cron.';


-- =============================================================================
-- 5b. Compile Digest Emails → Enqueue to pgmq (pg_cron)
-- =============================================================================
-- Groups pending digest items per user into a single pgmq message.
-- Backend consumer transforms the flat list into Document→Channel→Notification hierarchy.

create or replace function public.compile_digest_emails()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
    v_user record;
    v_compiled int := 0;
    v_skipped int := 0;
    v_app_url text;
    v_notifications jsonb;
    v_queue_ids uuid[];
begin
    v_app_url := coalesce(current_setting('app.base_url', true), 'https://docs.plus');

    -- Pre-pass: mark digest items with already-read notifications as skipped
    update public.email_queue eq
    set status = 'skipped',
        error_message = 'Notification already read'
    from public.notifications n
    where eq.notification_id = n.id
      and eq.status = 'pending'
      and eq.email_type = 'digest'
      and eq.scheduled_for <= now()
      and n.readed_at is not null;

    -- Process each user with pending digest entries
    for v_user in
        select distinct
            eq.user_id,
            u.email as recipient_email,
            u.display_name as recipient_name,
            coalesce(
                u.profile_data->'notification_preferences'->>'email_frequency',
                'daily'
            ) as frequency
        from public.email_queue eq
        join public.users u on u.id = eq.user_id
        where eq.status = 'pending'
          and eq.email_type = 'digest'
          and eq.scheduled_for <= now()
          and eq.attempts < 3
    loop
        -- Skip if user disabled email
        if not internal.is_email_enabled(v_user.user_id) then
            update public.email_queue
            set status = 'skipped',
                error_message = 'Email disabled by user'
            where user_id = v_user.user_id
              and status = 'pending'
              and email_type = 'digest'
              and scheduled_for <= now();
            v_skipped := v_skipped + 1;
            continue;
        end if;

        -- Skip if email suppressed (hard bounced)
        if internal.is_email_suppressed(v_user.recipient_email) then
            update public.email_queue
            set status = 'skipped',
                error_message = 'Email address suppressed (hard bounce)'
            where user_id = v_user.user_id
              and status = 'pending'
              and email_type = 'digest'
              and scheduled_for <= now();
            v_skipped := v_skipped + 1;
            continue;
        end if;

        -- Lock and collect queue item IDs
        select array_agg(id)
        into v_queue_ids
        from (
            select eq.id
            from public.email_queue eq
            where eq.user_id = v_user.user_id
              and eq.status = 'pending'
              and eq.email_type = 'digest'
              and eq.scheduled_for <= now()
              and eq.attempts < 3
            for update of eq skip locked
        ) locked_items;

        if v_queue_ids is null or array_length(v_queue_ids, 1) = 0 then
            continue;
        end if;

        -- Collect notification data for locked items (only unread)
        select jsonb_agg(
            jsonb_build_object(
                'notification_type', n.type,
                'sender_name', coalesce(s.display_name, 'Someone'),
                'sender_avatar_url', s.avatar_url,
                'message_preview', coalesce(n.message_preview, ''),
                'channel_id', n.channel_id,
                'channel_name', coalesce(c.name, 'General'),
                'workspace_id', c.workspace_id,
                'workspace_name', coalesce(w.name, c.slug),
                'workspace_slug', coalesce(w.slug, c.slug),
                'created_at', n.created_at
            )
            order by n.created_at
        )
        into v_notifications
        from public.email_queue eq
        join public.notifications n on n.id = eq.notification_id
        left join public.users s on s.id = n.sender_user_id
        left join public.channels c on c.id = n.channel_id
        left join public.workspaces w on w.id = c.workspace_id
        where eq.id = any(v_queue_ids);

        -- Skip if nothing to compile
        if v_notifications is null or jsonb_array_length(v_notifications) = 0 then
            v_skipped := v_skipped + 1;
            continue;
        end if;

        -- Mark all items as processing
        update public.email_queue
        set status = 'processing',
            attempts = attempts + 1
        where id = any(v_queue_ids);

        -- Send compiled digest to pgmq as a single message
        perform pgmq.send(
            'email_notifications_queue',
            jsonb_build_object(
                'type', 'digest',
                'recipient_email', v_user.recipient_email,
                'recipient_name', coalesce(v_user.recipient_name, ''),
                'recipient_id', v_user.user_id::text,
                'frequency', v_user.frequency,
                'queue_ids', to_jsonb(v_queue_ids),
                'notifications', v_notifications,
                'enqueued_at', now()::text
            )
        );

        v_compiled := v_compiled + 1;
    end loop;

    return jsonb_build_object(
        'compiled', v_compiled,
        'skipped', v_skipped,
        'timestamp', now()
    );
end;
$$;

comment on function public.compile_digest_emails() is
'Compiles pending digest notifications per user into a single pgmq message. Run via pg_cron.';


-- =============================================================================
-- 6. Consumer Helper: Read Email Queue
-- =============================================================================

create or replace function public.consume_email_queue(
    p_batch_size int default 50,
    p_visibility_timeout int default 60
)
returns table (
    msg_id bigint,
    payload jsonb,
    enqueued_at timestamptz
)
language plpgsql
security definer
set search_path = public
as $$
begin
    return query
    select
        m.msg_id,
        m.message as payload,
        m.enqueued_at
    from pgmq.read('email_notifications_queue', p_visibility_timeout, p_batch_size) m;
end;
$$;

comment on function public.consume_email_queue(int, int) is
'Reads email messages from pgmq queue. Called by backend consumer.';


-- =============================================================================
-- 7. Consumer Helper: Acknowledge Message
-- =============================================================================

create or replace function public.ack_email_message(p_msg_id bigint)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
begin
    return pgmq.delete('email_notifications_queue', p_msg_id);
end;
$$;

comment on function public.ack_email_message(bigint) is
'Acknowledges (deletes) a processed email message from pgmq.';


-- =============================================================================
-- 8. Update Email Queue Status (called by backend after sending)
-- =============================================================================

create or replace function public.update_email_status(
    p_queue_id uuid,
    p_status text,
    p_error_message text default null
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
begin
    update public.email_queue
    set status = p_status,
        sent_at = case when p_status = 'sent' then now() else sent_at end,
        error_message = p_error_message
    where id = p_queue_id;

    return found;
end;
$$;

comment on function public.update_email_status(uuid, text, text) is
'Updates email queue status after processing. Called by backend.';


-- =============================================================================
-- 9. Schedule Email Queue Processing (pg_cron)
-- =============================================================================

do $$
begin
    perform cron.unschedule('process_email_queue')
    where exists (select 1 from cron.job where jobname = 'process_email_queue');

    perform cron.schedule(
        'process_email_queue',
        '*/2 * * * *',  -- Every 2 minutes (immediate emails only)
        'select public.process_email_queue();'
    );
exception when others then
    raise notice 'pg_cron not available, skipping email queue scheduling';
end;
$$;

-- Schedule digest compilation (every 15 minutes)
do $$
begin
    perform cron.unschedule('compile_digest_emails')
    where exists (select 1 from cron.job where jobname = 'compile_digest_emails');

    perform cron.schedule(
        'compile_digest_emails',
        '*/15 * * * *',  -- Every 15 minutes (catches different timezone 9am slots)
        'select public.compile_digest_emails();'
    );
exception when others then
    raise notice 'pg_cron not available, skipping digest compilation scheduling';
end;
$$;


-- =============================================================================
-- 10. Cleanup Functions
-- =============================================================================

create or replace function public.cleanup_email_queue()
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
    delete from public.email_queue
    where created_at < now() - interval '30 days'
      and status in ('sent', 'skipped');

    update public.email_queue
    set status = 'failed',
        error_message = coalesce(error_message, '') || ' (max attempts reached)'
    where attempts >= 3
      and status = 'processing';
end;
$$;

do $$
begin
    perform cron.unschedule('cleanup_email_queue')
    where exists (select 1 from cron.job where jobname = 'cleanup_email_queue');

    perform cron.schedule(
        'cleanup_email_queue',
        '0 3 * * *',
        'select public.cleanup_email_queue();'
    );
exception when others then
    raise notice 'pg_cron not available, skipping email cleanup scheduling';
end;
$$;


-- =============================================================================
-- 11. Stats Function
-- =============================================================================

create or replace function public.get_email_notification_stats()
returns jsonb
language plpgsql
security definer
stable
set search_path = public
as $$
declare
    queue_depth bigint;
begin
    -- Get pgmq queue depth
    select count(*) into queue_depth
    from pgmq.q_email_notifications_queue;

    return jsonb_build_object(
        'architecture', 'pgmq_consumer',
        'queue', jsonb_build_object(
            'name', 'email_notifications_queue',
            'depth', queue_depth
        ),
        'email_queue', jsonb_build_object(
            'total', (select count(*) from public.email_queue),
            'pending', (select count(*) from public.email_queue where status = 'pending'),
            'processing', (select count(*) from public.email_queue where status = 'processing'),
            'sent', (select count(*) from public.email_queue where status = 'sent'),
            'skipped', (select count(*) from public.email_queue where status = 'skipped'),
            'failed', (select count(*) from public.email_queue where status = 'failed')
        ),
        'users_with_email_enabled', (
            select count(*)
            from public.users
            where (profile_data->'notification_preferences'->>'email_enabled')::boolean = true
        )
    );
end;
$$;


-- =============================================================================
-- 12. Unsubscribe Functions (unchanged from v1)
-- =============================================================================

-- Returns the HMAC secret used to sign unsubscribe tokens. Hard-fails when
-- unset rather than falling back to a derived-from-service-key default —
-- a missing GUC in prod must surface, not silently mint forgeable tokens.
create or replace function internal.get_unsubscribe_secret()
returns text
language plpgsql
stable
security definer
set search_path = public
as $$
declare
    v_secret text;
begin
    v_secret := current_setting('app.unsubscribe_secret', true);
    if v_secret is null or v_secret = '' then
        raise exception 'app.unsubscribe_secret is not configured';
    end if;
    return v_secret;
end;
$$;

create or replace function public.generate_unsubscribe_token(
    p_user_id uuid,
    p_action text
)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
    secret text;
    payload jsonb;
    payload_b64 text;
    signature text;
begin
    if p_action not in ('mentions', 'replies', 'reactions', 'digest', 'all') then
        raise exception 'Invalid unsubscribe action: %', p_action;
    end if;

    secret := internal.get_unsubscribe_secret();
    if secret is null or secret = '' then
        raise exception 'Unsubscribe secret not configured';
    end if;

    payload := jsonb_build_object(
        'uid', p_user_id,
        'act', p_action,
        'exp', extract(epoch from (now() + interval '90 days'))::bigint,
        'iat', extract(epoch from now())::bigint
    );

    payload_b64 := encode(convert_to(payload::text, 'UTF8'), 'base64');
    payload_b64 := replace(replace(replace(payload_b64, '=', ''), '+', '-'), '/', '_');

    signature := encode(hmac(payload_b64::bytea, secret::bytea, 'sha256'), 'base64');
    signature := replace(replace(replace(signature, '=', ''), '+', '-'), '/', '_');

    return payload_b64 || '.' || signature;
end;
$$;

create or replace function internal.verify_unsubscribe_token(p_token text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
    secret text;
    parts text[];
    payload_b64 text;
    provided_sig text;
    expected_sig text;
    payload_json text;
    payload jsonb;
    expiry bigint;
begin
    parts := string_to_array(p_token, '.');
    if array_length(parts, 1) != 2 then
        return null;
    end if;

    payload_b64 := parts[1];
    provided_sig := parts[2];

    secret := internal.get_unsubscribe_secret();
    if secret is null or secret = '' then
        return null;
    end if;

    expected_sig := encode(hmac(payload_b64::bytea, secret::bytea, 'sha256'), 'base64');
    expected_sig := replace(replace(replace(expected_sig, '=', ''), '+', '-'), '/', '_');

    if expected_sig != provided_sig then
        return null;
    end if;

    payload_b64 := replace(replace(payload_b64, '-', '+'), '_', '/');
    case length(payload_b64) % 4
        when 2 then payload_b64 := payload_b64 || '==';
        when 3 then payload_b64 := payload_b64 || '=';
        else null;
    end case;

    begin
        payload_json := convert_from(decode(payload_b64, 'base64'), 'UTF8');
        payload := payload_json::jsonb;
    exception when others then
        return null;
    end;

    expiry := (payload->>'exp')::bigint;
    if expiry < extract(epoch from now()) then
        return null;
    end if;

    return payload;
end;
$$;

create or replace function public.process_unsubscribe(p_token text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
    payload jsonb;
    v_user_id uuid;
    v_action text;
    v_user_email text;
    prefs jsonb;
    new_prefs jsonb;
    action_description text;
begin
    payload := internal.verify_unsubscribe_token(p_token);
    if payload is null then
        return jsonb_build_object(
            'success', false,
            'error', 'invalid_token',
            'message', 'This unsubscribe link is invalid or has expired.'
        );
    end if;

    v_user_id := (payload->>'uid')::uuid;
    v_action := payload->>'act';

    select email, coalesce(profile_data->'notification_preferences', '{}'::jsonb)
    into v_user_email, prefs
    from public.users
    where id = v_user_id;

    if v_user_email is null then
        return jsonb_build_object(
            'success', false,
            'error', 'user_not_found',
            'message', 'User account not found.'
        );
    end if;

    case v_action
        when 'mentions' then
            new_prefs := jsonb_set(prefs, '{email_mentions}', 'false'::jsonb);
            action_description := 'mention emails';
        when 'replies' then
            new_prefs := jsonb_set(prefs, '{email_replies}', 'false'::jsonb);
            action_description := 'reply emails';
        when 'reactions' then
            new_prefs := jsonb_set(prefs, '{email_reactions}', 'false'::jsonb);
            action_description := 'reaction emails';
        when 'digest' then
            new_prefs := jsonb_set(prefs, '{email_frequency}', '"never"'::jsonb);
            action_description := 'digest emails';
        when 'all' then
            new_prefs := jsonb_set(prefs, '{email_enabled}', 'false'::jsonb);
            action_description := 'all email notifications';
        else
            return jsonb_build_object(
                'success', false,
                'error', 'invalid_action',
                'message', 'Invalid unsubscribe action.'
            );
    end case;

    update public.users
    set profile_data = jsonb_set(
        coalesce(profile_data, '{}'::jsonb),
        '{notification_preferences}',
        new_prefs
    )
    where id = v_user_id;

    return jsonb_build_object(
        'success', true,
        'action', v_action,
        'action_description', action_description,
        'email', v_user_email,
        'message', 'You have been unsubscribed from ' || action_description || '.',
        'user_id', v_user_id
    );
end;
$$;

create or replace function public.get_unsubscribe_url(
    p_user_id uuid,
    p_action text,
    p_base_url text default null
)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
    token text;
    base_url text;
begin
    token := public.generate_unsubscribe_token(p_user_id, p_action);
    base_url := coalesce(
        p_base_url,
        current_setting('app.base_url', true),
        'https://docs.plus'
    );
    return base_url || '/unsubscribe?token=' || token;
end;
$$;

create or replace function public.get_email_footer_links(
    p_user_id uuid,
    p_base_url text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
    base_url text;
begin
    base_url := coalesce(
        p_base_url,
        current_setting('app.base_url', true),
        'https://docs.plus'
    );

    return jsonb_build_object(
        'unsubscribe_mentions', public.get_unsubscribe_url(p_user_id, 'mentions', base_url),
        'unsubscribe_replies', public.get_unsubscribe_url(p_user_id, 'replies', base_url),
        'unsubscribe_reactions', public.get_unsubscribe_url(p_user_id, 'reactions', base_url),
        'unsubscribe_digest', public.get_unsubscribe_url(p_user_id, 'digest', base_url),
        'unsubscribe_all', public.get_unsubscribe_url(p_user_id, 'all', base_url),
        'preferences', base_url || '/settings/notifications'
    );
end;
$$;


-- =============================================================================
-- 13. Drop Deprecated Functions
-- =============================================================================

drop function if exists internal.get_email_gateway_config() cascade;
drop function if exists internal.http_post_signed(text, jsonb, jsonb, text) cascade;


-- =============================================================================
-- 14. Security: lock email/queue/admin functions to service_role
-- =============================================================================
-- This file shipped with no explicit GRANT/REVOKE lines, which means every
-- SECURITY DEFINER function below is callable by `public` (Postgres default).
-- That includes the bounce-recording RPC, the queue consumer/ack RPCs, the
-- digest compiler, the admin stats RPC, and helper functions that compose
-- unsubscribe links. Lock them all to service_role; the Hocuspocus worker
-- and admin controller invoke them with the service_role key.
--
-- Note: `process_unsubscribe(text)` is also locked to service_role here.
-- The user-facing /unsubscribe URL handler in the webapp must call it via
-- the service-role key (server-side route), NOT via the browser session.
-- This is the safer default; relax only if a real browser-direct call site
-- emerges with a documented threat model.

-- Bounce ingestion (called by email worker)
revoke execute on function public.record_email_bounce(text, text, text, text) from public, anon, authenticated;
grant  execute on function public.record_email_bounce(text, text, text, text) to service_role;

-- pgmq queue producer (cron)
revoke execute on function public.process_email_queue() from public, anon, authenticated;
grant  execute on function public.process_email_queue() to service_role;

-- Digest compiler (cron)
revoke execute on function public.compile_digest_emails() from public, anon, authenticated;
grant  execute on function public.compile_digest_emails() to service_role;

-- Queue consumer + ack (worker)
revoke execute on function public.consume_email_queue(integer, integer) from public, anon, authenticated;
grant  execute on function public.consume_email_queue(integer, integer) to service_role;

revoke execute on function public.ack_email_message(bigint) from public, anon, authenticated;
grant  execute on function public.ack_email_message(bigint) to service_role;

-- Worker callbacks (status writeback)
revoke execute on function public.update_email_status(uuid, text, text) from public, anon, authenticated;
grant  execute on function public.update_email_status(uuid, text, text) to service_role;

-- Cleanup (cron)
revoke execute on function public.cleanup_email_queue() from public, anon, authenticated;
grant  execute on function public.cleanup_email_queue() to service_role;

-- Admin stats
revoke execute on function public.get_email_notification_stats() from public, anon, authenticated;
grant  execute on function public.get_email_notification_stats() to service_role;

-- Unsubscribe link helpers (server-side composition; HMAC over secret).
-- generate_/get_*_url are called from email composer; process_unsubscribe
-- is called from the /unsubscribe API route with service_role.
revoke execute on function public.generate_unsubscribe_token(uuid, text) from public, anon, authenticated;
grant  execute on function public.generate_unsubscribe_token(uuid, text) to service_role;

revoke execute on function public.process_unsubscribe(text) from public, anon, authenticated;
grant  execute on function public.process_unsubscribe(text) to service_role;

revoke execute on function public.get_unsubscribe_url(uuid, text, text) from public, anon, authenticated;
grant  execute on function public.get_unsubscribe_url(uuid, text, text) to service_role;

revoke execute on function public.get_email_footer_links(uuid, text) from public, anon, authenticated;
grant  execute on function public.get_email_footer_links(uuid, text) to service_role;


-- ============================================================
-- Hardening: pin search_path = public on functions defined above
-- (idempotent — safe to re-run). supabase_admin-owned functions
-- (mask_email, is_email_suppressed, check_email_rate_limit,
-- clear_email_bounce_info, ack_email_message, compile_digest_emails,
-- consume_email_queue, record_email_bounce) are pinned by
-- 29-lint-hardening.sql under the appropriate role context.
-- ============================================================
ALTER FUNCTION internal.is_email_enabled(p_user_id uuid) SET search_path = public;
ALTER FUNCTION internal.get_email_preferences(p_user_id uuid) SET search_path = public;
ALTER FUNCTION internal.get_unsubscribe_secret() SET search_path = public;
ALTER FUNCTION internal.verify_unsubscribe_token(p_token text) SET search_path = public;
ALTER FUNCTION public.queue_email_notification() SET search_path = public;
ALTER FUNCTION public.process_email_queue() SET search_path = public;
ALTER FUNCTION public.cleanup_email_queue() SET search_path = public;
ALTER FUNCTION public.get_email_notification_stats() SET search_path = public;
ALTER FUNCTION public.generate_unsubscribe_token(p_user_id uuid, p_action text) SET search_path = public;
ALTER FUNCTION public.process_unsubscribe(p_token text) SET search_path = public;
ALTER FUNCTION public.get_unsubscribe_url(p_user_id uuid, p_action text, p_base_url text) SET search_path = public;
ALTER FUNCTION public.get_email_footer_links(p_user_id uuid, p_base_url text) SET search_path = public;


-- ============================================================================
-- File: 07-bookmark-functions.sql
-- ============================================================================

-- Function: toggle_message_bookmark
-- Description: Toggles a bookmark for a message. If bookmark exists, removes it. If not, creates it.
create or replace function public.toggle_message_bookmark(
    p_message_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
    v_user_id uuid;
    v_bookmark_id bigint;
    v_action text;
begin
    -- Get the current user ID
    v_user_id := auth.uid();

    if v_user_id is null then
        raise exception 'User not authenticated';
    end if;

    -- Check if bookmark already exists
    select id into v_bookmark_id
    from message_bookmarks
    where user_id = v_user_id and message_id = p_message_id;

    if v_bookmark_id is not null then
        -- Unbookmark path: do NOT gate on visibility. Users must be able
        -- to clean up bookmarks pointing at messages that have since been
        -- soft-deleted or whose channel they've left.
        delete from message_bookmarks
        where id = v_bookmark_id;
        v_action := 'removed';
    else
        -- Bookmark path: gate on visibility (PUBLIC channel or active
        -- member, message not soft-deleted). Closes the message-id
        -- existence probe via FK-error-vs-success.
        if not exists (
            select 1
            from public.messages m
            join public.channels c on c.id = m.channel_id
            where m.id = p_message_id
              and m.deleted_at is null
              and (
                  c.type = 'PUBLIC'
                  or exists (
                      select 1
                      from public.channel_members cm
                      where cm.channel_id = m.channel_id
                        and cm.member_id  = v_user_id
                        and cm.left_at is null
                  )
              )
        ) then
            raise exception 'Access denied: message % is not visible to this user.', p_message_id;
        end if;

        insert into message_bookmarks (user_id, message_id)
        values (v_user_id, p_message_id)
        returning id into v_bookmark_id;
        v_action := 'added';
    end if;

    return jsonb_build_object(
        'action', v_action,
        'bookmark_id', v_bookmark_id,
        'message_id', p_message_id
    );
end;
$$;

comment on function public.toggle_message_bookmark is 'Toggles a bookmark for a message. Returns the action taken (added/removed) and relevant IDs.';

-- Function: get_user_bookmarks
-- Description: Gets all bookmarked messages for the current user with message details
create or replace function public.get_user_bookmarks(
    p_workspace_id varchar(36) default null,
    p_archived boolean default false,
    p_limit int default 50,
    p_offset int default 0
)
returns table (
    bookmark_id bigint,
    bookmark_created_at timestamptz,
    bookmark_updated_at timestamptz,
    bookmark_archived_at timestamptz,
    bookmark_marked_at timestamptz,
    bookmark_metadata jsonb,
    message_id uuid,
    message_content text,
    message_html text,
    message_created_at timestamptz,
    message_user_id uuid,
    message_channel_id varchar,
    message_type message_type,
    user_details jsonb,
    channel_name text,
    channel_slug text,
    workspace_id varchar,
    workspace_name text,
    workspace_slug text
)
language plpgsql
security definer
set search_path = public
as $$
declare
    v_user_id uuid;
begin
    -- Get the current user ID
    v_user_id := auth.uid();

    if v_user_id is null then
        raise exception 'User not authenticated';
    end if;

    return query
    select
        mb.id as bookmark_id,
        mb.created_at as bookmark_created_at,
        mb.updated_at as bookmark_updated_at,
        mb.archived_at as bookmark_archived_at,
        mb.marked_at as bookmark_marked_at,
        mb.metadata as bookmark_metadata,
        m.id as message_id,
        m.content as message_content,
        m.html as message_html,
        m.created_at as message_created_at,
        m.user_id as message_user_id,
        m.channel_id as message_channel_id,
        m.type as message_type,
        user_details_json(u) as user_details,
        c.name as channel_name,
        c.slug as channel_slug,
        w.id as workspace_id,
        w.name as workspace_name,
        w.slug as workspace_slug
    from message_bookmarks mb
    join messages m on mb.message_id = m.id
    join users u on m.user_id = u.id
    join channels c on m.channel_id = c.id
    join workspaces w on c.workspace_id = w.id
    where mb.user_id = v_user_id
        and m.deleted_at is null
        and c.deleted_at is null
        and w.deleted_at is null
        and (p_workspace_id is null or w.id = p_workspace_id)
        and (
            (p_archived = true and mb.archived_at is not null)
            or (p_archived = false and mb.archived_at is null)
        )
    order by mb.created_at desc
    limit p_limit
    offset p_offset;
end;
$$;

comment on function public.get_user_bookmarks is 'Retrieves bookmarked messages for the current user with full message and channel context. Can filter by workspace and archived status.';

-- Function: archive_bookmark
-- Description: Archives or unarchives a bookmark
create or replace function public.archive_bookmark(
    p_bookmark_id bigint,
    p_archive boolean default true
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
    v_user_id uuid;
    v_updated_count int;
begin
    -- Get the current user ID
    v_user_id := auth.uid();

    if v_user_id is null then
        raise exception 'User not authenticated';
    end if;

    -- Update the bookmark archive status
    update message_bookmarks
    set archived_at = case
        when p_archive then timezone('utc', now())
        else null
    end
    where id = p_bookmark_id
        and user_id = v_user_id;

    get diagnostics v_updated_count = row_count;

    return v_updated_count > 0;
end;
$$;

comment on function public.archive_bookmark is 'Archives or unarchives a bookmark. Returns true if successful, false if bookmark not found or not owned by user.';

-- Function: mark_bookmark_as_read
-- Description: Marks or unmarks a bookmark as read
create or replace function public.mark_bookmark_as_read(
    p_bookmark_id bigint,
    p_mark_as_read boolean default true
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
    v_user_id uuid;
    v_updated_count int;
begin
    -- Get the current user ID
    v_user_id := auth.uid();

    if v_user_id is null then
        raise exception 'User not authenticated';
    end if;

    -- Update the bookmark read status
    update message_bookmarks
    set marked_at = case
        when p_mark_as_read then timezone('utc', now())
        else null
    end
    where id = p_bookmark_id
        and user_id = v_user_id;

    get diagnostics v_updated_count = row_count;

    return v_updated_count > 0;
end;
$$;

comment on function public.mark_bookmark_as_read is 'Marks or unmarks a bookmark as read. Returns true if successful, false if bookmark not found or not owned by user.';

-- Function: get_bookmark_count
-- Description: Gets the total count of bookmarks for the current user
create or replace function public.get_bookmark_count(
    p_workspace_id varchar(36) default null,
    p_archived boolean default false
)
returns int
language plpgsql
security definer
set search_path = public
as $$
declare
    v_user_id uuid;
    v_count int;
begin
    -- Get the current user ID
    v_user_id := auth.uid();

    if v_user_id is null then
        raise exception 'User not authenticated';
    end if;

    select count(*)::int into v_count
    from message_bookmarks mb
    join messages m on mb.message_id = m.id
    join channels c on m.channel_id = c.id
    join workspaces w on c.workspace_id = w.id
    where mb.user_id = v_user_id
        and m.deleted_at is null
        and c.deleted_at is null
        and w.deleted_at is null
        and (p_workspace_id is null or w.id = p_workspace_id)
        and (
            (p_archived = true and mb.archived_at is not null)
            or (p_archived = false and mb.archived_at is null)
        );

    return v_count;
end;
$$;

comment on function public.get_bookmark_count is 'Returns the total number of bookmarks for the current user. Can filter by workspace and archived status.';

-- Function: get_bookmark_stats
-- Description: Gets bookmark statistics for the current user
create or replace function public.get_bookmark_stats(
    p_workspace_id varchar(36) default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
    v_user_id uuid;
    v_total int := 0;
    v_archived int := 0;
    v_unread int := 0;
    v_read int := 0;
begin
    -- Get the current user ID
    v_user_id := auth.uid();

    if v_user_id is null then
        raise exception 'User not authenticated';
    end if;

    -- Get counts
    select
        count(*)::int,
        count(case when mb.archived_at is not null then 1 end)::int,
        count(case when mb.marked_at is null then 1 end)::int,
        count(case when mb.marked_at is not null then 1 end)::int
    into v_total, v_archived, v_unread, v_read
    from message_bookmarks mb
    join messages m on mb.message_id = m.id
    join channels c on m.channel_id = c.id
    join workspaces w on c.workspace_id = w.id
    where mb.user_id = v_user_id
        and m.deleted_at is null
        and c.deleted_at is null
        and w.deleted_at is null
        and (p_workspace_id is null or w.id = p_workspace_id);

    return jsonb_build_object(
        'total', v_total,
        'archived', v_archived,
        'active', v_total - v_archived,
        'unread', v_unread,
        'read', v_read
    );
end;
$$;

comment on function public.get_bookmark_stats is 'Returns bookmark statistics for the current user including total, archived, active, read, and unread counts.';

-- ============================================================
-- Hardening: pin search_path = public on functions defined above
-- (idempotent — safe to re-run)
-- ============================================================
ALTER FUNCTION public.toggle_message_bookmark(p_message_id uuid) SET search_path = public;
ALTER FUNCTION public.get_user_bookmarks(p_workspace_id character varying, p_archived boolean, p_limit integer, p_offset integer) SET search_path = public;
ALTER FUNCTION public.archive_bookmark(p_bookmark_id bigint, p_archive boolean) SET search_path = public;
ALTER FUNCTION public.mark_bookmark_as_read(p_bookmark_id bigint, p_mark_as_read boolean) SET search_path = public;
ALTER FUNCTION public.get_bookmark_count(p_workspace_id character varying, p_archived boolean) SET search_path = public;
ALTER FUNCTION public.get_bookmark_stats(p_workspace_id character varying) SET search_path = public;


-- ============================================================================
-- File: 08-channel_members.sql
-- ============================================================================

-- Table: public.channel_members
-- Description: Manages the membership of users within channels. This table tracks which messages each user has read in a channel,
-- enabling the application to maintain an up-to-date read status. This is crucial for message-based applications where read receipts are important.
create table public.channel_members (
    id                    uuid default uuid_generate_v4() not null primary key, -- Unique ID for the channel member record.
    channel_id            varchar(36) not null references public.channels(id) on delete cascade, -- The ID of the channel. If the channel is deleted, associated member records are also deleted.
    member_id             uuid not null references public.users(id) on delete cascade, -- The ID of the channel member (user). If the user is deleted, their membership records are also deleted.
    last_read_message_id  uuid references public.messages(id) on delete set null, -- The ID of the last message read by the user in the channel. Helps in tracking read status.
    last_read_update_at   timestamp with time zone default timezone('utc', now()), -- Timestamp when the user's last read status was updated.
    joined_at             timestamp with time zone default timezone('utc', now()) not null, -- Timestamp when the user joined the channel.
    left_at               timestamp with time zone, -- Timestamp when the user left the channel.
    mute_in_app_notifications boolean default false, -- Indicates if notifications are muted for the channel.
    notif_state           channel_notification_state default 'MENTIONS'::public.channel_notification_state, -- User's notification preference for this channel
    channel_member_role   channel_member_role default 'MEMBER'::public.channel_member_role, -- The role of the user in the channel (e.g., admin, moderator, member).
    unread_message_count  int default 0, -- The number of unread messages for the user in the channel.
    last_read_seq         bigint not null default 0, -- v2 read cursor; replaces last_read_message_id in deploy 4 cleanup.
    created_at            timestamp with time zone default timezone('utc', now()) not null, -- Timestamp when the membership record was created.
    updated_at            timestamp with time zone default timezone('utc', now()) -- Timestamp when the membership record was last updated.
);

comment on table public.channel_members is 'Tracks user membership in channels, including the status of the last message read by each user in a specific channel. The created_at and updated_at columns help monitor the history and changes in user-channel relationships.';

-- Column comments for better documentation
comment on column public.channel_members.id is 'Unique identifier for this membership record';
comment on column public.channel_members.channel_id is 'Reference to the channel this membership belongs to';
comment on column public.channel_members.member_id is 'Reference to the user who is a member of the channel';
comment on column public.channel_members.last_read_message_id is 'Reference to the last message the user has read in this channel';
comment on column public.channel_members.last_read_update_at is 'Timestamp when the user last updated their read status';
comment on column public.channel_members.joined_at is 'Timestamp when the user joined this channel';
comment on column public.channel_members.left_at is 'Timestamp when the user left this channel, null if still active';
comment on column public.channel_members.mute_in_app_notifications is 'Whether the user has muted notifications for this channel';
comment on column public.channel_members.notif_state is 'User preference for notification delivery (ALL, MENTIONS, MUTED)';
comment on column public.channel_members.channel_member_role is 'Role of the user in this channel (ADMIN, MODERATOR, MEMBER, GUEST)';
comment on column public.channel_members.unread_message_count is 'Counter of unread messages for this user in this channel';
comment on column public.channel_members.created_at is 'Timestamp when this membership record was created';
comment on column public.channel_members.updated_at is 'Timestamp when this membership record was last updated';


-- ============================================================================
-- File: 09-document-views.sql
-- ============================================================================

-- =============================================================================
-- Document View Analytics System (v2 - pgmq + Anonymous Auth)
-- =============================================================================
-- High-performance, queue-based document view tracking with anonymous user support.
--
-- ARCHITECTURE:
--   1. Hocuspocus calls `enqueue_document_view()` → fast pgmq.send()
--   2. pg_cron worker processes queue batch every 10 seconds
--   3. Worker deduplicates and inserts views
--   4. Hocuspocus calls `update_view_duration()` on disconnect
--   5. Aggregation runs every 5 minutes
--
-- USER TRACKING:
--   - Authenticated: Real user_id from Supabase Auth
--   - Anonymous: Temporary user_id from Supabase Anonymous Auth (linkable)
--   - Guest: Session-based only (no user_id)
--
-- WHY pgmq?
--   - Handles 100+ concurrent views on same document without contention
--   - Decouples write path from processing
--   - Batched deduplication is more efficient
--   - Consistent pattern with message_counter
--
-- DEPLOYMENT CHECKLIST:
--   1. Enable Anonymous Auth in Supabase dashboard
--   2. Run this migration
--   3. Restart Hocuspocus server
--   4. Verify pg_cron jobs are scheduled
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. Raw Document Views Table (Partitioned by Month)
-- -----------------------------------------------------------------------------
-- Stores every view event. Partitioned for efficient data management.
-- Old partitions can be dropped without affecting performance.

create table if not exists public.document_views (
    id              uuid not null,  -- Generated upfront for duration updates
    document_slug   text not null,
    user_id         uuid references public.users(id) on delete set null,
    session_id      text not null,
    viewed_at       timestamp with time zone default now() not null,
    view_date       date not null default current_date,  -- For immutable dedup index
    duration_ms     integer default 0,
    is_bounce       boolean default true,  -- True until duration > 3s
    is_anonymous    boolean not null default false,  -- Supabase Anonymous Auth user
    is_authenticated boolean not null default false, -- Logged in with real account
    device_type     text check (device_type in ('desktop', 'mobile', 'tablet')),

    primary key (id, viewed_at)
) partition by range (viewed_at);

comment on table public.document_views is
'Raw document view events. Partitioned by month.
User types:
  - is_authenticated=true: Real logged-in user
  - is_anonymous=true: Supabase Anonymous Auth (can be linked later)
  - Both false: Guest with session_id only';

comment on table public.document_views is
'Raw document view events. Partitioned by month for efficient data lifecycle management.';

-- Create partitions for current and next 3 months
do $$
declare
    start_date date;
    end_date date;
    partition_name text;
begin
    for i in 0..3 loop
        start_date := date_trunc('month', current_date + (i || ' months')::interval);
        end_date := start_date + interval '1 month';
        partition_name := 'document_views_' || to_char(start_date, 'YYYY_MM');

        -- Check if partition exists
        if not exists (
            select 1 from pg_class c
            join pg_namespace n on n.oid = c.relnamespace
            where c.relname = partition_name and n.nspname = 'public'
        ) then
            execute format(
                'create table public.%I partition of public.document_views
                 for values from (%L) to (%L)',
                partition_name, start_date, end_date
            );

            -- Create indexes on partition
            execute format(
                'create index %I on public.%I (document_slug, viewed_at)',
                partition_name || '_slug_idx', partition_name
            );
            -- Unique index for ON CONFLICT dedup (session + document + date)
            execute format(
                'create unique index %I on public.%I (session_id, document_slug, view_date)',
                partition_name || '_dedup_idx', partition_name
            );
        end if;
    end loop;
end;
$$;

-- Function to auto-create future partitions (run monthly via pg_cron)
create or replace function public.create_document_views_partitions()
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
    start_date date;
    end_date date;
    partition_name text;
begin
    -- Create partitions for next 3 months
    for i in 1..3 loop
        start_date := date_trunc('month', current_date + (i || ' months')::interval);
        end_date := start_date + interval '1 month';
        partition_name := 'document_views_' || to_char(start_date, 'YYYY_MM');

        if not exists (
            select 1 from pg_class c
            join pg_namespace n on n.oid = c.relnamespace
            where c.relname = partition_name and n.nspname = 'public'
        ) then
            execute format(
                'create table public.%I partition of public.document_views
                 for values from (%L) to (%L)',
                partition_name, start_date, end_date
            );
            execute format(
                'create index %I on public.%I (document_slug, viewed_at)',
                partition_name || '_slug_idx', partition_name
            );
            -- Unique index for ON CONFLICT dedup
            execute format(
                'create unique index %I on public.%I (session_id, document_slug, view_date)',
                partition_name || '_dedup_idx', partition_name
            );
            -- Enable RLS on each new partition (S3.1). The parent
            -- document_views has RLS on but no policy → default deny;
            -- partitions need RLS enabled individually for the linter
            -- check `rls_disabled_in_public` to stay clean every month.
            execute format(
                'alter table public.%I enable row level security',
                partition_name
            );
        end if;
    end loop;
end;
$$;

comment on function public.create_document_views_partitions() is
'Creates future partitions for document_views table with RLS enabled. Run monthly via pg_cron.';


-- -----------------------------------------------------------------------------
-- 2. Pre-computed Document View Statistics
-- -----------------------------------------------------------------------------
-- Aggregated stats per document. Updated every 5 minutes by pg_cron.
-- This is what the admin dashboard queries for fast reads.

create table if not exists public.document_view_stats (
    document_slug       text primary key,

    -- Lifetime stats
    total_views         bigint not null default 0,
    unique_sessions     bigint not null default 0,
    unique_users        bigint not null default 0,

    -- User type breakdown
    authenticated_views bigint not null default 0,  -- Logged in users
    anonymous_views     bigint not null default 0,  -- Supabase Anonymous Auth
    guest_views         bigint not null default 0,  -- No auth at all

    -- Device breakdown
    views_desktop       bigint not null default 0,
    views_mobile        bigint not null default 0,
    views_tablet        bigint not null default 0,

    -- Engagement
    total_duration_ms   bigint not null default 0,
    avg_duration_ms     integer not null default 0,
    bounce_count        bigint not null default 0,
    bounce_rate         numeric(5,2) not null default 0,

    -- Time-windowed stats
    views_today         integer not null default 0,
    views_7d            integer not null default 0,
    views_30d           integer not null default 0,
    unique_users_7d     integer not null default 0,
    unique_users_30d    integer not null default 0,

    -- Metadata
    first_viewed_at     timestamp with time zone,
    last_viewed_at      timestamp with time zone,
    stats_updated_at    timestamp with time zone default now()
);

comment on table public.document_view_stats is
'Pre-computed view stats per document.
User types:
  - authenticated_views: Real logged-in users
  - anonymous_views: Supabase Anonymous Auth users
  - guest_views: No auth (session-based only)';

create index if not exists idx_document_view_stats_views
    on public.document_view_stats (views_7d desc);
create index if not exists idx_document_view_stats_updated
    on public.document_view_stats (stats_updated_at);

comment on table public.document_view_stats is
'Pre-computed document view statistics. Updated every 5 minutes by pg_cron for fast dashboard queries.';


-- -----------------------------------------------------------------------------
-- 3. Daily View Summary (for trend charts)
-- -----------------------------------------------------------------------------
-- One row per document per day. Used for trend visualization.

create table if not exists public.document_views_daily (
    document_slug   text not null,
    view_date       date not null,
    views           integer not null default 0,
    unique_sessions integer not null default 0,
    unique_users    integer not null default 0,
    avg_duration_ms integer not null default 0,
    bounce_count    integer not null default 0,

    primary key (document_slug, view_date)
);

create index if not exists idx_document_views_daily_date
    on public.document_views_daily (view_date desc);

comment on table public.document_views_daily is
'Daily aggregated view counts per document. Used for trend charts in admin dashboard.';


-- -----------------------------------------------------------------------------
-- 4. Record Document View (Main RPC Function)
-- -----------------------------------------------------------------------------
-- This is the ONLY function the frontend needs to call.
-- Handles all deduplication, validation, and recording.
-- Returns immediately after INSERT (non-blocking).

-- -----------------------------------------------------------------------------
-- 4. Create pgmq Queue for Document Views
-- -----------------------------------------------------------------------------

select from pgmq.create('document_views');

-- Enable RLS on the queue table (for consistency with other queues)
alter table pgmq.q_document_views enable row level security;

-- Policy for service_role (Hocuspocus writes). pgmq schema persists across
-- `DROP SCHEMA public CASCADE`, so the policy survives — guard the create.
drop policy if exists "service_role_all" on pgmq.q_document_views;
create policy "service_role_all" on pgmq.q_document_views
  for all
  to service_role
  using (true)
  with check (true);

-- Note: pg_cron runs as postgres superuser, bypasses RLS automatically


-- -----------------------------------------------------------------------------
-- 5. Enqueue Document View (Fast - Called by Hocuspocus)
-- -----------------------------------------------------------------------------
-- Generates view_id upfront, enqueues to pgmq, returns immediately.
-- ~1ms latency, no contention even with 100+ concurrent views.

create or replace function public.enqueue_document_view(
    p_document_slug text,
    p_session_id text,
    p_user_id uuid default null,
    p_is_anonymous boolean default false,
    p_device_type text default 'desktop'
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
    v_view_id uuid := gen_random_uuid();
    v_device text;
begin
    -- Input validation
    if p_document_slug is null or length(trim(p_document_slug)) = 0 then
        return jsonb_build_object('success', false, 'error', 'document_slug required');
    end if;

    if p_session_id is null or length(trim(p_session_id)) < 10 then
        return jsonb_build_object('success', false, 'error', 'valid session_id required');
    end if;

    -- Validate device type
    v_device := lower(coalesce(p_device_type, 'desktop'));
    if v_device not in ('desktop', 'mobile', 'tablet') then
        v_device := 'desktop';
    end if;

    -- Enqueue view event (fast, ~1ms)
    perform pgmq.send('document_views', jsonb_build_object(
        'view_id', v_view_id,
        'document_slug', lower(trim(p_document_slug)),
        'session_id', trim(p_session_id),
        'user_id', p_user_id,
        'is_anonymous', coalesce(p_is_anonymous, false),
        'is_authenticated', p_user_id is not null and not coalesce(p_is_anonymous, false),
        'device_type', v_device,
        'viewed_at', now()
    ));

    -- Return view_id so Hocuspocus can update duration later
    return jsonb_build_object(
        'success', true,
        'view_id', v_view_id
    );

exception when others then
    raise warning 'enqueue_document_view error: %', sqlerrm;
    return jsonb_build_object('success', false, 'error', 'internal_error');
end;
$$;

comment on function public.enqueue_document_view(text, text, uuid, boolean, text) is
'Enqueues a document view for batch processing.
Fast (~1ms), no contention.
p_is_anonymous: true if user is using Supabase Anonymous Auth.
Returns view_id for duration updates.';

grant execute on function public.enqueue_document_view(text, text, uuid, boolean, text)
    to authenticated, anon, service_role;


-- -----------------------------------------------------------------------------
-- 6. Document Views Queue Worker (pg_cron - every 10 seconds)
-- -----------------------------------------------------------------------------
-- Processes queued views in batches, handles deduplication.

create or replace function public.process_document_views_queue()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
    rec pgmq.message_record;
    v_processed integer := 0;
    v_duplicates integer := 0;
    v_errors integer := 0;
    max_loops integer := 10;
    loop_count integer := 0;
    batch_size integer := 100;
    row_count integer;
begin
    loop
        loop_count := loop_count + 1;
        row_count := 0;

        if loop_count > max_loops then
            exit;
        end if;

        -- Read batch from queue
        for rec in
            select * from pgmq.read(
                queue_name => 'document_views',
                vt => 30,
                qty => batch_size
            )
        loop
            row_count := row_count + 1;

            declare
                v_view_id uuid := (rec.message->>'view_id')::uuid;
                v_document_slug text := rec.message->>'document_slug';
                v_session_id text := rec.message->>'session_id';
                v_user_id uuid := (rec.message->>'user_id')::uuid;
                v_is_anonymous boolean := (rec.message->>'is_anonymous')::boolean;
                v_is_authenticated boolean := (rec.message->>'is_authenticated')::boolean;
                v_device_type text := rec.message->>'device_type';
                v_viewed_at timestamptz := (rec.message->>'viewed_at')::timestamptz;
                v_view_date date := (v_viewed_at at time zone 'UTC')::date;  -- Use UTC for consistency
            begin
                -- Check for duplicate (same session + document + day)
                if exists (
                    select 1 from public.document_views
                    where session_id = v_session_id
                      and document_slug = v_document_slug
                      and view_date = v_view_date
                    limit 1
                ) then
                    v_duplicates := v_duplicates + 1;
                else
                    -- Insert the view
                    insert into public.document_views (
                        id, document_slug, user_id, session_id, viewed_at, view_date,
                        is_anonymous, is_authenticated, device_type
                    ) values (
                        v_view_id, v_document_slug, v_user_id, v_session_id, v_viewed_at, v_view_date,
                        v_is_anonymous, v_is_authenticated, v_device_type
                    );
                    v_processed := v_processed + 1;
                end if;

                -- Delete from queue
                perform pgmq.delete('document_views', rec.msg_id);

            exception when others then
                v_errors := v_errors + 1;
                raise warning 'Error processing view %: %', rec.msg_id, sqlerrm;
                -- Still delete to prevent infinite retry
                perform pgmq.delete('document_views', rec.msg_id);
            end;
        end loop;

        -- Exit if queue is empty
        if row_count = 0 then
            exit;
        end if;
    end loop;

    return jsonb_build_object(
        'success', true,
        'processed', v_processed,
        'duplicates', v_duplicates,
        'errors', v_errors
    );
end;
$$;

comment on function public.process_document_views_queue() is
'Batch processes document views from pgmq queue.
Handles deduplication and inserts valid views.
Run every 10 seconds via pg_cron.';


-- -----------------------------------------------------------------------------
-- 7. Update View Duration (By view_id)
-- -----------------------------------------------------------------------------
-- Called by Hocuspocus on disconnect with the view_id from enqueue response.

create or replace function public.update_view_duration(
    p_view_id uuid,
    p_duration_ms integer
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
begin
    if p_view_id is null or p_duration_ms is null then
        return false;
    end if;

    -- Cap duration at 30 minutes
    p_duration_ms := least(greatest(p_duration_ms, 0), 1800000);

    -- Update by view_id (works across partitions)
    update public.document_views
    set
        duration_ms = p_duration_ms,
        is_bounce = p_duration_ms < 3000
    where id = p_view_id
      and viewed_at > now() - interval '24 hours';

    return found;
end;
$$;

comment on function public.update_view_duration(uuid, integer) is
'Updates duration for a view by view_id. Called by Hocuspocus on disconnect.';

grant execute on function public.update_view_duration(uuid, integer)
    to authenticated, anon, service_role;


-- -----------------------------------------------------------------------------
-- 6. Aggregate Stats Worker (pg_cron job)
-- -----------------------------------------------------------------------------
-- Batch processes raw views into pre-computed stats.
-- Runs every 5 minutes for near-real-time dashboard updates.

create or replace function public.aggregate_document_view_stats()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
    v_docs_updated integer := 0;
    v_daily_updated integer := 0;
    v_start_time timestamp := clock_timestamp();
    v_last_run timestamptz;
    v_cutoff_30d timestamptz := now() - interval '30 days';
begin
    -- Get last successful run time (for incremental processing)
    select max(stats_updated_at) into v_last_run from public.document_view_stats;
    -- Default to 30 days ago if no previous run
    v_last_run := coalesce(v_last_run - interval '1 minute', v_cutoff_30d);

    -- Only process documents with views since last run (incremental)
    -- Use 30-day window for time-based stats (covers all needed data)
    with docs_to_update as (
        select distinct document_slug
        from public.document_views
        where viewed_at >= v_last_run
    ),
    raw_stats as (
        select
            dv.document_slug,
            count(*) as total_views,
            count(distinct session_id) as unique_sessions,
            count(distinct user_id) filter (where user_id is not null) as unique_users,
            -- User type breakdown
            count(*) filter (where is_authenticated and not is_anonymous) as authenticated_views,
            count(*) filter (where is_anonymous) as anonymous_views,
            count(*) filter (where not is_authenticated and not is_anonymous) as guest_views,
            -- Device breakdown
            count(*) filter (where device_type = 'desktop') as views_desktop,
            count(*) filter (where device_type = 'mobile') as views_mobile,
            count(*) filter (where device_type = 'tablet') as views_tablet,
            -- Engagement
            coalesce(sum(duration_ms), 0) as total_duration_ms,
            coalesce(avg(duration_ms) filter (where duration_ms > 0), 0)::integer as avg_duration_ms,
            count(*) filter (where is_bounce) as bounce_count,
            -- Time windows
            count(*) filter (where viewed_at >= current_date) as views_today,
            count(*) filter (where viewed_at >= current_date - interval '7 days') as views_7d,
            count(*) filter (where viewed_at >= v_cutoff_30d) as views_30d,
            count(distinct user_id) filter (
                where user_id is not null and viewed_at >= current_date - interval '7 days'
            ) as unique_users_7d,
            count(distinct user_id) filter (
                where user_id is not null and viewed_at >= v_cutoff_30d
            ) as unique_users_30d,
            min(viewed_at) as first_viewed_at,
            max(viewed_at) as last_viewed_at
        from public.document_views dv
        where dv.document_slug in (select document_slug from docs_to_update)
        group by dv.document_slug
    )
    insert into public.document_view_stats (
        document_slug, total_views, unique_sessions, unique_users,
        authenticated_views, anonymous_views, guest_views,
        views_desktop, views_mobile, views_tablet,
        total_duration_ms, avg_duration_ms, bounce_count, bounce_rate,
        views_today, views_7d, views_30d, unique_users_7d, unique_users_30d,
        first_viewed_at, last_viewed_at, stats_updated_at
    )
    select
        document_slug, total_views, unique_sessions, unique_users,
        authenticated_views, anonymous_views, guest_views,
        views_desktop, views_mobile, views_tablet,
        total_duration_ms, avg_duration_ms, bounce_count,
        case when total_views > 0
            then round((bounce_count::numeric / total_views) * 100, 2)
            else 0
        end,
        views_today, views_7d, views_30d, unique_users_7d, unique_users_30d,
        first_viewed_at, last_viewed_at, now()
    from raw_stats
    on conflict (document_slug) do update set
        total_views = excluded.total_views,
        unique_sessions = excluded.unique_sessions,
        unique_users = excluded.unique_users,
        authenticated_views = excluded.authenticated_views,
        anonymous_views = excluded.anonymous_views,
        guest_views = excluded.guest_views,
        views_desktop = excluded.views_desktop,
        views_mobile = excluded.views_mobile,
        views_tablet = excluded.views_tablet,
        total_duration_ms = excluded.total_duration_ms,
        avg_duration_ms = excluded.avg_duration_ms,
        bounce_count = excluded.bounce_count,
        bounce_rate = excluded.bounce_rate,
        views_today = excluded.views_today,
        views_7d = excluded.views_7d,
        views_30d = excluded.views_30d,
        unique_users_7d = excluded.unique_users_7d,
        unique_users_30d = excluded.unique_users_30d,
        first_viewed_at = coalesce(document_view_stats.first_viewed_at, excluded.first_viewed_at),
        last_viewed_at = excluded.last_viewed_at,
        stats_updated_at = now();

    get diagnostics v_docs_updated = row_count;

    -- Update daily stats only for today and yesterday (incremental)
    with daily_raw as (
        select
            document_slug,
            view_date,
            count(*) as views,
            count(distinct session_id) as unique_sessions,
            count(distinct user_id) filter (where user_id is not null) as unique_users,
            coalesce(avg(duration_ms) filter (where duration_ms > 0), 0)::integer as avg_duration_ms,
            count(*) filter (where is_bounce) as bounce_count
        from public.document_views
        where view_date >= current_date - 1  -- Only today and yesterday
        group by document_slug, view_date
    )
    insert into public.document_views_daily (
        document_slug, view_date, views, unique_sessions,
        unique_users, avg_duration_ms, bounce_count
    )
    select * from daily_raw
    on conflict (document_slug, view_date) do update set
        views = excluded.views,
        unique_sessions = excluded.unique_sessions,
        unique_users = excluded.unique_users,
        avg_duration_ms = excluded.avg_duration_ms,
        bounce_count = excluded.bounce_count;

    get diagnostics v_daily_updated = row_count;

    return jsonb_build_object(
        'success', true,
        'documents_updated', v_docs_updated,
        'daily_records_updated', v_daily_updated,
        'duration_ms', extract(milliseconds from clock_timestamp() - v_start_time)::integer
    );
end;
$$;

comment on function public.aggregate_document_view_stats() is
'Incrementally aggregates views into pre-computed stats. Only processes documents with new views.';


-- -----------------------------------------------------------------------------
-- 7. Cleanup Old Data (pg_cron job)
-- -----------------------------------------------------------------------------
-- Drops old partitions and cleans up daily stats older than 1 year.

create or replace function public.cleanup_old_document_views()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
    v_partition_name text;
    v_partitions_dropped integer := 0;
    v_daily_deleted integer := 0;
begin
    -- Drop partitions older than 6 months
    for v_partition_name in
        select c.relname
        from pg_class c
        join pg_namespace n on n.oid = c.relnamespace
        where n.nspname = 'public'
          and c.relname like 'document_views_%'
          and c.relkind = 'r'
          and c.relname < 'document_views_' || to_char(current_date - interval '6 months', 'YYYY_MM')
    loop
        execute format('drop table if exists public.%I', v_partition_name);
        v_partitions_dropped := v_partitions_dropped + 1;
    end loop;

    -- Delete daily stats older than 1 year
    delete from public.document_views_daily
    where view_date < current_date - interval '1 year';

    get diagnostics v_daily_deleted = row_count;

    return jsonb_build_object(
        'success', true,
        'partitions_dropped', v_partitions_dropped,
        'daily_records_deleted', v_daily_deleted
    );
end;
$$;

comment on function public.cleanup_old_document_views() is
'Cleans up old view data. Drops partitions older than 6 months, daily stats older than 1 year.';


-- -----------------------------------------------------------------------------
-- 8. Admin Query Functions (for Dashboard)
-- -----------------------------------------------------------------------------

-- Get overall view statistics
create or replace function public.get_document_views_summary()
returns jsonb
language sql
security definer
stable
set search_path = public
as $$
    select jsonb_build_object(
        'total_views', coalesce(sum(total_views), 0),
        'unique_visitors', coalesce(sum(unique_users), 0),
        'views_today', coalesce(sum(views_today), 0),
        'views_7d', coalesce(sum(views_7d), 0),
        'views_30d', coalesce(sum(views_30d), 0),
        'avg_duration_ms', coalesce(
            (sum(total_duration_ms)::numeric / nullif(sum(total_views), 0))::integer,
            0
        ),
        'bounce_rate', coalesce(
            round((sum(bounce_count)::numeric / nullif(sum(total_views), 0)) * 100, 2),
            0
        ),
        'user_types', jsonb_build_object(
            'authenticated', coalesce(sum(authenticated_views), 0),
            'anonymous', coalesce(sum(anonymous_views), 0),
            'guest', coalesce(sum(guest_views), 0)
        ),
        'devices', jsonb_build_object(
            'desktop', coalesce(sum(views_desktop), 0),
            'mobile', coalesce(sum(views_mobile), 0),
            'tablet', coalesce(sum(views_tablet), 0)
        ),
        'documents_with_views', count(*),
        'last_updated', max(stats_updated_at)
    )
    from public.document_view_stats;
$$;

comment on function public.get_document_views_summary() is
'Returns overall document view statistics for admin dashboard.
Includes user type breakdown (authenticated/anonymous/guest) and device breakdown.';


-- Get top viewed documents
create or replace function public.get_top_viewed_documents(
    p_limit integer default 10,
    p_days integer default 7
)
returns table (
    document_slug text,
    views bigint,
    unique_visitors bigint,
    avg_duration_ms integer,
    bounce_rate numeric
)
language sql
security definer
stable
set search_path = public
as $$
    select
        document_slug,
        case when p_days = 7 then views_7d
             when p_days = 30 then views_30d
             else total_views
        end as views,
        case when p_days = 7 then unique_users_7d
             when p_days = 30 then unique_users_30d
             else unique_users
        end as unique_visitors,
        avg_duration_ms,
        bounce_rate
    from public.document_view_stats
    order by
        case when p_days = 7 then views_7d
             when p_days = 30 then views_30d
             else total_views
        end desc
    limit p_limit;
$$;

comment on function public.get_top_viewed_documents(integer, integer) is
'Returns top viewed documents for admin dashboard. p_days: 7, 30, or null for all time.';


-- Get view trend for a document or all documents
create or replace function public.get_document_views_trend(
    p_document_slug text default null,
    p_days integer default 30
)
returns table (
    view_date date,
    views bigint,
    unique_visitors bigint
)
language sql
security definer
stable
set search_path = public
as $$
    select
        view_date,
        sum(views)::bigint as views,
        sum(unique_users)::bigint as unique_visitors
    from public.document_views_daily
    where view_date >= current_date - (p_days || ' days')::interval
      and (p_document_slug is null or document_slug = p_document_slug)
    group by view_date
    order by view_date;
$$;

comment on function public.get_document_views_trend(text, integer) is
'Returns daily view counts for trend charts. Pass document_slug for single doc, null for all.';


-- Get views for specific document
create or replace function public.get_document_view_stats(p_document_slug text)
returns jsonb
language sql
security definer
stable
set search_path = public
as $$
    select coalesce(
        (
            select jsonb_build_object(
                'document_slug', document_slug,
                'total_views', total_views,
                'unique_visitors', unique_users,
                'views_7d', views_7d,
                'views_30d', views_30d,
                'avg_duration_ms', avg_duration_ms,
                'bounce_rate', bounce_rate,
                'first_viewed_at', first_viewed_at,
                'last_viewed_at', last_viewed_at
            )
            from public.document_view_stats
            where document_slug = lower(trim(p_document_slug))
        ),
        jsonb_build_object('document_slug', p_document_slug, 'total_views', 0)
    );
$$;

comment on function public.get_document_view_stats(text) is
'Returns view statistics for a specific document.';


-- -----------------------------------------------------------------------------
-- 9. RLS Policies
-- -----------------------------------------------------------------------------

alter table public.document_views enable row level security;
alter table public.document_view_stats enable row level security;
alter table public.document_views_daily enable row level security;

-- document_views: Only service role can read (admin queries use functions)
-- No direct table access needed

-- document_view_stats: Admins can read
create policy "Admins can read document_view_stats"
    on public.document_view_stats for select
    using (public.is_admin(auth.uid()));

-- document_views_daily: Admins can read
create policy "Admins can read document_views_daily"
    on public.document_views_daily for select
    using (public.is_admin(auth.uid()));


-- -----------------------------------------------------------------------------
-- 10. pg_cron Scheduling
-- -----------------------------------------------------------------------------

-- Process document views queue every 10 seconds
do $$
begin
    perform cron.unschedule('process_document_views_queue')
    where exists (select 1 from cron.job where jobname = 'process_document_views_queue');

    perform cron.schedule(
        'process_document_views_queue',
        '*/10 * * * * *',
        'select public.process_document_views_queue();'
    );
exception when others then
    raise notice 'pg_cron not available for process_document_views_queue';
end;
$$;

-- Aggregate stats every 5 minutes
do $$
begin
    perform cron.unschedule('aggregate_document_view_stats')
    where exists (select 1 from cron.job where jobname = 'aggregate_document_view_stats');

    perform cron.schedule(
        'aggregate_document_view_stats',
        '*/5 * * * *',
        'select public.aggregate_document_view_stats();'
    );
exception when others then
    raise notice 'pg_cron not available for aggregate_document_view_stats';
end;
$$;

-- Create partitions monthly (1st of each month at 00:05)
do $$
begin
    perform cron.unschedule('create_document_views_partitions')
    where exists (select 1 from cron.job where jobname = 'create_document_views_partitions');

    perform cron.schedule(
        'create_document_views_partitions',
        '5 0 1 * *',
        'select public.create_document_views_partitions();'
    );
exception when others then
    raise notice 'pg_cron not available for create_document_views_partitions';
end;
$$;

-- Cleanup old data weekly (Sunday at 03:00)
do $$
begin
    perform cron.unschedule('cleanup_old_document_views')
    where exists (select 1 from cron.job where jobname = 'cleanup_old_document_views');

    perform cron.schedule(
        'cleanup_old_document_views',
        '0 3 * * 0',
        'select public.cleanup_old_document_views();'
    );
exception when others then
    raise notice 'pg_cron not available for cleanup_old_document_views';
end;
$$;


-- -----------------------------------------------------------------------------
-- 11. Grant Permissions for Admin Functions
-- -----------------------------------------------------------------------------

grant execute on function public.get_document_views_summary() to authenticated;
grant execute on function public.get_top_viewed_documents(integer, integer) to authenticated;
grant execute on function public.get_document_views_trend(text, integer) to authenticated;
grant execute on function public.get_document_view_stats(text) to authenticated;

-- ============================================================
-- Hardening: pin search_path = public on functions defined above
-- (idempotent — safe to re-run)
-- ============================================================
ALTER FUNCTION public.create_document_views_partitions() SET search_path = public;
ALTER FUNCTION public.enqueue_document_view(p_document_slug text, p_session_id text, p_user_id uuid, p_is_anonymous boolean, p_device_type text) SET search_path = public;
ALTER FUNCTION public.process_document_views_queue() SET search_path = public;
ALTER FUNCTION public.update_view_duration(p_view_id uuid, p_duration_ms integer) SET search_path = public;
ALTER FUNCTION public.aggregate_document_view_stats() SET search_path = public;
ALTER FUNCTION public.cleanup_old_document_views() SET search_path = public;
ALTER FUNCTION public.get_document_views_summary() SET search_path = public;
ALTER FUNCTION public.get_top_viewed_documents(p_limit integer, p_days integer) SET search_path = public;
ALTER FUNCTION public.get_document_views_trend(p_document_slug text, p_days integer) SET search_path = public;
ALTER FUNCTION public.get_document_view_stats(p_document_slug text) SET search_path = public;


-- ============================================================================
-- File: 09-message_counter.sql
-- ============================================================================

/****************************************************************************
 * Document Title: Channel Message Counting with pgmq and pg_cron
 *
 * Overview:
 *   This SQL file implements a strategy to keep track of message counts
 *   across channels using:
 *     - A "message_counter" queue (from pgmq)
 *     - Trigger-based event enqueueing on the messages table
 *     - A batch worker function scheduled by pg_cron
 *
 * Why this Strategy?
 *   1. Decoupled Inserts:
 *      - The main INSERT path (when new messages are created) only enqueues
 *        a small event. This avoids expensive updates in real-time.
 *   2. Batched Updates:
 *      - The worker function processes multiple queued events in a loop,
 *        updating channel counts in batches. This reduces row-level
 *        contention.
 *   3. Near-Real-Time:
 *      - The pg_cron job runs every minute (`* * * * *`, portable 5-field),
 *        so the aggregate counter can trail realtime by up to ~60s; messages
 *        still arrive live via Supabase Realtime.
 *   4. Simpler Maintenance:
 *      - All logic is contained in the database. You do not need an external
 *        worker service.
 *
 * Schema and Steps:
 *   1. channel_message_counts Table
 *      - Stores the cumulative message count per channel (tied to a workspace).
 *   2. pgmq Queue ("message_counter")
 *      - Holds small JSON events whenever a message is inserted or deleted.
 *   3. Triggers (on_message_insert_queue / on_message_delete_queue)
 *      - Enqueue "increment" or "decrement" events on the queue.
 *   4. message_counter_batch_worker()
 *      - Reads events in batches from the queue (via pgmq.read).
 *      - Updates channel_message_counts accordingly.
 *      - Deletes processed messages from the queue.
 *   5. pg_cron Schedule
 *      - Runs message_counter_batch_worker() on the schedule defined at the
 *        bottom of this file (today: every minute). Sub-minute 6-field cron
 *        requires `cron.use_background_workers = on` and a Postgres restart;
 *        see the comment block above `cron.schedule` in this file.
 *
 * Maintenance Notes:
 *   - Tune read_limit / max_loops in the worker before shortening the cron.
 *   - Ensure you have granted privileges on the pgmq schema and the
 *     underlying queue table (pgmq.q_message_counter) to the role executing
 *     these operations.
 ****************************************************************************/


-- 1. Table to store message counts per channel
--    We add 'workspace_id' for grouping or filtering by workspace.
--    'channel_id' is the primary key, referencing public.channels(id).
--    'workspace_id' references public.workspaces(id).
CREATE TABLE IF NOT EXISTS public.channel_message_counts (
  channel_id    TEXT PRIMARY KEY REFERENCES public.channels(id) ON DELETE CASCADE,
  workspace_id  TEXT NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  message_count BIGINT NOT NULL DEFAULT 0
);

-- 1a. Index on workspace_id for fast queries by workspace
CREATE INDEX IF NOT EXISTS idx_channel_msg_counts_workspace_id
  ON public.channel_message_counts (workspace_id);


-- 2. Create or ensure the pgmq extension is enabled (uncomment if needed)
-- CREATE EXTENSION IF NOT EXISTS pgmq;

-- 3. Create the queue
SELECT FROM pgmq.create('message_counter');

-- 4. Trigger function to enqueue an increment event on message insert.
-- Resolves workspace_id at enqueue time so a later hard-delete of the
-- channel doesn't poison the worker (channels.workspace_id is NULL after
-- the row is gone). Lookup is a PK probe on channels and adds < 1ms to
-- the message INSERT path.
CREATE OR REPLACE FUNCTION public.on_message_insert_queue()
RETURNS TRIGGER AS $$
DECLARE
    v_workspace_id text;
BEGIN
    SELECT workspace_id INTO v_workspace_id
    FROM public.channels WHERE id = NEW.channel_id;

    PERFORM pgmq.send(
      'message_counter',
      jsonb_build_object(
        'channel_id',   NEW.channel_id,
        'workspace_id', v_workspace_id,
        'op',           'increment'
      )
    );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 5. Apply the insert trigger to the messages table
CREATE TRIGGER trigger_on_message_insert
AFTER INSERT ON public.messages
FOR EACH ROW
EXECUTE FUNCTION public.on_message_insert_queue();

-- 6. Trigger function to enqueue a decrement event on message delete.
CREATE OR REPLACE FUNCTION public.on_message_delete_queue()
RETURNS TRIGGER AS $$
DECLARE
    v_workspace_id text;
BEGIN
    SELECT workspace_id INTO v_workspace_id
    FROM public.channels WHERE id = OLD.channel_id;

    PERFORM pgmq.send(
      'message_counter',
      jsonb_build_object(
        'channel_id',   OLD.channel_id,
        'workspace_id', v_workspace_id,
        'op',           'decrement'
      )
    );
  RETURN OLD;
END;
$$ LANGUAGE plpgsql;

-- 7. Apply the delete trigger to the messages table
CREATE TRIGGER trigger_on_message_delete
AFTER DELETE ON public.messages
FOR EACH ROW
EXECUTE FUNCTION public.on_message_delete_queue();

-- 7a. Soft-delete decrement.
-- The product path is `UPDATE deleted_at`, not hard DELETE. Without this,
-- channel_message_counts.message_count drifts upward forever. Fires only on
-- the NULL -> NOT NULL transition so repeated UPDATEs don't double-count.
CREATE OR REPLACE FUNCTION public.on_message_soft_delete_queue()
RETURNS TRIGGER AS $$
DECLARE
    v_workspace_id text;
BEGIN
    SELECT workspace_id INTO v_workspace_id
    FROM public.channels WHERE id = OLD.channel_id;

    PERFORM pgmq.send(
      'message_counter',
      jsonb_build_object(
        'channel_id',   OLD.channel_id,
        'workspace_id', v_workspace_id,
        'op',           'decrement'
      )
    );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_on_message_soft_delete
AFTER UPDATE OF deleted_at ON public.messages
FOR EACH ROW
WHEN (OLD.deleted_at IS NULL AND NEW.deleted_at IS NOT NULL)
EXECUTE FUNCTION public.on_message_soft_delete_queue();

-- 8. Batch worker function to process queued events
CREATE OR REPLACE FUNCTION public.message_counter_batch_worker()
RETURNS void
LANGUAGE plpgsql
AS $$
DECLARE
  rec             pgmq.message_record;   -- Each row from the queue
  max_loops       INT := 10;            -- Safeguard to prevent infinite loops
  loop_count      INT := 0;
  read_limit      INT := 100;           -- Batch size for each read
  row_count       INT;
BEGIN
  LOOP
    loop_count := loop_count + 1;
    row_count  := 0;

    IF loop_count > max_loops THEN
      EXIT;
    END IF;

    -- Read events from the queue in a batch
    FOR rec IN
      SELECT *
      FROM pgmq.read(
        queue_name => 'message_counter',
        vt         => 30,
        qty        => read_limit
      )
    LOOP
      row_count := row_count + 1;

      -- Read the event payload. workspace_id is captured at enqueue time
      -- by the triggers above; we still fall back to a channel lookup to
      -- handle legacy events (pre-`workspace_id`-in-payload) gracefully.
      DECLARE
        v_channel_id   TEXT := rec.message->>'channel_id';
        v_op           TEXT := rec.message->>'op';
        v_workspace_id TEXT := rec.message->>'workspace_id';
      BEGIN
        IF v_workspace_id IS NULL THEN
          SELECT workspace_id INTO v_workspace_id
          FROM public.channels WHERE id = v_channel_id;
        END IF;

        -- Channel was hard-deleted before the event was processed. The
        -- counter row is removed by FK CASCADE, so the event is a no-op;
        -- drop it from the queue and move on. Without this branch, a
        -- single orphan event poisons every subsequent cron run via the
        -- channel_message_counts.workspace_id NOT NULL constraint.
        IF v_workspace_id IS NULL THEN
          PERFORM pgmq.delete('message_counter', rec.msg_id);
          CONTINUE;
        END IF;

        IF v_op = 'increment' THEN
          INSERT INTO public.channel_message_counts (channel_id, workspace_id, message_count)
          VALUES (v_channel_id, v_workspace_id, 1)
          ON CONFLICT (channel_id)
          DO UPDATE
            SET message_count = public.channel_message_counts.message_count + 1,
                workspace_id  = EXCLUDED.workspace_id;

        ELSIF v_op = 'decrement' THEN
          INSERT INTO public.channel_message_counts (channel_id, workspace_id, message_count)
          VALUES (v_channel_id, v_workspace_id, 0)
          ON CONFLICT (channel_id)
          DO UPDATE
            SET message_count = GREATEST(public.channel_message_counts.message_count - 1, 0),
                workspace_id  = EXCLUDED.workspace_id;
        END IF;
      END;

      -- Delete processed message so it doesn't appear again
      PERFORM pgmq.delete('message_counter', rec.msg_id);
    END LOOP;

    -- If no rows were read, the queue is empty; exit early
    IF row_count = 0 THEN
      EXIT;
    END IF;
  END LOOP;
END;
$$;

-- 9. Schedule the worker. Default = every minute (portable 5-field cron).
--
-- pg_cron only honors sub-minute schedules ("*/10 * * * * *", 6-field
-- form including seconds) when `cron.use_background_workers = on` in
-- postgresql.conf — that setting requires a server restart since
-- pg_cron is in shared_preload_libraries. With the launcher-only mode
-- (the default on local Supabase Docker), a 6-field schedule gets
-- silently truncated to 5 fields and "*/10 * * * * *" is interpreted as
-- "*/10 * * * *" = every 10 minutes, which is way too laggy for the
-- unread badge UX.
--
-- A 1-minute cadence covers chat unread display fine: messages still
-- propagate live via realtime; only the aggregate counter trails by up
-- to 60s. To upgrade to ~10s on a host that supports it:
--   ALTER SYSTEM SET cron.use_background_workers = 'on';
--   -- then restart Postgres and reschedule with '*/10 * * * * *'
SELECT cron.unschedule('message_counter_batch_job')
FROM cron.job WHERE jobname = 'message_counter_batch_job';

SELECT cron.schedule(
            'message_counter_batch_job',      -- A job name for reference
            '* * * * *',                      -- Every minute (portable)
    $$
            SELECT public.message_counter_batch_worker();
    $$
        );

-- ============================================================
-- Hardening: pin search_path = public on functions defined above
-- (idempotent — safe to re-run)
-- ============================================================
ALTER FUNCTION public.on_message_insert_queue() SET search_path = public;
ALTER FUNCTION public.on_message_delete_queue() SET search_path = public;
ALTER FUNCTION public.on_message_soft_delete_queue() SET search_path = public;
ALTER FUNCTION public.message_counter_batch_worker() SET search_path = public;

-- Trigger functions run as postgres (DEFINER) so internal side effects
-- (counters, previews, notifications) bypass RLS on side-effect tables.
-- search_path is already pinned above; flipping security mode is safe.
ALTER FUNCTION public.on_message_insert_queue() SECURITY DEFINER;
ALTER FUNCTION public.on_message_delete_queue() SECURITY DEFINER;
ALTER FUNCTION public.on_message_soft_delete_queue() SECURITY DEFINER;


-- ============================================================================
-- File: 10-0-func-helpers.sql
-- ============================================================================

/*
 * Helper Functions
 * This file contains utility functions used throughout the application.
 */

/**
 * Function: truncate_content
 * Description: Truncates text content to a specified maximum length, adding ellipsis if needed.
 * Parameters:
 *   - input_content: The text content to truncate
 *   - max_length: Maximum length of the output text (optional, defaults to 80)
 * Returns: Truncated text with ellipsis appended if truncation occurred
 * Usage: Used for generating preview text throughout the application
 */
create or replace function truncate_content(
    input_content text,
    max_length int default null
) returns text as $$
declare
    -- Define a constant for the default max length
    default_max_length constant int := 80;
begin
    -- Use the provided max_length or the default if not provided
    if max_length is null then
        max_length := default_max_length;
    end if;

    return case
        when length(input_content) > max_length then left(input_content, max_length - 3) || '...'
        else input_content
    end;
end;
$$ language plpgsql;

comment on function truncate_content(text, int) is
'Utility function to truncate text content to a specified length with ellipsis, used for preview text generation.';

-- ============================================================
-- Hardening: pin search_path = public on functions defined above
-- (idempotent — safe to re-run)
-- ============================================================
ALTER FUNCTION public.truncate_content(input_content text, max_length integer) SET search_path = public;


-- ============================================================================
-- File: 10-1-func-users.sql
-- ============================================================================

/*
 * User Management Functions
 * This file contains functions and triggers related to user account management.
 */

-- Create internal schema for private helper functions
CREATE SCHEMA IF NOT EXISTS internal;
GRANT USAGE ON SCHEMA internal TO authenticated, service_role;

/**
 * Function: handle_new_user
 * Description: Creates a new user record in public.users when a new auth user is registered.
 * Trigger: Executes after INSERT on auth.users
 * Action: Generates a username based on name or email, sanitizes it, ensures uniqueness,
 *         and creates the public user profile with data from auth metadata.
 * Returns: The NEW record (trigger standard)
 */

-- Create function with explicit ownership
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  raw_username TEXT;
  sanitized_username TEXT;
  final_username TEXT;
  name_suffix INT := 0;
  user_full_name TEXT;
  user_avatar_url TEXT;
BEGIN
  -- Skip profile creation for anonymous users entirely.
  -- Anonymous users (created by Supabase Anonymous Auth for document view tracking)
  -- don't need public.users entries — they have no email, no profile.
  -- The webapp's useOnAuthStateChange also skips getUserProfile for anonymous users.
  IF new.is_anonymous = true THEN
    RETURN new;
  END IF;

  -- Extract full_name from metadata (Google uses 'name', others might use 'full_name')
  user_full_name := COALESCE(
    new.raw_user_meta_data->>'full_name',
    new.raw_user_meta_data->>'name',
    NULL
  );

  -- Extract avatar_url from metadata
  user_avatar_url := COALESCE(
    new.raw_user_meta_data->>'avatar_url',
    new.raw_user_meta_data->>'picture',
    NULL
  );

  -- Extract initial username from meta-data or email
  -- Note: trim() is not in pg_catalog, so we use btrim() or unqualified trim()
  IF user_full_name IS NOT NULL THEN
    raw_username := pg_catalog.lower(pg_catalog.btrim(user_full_name));
  ELSIF new.email IS NOT NULL THEN
    raw_username := pg_catalog.lower(pg_catalog.split_part(new.email, '@', 1));
  ELSE
    -- Fallback: generate username from UUID if no email/name
    raw_username := 'user_' || pg_catalog.replace(pg_catalog.substr(new.id::text, 1, 8), '-', '');
  END IF;

  -- Sanitize username: replace invalid chars with underscores
  sanitized_username := pg_catalog.regexp_replace(raw_username, '[^a-z0-9_-]', '_', 'g');

  -- Ensure username starts with a letter
  IF sanitized_username !~ '^[a-z]' THEN
    sanitized_username := 'user_' || sanitized_username;
  END IF;

  -- Apply length constraints (max 30 chars)
  sanitized_username := pg_catalog.left(sanitized_username, 30);

  -- Ensure minimum length requirement (3 chars)
  IF pg_catalog.char_length(sanitized_username) < 3 THEN
    sanitized_username := sanitized_username || '_usr';
  END IF;

  -- Ensure username uniqueness
  final_username := sanitized_username;
  WHILE EXISTS (SELECT 1 FROM public.users WHERE public.users.username = final_username) LOOP
    name_suffix := name_suffix + 1;
    final_username := pg_catalog.left(sanitized_username || '_' || name_suffix::TEXT, 30);
  END LOOP;

  -- Ensure email is not NULL (required by public.users constraint)
  IF new.email IS NULL THEN
    RAISE EXCEPTION 'Email is required for user creation';
  END IF;

  INSERT INTO public.users (id, full_name, avatar_url, email, username)
  VALUES (new.id, user_full_name, user_avatar_url, new.email, final_username);

  RETURN new;
END;
$$;


-- Trigger: on_auth_user_created
-- Description: Executes handle_new_user function after a new user is created in auth.users table.
CREATE TRIGGER on_auth_user_created
AFTER INSERT ON auth.users
FOR EACH ROW
EXECUTE PROCEDURE public.handle_new_user();

----------------------------------------------------
----------------------------------------------------

/**
 * Function: update_user_online_at
 * Description: Updates the online_at timestamp when a user's status changes
 * Trigger: Executes before UPDATE of status on public.users
 * Action: Sets the online_at timestamp to current UTC time when status changes
 * Returns: The modified NEW record
 */
CREATE OR REPLACE FUNCTION public.update_user_online_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
    -- Check if the 'status' column is being updated
    IF OLD.status IS DISTINCT FROM NEW.status THEN
        -- Update 'online_at' to the current timestamp
        NEW.online_at := timezone('utc', now());
    END IF;
    RETURN NEW;
END;
$$;

COMMENT ON FUNCTION public.update_user_online_at() IS 'Updates the online_at timestamp whenever a user status changes, for tracking user activity.';

CREATE TRIGGER trigger_update_user_online_at
BEFORE UPDATE OF status ON public.users
FOR EACH ROW
EXECUTE FUNCTION public.update_user_online_at();

COMMENT ON TRIGGER trigger_update_user_online_at ON public.users IS 'Automatically updates the online_at timestamp when a user status changes.';

----------------------------------------------------
----------------------------------------------------

/**
 * Function: is_user_online
 * Description: Checks if a user is actively online based on status and recent activity.
 * Parameters: p_user_id - The UUID of the user to check
 * Returns: TRUE if user has status='ONLINE' AND online_at within last 2 minutes
 *
 * Usage: Used by push notification trigger to skip push for active users.
 * The 2-minute threshold is more aggressive than the cron cleanup (also 2 min)
 * to ensure we catch users who are actively engaged.
 */
CREATE OR REPLACE FUNCTION internal.is_user_online(p_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
AS $$
    SELECT EXISTS (
        SELECT 1 FROM public.users
        WHERE id = p_user_id
          AND status = 'ONLINE'
          AND online_at > now() - interval '2 minutes'
    );
$$;

COMMENT ON FUNCTION internal.is_user_online(uuid) IS
'Checks if user is actively online. Returns true if status is ONLINE and online_at is within last 2 minutes.';

-- Grant execute to service_role for push notification trigger
GRANT EXECUTE ON FUNCTION internal.is_user_online(uuid) TO service_role;

-- ============================================================
-- Hardening: pin search_path = public on functions defined above
-- (idempotent — safe to re-run)
-- ============================================================
ALTER FUNCTION public.handle_new_user() SET search_path = public;
ALTER FUNCTION public.update_user_online_at() SET search_path = public;
ALTER FUNCTION internal.is_user_online(p_user_id uuid) SET search_path = public;

-- Trigger functions run as postgres (DEFINER) so internal side effects
-- (counters, previews, notifications) bypass RLS on side-effect tables.
-- search_path is already pinned above; flipping security mode is safe.
ALTER FUNCTION public.update_user_online_at() SECURITY DEFINER;


-- ============================================================================
-- File: 10-2-func-channels.sql
-- ============================================================================

/*
 * Channel Management Functions
 * This file contains functions and triggers related to channel operations:
 * - Channel creation and membership
 * - Channel notifications
 * - Member counts and activity tracking
 */

/**
 * Function: add_channel_creator_as_admin
 * Description: Adds the creator of a new channel as an admin member
 * Trigger: Executes after INSERT on public.channels
 * Action: Inserts a record into channel_members with ADMIN role for the creator
 * Returns: The NEW record (trigger standard)
 */
create or replace function add_channel_creator_as_admin()
returns trigger as $$
begin
    -- Insert the channel creator as an admin member
    insert into public.channel_members (
        channel_id,
        member_id,
        channel_member_role,
        joined_at
    )
    values (
        new.id,
        new.created_by,
        'ADMIN',
        now()
    );

    return new;
end;
$$ language plpgsql;

comment on function add_channel_creator_as_admin() is
'Adds the creator of a new channel as an admin member in the channel_members table.';

-- Trigger: channel_creator_as_admin
create trigger channel_creator_as_admin
after insert on public.channels
for each row
execute function add_channel_creator_as_admin();

comment on trigger channel_creator_as_admin on public.channels is
'Automatically adds the channel creator as an admin member when a new channel is created.';
--INFO: Disable this trigger for now
/**
 * Function: create_channel_notification
 * Description: Creates a system notification message when a new channel is created
 * Trigger: Executes after INSERT on public.channels
 * Action: Creates a notification message in the new channel
 * Returns: The NEW record (trigger standard)
 */
-- create or replace function create_channel_notification()
-- returns trigger as $$
-- begin
--     insert into public.messages (
--         channel_id,
--         type,
--         user_id,
--         content,
--         metadata
--     )
--     values (
--         new.id,
--         'notification',
--         '992bb85e-78f8-4747-981a-fd63d9317ff1', -- System user ID
--         'Channel created',
--         jsonb_build_object(
--             'type', 'channel_created'
--         )
--     );

--     return new;
-- end;
-- $$ language plpgsql;

-- comment on function create_channel_notification() is
-- 'Creates a system notification message when a new channel is created.';

-- Trigger: notify_channel_creation
-- create trigger notify_channel_creation
-- after insert on public.channels
-- for each row
-- execute function create_channel_notification();

-- comment on trigger notify_channel_creation on public.channels is
-- 'Creates a notification message when a new channel is created.';

/* Legacy code - kept for reference but commented out
create or replace function update_last_read_time()
returns trigger as $$
begin
    -- Update the last_read_update_at if there's a change in last_read_message_id
    if old.last_read_message_id is distinct from new.last_read_message_id then
        new.last_read_update_at := timezone('utc', now());
    end if;
    return new;
end;
$$ language plpgsql;

create trigger trigger_update_last_read_time
before update on public.channel_members
for each row
execute function update_last_read_time();
*/

/**
 * Function: notify_channel_name_change
 * Description: Creates a system notification when a channel's name is changed
 * Trigger: Executes after UPDATE of name on public.channels
 * Action: Creates a notification message with the new channel name
 * Returns: The NEW record (trigger standard)
 */
--INFO: Disable this trigger for now
-- create or replace function notify_channel_name_change()
-- returns trigger as $$
-- begin
--     if old.name is distinct from new.name then
--         insert into public.messages (
--             channel_id,
--             type,
--             user_id,
--             content,
--             metadata
--         )
--         values (
--             new.id,
--             'notification',
--             '992bb85e-78f8-4747-981a-fd63d9317ff1', -- System user ID
--             'Channel renamed to "' || new.name || '"',
--             jsonb_build_object(
--                 'type', 'channel_name_changed',
--                 'name', new.name
--             )
--         );
--     end if;

--     return new;
-- end;
-- $$ language plpgsql;

-- comment on function notify_channel_name_change() is
-- 'Creates a system notification message when a channel name is changed.';

-- Trigger: notify_on_channel_name_change
-- create trigger notify_on_channel_name_change
-- after update of name on public.channels
-- for each row
-- when (old.name is distinct from new.name)
-- execute function notify_channel_name_change();

-- comment on trigger notify_on_channel_name_change on public.channels is
-- 'Creates a notification when a channel name is changed.';

/**
 * Function: notify_user_join_channel
 * Description: Creates a notification message when a user joins a channel
 * Trigger: Executes after INSERT on public.channel_members
 * Action: Creates a notification message showing who joined
 * Returns: The NEW record (trigger standard)
 */
--INFO: Disable this trigger for now
-- create or replace function notify_user_join_channel()
-- returns trigger as $$
-- declare
--     joining_username text;
--     channel_workspace_id varchar(36);
-- begin
--     -- Skip if this is a workspace channel
--     select workspace_id into channel_workspace_id
--     from public.channels
--     where id = new.channel_id;

--     if channel_workspace_id = new.channel_id then
--         return new;
--     end if;

--     -- Get the username of the joining member
--     select username into joining_username
--     from public.users
--     where id = new.member_id;

--     -- Create the notification message
--     insert into public.messages (
--         user_id,
--         channel_id,
--         type,
--         content,
--         metadata
--     )
--     values (
--         new.member_id,
--         new.channel_id,
--         'notification',
--         joining_username || ' joined the channel',
--         jsonb_build_object(
--             'type', 'user_join_channel',
--             'user_name', joining_username
--         )
--     );

--     return new;
-- end;
-- $$ language plpgsql;

-- comment on function notify_user_join_channel() is
-- 'Creates a notification message when a user joins a channel.';

-- Trigger: notify_on_user_join
-- create trigger notify_on_user_join
-- after insert on public.channel_members
-- for each row
-- execute function notify_user_join_channel();

-- comment on trigger notify_on_user_join on public.channel_members is
-- 'Creates a notification when a user joins a channel.';

/**
 * Function: notify_user_leave_channel
 * Description: Creates a notification message when a user leaves a channel
 * Trigger: Executes after DELETE on public.channel_members
 * Action: Creates a notification message showing who left
 * Returns: The OLD record (trigger standard)
 */
--INFO: Disable this trigger for now
-- create or replace function notify_user_leave_channel()
-- returns trigger as $$
-- declare
--     leaving_username text;
-- begin
--     -- Get the username of the leaving member
--     select username into leaving_username
--     from public.users
--     where id = old.member_id;

--     -- Check if the channel still exists before creating notification
--     if exists (select 1 from public.channels where id = old.channel_id) then
--         insert into public.messages (
--             user_id,
--             channel_id,
--             type,
--             content,
--             metadata
--         )
--         values (
--             old.member_id,
--             old.channel_id,
--             'notification',
--             leaving_username || ' left the channel',
--             jsonb_build_object(
--                 'type', 'user_leave_channel',
--                 'user_name', leaving_username
--             )
--         );
--     end if;

--     return old;
-- end;
-- $$ language plpgsql;

-- comment on function notify_user_leave_channel() is
-- 'Creates a notification message when a user leaves a channel.';

-- -- Trigger: notify_on_user_leave
-- create trigger notify_on_user_leave
-- after delete on public.channel_members
-- for each row
-- execute function notify_user_leave_channel();

-- comment on trigger notify_on_user_leave on public.channel_members is
-- 'Creates a notification when a user leaves a channel.';

/**
 * Function: increment_channel_member_count
 * Description: Increments the member_count of a channel when a new member is added
 * Trigger: Executes after INSERT on public.channel_members
 * Action: Updates the member_count in channels table by adding 1
 * Returns: The NEW record (trigger standard)
 * Note: Will be rolled back automatically if the transaction is rolled back
 */
create or replace function increment_channel_member_count()
returns trigger as $$
begin
    update public.channels
    set member_count = member_count + 1
    where id = new.channel_id;

    return new;
end;
$$ language plpgsql;

comment on function increment_channel_member_count() is
'Increments the member count of a channel when a new member is added.';

-- Trigger: increment_member_count
create trigger increment_member_count
after insert on public.channel_members
for each row
execute function increment_channel_member_count();

comment on trigger increment_member_count on public.channel_members is
'Automatically increments the member count when a new member is added to a channel.';

/**
 * Function: decrement_channel_member_count
 * Description: Decrements the member_count of a channel when a member is removed
 * Trigger: Executes after DELETE on public.channel_members
 * Action: Updates the member_count in channels table by subtracting 1
 * Returns: The OLD record (trigger standard)
 * Note: Will handle member removal from both explicit leave and cascade delete when a user is deleted
 */
create or replace function decrement_channel_member_count()
returns trigger as $$
begin
    update public.channels
    set member_count = member_count - 1
    where id = old.channel_id;

    return old;
end;
$$ language plpgsql;

comment on function decrement_channel_member_count() is
'Decrements the member count of a channel when a member is removed.';

-- Trigger: decrement_member_count
create trigger decrement_member_count
after delete on public.channel_members
for each row
execute function decrement_channel_member_count();

comment on trigger decrement_member_count on public.channel_members is
'Automatically decrements the member count when a member is removed from a channel.';

/**
 * Function: prevent_duplicate_channel_member
 * Description: Prevents adding the same user to a channel multiple times
 * Trigger: Executes before INSERT on public.channel_members
 * Action: Checks if the user is already a member of the channel and raises exception if true
 * Returns: The NEW record (trigger standard) if the user is not already a member
 */
create or replace function prevent_duplicate_channel_member()
returns trigger as $$
begin
    -- Check if a record already exists with the same channel_id and member_id
    if exists (
        select 1
        from public.channel_members
        where channel_id = new.channel_id
        and member_id = new.member_id
    ) then
        -- If exists, raise an exception
        raise exception 'This user is already a member of the channel.';
    end if;

    -- If not, allow the insertion
    return new;
end;
$$ language plpgsql;

comment on function prevent_duplicate_channel_member() is
'Prevents adding the same user to a channel multiple times.';

-- Trigger: check_duplicate_member
create trigger check_duplicate_member
before insert on public.channel_members
for each row
execute function prevent_duplicate_channel_member();

comment on trigger check_duplicate_member on public.channel_members is
'Ensures a user cannot be added to the same channel multiple times.';

-- ============================================================
-- Hardening: pin search_path = public on functions defined above
-- (idempotent — safe to re-run)
-- ============================================================
ALTER FUNCTION public.add_channel_creator_as_admin() SET search_path = public;
ALTER FUNCTION public.increment_channel_member_count() SET search_path = public;
ALTER FUNCTION public.decrement_channel_member_count() SET search_path = public;
ALTER FUNCTION public.prevent_duplicate_channel_member() SET search_path = public;

-- Trigger functions run as postgres (DEFINER) so internal side effects
-- (counters, previews, notifications) bypass RLS on side-effect tables.
-- search_path is already pinned above; flipping security mode is safe.
ALTER FUNCTION public.add_channel_creator_as_admin() SECURITY DEFINER;
ALTER FUNCTION public.increment_channel_member_count() SECURITY DEFINER;
ALTER FUNCTION public.decrement_channel_member_count() SECURITY DEFINER;
ALTER FUNCTION public.prevent_duplicate_channel_member() SECURITY DEFINER;


-- ============================================================================
-- File: 10-3-func-message.sql
-- ============================================================================

/*
 * Message Management Functions
 * This file contains functions and triggers related to message operations:
 * - Message soft deletion
 * - Message editing and content updates
 * - Message preview generation
 */

/**
 * Function: handle_message_soft_delete
 * Description: Performs cleanup operations when a message is soft-deleted
 * Trigger: Executes after UPDATE of deleted_at on public.messages
 * Action:
 *   - Deletes related pinned messages
 *   - Decrements unread_message_count for users with unread notifications
 *   - Deletes related notifications
 *   - Updates related reply references
 *   - Updates channel last_message_preview if needed
 * Returns: The NEW record (trigger standard)
 */
CREATE OR REPLACE FUNCTION handle_message_soft_delete() RETURNS TRIGGER AS $$
DECLARE
    current_metadata JSONB;
BEGIN
    -- Set deleted_at timestamp for soft delete
    NEW.deleted_at := NOW();

    IF TG_OP = 'UPDATE' THEN
        -- Delete pinned message
        DELETE FROM public.pinned_messages WHERE message_id = OLD.id;

        -- Decrement unread count for users with unread notifications for this message
        -- Must happen BEFORE deleting notifications so we know who to decrement
        UPDATE public.channel_members cm
        SET unread_message_count = GREATEST(0, unread_message_count - 1)
        FROM (
            SELECT receiver_user_id, channel_id
            FROM public.notifications
            WHERE message_id = OLD.id AND readed_at IS NULL
        ) n
        WHERE cm.channel_id = n.channel_id AND cm.member_id = n.receiver_user_id;

        -- Delete associated notifications
        DELETE FROM public.notifications WHERE message_id = OLD.id;

        -- Update reply previews
        UPDATE public.messages
        SET replied_message_preview = 'The message has been deleted'
        WHERE reply_to_message_id = OLD.id;

        -- Refresh the channel preview to the next-newest non-deleted message.
        -- If OLD wasn't the latest, this resolves to the same row already in
        -- last_message_preview (no-op effect). If OLD was the latest, this
        -- pulls in the previous message. NULL when the channel is now empty.
        IF OLD.channel_id IS NOT NULL AND EXISTS (SELECT 1 FROM public.channels WHERE id = OLD.channel_id) THEN
            UPDATE public.channels
            SET last_message_preview = (
                    SELECT truncate_content(m.content)
                    FROM public.messages m
                    WHERE m.channel_id = OLD.channel_id
                      AND m.deleted_at IS NULL
                      AND m.id <> OLD.id
                    ORDER BY m.created_at DESC, m.id DESC
                    LIMIT 1
                ),
                last_activity_at = NOW()
            WHERE id = OLD.channel_id;
        END IF;

        -- Remove the reply from the metadata of the original message
        IF NEW.reply_to_message_id IS NOT NULL THEN
            SELECT metadata INTO current_metadata FROM public.messages
            WHERE id = NEW.reply_to_message_id;

            IF current_metadata IS NOT NULL THEN
                -- Remove the deleted message ID from the 'replied' array
                current_metadata := jsonb_set(current_metadata, '{replied}', (current_metadata->'replied') - NEW.id::text);

                -- Update the original message's metadata
                UPDATE public.messages
                SET metadata = current_metadata
                WHERE id = NEW.reply_to_message_id;
            END IF;
        END IF;

        -- Anon viewers can't observe soft-deletes via postgres_changes — the
        -- anon SELECT policy (messages_public_anon_select) filters
        -- `deleted_at IS NULL`, so the realtime layer drops the UPDATE event
        -- whose NEW row fails the policy. Emit a broadcast on the NULL → NOT
        -- NULL transition so subscribers prune locally. Payload is id +
        -- channel only; no content leak.
        IF OLD.deleted_at IS NULL AND NEW.deleted_at IS NOT NULL THEN
            PERFORM realtime.send(
                jsonb_build_object('id', NEW.id, 'channel_id', NEW.channel_id),
                'message:deleted',
                'chatroom:' || NEW.channel_id,
                FALSE
            );
        END IF;

        RETURN NEW;
    END IF;

    RETURN NULL; -- Should not reach here for an UPDATE trigger
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION handle_message_soft_delete() IS 'Performs cleanup operations when a message is soft-deleted including updating previews and removing references.';

CREATE TRIGGER message_soft_delete
AFTER UPDATE OF deleted_at ON public.messages
FOR EACH ROW
EXECUTE FUNCTION handle_message_soft_delete();

COMMENT ON TRIGGER message_soft_delete ON public.messages IS 'Handles additional actions when a message is soft-deleted.';

/**
 * Function: update_message_preview_on_edit
 * Description: Updates message previews across the system when a message is edited
 * Trigger: Executes after UPDATE of content on public.messages
 * Action: Updates previews in notifications, replies, and channel
 * Returns: The NEW record (trigger standard)
 */
CREATE OR REPLACE FUNCTION update_message_preview_on_edit()
RETURNS TRIGGER AS $$
DECLARE
    truncated_content TEXT;
BEGIN
    truncated_content := truncate_content(NEW.content);

    -- Update unread notification preview
    UPDATE public.notifications
    SET message_preview = truncated_content
    WHERE message_id = NEW.id AND readed_at IS NULL;

    -- Update previews for messages that are replies to the edited message
    UPDATE public.messages
    SET replied_message_preview = truncated_content
    WHERE reply_to_message_id = NEW.id;

    -- Update last message preview in the channel of the edited message
    IF NEW.channel_id IS NOT NULL AND EXISTS (SELECT 1 FROM public.channels WHERE id = NEW.channel_id) THEN
        UPDATE public.channels
        SET last_message_preview = truncated_content
        WHERE id = NEW.channel_id;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION update_message_preview_on_edit() IS 'Updates message previews in various tables when a message is edited.';

CREATE TRIGGER update_message_previews
AFTER UPDATE OF content ON public.messages
FOR EACH ROW
WHEN (OLD.content IS DISTINCT FROM NEW.content)
EXECUTE FUNCTION update_message_preview_on_edit();

COMMENT ON TRIGGER update_message_previews ON public.messages IS 'Updates message previews throughout the system when message content changes.';

/**
 * Function: update_message_edited_at
 * Description: Sets the edited_at timestamp when message content or HTML is modified
 * Trigger: Executes before UPDATE of content or html on public.messages
 * Action: Sets the edited_at timestamp to the current time
 * Returns: The modified NEW record
 */
CREATE OR REPLACE FUNCTION update_message_edited_at() RETURNS TRIGGER AS $$
BEGIN
    -- Check if the content or html column has been updated
    IF OLD.content IS DISTINCT FROM NEW.content OR OLD.html IS DISTINCT FROM NEW.html THEN
        -- Update the edited_at timestamp
        NEW.edited_at := NOW();
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION update_message_edited_at() IS 'Sets the edited_at timestamp when a message is edited.';

CREATE TRIGGER set_message_edited_at
BEFORE UPDATE OF content, html ON public.messages
FOR EACH ROW
EXECUTE FUNCTION update_message_edited_at();

COMMENT ON TRIGGER set_message_edited_at ON public.messages IS 'Sets the edited_at timestamp when message content or HTML is updated.';

-- ============================================================
-- Hardening: pin search_path = public on functions defined above
-- (idempotent — safe to re-run)
-- ============================================================
ALTER FUNCTION public.handle_message_soft_delete() SET search_path = public;
ALTER FUNCTION public.update_message_preview_on_edit() SET search_path = public;
ALTER FUNCTION public.update_message_edited_at() SET search_path = public;

-- Trigger functions run as postgres (DEFINER) so internal side effects
-- (counters, previews, notifications) bypass RLS on side-effect tables.
-- search_path is already pinned above; flipping security mode is safe.
ALTER FUNCTION public.handle_message_soft_delete() SECURITY DEFINER;
ALTER FUNCTION public.update_message_preview_on_edit() SECURITY DEFINER;
ALTER FUNCTION public.update_message_edited_at() SECURITY DEFINER;

-- ============================================================
-- v2 reactions RPCs. Direct messages.update from the FE is removed;
-- reactions go through these. SELECT ... FOR UPDATE prevents lost
-- updates on concurrent toggles. The persisted shape is the v1 object
-- { [emoji]: [{user_id, created_at}, …] } so ReactionList /
-- AddReactionButton readers stay untouched.
-- ============================================================

create or replace function public.add_reaction(
  p_message_id uuid,
  p_emoji      text
) returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_uid uuid := (select auth.uid());
  v_channel_id varchar(36);
  v_reactions jsonb;
  v_users jsonb;
  v_already_reacted boolean;
begin
  if v_uid is null then
    raise exception 'not authenticated' using errcode = '42501';
  end if;
  if length(p_emoji) = 0 or length(p_emoji) > 16 then
    raise exception 'invalid emoji' using errcode = '22023';
  end if;

  select channel_id into v_channel_id
  from public.messages
  where id = p_message_id and deleted_at is null;
  if v_channel_id is null then
    raise exception 'message not found' using errcode = '42501';
  end if;
  if not internal.can_read_channel(v_channel_id) then
    raise exception 'forbidden' using errcode = '42501';
  end if;

  select coalesce(reactions, '{}'::jsonb) into v_reactions
  from public.messages where id = p_message_id for update;

  v_users := coalesce(v_reactions -> p_emoji, '[]'::jsonb);
  v_already_reacted := exists (
    select 1 from jsonb_array_elements(v_users) elt
    where elt->>'user_id' = v_uid::text
  );

  if not v_already_reacted then
    v_users := v_users || jsonb_build_array(
      jsonb_build_object(
        'user_id', v_uid::text,
        'created_at', to_char(now() at time zone 'utc', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"')
      )
    );
    v_reactions := v_reactions || jsonb_build_object(p_emoji, v_users);
    update public.messages set reactions = v_reactions where id = p_message_id;
  end if;

  return v_reactions;
end;
$$;

grant execute on function public.add_reaction(uuid, text) to authenticated;
revoke execute on function public.add_reaction(uuid, text) from anon, public;

create or replace function public.remove_reaction(
  p_message_id uuid,
  p_emoji      text
) returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_uid uuid := (select auth.uid());
  v_channel_id varchar(36);
  v_reactions jsonb;
  v_users jsonb;
begin
  if v_uid is null then
    raise exception 'not authenticated' using errcode = '42501';
  end if;

  select channel_id into v_channel_id
  from public.messages
  where id = p_message_id and deleted_at is null;
  if v_channel_id is null then
    raise exception 'message not found' using errcode = '42501';
  end if;
  if not internal.can_read_channel(v_channel_id) then
    raise exception 'forbidden' using errcode = '42501';
  end if;

  select coalesce(reactions, '{}'::jsonb) into v_reactions
  from public.messages where id = p_message_id for update;

  v_users := coalesce(v_reactions -> p_emoji, '[]'::jsonb);
  v_users := coalesce((
    select jsonb_agg(elt)
    from jsonb_array_elements(v_users) elt
    where elt->>'user_id' <> v_uid::text
  ), '[]'::jsonb);

  if jsonb_array_length(v_users) = 0 then
    v_reactions := v_reactions - p_emoji;
  else
    v_reactions := v_reactions || jsonb_build_object(p_emoji, v_users);
  end if;

  update public.messages set reactions = v_reactions where id = p_message_id;

  return v_reactions;
end;
$$;

grant execute on function public.remove_reaction(uuid, text) to authenticated;
revoke execute on function public.remove_reaction(uuid, text) from anon, public;


-- ============================================================================
-- File: 10-5-func-replied_msg.sql
-- ============================================================================

-- Reply-aware row hooks: snapshot the parent preview, mirror the new id
-- onto the parent's replied[] metadata, and refresh the channel preview.

-- Stamps the parent's truncated content onto the reply row before insert
-- so the UI can render the quoted preview without an extra join.
CREATE OR REPLACE FUNCTION set_replied_message_preview()
RETURNS TRIGGER AS $$
DECLARE
    original_message_content TEXT;
    truncated_content TEXT;
BEGIN
    -- Only proceed if this message is a reply
    IF NEW.reply_to_message_id IS NOT NULL THEN
        -- Retrieve the content of the original message, only if not deleted
        SELECT content INTO original_message_content FROM public.messages
        WHERE id = NEW.reply_to_message_id AND deleted_at IS NULL;

        IF FOUND THEN
            -- Truncate and set the replied_message_preview
            truncated_content := truncate_content(original_message_content);
            NEW.replied_message_preview := truncated_content;
        ELSE
            -- Original message does not exist or has been deleted
            NEW.replied_message_preview := 'The original message is not available.';
        END IF;
    END IF;

    -- Proceed with the insert operation
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION set_replied_message_preview() IS 'Sets the preview content for replied messages by truncating the original message content.';

-- Trigger: set_reply_message_preview
DROP TRIGGER IF EXISTS set_reply_message_preview ON public.messages;
CREATE TRIGGER set_reply_message_preview
BEFORE INSERT ON public.messages
FOR EACH ROW
EXECUTE FUNCTION set_replied_message_preview();

COMMENT ON TRIGGER set_reply_message_preview ON public.messages IS 'Sets the replied_message_preview field when a new reply message is created.';

-- Appends the new reply id into the parent's metadata.replied[] so the
-- parent row carries an inline list of replies for the UI.
CREATE OR REPLACE FUNCTION update_original_message_metadata()
RETURNS TRIGGER AS $$
DECLARE
    current_metadata JSONB;
BEGIN
    -- Only proceed if this message is a reply
    IF NEW.reply_to_message_id IS NOT NULL THEN
        -- Generate a new ID if not provided
        IF NEW.id IS NULL THEN
            NEW.id := uuid_generate_v4();
        END IF;

        -- Retrieve the current metadata of the original message, only if not deleted
        SELECT metadata INTO current_metadata FROM public.messages
        WHERE id = NEW.reply_to_message_id AND deleted_at IS NULL;

        IF FOUND THEN
            -- Initialize metadata if null
            IF current_metadata IS NULL THEN
                current_metadata := '{}'::jsonb;
            END IF;

            -- Check if the 'replied' key exists, if not initialize it as an empty array
            IF NOT (current_metadata ? 'replied') THEN
                current_metadata := current_metadata || jsonb_build_object('replied', '[]'::jsonb);
            END IF;

            -- Append the new message ID to the 'replied' array
            current_metadata := jsonb_set(
                current_metadata,
                '{replied}',
                (current_metadata->'replied') || to_jsonb(NEW.id::text)
            );

            -- Update the original message's metadata
            UPDATE public.messages
            SET metadata = current_metadata
            WHERE id = NEW.reply_to_message_id;
        END IF;
    END IF;

    -- Proceed with the insert operation
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION update_original_message_metadata() IS 'Updates the metadata of the original message to track reply message IDs.';

-- Trigger: track_message_replies
DROP TRIGGER IF EXISTS track_message_replies ON public.messages;
CREATE TRIGGER track_message_replies
BEFORE INSERT ON public.messages
FOR EACH ROW
EXECUTE FUNCTION update_original_message_metadata();

COMMENT ON TRIGGER track_message_replies ON public.messages IS 'Updates the original message metadata to track reply message IDs.';

-- Bumps last_message_preview / last_activity_at on the channel so the
-- sidebar can sort and preview without scanning messages.
CREATE OR REPLACE FUNCTION update_channel_preview_on_new_message() RETURNS TRIGGER AS $$
DECLARE
    truncated_content TEXT;
BEGIN
    truncated_content := truncate_content(NEW.content);

    IF EXISTS (SELECT 1 FROM public.channels WHERE id = NEW.channel_id) THEN
        UPDATE public.channels
        SET last_message_preview = truncated_content,
            last_activity_at = timezone('utc', now())
        WHERE id = NEW.channel_id;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION update_channel_preview_on_new_message() IS 'Updates the last message preview in a channel when a new message is inserted.';

-- Trigger: update_channel_preview
DROP TRIGGER IF EXISTS update_channel_preview ON public.messages;
CREATE TRIGGER update_channel_preview
AFTER INSERT ON public.messages
FOR EACH ROW
EXECUTE FUNCTION update_channel_preview_on_new_message();

COMMENT ON TRIGGER update_channel_preview ON public.messages IS 'Updates the channel preview when a new message is posted.';


-- ============================================================
-- Hardening: pin search_path = public on functions defined above
-- (idempotent — safe to re-run)
-- ============================================================
ALTER FUNCTION public.set_replied_message_preview() SET search_path = public;
ALTER FUNCTION public.update_original_message_metadata() SET search_path = public;
ALTER FUNCTION public.update_channel_preview_on_new_message() SET search_path = public;

-- Trigger functions run as postgres (DEFINER) so internal side effects
-- (counters, previews, notifications) bypass RLS on side-effect tables.
-- search_path is already pinned above; flipping security mode is safe.
ALTER FUNCTION public.set_replied_message_preview() SECURITY DEFINER;
ALTER FUNCTION public.update_original_message_metadata() SECURITY DEFINER;
ALTER FUNCTION public.update_channel_preview_on_new_message() SECURITY DEFINER;


-- ============================================================================
-- File: 10-7-func-pinned.sql
-- ============================================================================

/*
 * Pinned Message Functions
 * This file contains functions and triggers related to pinned messages:
 * - Message pinning and unpinning
 * - Message metadata updates for pinned status
 * - Channel activity tracking for pin actions
 */

/**
 * Function: update_message_on_pin
 * Description: Updates message metadata when a message is pinned
 * Trigger: Executes before INSERT on public.pinned_messages
 * Action: Sets pinned=true in message metadata and truncates content for pin record
 * Returns: The modified NEW record
 */
create or replace function update_message_on_pin()
returns trigger as $$
declare
    current_metadata jsonb;
    message_content text;
begin
    -- Retrieve current metadata and content from the messages table for the given message_id
    select metadata, content into current_metadata, message_content
    from public.messages
    where id = new.message_id and deleted_at is null;

    -- Check if the message exists and is not deleted
    if not found then
        raise exception 'Cannot pin message: Message with id % does not exist or has been deleted.', new.message_id;
    end if;

    -- Initialize metadata if null
    if current_metadata is null then
        current_metadata := '{}'::jsonb;
    end if;

    -- Set pinned status to true in metadata
    current_metadata := jsonb_set(current_metadata, '{pinned}', 'true');

    -- Update the message metadata
    update public.messages
    set metadata = current_metadata
    where id = new.message_id;

    -- Set the truncated content in the pinned message record
    new.content := truncate_content(message_content);

    return new;
end;
$$ language plpgsql;

comment on function update_message_on_pin() is
'Updates message metadata when a message is pinned and creates a truncated content preview.';

-- Trigger: set_message_pinned_status
create trigger set_message_pinned_status
before insert on public.pinned_messages
for each row
execute function update_message_on_pin();

comment on trigger set_message_pinned_status on public.pinned_messages is
'Sets pinned status and prepares content preview when a message is pinned.';

/**
 * Function: update_message_on_unpin
 * Description: Updates message metadata when a pinned message is unpinned
 * Trigger: Executes after DELETE on public.pinned_messages
 * Action: Sets pinned=false in message metadata
 * Returns: The OLD record
 */
create or replace function update_message_on_unpin()
returns trigger as $$
declare
    current_metadata jsonb;
begin
    -- Retrieve current metadata from the messages table for the given message_id
    select metadata into current_metadata
    from public.messages
    where id = old.message_id;

    -- Check if the message exists
    if not found then
        -- Message does not exist; nothing to update
        return old;
    end if;

    -- Initialize metadata if null
    if current_metadata is null then
        current_metadata := '{}'::jsonb;
    end if;

    -- Set pinned status to false in metadata
    current_metadata := jsonb_set(current_metadata, '{pinned}', 'false');

    -- Update the message metadata
    update public.messages
    set metadata = current_metadata
    where id = old.message_id;

    return old;
end;
$$ language plpgsql;

comment on function update_message_on_unpin() is
'Updates message metadata when a pinned message is unpinned by setting pinned=false.';

-- Trigger: clear_message_pinned_status
create trigger clear_message_pinned_status
after delete on public.pinned_messages
for each row
execute function update_message_on_unpin();

comment on trigger clear_message_pinned_status on public.pinned_messages is
'Clears pinned status in message metadata when a message is unpinned.';

/**
 * Function: update_channel_activity_on_pin
 * Description: Updates channel last_activity_at when a message is pinned
 * Trigger: Executes after INSERT on public.pinned_messages
 * Action: Updates the channel's last_activity_at timestamp
 * Returns: The NEW record
 */
create or replace function update_channel_activity_on_pin()
returns trigger as $$
begin
    -- Update the last_activity_at timestamp of the channel where the message is pinned
    if exists (select 1 from public.channels where id = new.channel_id) then
        update public.channels
        set last_activity_at = timezone('utc', now())
        where id = new.channel_id;
    end if;

    return new;
end;
$$ language plpgsql;

comment on function update_channel_activity_on_pin() is
'Updates the channel last activity timestamp when a message is pinned.';

-- Trigger: track_channel_activity_on_pin
create trigger track_channel_activity_on_pin
after insert on public.pinned_messages
for each row
execute function update_channel_activity_on_pin();

comment on trigger track_channel_activity_on_pin on public.pinned_messages is
'Tracks channel activity by updating last_activity_at when a message is pinned.';

-- ============================================================
-- Hardening: pin search_path = public on functions defined above
-- (idempotent — safe to re-run)
-- ============================================================
ALTER FUNCTION public.update_message_on_pin() SET search_path = public;
ALTER FUNCTION public.update_message_on_unpin() SET search_path = public;
ALTER FUNCTION public.update_channel_activity_on_pin() SET search_path = public;

-- Trigger functions run as postgres (DEFINER) so internal side effects
-- (counters, previews, notifications) bypass RLS on side-effect tables.
-- search_path is already pinned above; flipping security mode is safe.
ALTER FUNCTION public.update_message_on_pin() SECURITY DEFINER;
ALTER FUNCTION public.update_message_on_unpin() SECURITY DEFINER;
ALTER FUNCTION public.update_channel_activity_on_pin() SECURITY DEFINER;


-- ============================================================================
-- File: 10-8-func-workspace_members.sql
-- ============================================================================

-- Posts a synthetic notification message into the workspace's channel
-- when a new member joins, so the chat shows a "joined" line.
create or replace function notify_user_join_workspace()
returns trigger as $$
declare
    joining_username text;
    workspace_name text;
    workspace_channel_id varchar(36);
begin
    -- Get the username of the joining member
    select username into joining_username
    from public.users
    where id = new.member_id;

    -- Get the workspace name
    select name into workspace_name
    from public.workspaces
    where id = new.workspace_id;

    -- Check if channel exists for this workspace
    select id into workspace_channel_id
    from public.channels
    where id = new.workspace_id
    limit 1;

    -- If no channel exists, create one
    if workspace_channel_id is null then
        insert into public.channels (
            id,
            workspace_id,
            slug,
            name,
            created_by,
            description,
            type
        ) values (
            new.workspace_id,
            new.workspace_id,
            'c' || regexp_replace(lower(new.workspace_id), '[^a-z0-9]', '', 'g'),
            regexp_replace(lower(new.workspace_id), '[^a-z0-9]', '', 'g'),
            '992bb85e-78f8-4747-981a-fd63d9317ff1', -- System user ID
            'Main workspace channel',
            'PUBLIC'
        ) returning id into workspace_channel_id;
    end if;

    -- Create the notification message
    insert into public.messages (
        user_id,
        channel_id,
        type,
        content,
        metadata
    )
    values (
        new.member_id,
        workspace_channel_id,
        'notification',
        '@' || joining_username || ' joined the workspace ',
        jsonb_build_object(
            'type', 'user_join_workspace',
            'user_name', joining_username,
            'user_id', new.member_id,
            'workspace_name', workspace_name
        )
    );

    return new;
end;
$$ language plpgsql;

comment on function notify_user_join_workspace() is
'Creates a notification message when a user joins a workspace.';

-- Trigger: notify_on_workspace_join
drop trigger if exists notify_on_workspace_join on public.workspace_members;
create trigger notify_on_workspace_join
after insert on public.workspace_members
for each row
execute function notify_user_join_workspace();

comment on trigger notify_on_workspace_join on public.workspace_members is
'Creates a notification when a user joins a workspace.';


-- =============================================================================
-- Admin: document member counts (used by admin dashboard)
-- =============================================================================

-- Returns workspace member counts for a batch of document slugs.
-- SECURITY DEFINER bypasses RLS; guarded by is_admin() for authenticated
-- callers and allows service_role (backend) direct access.

create or replace function public.admin_get_document_member_counts(p_slugs text[])
returns table (
    slug text,
    member_count bigint
)
language plpgsql
security definer
set search_path = public
as $$
declare
    v_jwt_role text;
begin
    -- Allow: service_role (backend API) or authenticated admin
    v_jwt_role := coalesce(current_setting('request.jwt.claim.role', true), '');

    if v_jwt_role not in ('service_role') then
        if auth.uid() is not null and not public.is_admin(auth.uid()) then
            raise exception 'Access denied: user is not an admin.';
        end if;
    end if;

    return query
    select
        w.slug,
        count(wm.id) as member_count
    from public.workspaces w
    left join public.workspace_members wm
        on wm.workspace_id = w.id
        and wm.left_at is null
    where w.slug = any(p_slugs)
    group by w.slug;
end;
$$;

comment on function public.admin_get_document_member_counts(text[]) is
'Returns workspace member counts per document slug. Admin-only or service_role, bypasses RLS.';

revoke execute on function public.admin_get_document_member_counts(text[]) from anon;
grant execute on function public.admin_get_document_member_counts(text[]) to authenticated;
grant execute on function public.admin_get_document_member_counts(text[]) to service_role;

-- ============================================================
-- Hardening: pin search_path = public on functions defined above
-- (idempotent — safe to re-run)
-- ============================================================
ALTER FUNCTION public.notify_user_join_workspace() SET search_path = public;
ALTER FUNCTION public.admin_get_document_member_counts(p_slugs text[]) SET search_path = public;

-- Trigger functions run as postgres (DEFINER) so internal side effects
-- (counters, previews, notifications) bypass RLS on side-effect tables.
-- search_path is already pinned above; flipping security mode is safe.
ALTER FUNCTION public.notify_user_join_workspace() SECURITY DEFINER;


-- ============================================================================
-- File: 10-func-notifications.sql
-- ============================================================================

-- Fan-out triggers for message-driven notifications (mentions, @everyone,
-- replies, reactions, regular sends) and unread-count maintenance.

-- Fans out one notification per channel member mentioned by @username.
CREATE OR REPLACE FUNCTION create_mention_notifications()
RETURNS TRIGGER AS $$
DECLARE
    mentioned_user_id UUID;
    is_channel_muted BOOLEAN;
    truncated_content TEXT;
BEGIN
    -- 1) Check if the channel exists and notifications are not globally muted on the channel
    SELECT mute_in_app_notifications
      INTO is_channel_muted
      FROM public.channels
     WHERE id = NEW.channel_id;

    IF NOT FOUND THEN
        -- Channel does not exist
        RETURN NEW;
    END IF;

    IF is_channel_muted THEN
        -- Channel-level mute is enabled, no notifications
        RETURN NEW;
    END IF;

    -- 2) Verify that the sender exists (and is not deleted)
    IF NOT EXISTS (
        SELECT 1
          FROM public.users
         WHERE id = NEW.user_id
    ) THEN
        -- Sender does not exist
        RETURN NEW;
    END IF;

    -- 3) Truncate message content for preview
    truncated_content := truncate_content(NEW.content);

    -- 4) For each mentioned username, attempt to create a notification.
    --    Anchored regex prevents `@al` from matching `alice`/`alpha`.
    --    Usernames are validated as `^[a-z][a-z0-9_-]{2,29}$` at the
    --    table level, so concatenating into the pattern is safe.
    FOR mentioned_user_id IN
        SELECT u.id
          FROM public.users u
         WHERE NEW.content ~ ('(^|[^a-z0-9_-])@' || u.username || '($|[^a-z0-9_-])')
    LOOP
        -- Check membership in the channel AND notification settings
        IF EXISTS (
            SELECT 1
              FROM public.channel_members
             WHERE channel_id = NEW.channel_id
               AND member_id  = mentioned_user_id
               AND mute_in_app_notifications = false
               AND notif_state != 'MUTED'
        ) THEN
            -- Insert the mention notification
            INSERT INTO public.notifications (
                receiver_user_id,
                sender_user_id,
                type,
                message_id,
                channel_id,
                message_preview,
                created_at
            )
            VALUES (
                mentioned_user_id,
                NEW.user_id,
                'mention',
                NEW.id,
                NEW.channel_id,
                truncated_content,
                timezone('utc', now())
            );
        END IF;
    END LOOP;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION create_mention_notifications() IS 'Creates notifications for users who are mentioned with @username in a message.';

-- Trigger: create_mention_notifications
CREATE TRIGGER create_mention_notifications
AFTER INSERT ON public.messages
FOR EACH ROW
WHEN (NEW.content LIKE '%@%')
EXECUTE FUNCTION create_mention_notifications();

COMMENT ON TRIGGER create_mention_notifications ON public.messages IS 'Creates notifications for users mentioned with @username in a message.';

-- Replies are high-signal: always notify the original author unless the
-- channel is muted, regardless of notif_state.
CREATE OR REPLACE FUNCTION create_reply_notification()
RETURNS TRIGGER AS $$
DECLARE
    original_message RECORD;
    truncated_content TEXT;
BEGIN
    -- Only process if this is a reply
    IF NEW.reply_to_message_id IS NULL THEN
        RETURN NEW;
    END IF;

    -- Get the original message and channel info
    SELECT m.user_id, m.channel_id, c.mute_in_app_notifications
    INTO original_message
    FROM public.messages m
    JOIN public.channels c ON c.id = m.channel_id
    WHERE m.id = NEW.reply_to_message_id;

    IF NOT FOUND THEN
        RETURN NEW;
    END IF;

    -- Skip if channel is globally muted
    IF original_message.mute_in_app_notifications THEN
        RETURN NEW;
    END IF;

    -- Skip if replying to own message
    IF original_message.user_id = NEW.user_id THEN
        RETURN NEW;
    END IF;

    -- Skip if user has muted this channel
    IF EXISTS (
        SELECT 1 FROM public.channel_members
        WHERE channel_id = NEW.channel_id
          AND member_id = original_message.user_id
          AND mute_in_app_notifications = TRUE
    ) THEN
        RETURN NEW;
    END IF;

    -- Truncate content for preview
    truncated_content := CASE
        WHEN length(NEW.content) > 100 THEN substring(NEW.content, 1, 100) || '...'
        ELSE NEW.content
    END;

    -- Create the reply notification
    INSERT INTO public.notifications (
        receiver_user_id,
        sender_user_id,
        type,
        message_id,
        channel_id,
        message_preview,
        created_at
    ) VALUES (
        original_message.user_id,
        NEW.user_id,
        'reply'::notification_category,
        NEW.id,
        NEW.channel_id,
        truncated_content,
        timezone('utc', now())
    );

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION create_reply_notification() IS
'Creates notification for original message author when someone replies. Always notifies regardless of notif_state.';

-- Trigger: create_reply_notification
DROP TRIGGER IF EXISTS create_reply_notification ON public.messages;
CREATE TRIGGER create_reply_notification
AFTER INSERT ON public.messages
FOR EACH ROW
WHEN (NEW.reply_to_message_id IS NOT NULL)
EXECUTE FUNCTION create_reply_notification();

COMMENT ON TRIGGER create_reply_notification ON public.messages IS
'Notifies the original message author when someone replies to their message.';

-- Fans out @everyone to every non-sender channel member that hasn't muted.
CREATE OR REPLACE FUNCTION create_everyone_notifications()
RETURNS TRIGGER AS $$
DECLARE
    channel_member_id UUID;
    is_channel_muted  BOOLEAN;
    truncated_content TEXT;
BEGIN
    -- 1) Check if the channel exists and if it's globally muted
    SELECT mute_in_app_notifications
      INTO is_channel_muted
      FROM public.channels
     WHERE id = NEW.channel_id;

    IF NOT FOUND OR is_channel_muted THEN
        RETURN NEW; -- Channel either doesn't exist or is muted globally
    END IF;

    -- 2) Verify the sender exists
    IF NOT EXISTS (
        SELECT 1
          FROM public.users
         WHERE id = NEW.user_id
    ) THEN
        RETURN NEW; -- Sender doesn't exist or is deleted
    END IF;

    -- 3) Truncate message content for preview
    truncated_content := truncate_content(NEW.content);

    -- 4) Check for an actual @everyone token (not a substring inside
    --    something like `@everyone_team`).
    IF NEW.content ~ '(^|[^a-z0-9_-])@everyone($|[^a-z0-9_-])' THEN
        -- 5) Loop over channel members (excluding sender) who have not muted notifications
        FOR channel_member_id IN
            SELECT cm.member_id
              FROM public.channel_members cm
             WHERE cm.channel_id = NEW.channel_id
               AND cm.member_id != NEW.user_id
               AND cm.mute_in_app_notifications = false
               AND cm.notif_state != 'MUTED'
        LOOP
            -- Insert the notification for each eligible member
            INSERT INTO public.notifications (
                receiver_user_id,
                sender_user_id,
                type,
                message_id,
                channel_id,
                message_preview,
                created_at
            )
            VALUES (
                channel_member_id,
                NEW.user_id,
                'channel_event',
                NEW.id,
                NEW.channel_id,
                truncated_content,
                timezone('utc', now())
            );
        END LOOP;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION create_everyone_notifications() IS 'Creates notifications for all channel members when @everyone is used in a message.';

-- Trigger: create_everyone_notifications
-- Tokenised match — must mirror the IF inside the function body.
DROP TRIGGER IF EXISTS create_everyone_notifications ON public.messages;
CREATE TRIGGER create_everyone_notifications
AFTER INSERT ON public.messages
FOR EACH ROW
WHEN (NEW.content ~ '(^|[^a-z0-9_-])@everyone($|[^a-z0-9_-])')
EXECUTE FUNCTION create_everyone_notifications();

COMMENT ON TRIGGER create_everyone_notifications ON public.messages IS 'Creates notifications for all channel members when @everyone is used.';

-- Notifies offline, ALL-state, non-muted channel members for plain (no
-- mention / no @everyone) messages. Trigger predicate filters the rest.
CREATE OR REPLACE FUNCTION create_regular_message_notifications()
RETURNS TRIGGER AS $$
DECLARE
    is_channel_muted  BOOLEAN;
    truncated_content TEXT;
BEGIN
    -- 1) Check if the channel exists and if it's globally muted
    SELECT mute_in_app_notifications
      INTO is_channel_muted
      FROM public.channels
     WHERE id = NEW.channel_id;

    IF NOT FOUND OR is_channel_muted THEN
        RETURN NEW; -- Channel doesn't exist or is globally muted
    END IF;

    -- 2) Verify the sender still exists
    IF NOT EXISTS (
        SELECT 1
          FROM public.users
         WHERE id = NEW.user_id
    ) THEN
        RETURN NEW; -- Sender doesn't exist or is deleted
    END IF;

    -- 3) Truncate message content for preview
    truncated_content := truncate_content(NEW.content);

    -- 4) Create notifications only for members whose notif_state = 'ALL' and who are not online or the sender
    INSERT INTO public.notifications (
        receiver_user_id,
        sender_user_id,
        type,
        message_id,
        channel_id,
        message_preview,
        created_at
    )
    -- Reply notifications for the original-message author are emitted by
    -- create_reply_notification; do not duplicate the row here.
    SELECT
        cm.member_id,
        NEW.user_id,
        'message'::notification_category,
        NEW.id,
        NEW.channel_id,
        truncated_content,
        timezone('utc', now())
    FROM public.channel_members cm
    JOIN public.users u ON u.id = cm.member_id
    WHERE cm.channel_id = NEW.channel_id
      AND cm.member_id  != NEW.user_id
      AND (u.status IS NULL OR u.status != 'ONLINE')
      AND cm.mute_in_app_notifications = FALSE
      AND cm.notif_state = 'ALL';

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION create_regular_message_notifications() IS 'Creates notifications for regular messages based on user notification preferences.';

-- Trigger: create_regular_message_notifications
-- Fire only on messages that contain NO @user mention and NO @everyone.
-- Original predicate `(... NOT LIKE '%@%' OR ... NOT LIKE '%@everyone%')`
-- is true for nearly every string containing '@' (any @user that isn't
-- exactly @everyone) and produced duplicate inbox rows alongside the
-- mention/reply/everyone notification creators. Use a regex that matches
-- either pattern and negate with `!~`.
CREATE TRIGGER create_regular_message_notifications
AFTER INSERT ON public.messages
FOR EACH ROW
WHEN (NEW.content !~ '@[A-Za-z0-9_]+|@everyone')
EXECUTE FUNCTION create_regular_message_notifications();

COMMENT ON TRIGGER create_regular_message_notifications ON public.messages IS 'Creates notifications for regular messages that contain no @mention and no @everyone.';

-- Reactions are high-signal: always notify the message owner per new
-- reaction entry, regardless of notif_state. Channel mute still applies.
CREATE OR REPLACE FUNCTION create_reaction_notifications()
RETURNS TRIGGER AS $$
DECLARE
    old_reactions     JSONB;
    new_reactions     JSONB;
    reaction_key      TEXT;
    new_reaction      JSONB;
    sender_user_id    UUID;
    is_channel_muted  BOOLEAN;
    is_user_muted     BOOLEAN;
BEGIN
    -- 1) Check if the channel is globally muted
    SELECT mute_in_app_notifications
      INTO is_channel_muted
      FROM public.channels
     WHERE id = NEW.channel_id;

    IF NOT FOUND OR is_channel_muted THEN
        RETURN NEW;
    END IF;

    -- 2) Verify the message owner exists
    IF NOT EXISTS (
        SELECT 1 FROM public.users WHERE id = OLD.user_id
    ) THEN
        RETURN NEW;
    END IF;

    -- 3) Check if user has muted this channel (ignore notif_state for reactions)
    SELECT cm.mute_in_app_notifications
      INTO is_user_muted
      FROM public.channel_members cm
     WHERE cm.channel_id = NEW.channel_id
       AND cm.member_id = OLD.user_id;

    IF is_user_muted THEN
        RETURN NEW;
    END IF;

    -- 4) Compare old and new reactions
    old_reactions := COALESCE(OLD.reactions, '{}'::jsonb);
    new_reactions := NEW.reactions;

    -- 5) Loop through each reaction type
    FOR reaction_key IN
        SELECT jsonb_object_keys(new_reactions)
    LOOP
        FOR new_reaction IN
            SELECT jsonb_array_elements(new_reactions -> reaction_key)
        LOOP
            sender_user_id := (new_reaction ->> 'user_id')::UUID;

            -- Skip if reacting to own message
            IF sender_user_id = OLD.user_id THEN
                CONTINUE;
            END IF;

            -- Skip if reaction already existed
            IF (old_reactions ? reaction_key)
               AND (old_reactions -> reaction_key) @> jsonb_build_array(new_reaction)
            THEN
                CONTINUE;
            END IF;

            -- Verify sender exists and create notification
            IF EXISTS (SELECT 1 FROM public.users WHERE id = sender_user_id) THEN
                INSERT INTO public.notifications (
                    receiver_user_id,
                    sender_user_id,
                    type,
                    message_id,
                    channel_id,
                    message_preview,
                    created_at
                ) VALUES (
                    OLD.user_id,
                    sender_user_id,
                    'reaction'::notification_category,
                    NEW.id,
                    NEW.channel_id,
                    reaction_key,  -- Store the emoji
                    timezone('utc', now())
                );
            END IF;
        END LOOP;
    END LOOP;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION create_reaction_notifications() IS
'Creates notification when someone reacts to your message. Always notifies regardless of notif_state.';

-- Trigger: create_reaction_notifications
CREATE TRIGGER create_reaction_notifications
AFTER UPDATE OF reactions ON public.messages
FOR EACH ROW
WHEN (OLD.reactions IS DISTINCT FROM NEW.reactions)
EXECUTE FUNCTION create_reaction_notifications();

COMMENT ON TRIGGER create_reaction_notifications ON public.messages IS 'Creates notifications when a message receives new reactions.';

-- Bumps unread_message_count for every workspace member (creating their
-- channel_members row if missing) except the sender, so unread badges
-- include people who never explicitly joined the channel.
CREATE OR REPLACE FUNCTION increment_unread_count_on_new_message() RETURNS TRIGGER AS $$
DECLARE
    workspace_id_var VARCHAR(36);
BEGIN
    -- Skip if message type is notification
    IF NEW.type = 'notification' THEN
        RETURN NEW;
    END IF;

    -- Get the workspace ID for the channel where the message was posted
    SELECT workspace_id INTO workspace_id_var
    FROM public.channels
    WHERE id = NEW.channel_id;

    -- If channel doesn't exist or has no workspace, exit early
    IF workspace_id_var IS NULL THEN
        RETURN NEW;
    END IF;

    -- First, ensure all workspace members have a channel_members entry
    -- If they don't, create one with unread_message_count = 1
    INSERT INTO public.channel_members (channel_id, member_id, unread_message_count, last_read_update_at)
    SELECT
        NEW.channel_id,
        wm.member_id,
        1,
        COALESCE((SELECT created_at FROM public.messages
                 WHERE channel_id = NEW.channel_id
                 ORDER BY created_at DESC
                 LIMIT 1 OFFSET 1),
                 timezone('utc', now()) - interval '1 second')
    FROM public.workspace_members wm
    WHERE wm.workspace_id = workspace_id_var
      AND wm.left_at IS NULL
      AND wm.member_id != NEW.user_id
      AND NOT EXISTS (
          SELECT 1
          FROM public.channel_members cm
          WHERE cm.channel_id = NEW.channel_id
            AND cm.member_id = wm.member_id
      )
    ON CONFLICT (channel_id, member_id) DO NOTHING;

    -- Then, increment unread message count for all existing channel members
    -- who are also active workspace members (excluding the sender)
    UPDATE public.channel_members cm
    SET unread_message_count = unread_message_count + 1
    FROM public.workspace_members wm
    WHERE cm.channel_id = NEW.channel_id
      AND cm.member_id != NEW.user_id
      AND wm.workspace_id = workspace_id_var
      AND wm.member_id = cm.member_id
      AND wm.left_at IS NULL
      AND cm.last_read_update_at < NEW.created_at;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION increment_unread_count_on_new_message() IS 'Increments unread message count for ALL workspace members (even non-channel members) upon insertion of a new message.';

-- Trigger: increment_unread_count
CREATE TRIGGER increment_unread_count
AFTER INSERT ON public.messages
FOR EACH ROW
EXECUTE FUNCTION increment_unread_count_on_new_message();

COMMENT ON TRIGGER increment_unread_count ON public.messages IS 'Increments the unread message count for all workspace members when a new message is posted.';

/**
 * DEPRECATED: update_unread_count_on_message_delete
 *
 * This function and its triggers have been removed.
 * Unread count decrements are now handled in handle_message_soft_delete()
 * in 10-3-func-message.sql, which decrements counts BEFORE deleting
 * notifications to ensure we know exactly which users to update.
 *
 * See: handle_message_soft_delete() in 10-3-func-message.sql
 */

-- Drop the old triggers (if they exist)
DROP TRIGGER IF EXISTS update_unread_count_on_soft_delete ON public.messages;
DROP TRIGGER IF EXISTS update_unread_count_on_hard_delete ON public.messages;

-- Drop the old function (if it exists)
DROP FUNCTION IF EXISTS update_unread_count_on_message_delete();

-- ============================================================
-- Hardening: pin search_path = public on functions defined above
-- (idempotent — safe to re-run)
-- ============================================================
ALTER FUNCTION public.create_mention_notifications() SET search_path = public;
ALTER FUNCTION public.create_reply_notification() SET search_path = public;
ALTER FUNCTION public.create_everyone_notifications() SET search_path = public;
ALTER FUNCTION public.create_regular_message_notifications() SET search_path = public;
ALTER FUNCTION public.create_reaction_notifications() SET search_path = public;
ALTER FUNCTION public.increment_unread_count_on_new_message() SET search_path = public;

-- Trigger functions run as postgres (DEFINER) so internal side effects
-- (counters, previews, notifications) bypass RLS on side-effect tables.
-- search_path is already pinned above; flipping security mode is safe.
ALTER FUNCTION public.create_mention_notifications() SECURITY DEFINER;
ALTER FUNCTION public.create_reply_notification() SECURITY DEFINER;
ALTER FUNCTION public.create_everyone_notifications() SECURITY DEFINER;
ALTER FUNCTION public.create_regular_message_notifications() SECURITY DEFINER;
ALTER FUNCTION public.create_reaction_notifications() SECURITY DEFINER;
ALTER FUNCTION public.increment_unread_count_on_new_message() SECURITY DEFINER;


-- ============================================================================
-- File: 10-functions.sql
-- ============================================================================

-- Test
-- SELECT * FROM get_channel_aggregate_data('99634205-5238-4ffc-90ec-c64be3ad25cf');

-- Helper function to get standardized user details as JSON
CREATE OR REPLACE FUNCTION user_details_json(u public.users)
RETURNS JSONB AS $$
BEGIN
  RETURN json_build_object(
    'id', u.id,
    'username', u.username,
    'fullname', u.full_name,
    'avatar_url', u.avatar_url,
    'avatar_updated_at', u.avatar_updated_at
  );
END;
$$ LANGUAGE plpgsql IMMUTABLE;

COMMENT ON FUNCTION user_details_json(public.users) IS
'Returns a standardized JSON object with user details. Immutable function
for consistent user representation across different contexts.';

-- Drop the existing function first to allow changing the return type
DROP FUNCTION IF EXISTS get_channel_aggregate_data(VARCHAR(36), INT, UUID);

CREATE OR REPLACE FUNCTION get_channel_aggregate_data(
    input_channel_id VARCHAR(36),
    message_limit INT DEFAULT 20,
    anchor_message_id UUID DEFAULT NULL
)
RETURNS TABLE(
    channel_info JSONB,
    last_messages JSONB,
    pinned_messages JSONB,
    is_user_channel_member BOOLEAN,
    channel_member_info JSONB,
    total_messages_since_last_read INT,
    unread_message BOOLEAN,
    last_read_message_id UUID,
    last_read_message_timestamp TIMESTAMP WITH TIME ZONE,
    last_read_seq BIGINT,
    anchor_message_timestamp TIMESTAMP WITH TIME ZONE,
    older_cursor TIMESTAMP WITH TIME ZONE,
    newer_cursor TIMESTAMP WITH TIME ZONE,
    has_more_older BOOLEAN,
    has_more_newer BOOLEAN,
    peer_max_read_seq BIGINT
) AS $$
DECLARE
    channel_result JSONB;
    messages_result JSONB;
    pinned_result JSONB;
    is_member_result BOOLEAN;
    channel_member_info_result JSONB;
    total_messages_since_last_read INT;
    last_read_message_id UUID;
    last_read_message_timestamp TIMESTAMP WITH TIME ZONE;
    last_read_seq_result BIGINT;
    unread_message BOOLEAN := FALSE;
    anchor_message_timestamp TIMESTAMP WITH TIME ZONE;
    resolved_anchor_id UUID;
    before_n INT;
    after_n INT;
    older_cursor_result TIMESTAMP WITH TIME ZONE;
    newer_cursor_result TIMESTAMP WITH TIME ZONE;
    has_more_older_result BOOLEAN := FALSE;
    has_more_newer_result BOOLEAN := FALSE;
    peer_max_read_seq_result BIGINT;
BEGIN
    -- Check if the channel exists and is not deleted
    SELECT json_build_object(
               'id', c.id,
               'slug', c.slug,
               'name', c.name,
               'created_by', c.created_by,
               'description', c.description,
               'member_limit', c.member_limit,
               'is_avatar_set', c.is_avatar_set,
               'allow_emoji_reactions', c.allow_emoji_reactions,
               'mute_in_app_notifications', c.mute_in_app_notifications,
               'type', c.type,
               'member_count', c.member_count,
               'metadata', c.metadata
           ) INTO channel_result
    FROM public.channels c
    WHERE c.id = input_channel_id AND c.deleted_at IS NULL;

    -- Empty-room signal: a chatroom is heading-keyed and is created
    -- lazily by the first authenticated chatter. Anonymous visitors and
    -- authenticated visitors who land before any author has chatted in
    -- this heading hit the missing-channel case. Treat it as a normal
    -- empty state, not an error: return one row with channel_info NULL
    -- so the FE wrapper's `.single()` succeeds and the caller can render
    -- the "no messages yet" view instead of the failure badge.
    IF channel_result IS NULL THEN
        RETURN QUERY SELECT
            NULL::JSONB                       AS channel_info,
            '[]'::JSONB                       AS last_messages,
            '[]'::JSONB                       AS pinned_messages,
            FALSE                             AS is_user_channel_member,
            NULL::JSONB                       AS channel_member_info,
            0                                 AS total_messages_since_last_read,
            FALSE                             AS unread_message,
            NULL::UUID                        AS last_read_message_id,
            NULL::TIMESTAMP WITH TIME ZONE    AS last_read_message_timestamp,
            NULL::BIGINT                      AS last_read_seq,
            NULL::TIMESTAMP WITH TIME ZONE    AS anchor_message_timestamp,
            NULL::TIMESTAMP WITH TIME ZONE    AS older_cursor,
            NULL::TIMESTAMP WITH TIME ZONE    AS newer_cursor,
            FALSE                             AS has_more_older,
            FALSE                             AS has_more_newer,
            NULL::BIGINT                      AS peer_max_read_seq;
        RETURN;
    END IF;

    -- Authorization: PUBLIC channels are readable by anyone; everything
    -- else requires explicit channel membership. Without this gate, the
    -- function streams full message history + sender PII to anyone who
    -- learns a channel id (the schema currently has no live RLS on
    -- `messages` / `channel_members`).
    IF (channel_result->>'type') <> 'PUBLIC'
       AND NOT EXISTS (
           SELECT 1
           FROM public.channel_members cm
           WHERE cm.channel_id = input_channel_id
             AND cm.member_id  = auth.uid()
             AND cm.left_at IS NULL
       )
    THEN
        RAISE EXCEPTION 'Access denied: caller is not a member of channel %.', input_channel_id;
    END IF;

    -- Attempt to get channel member details. v2: include last_read_seq as the
    -- new cursor source; last_read_message_id is kept for deploy-4 cleanup.
    SELECT json_build_object(
            'last_read_message_id', cm.last_read_message_id,
            'last_read_seq', cm.last_read_seq,
            'last_read_update_at', cm.last_read_update_at,
            'joined_at', cm.joined_at,
            'left_at', cm.left_at,
            'mute_in_app_notifications', cm.mute_in_app_notifications,
            'channel_member_role', cm.channel_member_role,
            'unread_message_count', cm.unread_message_count
        )
    INTO channel_member_info_result
    FROM public.channel_members cm
    WHERE cm.channel_id = input_channel_id AND cm.member_id = auth.uid();

    -- Set is_member_result based on whether channel_member_info_result is null
    is_member_result := (channel_member_info_result IS NOT NULL);

    -- Bootstrap seed for the sender-side check-mark; later advances
    -- arrive via the `read:advanced` broadcast in advance_read_cursor.
    -- Members only: leaks peer activity (online-status recon) otherwise.
    IF is_member_result THEN
      SELECT MAX(cm.last_read_seq) INTO peer_max_read_seq_result
      FROM public.channel_members cm
      WHERE cm.channel_id = input_channel_id
        AND cm.member_id <> auth.uid()
        AND cm.left_at IS NULL;
    END IF;

    -- Get the last_read_message_id, last_read_seq, and timestamp for the current
    -- user in the channel. last_read_seq is the v2 cursor used by useReadCursor.
    IF is_member_result THEN
        SELECT cm.last_read_message_id, cm.last_read_seq
          INTO last_read_message_id, last_read_seq_result
        FROM public.channel_members cm
        WHERE cm.channel_id = input_channel_id AND cm.member_id = auth.uid();

        -- Get the timestamp of the last read message
        IF last_read_message_id IS NOT NULL THEN
            SELECT created_at INTO last_read_message_timestamp
            FROM public.messages
            WHERE id = last_read_message_id AND deleted_at IS NULL;
        END IF;
    END IF;

    -- Count messages strictly after the last-read cursor (TOC badge / unread line).
    SELECT COUNT(*) INTO total_messages_since_last_read
    FROM public.messages
    WHERE channel_id = input_channel_id
        AND deleted_at IS NULL
        AND created_at > COALESCE(last_read_message_timestamp, 'epoch'::timestamp);

    unread_message := (total_messages_since_last_read > 0);

    -- Initial window anchor: explicit msg_id deep-link, else member last-read row (bounded window — never inflate LIMIT to full unread count).
    resolved_anchor_id := NULL;
    anchor_message_timestamp := NULL;

    IF anchor_message_id IS NOT NULL THEN
        SELECT created_at INTO anchor_message_timestamp
        FROM public.messages
        WHERE id = anchor_message_id AND channel_id = input_channel_id AND deleted_at IS NULL;

        IF anchor_message_timestamp IS NULL THEN
            RAISE EXCEPTION 'Anchor message % does not exist or has been deleted.', anchor_message_id;
        END IF;
        resolved_anchor_id := anchor_message_id;
    ELSIF last_read_message_id IS NOT NULL THEN
        SELECT created_at INTO anchor_message_timestamp
        FROM public.messages
        WHERE id = last_read_message_id AND channel_id = input_channel_id AND deleted_at IS NULL;

        IF anchor_message_timestamp IS NOT NULL THEN
            resolved_anchor_id := last_read_message_id;
        END IF;
    END IF;

    IF resolved_anchor_id IS NULL THEN
        -- Newest tail: anon, non-member PUBLIC read, no last-read row, or deleted last-read message.
        SELECT COALESCE(json_agg(t), '[]'::json) INTO messages_result
        FROM (
            SELECT m.*,
                json_build_object(
                    'id', u.id,
                    'username', u.username,
                    'fullname', u.full_name,
                    'avatar_url', u.avatar_url,
                    'avatar_updated_at', u.avatar_updated_at
                ) AS user_details,
                CASE
                    WHEN m.reply_to_message_id IS NOT NULL THEN
                        (SELECT json_build_object(
                                'message', json_build_object(
                                    'id', rm.id,
                                    'created_at', rm.created_at
                                ),
                                'user', json_build_object(
                                    'id', ru.id,
                                    'username', ru.username,
                                    'fullname', ru.full_name,
                                    'avatar_url', ru.avatar_url,
                                    'avatar_updated_at', ru.avatar_updated_at
                                )
                            )
                         FROM public.messages rm
                         LEFT JOIN public.users ru ON rm.user_id = ru.id
                         WHERE rm.id = m.reply_to_message_id AND rm.deleted_at IS NULL)
                    ELSE NULL
                END AS replied_message_details,
                (mb.id IS NOT NULL AND mb.archived_at IS NULL AND mb.marked_at IS NULL) AS is_bookmarked,
                mb.id AS bookmark_id
            FROM public.messages m
            LEFT JOIN public.users u ON m.user_id = u.id
            LEFT JOIN public.message_bookmarks mb ON m.id = mb.message_id AND mb.user_id = auth.uid()
            WHERE m.channel_id = input_channel_id
                AND m.deleted_at IS NULL
                AND NOT (m.type = 'notification' AND m.metadata->>'type' IN ('user_join_channel', 'channel_created'))
            ORDER BY m.created_at DESC, m.id DESC
            LIMIT message_limit
        ) t;
    ELSE
        -- Implicit last-read (large unread): bias toward newer rows so newer_cursor/has_more_newer match pagination.
        IF anchor_message_id IS NULL AND total_messages_since_last_read > message_limit / 2 THEN
            before_n := GREATEST(message_limit / 5, 1);
            after_n := message_limit - before_n;
        ELSE
            before_n := GREATEST(message_limit / 2, 1);
            after_n := message_limit - before_n;
        END IF;

        WITH messages_before AS (
            -- Get messages before or at the anchor
            SELECT m.*,
                json_build_object(
                    'id', u.id,
                    'username', u.username,
                    'fullname', u.full_name,
                    'avatar_url', u.avatar_url,
                    'avatar_updated_at', u.avatar_updated_at
                ) AS user_details,
                CASE
                    WHEN m.reply_to_message_id IS NOT NULL THEN
                        (SELECT json_build_object(
                                'message', json_build_object(
                                    'id', rm.id,
                                    'created_at', rm.created_at
                                ),
                                'user', json_build_object(
                                    'id', ru.id,
                                    'username', ru.username,
                                    'fullname', ru.full_name,
                                    'avatar_url', ru.avatar_url,
                                    'avatar_updated_at', ru.avatar_updated_at
                                )
                            )
                         FROM public.messages rm
                         LEFT JOIN public.users ru ON rm.user_id = ru.id
                         WHERE rm.id = m.reply_to_message_id AND rm.deleted_at IS NULL)
                    ELSE NULL
                END AS replied_message_details,
                -- Bookmark information
                (mb.id IS NOT NULL AND mb.archived_at IS NULL AND mb.marked_at IS NULL) AS is_bookmarked,
                mb.id AS bookmark_id
            FROM public.messages m
            LEFT JOIN public.users u ON m.user_id = u.id
            LEFT JOIN public.message_bookmarks mb ON m.id = mb.message_id AND mb.user_id = auth.uid()
            WHERE m.channel_id = input_channel_id
                AND m.deleted_at IS NULL
                AND NOT (m.type = 'notification' AND m.metadata->>'type' IN ('user_join_channel', 'channel_created'))
                AND m.created_at <= anchor_message_timestamp
            ORDER BY m.created_at DESC, m.id DESC
            LIMIT before_n
        ),
        messages_after AS (
            -- Get messages after the anchor
            SELECT m.*,
                json_build_object(
                    'id', u.id,
                    'username', u.username,
                    'fullname', u.full_name,
                    'avatar_url', u.avatar_url,
                    'avatar_updated_at', u.avatar_updated_at
                ) AS user_details,
                CASE
                    WHEN m.reply_to_message_id IS NOT NULL THEN
                        (SELECT json_build_object(
                                'message', json_build_object(
                                    'id', rm.id,
                                    'created_at', rm.created_at
                                ),
                                'user', json_build_object(
                                    'id', ru.id,
                                    'username', ru.username,
                                    'fullname', ru.full_name,
                                    'avatar_url', ru.avatar_url,
                                    'avatar_updated_at', ru.avatar_updated_at
                                )
                            )
                         FROM public.messages rm
                         LEFT JOIN public.users ru ON rm.user_id = ru.id
                         WHERE rm.id = m.reply_to_message_id AND rm.deleted_at IS NULL)
                    ELSE NULL
                END AS replied_message_details,
                -- Bookmark information
                (mb.id IS NOT NULL AND mb.archived_at IS NULL AND mb.marked_at IS NULL) AS is_bookmarked,
                mb.id AS bookmark_id
            FROM public.messages m
            LEFT JOIN public.users u ON m.user_id = u.id
            LEFT JOIN public.message_bookmarks mb ON m.id = mb.message_id AND mb.user_id = auth.uid()
            WHERE m.channel_id = input_channel_id
                AND m.deleted_at IS NULL
                AND NOT (m.type = 'notification' AND m.metadata->>'type' IN ('user_join_channel', 'channel_created'))
                AND m.created_at > anchor_message_timestamp
            ORDER BY m.created_at ASC, m.id ASC
            LIMIT after_n
        ),
        combined_messages AS (
            -- Combine the before and after messages
            SELECT * FROM messages_before
            UNION ALL
            SELECT * FROM (SELECT * FROM messages_after ORDER BY created_at DESC) as sorted_after
        )
        SELECT COALESCE(json_agg(cm), '[]'::json) INTO messages_result
        FROM (
            SELECT * FROM combined_messages
            ORDER BY created_at DESC, id DESC
            LIMIT message_limit
        ) cm;
    END IF;

    -- Derive pagination cursors from the materialized messages_result
    SELECT
        MIN((m->>'created_at')::TIMESTAMPTZ),
        MAX((m->>'created_at')::TIMESTAMPTZ)
    INTO older_cursor_result, newer_cursor_result
    FROM jsonb_array_elements(messages_result) AS m;

    IF older_cursor_result IS NOT NULL THEN
        SELECT EXISTS (
            SELECT 1
            FROM public.messages
            WHERE channel_id = input_channel_id
              AND deleted_at IS NULL
              AND NOT (type = 'notification' AND metadata->>'type' IN ('user_join_channel', 'channel_created'))
              AND created_at < older_cursor_result
        ) INTO has_more_older_result;
    END IF;

    IF newer_cursor_result IS NOT NULL THEN
        SELECT EXISTS (
            SELECT 1
            FROM public.messages
            WHERE channel_id = input_channel_id
              AND deleted_at IS NULL
              AND NOT (type = 'notification' AND metadata->>'type' IN ('user_join_channel', 'channel_created'))
              AND created_at > newer_cursor_result
        ) INTO has_more_newer_result;
    END IF;

    -- Query for the pinned messages
    SELECT COALESCE(json_agg(pm), '[]'::json) INTO pinned_result
    FROM public.pinned_messages pm
    JOIN public.messages m ON pm.message_id = m.id
    WHERE pm.channel_id = input_channel_id
      AND m.deleted_at IS NULL;

    -- Return the results including the user data
    RETURN QUERY SELECT
        channel_result,
        messages_result,
        pinned_result,
        is_member_result,
        channel_member_info_result,
        COALESCE(total_messages_since_last_read, 0),
        unread_message,
        last_read_message_id,
        last_read_message_timestamp,
        last_read_seq_result,
        anchor_message_timestamp,
        older_cursor_result,
        newer_cursor_result,
        has_more_older_result,
        has_more_newer_result,
        peer_max_read_seq_result;
END;
$$ LANGUAGE plpgsql STABLE;
-------------------------------
-------------------------------
-- SECURITY DEFINER: the function needs to read u.email (column-revoked
-- from authenticated in 13-RLS.sql) and to insert a channel_members row
-- for `user_id != auth.uid()` (blocked by channel_members_join_insert).
-- Both are intended bypasses for the DM-create flow; auth.uid()-based
-- checks inside the function body enforce the actual authorisation.
CREATE OR REPLACE FUNCTION create_direct_message_channel(
    workspace_uid VARCHAR(36),
    user_id UUID
) RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    user_name TEXT;
    display_name TEXT;
    full_name TEXT;
    email TEXT;
    new_channel JSONB;
    existing_channel JSONB;
    current_user_id UUID;
    new_channel_id UUID := uuid_generate_v4();
BEGIN
    -- Ensure user_id (the other user) is not NULL
    IF user_id IS NULL THEN
        RAISE EXCEPTION 'Parameter user_id cannot be NULL.';
    END IF;

    -- Get current user ID from auth.uid(), or from app.current_user_id if auth.uid() is NULL
    current_user_id := auth.uid();

    IF current_user_id IS NULL THEN
        -- Attempt to get current_user_id from session variable for testing purposes
        BEGIN
            SELECT current_setting('app.current_user_id', TRUE) INTO current_user_id;
        EXCEPTION WHEN OTHERS THEN
            RAISE EXCEPTION 'Current user ID is NULL or not set.';
        END;
    END IF;

    -- Check if current_user_id is still NULL
    IF current_user_id IS NULL THEN
        RAISE EXCEPTION 'Current user ID is NULL.';
    END IF;

    -- Check if the workspace exists and is not deleted
    IF NOT EXISTS (SELECT 1 FROM public.workspaces WHERE id = workspace_uid AND deleted_at IS NULL) THEN
        RAISE EXCEPTION 'Workspace % does not exist or has been deleted.', workspace_uid;
    END IF;

    -- Check if the other user exists and is not deleted
    SELECT u.username, u.full_name, u.display_name, u.email
    INTO user_name, full_name, display_name, email
    FROM public.users u
    WHERE u.id = user_id;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'User % does not exist or has been deleted.', user_id;
    END IF;

    -- Check if the current user exists and is not deleted
    IF NOT EXISTS (SELECT 1 FROM public.users WHERE id = current_user_id) THEN
        RAISE EXCEPTION 'Current user % does not exist or has been deleted.', current_user_id;
    END IF;

    -- Prevent creating a channel with oneself
    IF current_user_id = user_id THEN
        RAISE EXCEPTION 'Cannot create a direct message channel with oneself.';
    END IF;

    -- Create display name based on the priority: display_name, full_name, username, email
    user_name := COALESCE(display_name, full_name, user_name, email);

    -- Check if the direct message channel already exists between the two users
    SELECT to_jsonb(ch.*) INTO existing_channel
    FROM public.channels ch
    JOIN public.channel_members cm1 ON cm1.channel_id = ch.id AND cm1.member_id = current_user_id
    JOIN public.channel_members cm2 ON cm2.channel_id = ch.id AND cm2.member_id = user_id
    WHERE ch.type = 'DIRECT'
      AND ch.workspace_id = workspace_uid
      AND ch.deleted_at IS NULL
      AND cm1.left_at IS NULL
      AND cm2.left_at IS NULL;

    -- If the channel already exists, return it
    IF existing_channel IS NOT NULL THEN
        RETURN existing_channel;
    END IF;

    -- Otherwise, create a new channel
    INSERT INTO public.channels (id, workspace_id, type, name, slug, created_by)
    VALUES (new_channel_id, workspace_uid, 'DIRECT', user_name, uuid_generate_v4(), current_user_id)
    RETURNING to_jsonb(public.channels.*) INTO new_channel;

    -- Add current user to the channel
    -- INSERT INTO public.channel_members (channel_id, member_id, joined_at)
    -- VALUES (new_channel_id, current_user_id, now());

    -- Add the other user to the channel
    INSERT INTO public.channel_members (channel_id, member_id, joined_at)
    VALUES (new_channel_id, user_id, now());

    RETURN new_channel;
END;
$$;


---------------------
CREATE OR REPLACE FUNCTION public.notifications_summary(
    _workspace_id VARCHAR(36) DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
AS $$
DECLARE
    v_unread_count          BIGINT;
    v_unread_mention_count  BIGINT;
    v_last_unread           JSONB;
    v_last_unread_mention   JSONB;
BEGIN
    /*
       If _workspace_id is not NULL, filter notifications by channels in that workspace.
       Otherwise, no workspace filter.
    */

    -- 1) Count all unread notifications
    SELECT COUNT(*)
    INTO v_unread_count
    FROM public.notifications AS n
    JOIN public.channels      AS c ON c.id = n.channel_id
    WHERE n.receiver_user_id = auth.uid()
      AND n.readed_at IS NULL
      AND (
          _workspace_id IS NULL
          OR c.workspace_id = _workspace_id
      );

    -- 2) Count all unread "mention" notifications
    SELECT COUNT(*)
    INTO v_unread_mention_count
    FROM public.notifications AS n
    JOIN public.channels      AS c ON c.id = n.channel_id
    WHERE n.receiver_user_id = auth.uid()
      AND n.type = 'mention'
      AND n.readed_at IS NULL
      AND (
          _workspace_id IS NULL
          OR c.workspace_id = _workspace_id
      );

    -- 3) Last 6 unread notifications (with embedded sender data)
    SELECT JSONB_AGG(to_jsonb(sub.*))
    INTO v_last_unread
    FROM (
        SELECT
            n.id,
            n.type,
            n.message_id,
            n.channel_id,
            n.message_preview,
            n.created_at,
            n.readed_at,
            JSON_BUILD_OBJECT(
                'id',               u.id,
                'username',         u.username,
                'full_name',        u.full_name,
                'avatar_url',       u.avatar_url,
                'display_name',     u.display_name,
                'avatar_updated_at',u.avatar_updated_at
            ) AS sender
        FROM public.notifications AS n
        JOIN public.channels      AS c ON c.id = n.channel_id
        LEFT JOIN public.users    AS u ON u.id = n.sender_user_id
        WHERE n.receiver_user_id = auth.uid()
          AND n.readed_at IS NULL
          AND (
              _workspace_id IS NULL
              OR c.workspace_id = _workspace_id
          )
        ORDER BY n.created_at DESC
        LIMIT 6
    ) AS sub;

    -- 4) Last 6 unread "mention" notifications (with embedded sender data)
    SELECT JSONB_AGG(to_jsonb(sub.*))
    INTO v_last_unread_mention
    FROM (
        SELECT
            n.id,
            n.type,
            n.message_id,
            n.channel_id,
            n.message_preview,
            n.created_at,
            n.readed_at,
            JSON_BUILD_OBJECT(
                'id',               u.id,
                'username',         u.username,
                'full_name',        u.full_name,
                'avatar_url',       u.avatar_url,
                'display_name',     u.display_name,
                'avatar_updated_at',u.avatar_updated_at
            ) AS sender
        FROM public.notifications AS n
        JOIN public.channels      AS c ON c.id = n.channel_id
        LEFT JOIN public.users    AS u ON u.id = n.sender_user_id
        WHERE n.receiver_user_id = auth.uid()
          AND n.type = 'mention'
          AND n.readed_at IS NULL
          AND (
              _workspace_id IS NULL
              OR c.workspace_id = _workspace_id
          )
        ORDER BY n.created_at DESC
        LIMIT 6
    ) AS sub;

    RETURN JSONB_BUILD_OBJECT(
        'unread_count',         v_unread_count,
        'unread_mention_count', v_unread_mention_count,
        'last_unread',         COALESCE(v_last_unread, '[]'::JSONB),
        'last_unread_mention', COALESCE(v_last_unread_mention, '[]'::JSONB)
    );
END;
$$;
-----------------------------------

CREATE OR REPLACE FUNCTION public.get_unread_notifications_paginated(
    _workspace_id VARCHAR(36) DEFAULT NULL,
    _type         TEXT        DEFAULT NULL,
    _page         INT         DEFAULT 1,
    _page_size    INT         DEFAULT 6
)
RETURNS SETOF JSONB
LANGUAGE plpgsql
AS $$
DECLARE
    v_offset INT := (_page - 1) * _page_size;
BEGIN
    RETURN QUERY
        SELECT to_jsonb(sub.*)
        FROM (
            SELECT
                n.id,
                n.type,
                n.message_id,
                n.channel_id,
                n.message_preview,
                n.action_url,
                n.created_at,
                JSON_BUILD_OBJECT(
                    'id',               u.id,
                    'username',         u.username,
                    'full_name',        u.full_name,
                    'avatar_url',       u.avatar_url,
                    'display_name',     u.display_name,
                    'avatar_updated_at',u.avatar_updated_at
                ) AS sender
            FROM public.notifications AS n
            LEFT JOIN public.channels AS c ON c.id = n.channel_id
            LEFT JOIN public.users    AS u ON u.id = n.sender_user_id
            WHERE n.receiver_user_id = auth.uid()
              AND n.readed_at IS NULL
              -- If _type is NULL, allow any type. Otherwise, match it.
              AND (
                _type IS NULL
                OR n.type::text = _type
              )
              -- If _workspace_id is NULL, no workspace filter; otherwise match.
              -- System notifications (no channel) are always included.
              AND (
                _workspace_id IS NULL
                OR n.channel_id IS NULL
                OR c.workspace_id = _workspace_id
              )
            ORDER BY n.created_at DESC
            LIMIT _page_size
            OFFSET v_offset
        ) AS sub;
END;
$$;

-------------------------

CREATE OR REPLACE FUNCTION public.fetch_mentioned_users(
  _workspace_id VARCHAR,
  _username TEXT
)
RETURNS TABLE (
  id UUID,
  username TEXT,
  full_name TEXT,
  display_name TEXT,
  avatar_url TEXT,
  avatar_updated_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ
)
LANGUAGE plpgsql
AS $$
BEGIN
  -- Authorization: workspace mention lists must not enumerate users
  -- across workspaces. Caller must be an active workspace member.
  IF NOT EXISTS (
    SELECT 1 FROM public.workspace_members wm
    WHERE wm.workspace_id = _workspace_id
      AND wm.member_id    = auth.uid()
      AND wm.left_at IS NULL
  ) THEN
    RAISE EXCEPTION 'Access denied: caller is not a member of workspace %.', _workspace_id;
  END IF;

  IF _username IS NULL OR _username = '' THEN
    -- If no username is provided, return the 6 most recent users
    RETURN QUERY
      SELECT DISTINCT
             u.id,
             u.username,
             u.full_name,
             u.display_name,
             u.avatar_url,
             u.avatar_updated_at,
             u.created_at
        FROM public.users u
        JOIN public.channel_members cm ON cm.member_id = u.id
        JOIN public.channels c        ON c.id = cm.channel_id
       WHERE c.workspace_id = _workspace_id
         AND u.deleted_at IS NULL
         AND u.username != 'system'
       ORDER BY u.created_at DESC
       LIMIT 6;

  ELSE
    -- If a username is provided, perform a partial match
    RETURN QUERY
      SELECT DISTINCT
             u.id,
             u.username,
             u.full_name,
             u.display_name,
             u.avatar_url,
             u.avatar_updated_at,
             u.created_at
        FROM public.users u
        JOIN public.channel_members cm ON cm.member_id = u.id
        JOIN public.channels c        ON c.id = cm.channel_id
       WHERE c.workspace_id = _workspace_id
         AND u.deleted_at IS NULL
         AND u.username != 'system'
         AND u.username ILIKE '%' || _username || '%'
       ORDER BY u.username
       LIMIT 10;
  END IF;
END;
$$;


-----------------------------------
CREATE OR REPLACE FUNCTION public.get_unread_notif_count(
    _workspace_id VARCHAR(36) DEFAULT NULL
)
RETURNS BIGINT
LANGUAGE plpgsql
AS $$
DECLARE
    v_unread_count BIGINT;
BEGIN
    SELECT COUNT(*)
    INTO v_unread_count
    FROM public.notifications AS n
    JOIN public.channels AS c ON c.id = n.channel_id
    WHERE n.receiver_user_id = auth.uid()
      AND n.readed_at IS NULL
      AND (
          _workspace_id IS NULL
          OR c.workspace_id = _workspace_id
      );

    RETURN v_unread_count;
END;
$$;

-- ALTER FUNCTION public.get_unread_notif_count(VARCHAR(36))
-- SET parallel_safe = true;

-----------------------------------
CREATE OR REPLACE FUNCTION public.get_channel_notif_state(
  _channel_id VARCHAR(36)
)
RETURNS public.channel_notification_state
LANGUAGE plpgsql
AS $$
DECLARE
    v_notif_state public.channel_notification_state;
BEGIN
    SELECT notif_state
    INTO v_notif_state
    FROM public.channel_members cm
   WHERE cm.channel_id = _channel_id
     AND cm.member_id = auth.uid()
   LIMIT 1;

    RETURN v_notif_state;
END;
$$;

-----------------------------------
-- Function to add the current user to a workspace.
--
-- Product invariant: docs.plus workspaces are document slugs. Opening any
-- doc auto-bootstraps the workspace (creates if missing) and joins the
-- caller. Membership is intentionally self-service — there is no invite
-- gate. Workspace isolation is therefore "anyone signed in can see any
-- workspace's PUBLIC content" by design; PRIVATE channels still require
-- per-channel membership (`channels_member_insert` in 13-RLS.sql).
CREATE OR REPLACE FUNCTION join_workspace(
    _workspace_id VARCHAR(36)
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    user_id UUID;
BEGIN
    -- Get the current user ID
    user_id := auth.uid();

    -- Check if the user ID is valid
    IF user_id IS NULL THEN
        RAISE EXCEPTION 'Authentication required. User ID is NULL.';
    END IF;

    -- Check if the workspace exists and is not deleted, create if it doesn't exist
    IF NOT EXISTS (
        SELECT 1 FROM public.workspaces
        WHERE id = _workspace_id AND deleted_at IS NULL
    ) THEN
        -- Create the workspace with the given ID
        INSERT INTO public.workspaces (id, name, slug, created_by)
        VALUES (_workspace_id, _workspace_id, lower(_workspace_id), user_id);
    END IF;

    -- Check if user is already a member of this workspace
    IF EXISTS (
        SELECT 1 FROM public.workspace_members
        WHERE workspace_id = _workspace_id AND member_id = user_id
    ) THEN
        -- Return true if the user is already a member
        RETURN TRUE;
    END IF;

    -- Insert new workspace member record
    INSERT INTO public.workspace_members (workspace_id, member_id)
    VALUES (_workspace_id, user_id);

        -- For new workspace members, create channel_members entries for all channels in this workspace
    -- Use a single INSERT with CTEs for optimal performance
    INSERT INTO public.channel_members (
        channel_id,
        member_id,
        unread_message_count,
        last_read_message_id,
        last_read_update_at
    )
    WITH channel_data AS (
        SELECT
            cmc.channel_id,
            cmc.message_count,
            c.created_at as channel_created_at
        FROM public.channel_message_counts cmc
        JOIN public.channels c ON c.id = cmc.channel_id
        WHERE cmc.workspace_id = _workspace_id
          AND c.deleted_at IS NULL
    ),
    first_messages AS (
        SELECT DISTINCT ON (m.channel_id)
            m.channel_id,
            m.id as first_message_id
        FROM public.messages m
        WHERE m.channel_id IN (SELECT channel_id FROM channel_data)
          AND m.deleted_at IS NULL
        ORDER BY m.channel_id, m.created_at ASC
    )
    SELECT
        cd.channel_id,
        user_id,
        cd.message_count,
        fm.first_message_id,
        cd.channel_created_at
    FROM channel_data cd
    LEFT JOIN first_messages fm ON fm.channel_id = cd.channel_id
    ON CONFLICT (channel_id, member_id) DO NOTHING;

    RETURN TRUE;
END;
$$;

COMMENT ON FUNCTION join_workspace(VARCHAR(36)) IS
'Adds the currently authenticated user to the specified workspace.
Returns TRUE if successful or if user is already a member.';

-----------------------------------
-- Function to get channel members by last read update timestamp
CREATE OR REPLACE FUNCTION public.get_channel_members_by_last_read_update(
    _channel_id VARCHAR(36),
    _timestamp TIMESTAMP WITH TIME ZONE
)
RETURNS TABLE (
    avatar_updated_at TIMESTAMP WITH TIME ZONE,
    avatar_url TEXT,
    display_name TEXT,
    full_name TEXT,
    last_read_update_at TIMESTAMP WITH TIME ZONE,
    username TEXT,
    user_id UUID
)
LANGUAGE plpgsql
STABLE
AS $$
BEGIN
    -- Validate input parameters
    IF _channel_id IS NULL THEN
        RAISE EXCEPTION 'channel_id cannot be NULL';
    END IF;

    IF _timestamp IS NULL THEN
        RAISE EXCEPTION 'timestamp cannot be NULL';
    END IF;

    -- Check if channel exists and is not deleted
    IF NOT EXISTS (
        SELECT 1 FROM public.channels
        WHERE id = _channel_id AND deleted_at IS NULL
    ) THEN
        RAISE EXCEPTION 'Channel % does not exist or has been deleted', _channel_id;
    END IF;

    -- Authorization: read-receipts are not public-readable, even on
    -- PUBLIC channels. Members only.
    IF NOT EXISTS (
        SELECT 1 FROM public.channel_members cm
        WHERE cm.channel_id = _channel_id
          AND cm.member_id  = auth.uid()
          AND cm.left_at IS NULL
    ) THEN
        RAISE EXCEPTION 'Access denied: caller is not a member of channel %.', _channel_id;
    END IF;

    RETURN QUERY
    SELECT
        u.avatar_updated_at,
        u.avatar_url,
        u.display_name,
        u.full_name,
        cm.last_read_update_at,
        u.username,
        u.id
    FROM public.channel_members cm
    JOIN public.users u ON u.id = cm.member_id
    WHERE cm.channel_id = _channel_id
      AND cm.last_read_update_at >= _timestamp
      AND u.deleted_at IS NULL
      AND cm.left_at IS NULL  -- Only active members
    ORDER BY cm.last_read_update_at DESC, u.username ASC;
END;
$$;

COMMENT ON FUNCTION public.get_channel_members_by_last_read_update(VARCHAR(36), TIMESTAMP WITH TIME ZONE) IS
'Returns channel members whose last_read_update_at is equal to or greater than the specified timestamp.
Only returns active members (not left) and non-deleted users.';

-- ============================================================
-- Hardening: pin search_path = public on functions defined above
-- (idempotent — safe to re-run)
-- ============================================================
ALTER FUNCTION public.user_details_json(u users) SET search_path = public;
ALTER FUNCTION public.get_channel_aggregate_data(input_channel_id character varying, message_limit integer, anchor_message_id uuid) SET search_path = public;
ALTER FUNCTION public.create_direct_message_channel(workspace_uid character varying, user_id uuid) SET search_path = public;
ALTER FUNCTION public.notifications_summary(_workspace_id character varying) SET search_path = public;
ALTER FUNCTION public.get_unread_notifications_paginated(_workspace_id character varying, _type text, _page integer, _page_size integer) SET search_path = public;
ALTER FUNCTION public.fetch_mentioned_users(_workspace_id character varying, _username text) SET search_path = public;
ALTER FUNCTION public.get_unread_notif_count(_workspace_id character varying) SET search_path = public;
ALTER FUNCTION public.get_channel_notif_state(_channel_id character varying) SET search_path = public;
ALTER FUNCTION public.join_workspace(_workspace_id character varying) SET search_path = public;
ALTER FUNCTION public.get_channel_members_by_last_read_update(_channel_id character varying, _timestamp timestamp with time zone) SET search_path = public;

-- ============================================================
-- v2 chatroom RPCs (paired with migrations 20260513140500..20260513142000).
-- ============================================================

-- fetch_message_window: anchor-aware window. Four anchor kinds:
--   'tail', 'first_unread', 'message_id' (raises 42501 if forbidden),
--   'before_seq' (loadOlder cursor). Returns
--   { rows, anchor_seq, has_more_before, has_more_after }.
create or replace function public.fetch_message_window(
  p_channel_id   varchar(36),
  p_anchor_kind  text,
  p_anchor_value text default null,
  p_before_limit int default 40,
  p_after_limit  int default 40
) returns jsonb
language plpgsql
stable
security invoker
set search_path = ''
as $$
declare
  v_uid uuid := (select auth.uid());
  v_anchor_seq bigint;
  -- v_anchor_seq drives the local before/after window query; v_response_anchor
  -- is what the FE sees. They diverge for 'first_unread' when no real unread
  -- exists (anon viewers, or authed users caught up to tail) — we still need
  -- a seq to center the window on (tail), but the FE must NOT render the
  -- "Unread messages" sentinel since there's nothing to flag.
  v_response_anchor bigint;
  v_rows jsonb;
  v_has_more_before boolean;
  v_has_more_after boolean;
  v_target_msg_id uuid;
  v_target_channel varchar(36);
begin
  if p_anchor_kind = 'tail' then
    select coalesce(max(seq), 0) into v_anchor_seq
    from public.messages
    where channel_id = p_channel_id and deleted_at is null;
    v_response_anchor := v_anchor_seq;

  elsif p_anchor_kind = 'first_unread' then
    if v_uid is null then
      -- Anon has no per-user read cursor; window around tail but null out
      -- the response anchor so the FE skips the sentinel.
      select coalesce(max(seq), 0) into v_anchor_seq
      from public.messages
      where channel_id = p_channel_id and deleted_at is null;
      v_response_anchor := null;
    else
      select min(m.seq) into v_anchor_seq
      from public.messages m
      join public.channel_members cm on cm.channel_id = m.channel_id
      where m.channel_id = p_channel_id
        and m.deleted_at is null
        and cm.member_id = v_uid
        and m.seq > cm.last_read_seq;
      if v_anchor_seq is null then
        -- Authed user is caught up; same treatment as anon.
        select coalesce(max(seq), 0) into v_anchor_seq
        from public.messages
        where channel_id = p_channel_id and deleted_at is null;
        v_response_anchor := null;
      else
        v_response_anchor := v_anchor_seq;
      end if;
    end if;

  elsif p_anchor_kind = 'message_id' then
    v_target_msg_id := p_anchor_value::uuid;
    select channel_id, seq into v_target_channel, v_anchor_seq
    from public.messages
    where id = v_target_msg_id and deleted_at is null;
    if v_target_channel is null or v_target_channel <> p_channel_id then
      raise exception 'message not found or not in channel' using errcode = '42501';
    end if;
    v_response_anchor := v_anchor_seq;

  elsif p_anchor_kind = 'before_seq' then
    v_anchor_seq := (p_anchor_value::bigint) - 1;
    v_response_anchor := v_anchor_seq;
    -- Inline json_build_object instead of public.user_details_json(u): the
    -- composite-row form requires SELECT on every users column (including
    -- `email`, which is excluded from anon + authenticated column grants),
    -- so security-invoker callers get "permission denied for table users".
    select coalesce(jsonb_agg(row_to_json(t) order by t.seq asc), '[]'::jsonb)
      into v_rows
      from (
        select m.*,
          json_build_object(
            'id', u.id,
            'username', u.username,
            'fullname', u.full_name,
            'avatar_url', u.avatar_url,
            'avatar_updated_at', u.avatar_updated_at
          ) as user_details,
          (mb.id is not null and mb.archived_at is null and mb.marked_at is null) as is_bookmarked,
          mb.id as bookmark_id
        from public.messages m
        left join public.users u on u.id = m.user_id
        left join public.message_bookmarks mb
          on mb.message_id = m.id and mb.user_id = (select auth.uid())
        where m.channel_id = p_channel_id
          and m.deleted_at is null
          and m.seq < (p_anchor_value::bigint)
        order by m.seq desc
        limit p_before_limit
      ) t;
    v_has_more_before := exists (
      select 1 from public.messages
      where channel_id = p_channel_id and deleted_at is null
        and seq < coalesce(
          (select min((value->>'seq')::bigint) from jsonb_array_elements(v_rows)),
          (p_anchor_value::bigint)
        )
    );
    v_has_more_after := true;
    return jsonb_build_object(
      'rows', v_rows,
      'anchor_seq', v_response_anchor,
      'has_more_before', v_has_more_before,
      'has_more_after', v_has_more_after
    );

  else
    raise exception 'invalid anchor_kind: %', p_anchor_kind using errcode = '22023';
  end if;

  select coalesce(jsonb_agg(row_to_json(t) order by t.seq asc), '[]'::jsonb)
  into v_rows
  from (
    (
      select m.*,
        json_build_object(
          'id', u.id,
          'username', u.username,
          'fullname', u.full_name,
          'avatar_url', u.avatar_url,
          'avatar_updated_at', u.avatar_updated_at
        ) as user_details,
        (mb.id is not null and mb.archived_at is null and mb.marked_at is null) as is_bookmarked,
        mb.id as bookmark_id
      from public.messages m
      left join public.users u on u.id = m.user_id
      left join public.message_bookmarks mb
        on mb.message_id = m.id and mb.user_id = (select auth.uid())
      where m.channel_id = p_channel_id and m.deleted_at is null and m.seq <= v_anchor_seq
      order by m.seq desc limit p_before_limit + 1
    )
    union all
    (
      select m.*,
        json_build_object(
          'id', u.id,
          'username', u.username,
          'fullname', u.full_name,
          'avatar_url', u.avatar_url,
          'avatar_updated_at', u.avatar_updated_at
        ) as user_details,
        (mb.id is not null and mb.archived_at is null and mb.marked_at is null) as is_bookmarked,
        mb.id as bookmark_id
      from public.messages m
      left join public.users u on u.id = m.user_id
      left join public.message_bookmarks mb
        on mb.message_id = m.id and mb.user_id = (select auth.uid())
      where m.channel_id = p_channel_id and m.deleted_at is null and m.seq > v_anchor_seq
      order by m.seq asc limit p_after_limit
    )
  ) t;

  select exists (
    select 1 from public.messages
    where channel_id = p_channel_id and deleted_at is null
      and seq < coalesce(
        (select min((value->>'seq')::bigint) from jsonb_array_elements(v_rows)),
        v_anchor_seq + 1
      )
  ) into v_has_more_before;

  select exists (
    select 1 from public.messages
    where channel_id = p_channel_id and deleted_at is null
      and seq > coalesce(
        (select max((value->>'seq')::bigint) from jsonb_array_elements(v_rows)),
        v_anchor_seq - 1
      )
  ) into v_has_more_after;

  return jsonb_build_object(
    'rows', v_rows,
    'anchor_seq', v_response_anchor,
    'has_more_before', v_has_more_before,
    'has_more_after', v_has_more_after
  );
end;
$$;

grant execute on function public.fetch_message_window(varchar, text, text, int, int)
  to authenticated, anon;

-- fetch_messages_since: connection-event refetch. Returns a jsonb array of
-- message rows (each row enriched with user_details via user_details_json)
-- with seq > p_since_seq, ordered ascending. Returning jsonb instead of
-- setof public.messages lets us inline user_details for display parity
-- with fetch_message_window without changing the base messages rowtype.
drop function if exists public.fetch_messages_since(varchar, bigint, int);
create or replace function public.fetch_messages_since(
  p_channel_id varchar(36),
  p_since_seq  bigint,
  p_limit      int default 100
) returns jsonb
language sql
stable
security invoker
set search_path = ''
as $$
  select coalesce(jsonb_agg(row_to_json(t) order by t.seq asc), '[]'::jsonb)
  from (
    select m.*,
      json_build_object(
        'id', u.id,
        'username', u.username,
        'fullname', u.full_name,
        'avatar_url', u.avatar_url,
        'avatar_updated_at', u.avatar_updated_at
      ) as user_details,
      (mb.id is not null and mb.archived_at is null and mb.marked_at is null) as is_bookmarked,
      mb.id as bookmark_id
    from public.messages m
    left join public.users u on u.id = m.user_id
    left join public.message_bookmarks mb
      on mb.message_id = m.id and mb.user_id = (select auth.uid())
    where m.channel_id = p_channel_id
      and m.seq > p_since_seq
      and m.deleted_at is null
    order by m.seq asc
    limit p_limit
  ) t;
$$;

grant execute on function public.fetch_messages_since(varchar, bigint, int)
  to authenticated, anon;

-- advance_read_cursor: single-row UPDATE on channel_members.last_read_seq,
-- recomputes unread_message_count, stamps last_read_update_at. One row
-- broadcasts via realtime — useful for cross-tab sync without flooding.
create or replace function public.advance_read_cursor(
  p_channel_id varchar(36),
  p_up_to_seq  bigint
) returns void
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_uid uuid := (select auth.uid());
  v_new_seq bigint;
  v_unread int;
begin
  if v_uid is null then
    raise exception 'not authenticated' using errcode = '42501';
  end if;

  -- FOR UPDATE locks the row so concurrent advances (open tab + mobile)
  -- cannot interleave SELECT/UPDATE and flap unread_message_count.
  select greatest(last_read_seq, p_up_to_seq) into v_new_seq
  from public.channel_members
  where channel_id = p_channel_id and member_id = v_uid
  for update;

  if v_new_seq is null then
    return;
  end if;

  select coalesce(count(*), 0) into v_unread
  from public.messages
  where channel_id = p_channel_id
    and deleted_at is null
    and seq > v_new_seq;

  update public.channel_members
  set last_read_seq = v_new_seq,
      unread_message_count = v_unread,
      last_read_update_at = (now() at time zone 'utc')
  where channel_id = p_channel_id and member_id = v_uid;

  -- Private topic `chatroom-read:{id}` gated by chatroom_read_topic_access
  -- on realtime.messages (members-only). The cursor write is the durable
  -- contract; broadcast failure (broker hiccup, missing extension) must
  -- not roll back the UPDATE.
  begin
    perform realtime.send(
      jsonb_build_object('user_id', v_uid, 'seq', v_new_seq),
      'read:advanced',
      'chatroom-read:' || p_channel_id,
      true
    );
  exception when others then
    raise warning 'read:advanced broadcast failed: %', sqlerrm;
  end;
end;
$$;

grant execute on function public.advance_read_cursor(varchar, bigint) to authenticated;
revoke execute on function public.advance_read_cursor(varchar, bigint) from anon, public;

-- ---------------------------------------------------------------------------
-- Authorization for `chatroom-read:{channel_id}` private topic.
--   - Subscribers must be authenticated channel members (left_at IS NULL).
--   - `realtime.messages` RLS is already enabled by 07-3-notification-broadcast.
--   - 14-char prefix `chatroom-read:` -> substring starts at position 15.
-- ---------------------------------------------------------------------------

drop policy if exists "chatroom_read_topic_access" on realtime.messages;

create policy "chatroom_read_topic_access"
on realtime.messages
for select
to authenticated
using (
  realtime.messages.topic like 'chatroom-read:%'
  and exists (
    select 1
    from public.channel_members cm
    where cm.channel_id = substr(realtime.messages.topic, 15)
      and cm.member_id  = (select auth.uid())
      and cm.left_at    is null
  )
);

comment on policy "chatroom_read_topic_access" on realtime.messages is
'Members-only subscription to chatroom-read:{channel_id}. Pairs with
advance_read_cursor which fans out read:advanced with private := TRUE.';


-- ============================================================================
-- File: 11-0-events.sql
-- ============================================================================

-- /*https://github.com/orgs/supabase/discussions/5152*/
-- /*----------------  Events TABLE  ---------------------*/


-- create table public.events (
--   -- a primary key is necessary for realtime RLS to work
--   id int generated always as identity primary key,
--   -- `null` if the event is public, and the `auth.uid` if the event is for specific user.
--   uid uuid,
--   -- customized topic including filters (e.g. "messages_view|{otherUID}" or "comments|{postID}")
--   topic text,
--   -- The inserted/updated data wrapped in a json object
--   data json,
--   -- `INSERT`, `UPDATE`, or `DELETE`
--   event_type text,
--   -- used to delete old events by a cron job
--   created_at timestamp with time zone DEFAULT now() NOT NULL

-- );

-- /*----------------  REALTIME SETUP  ---------------------*/

-- -- clients can only listen to the events table and only for insert events.
-- ALTER PUBLICATION supabase_realtime SET (publish = 'insert');
-- ALTER PUBLICATION supabase_realtime ADD TABLE events;


-- /*----------------- SECURITY  ---------------------*/

-- -- RLS not good for performance

-- -- ALTER TABLE public.events ENABLE ROW LEVEL SECURITY;

-- -- CREATE POLICY events_policy
-- -- ON public.events
-- -- FOR SELECT USING (
-- --   events.uid is NULL OR events.uid = auth.uid()
-- -- );


-- /*----------------- INDEXES  ---------------------*/

-- CREATE INDEX events_topic_idx ON public.events (topic);
-- CREATE INDEX events_uid_idx ON public.events (uid);
-- CREATE INDEX events_created_at_idx ON public.events (created_at);

-- COMMENT ON TABLE public.events IS 'Stores all changes to the database. Used for realtime and to trigger webhooks.';

-- /*----------------- TRIGGERS  ---------------------*/


-- ============================================================================
-- File: 11-indexes.sql
-- ============================================================================

-- -----------------------------------------------------------------------------
-- Database Indexes and System User Definition
-- -----------------------------------------------------------------------------
-- Description: Creates performance-optimizing indexes on primary application tables
-- and establishes a system user for automation purposes.
-- -----------------------------------------------------------------------------

-- Indexes on public.users Table
-- Optimizes queries filtering or sorting by username.
create index idx_users_username on public.users (username);

-- Indexes on public.messages Table
-- idx_messages_channel_id is covered by the composite (channel_id, created_at desc) below.
create index idx_messages_user_id on public.messages (user_id);
-- idx_messages_type serves m.type = 'notification' filters in get_channel_aggregate_data
-- and pin/forward RPCs (10-functions.sql); keep despite low cardinality.
create index idx_messages_type on public.messages (type);

-- Composite Index on public.messages
create index idx_messages_channel_id_created_at on public.messages (channel_id, created_at desc);

-- Indexes on public.channels Table
-- Optimizes query performance for slug, created_by, and last_activity_at.
create index idx_channels_slug on public.channels (slug);
create index idx_channels_created_by on public.channels (created_by);
create index idx_channels_workspace_id on public.channels (workspace_id);
create index idx_channels_last_activity_at on public.channels (last_activity_at desc);

-- Indexes on public.pinned_messages Table
-- Optimizes query performance for channel_id and message_id.
create unique index idx_pinned_messages_channel_id_message_id on public.pinned_messages (channel_id, message_id);

-- Indexes on public.channel_members Table
-- Optimizes query performance for channel_id and member_id.
create unique index idx_channel_members_channel_id_member_id on public.channel_members (channel_id, member_id);

-- Indexes on public.notifications Table
-- Optimizes query performance for receiver_user_id and created_at.
create index idx_notifications_channel on public.notifications (channel_id);
create index idx_notifications_receiver_user_id on public.notifications (receiver_user_id);
create index idx_notifications_created_at on public.notifications (created_at);
create index idx_notifications_receiver_user_id_created_at on public.notifications (receiver_user_id, created_at desc);
create index idx_notifications_receiver_readed on public.notifications (receiver_user_id, readed_at) where readed_at is null;

-- Indexes on public.workspaces Table
-- Optimizes query performance for created_by.
create index idx_workspaces_slug on public.workspaces (slug);

-- Partial composite for the hot pagination read path under the soft-delete filter.
-- Replaces idx_messages_channel_id_not_deleted (channel_id only) which couldn't serve ORDER BY.
create index idx_messages_channel_id_created_at_active
  on public.messages (channel_id, created_at desc)
  where deleted_at is null;

-- workspace_members lookups by member alone (RLS hot path: is_workspace_member()).
-- The unique constraint covers (workspace_id, member_id); reverse direction needs its own index.
create index idx_workspace_members_member_id on public.workspace_members (member_id);

-- FK indexes on message-edit / soft-delete / reply hot triggers. Without
-- these every edit, soft-delete, or forward does a seq scan on messages /
-- notifications inside an AFTER trigger on the synchronous send path.
create index if not exists idx_messages_reply_to_message_id
  on public.messages (reply_to_message_id)
  where reply_to_message_id is not null;

create index if not exists idx_notifications_message_id
  on public.notifications (message_id);

-- channel_members(member_id) — reverse-direction lookup for user-keyed
-- joins (e.g. get_channel_users). The unique (channel_id, member_id) index
-- only serves channel-keyed scans.
create index if not exists idx_channel_members_member_id
  on public.channel_members (member_id);

-- v2 chatroom hot paths: seq-ordered scans and per-member read cursor.
create index if not exists idx_messages_channel_id_seq_desc
  on public.messages (channel_id, seq desc)
  where deleted_at is null;

create index if not exists idx_channel_members_channel_member_lastread
  on public.channel_members (channel_id, member_id, last_read_seq);

-- Create system user for system messages and notifications
-- This user serves as the sender for automated system notifications and messages.
insert into auth.users (id, email)
values ('992bb85e-78f8-4747-981a-fd63d9317ff1', 'system@system.com')
on conflict (id) do nothing;

-- comment on table auth.users is 'Auth users table - includes all users with auth accounts including system accounts';
-- comment on column auth.users.id is 'Unique identifier for the auth user';
-- comment on column auth.users.email is 'Email address associated with the auth user';


-- ============================================================================
-- File: 12-buckets.sql
-- ============================================================================

/*
  File: storage_buckets.sql
  Description: This script defines the storage buckets for a messaging application, similar to Slack.
  The buckets are designed to store different types of media: user avatars, channel avatars, and general media files.
  Each bucket has specific policies to control access and usage, ensuring secure and organized file management.

  Reference Documentation:
  - Storage Overview: https://supabase.com/docs/guides/storage
  - Storage Schema: https://supabase.com/docs/guides/storage/schema/design
  - Storage API: https://supabase.com/docs/reference/javascript/storage

  Buckets Overview:
  - 'user_avatars': For storing user profile images.
  - 'channel_avatars': For storing images representing chat channels.
  - 'media': For storing general media files related to messages.

  Idempotency:
  - storage schema persists across `DROP SCHEMA public CASCADE`, so inserts
    must guard against existing rows and policy creates against existing names.
*/

-- User Avatars Bucket Configuration
-- Purpose: Store user profile images.
-- Max File Size: 1MB (1,048,576 bytes).
-- Allowed MIME Types: JPEG, PNG, SVG, GIF, WebP.
insert into storage.buckets
    (id, name, public, file_size_limit, allowed_mime_types)
values
    ('user_avatars', 'user_avatars', true, 1048576,
     '{"image/jpeg", "image/png", "image/svg+xml", "image/gif", "image/webp"}')
on conflict (id) do nothing;

-- Policies for User Avatars Bucket.
-- SELECT is scoped to the caller's own folder. Public-URL reads are
-- served by storage's HTTP handler (bucket.public = true) and don't
-- pass through this policy; the SELECT is required only so the upload
-- INSERT-then-readback succeeds (otherwise storage maps the empty
-- readback to a misleading "new row violates row-level security
-- policy" 403). Folder-scoping blocks bucket enumeration.
drop policy if exists "User Avatar is publicly accessible" on storage.objects;
create policy "User Avatar is publicly accessible" on storage.objects
    for select to authenticated using (
        bucket_id = 'user_avatars'
        and (storage.foldername(name))[1] = (select auth.uid()::text)
    );
drop policy if exists "User can upload an avatar" on storage.objects;
create policy "User can upload an avatar" on storage.objects
    for insert to authenticated
    with check (
        bucket_id = 'user_avatars'
        and (storage.foldername(name))[1] = (select auth.uid()::text)
    );
drop policy if exists "User can update own avatar" on storage.objects;
create policy "User can update own avatar" on storage.objects
    for update to authenticated
    using (
        bucket_id = 'user_avatars'
        and (storage.foldername(name))[1] = (select auth.uid()::text)
    );
drop policy if exists "User can delete own avatar" on storage.objects;
create policy "User can delete own avatar" on storage.objects
    for delete to authenticated
    using (
        bucket_id = 'user_avatars'
        and (storage.foldername(name))[1] = (select auth.uid()::text)
    );

-- Channel Avatars Bucket Configuration
-- Purpose: Store images for chat channels.
-- Max File Size: 1MB (1,048,576 bytes).
-- Allowed MIME Types: JPEG, PNG, SVG, GIF, WebP.
insert into storage.buckets
    (id, name, public, file_size_limit, allowed_mime_types)
values
    ('channel_avatars', 'channel_avatars', true, 1048576,
     '{"image/jpeg", "image/png", "image/svg+xml", "image/gif", "image/webp"}')
on conflict (id) do nothing;

-- Policies for Channel Avatars Bucket
-- Channel avatars: same SELECT-for-upload-readback rationale as above.
drop policy if exists "Channel Avatar is publicly accessible" on storage.objects;
create policy "Channel Avatar is publicly accessible" on storage.objects
    for select to authenticated using (
        bucket_id = 'channel_avatars'
        and (storage.foldername(name))[1] = (select auth.uid()::text)
    );
drop policy if exists "User can upload a channel avatar" on storage.objects;
create policy "User can upload a channel avatar" on storage.objects
    for insert to authenticated
    with check (
        bucket_id = 'channel_avatars'
        and (storage.foldername(name))[1] = (select auth.uid()::text)
    );
drop policy if exists "User can update own channel avatar" on storage.objects;
create policy "User can update own channel avatar" on storage.objects
    for update to authenticated
    using (
        bucket_id = 'channel_avatars'
        and (storage.foldername(name))[1] = (select auth.uid()::text)
    );
drop policy if exists "User can delete own channel avatar" on storage.objects;
create policy "User can delete own channel avatar" on storage.objects
    for delete to authenticated
    using (
        bucket_id = 'channel_avatars'
        and (storage.foldername(name))[1] = (select auth.uid()::text)
    );

-- Media Files Bucket Configuration
-- Purpose: Store various media files related to messages.
-- Max File Size: 2MB (2,097,152 bytes).
-- Allowed MIME Types: All file types.
insert into storage.buckets
    (id, name, public, file_size_limit, allowed_mime_types)
values
    ('media', 'media', true, 2097152, '{"*/*"}')
on conflict (id) do nothing;

-- Policies for Media Files Bucket.
-- SELECT scoped to the uploader (owner_id) matches the UPDATE/DELETE
-- policies below. Public URLs are still served by storage's HTTP
-- handler; the SELECT exists for the upload INSERT-then-readback.
drop policy if exists "Media files are publicly accessible" on storage.objects;
create policy "Media files are publicly accessible" on storage.objects
    for select to authenticated using (
        bucket_id = 'media'
        and (select auth.uid())::text = owner_id
    );
drop policy if exists "User can upload media files" on storage.objects;
create policy "User can upload media files" on storage.objects
    for insert to authenticated with check (bucket_id = 'media');
drop policy if exists "User can update own media files" on storage.objects;
create policy "User can update own media files" on storage.objects
    for update to authenticated using ((select auth.uid())::text = owner_id and bucket_id = 'media');
drop policy if exists "User can delete own media files" on storage.objects;
create policy "User can delete own media files" on storage.objects
    for delete to authenticated using ((select auth.uid())::text = owner_id and bucket_id = 'media');


-- ============================================================================
-- File: 13-RLS.sql
-- ============================================================================

-- =====================================================================
-- 13-RLS.sql — Row-Level Security: helpers + policies for chat surface
-- =====================================================================
-- Source of truth for the chat-surface RLS rollout. Mirrored by the
-- migration `20260513130000_chat_rls_rollout_catchup.sql`. See
-- docs/superpowers/plans/chatroom-s3-1-rls-rollout.md for design rationale.
--
-- Load order: this file runs after the table-creation scripts (02-08),
-- the function/RPC scripts (10-*), and the message-counter / cron / extension
-- scripts (11-12). Helpers come first in this file so the policy
-- expressions below can reference them.
-- =====================================================================


-- =====================================================================
-- 1. internal helper functions (policy primitives)
-- =====================================================================
-- SECURITY DEFINER + SET search_path = public — search-path-hijack safe.
-- STABLE SQL bodies are inlined by the planner, so policy expressions
-- effectively become the inlined EXISTS subqueries against:
--   workspace_members_workspace_id_member_id_key  → is_workspace_member
--   idx_channel_members_channel_id_member_id      → is_channel_member
--   channels_pkey + the above                     → can_read_channel

CREATE SCHEMA IF NOT EXISTS internal;

CREATE OR REPLACE FUNCTION internal.is_workspace_member(p_workspace_id varchar)
RETURNS boolean
LANGUAGE sql STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.workspace_members
    WHERE workspace_id = p_workspace_id
      AND member_id    = auth.uid()
      AND left_at IS NULL
  );
$$;

COMMENT ON FUNCTION internal.is_workspace_member(varchar) IS
'Active workspace membership predicate for RLS policies.';

CREATE OR REPLACE FUNCTION internal.is_channel_member(p_channel_id varchar)
RETURNS boolean
LANGUAGE sql STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.channel_members
    WHERE channel_id = p_channel_id
      AND member_id  = auth.uid()
      AND left_at IS NULL
  );
$$;

COMMENT ON FUNCTION internal.is_channel_member(varchar) IS
'Active channel membership predicate for RLS policies.';

CREATE OR REPLACE FUNCTION internal.can_read_channel(p_channel_id varchar)
RETURNS boolean
LANGUAGE sql STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.channels c
    WHERE c.id = p_channel_id
      AND (
        c.type = 'PUBLIC'
        OR EXISTS (
          SELECT 1 FROM public.channel_members cm
          WHERE cm.channel_id = c.id
            AND cm.member_id  = auth.uid()
            AND cm.left_at IS NULL
        )
      )
  );
$$;

COMMENT ON FUNCTION internal.can_read_channel(varchar) IS
'PUBLIC bypass + active channel membership; read-eligibility predicate.';

-- Anon is blocked at the policy level (TO authenticated) before any helper
-- call, so anon does not need USAGE on internal.
GRANT USAGE ON SCHEMA internal                                 TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION internal.is_workspace_member(varchar) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION internal.is_channel_member(varchar)   TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION internal.can_read_channel(varchar)    TO authenticated, service_role;


-- =====================================================================
-- 2. RLS + policies per table
-- =====================================================================

-- 2a. users — readable by every authenticated user (mention picker, sender
--     info, avatars). Column-level GRANT excludes `email` from both anon
--     (in 29-lint-hardening.sql §3) and authenticated (below), so the row
--     policy stays `USING (true)` while email never leaves SECURITY DEFINER
--     RPCs that legitimately need it (e.g. create_direct_message_channel).

ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS users_select       ON public.users;
DROP POLICY IF EXISTS users_self_update  ON public.users;

CREATE POLICY users_select ON public.users
  FOR SELECT TO authenticated
  USING (true);

CREATE POLICY users_self_update ON public.users
  FOR UPDATE TO authenticated
  USING      (id = auth.uid())
  WITH CHECK (id = auth.uid());

-- Mirror the anon column whitelist for authenticated. `email` is excluded;
-- DEFINER RPCs bypass column grants so legitimate readers are unaffected.
REVOKE SELECT ON public.users FROM authenticated;
GRANT SELECT (
    id, username, full_name, display_name, avatar_url, avatar_updated_at,
    profile_data, status, online_at, created_at, updated_at, deleted_at
) ON public.users TO authenticated;

-- Mirror the SELECT whitelist for UPDATE so PostgREST cannot accept a PATCH
-- against `email`, `id`, `created_at`, or any column outside the
-- user-editable profile surface. `online_at` is excluded because it's
-- trigger-maintained from `status` writes — granting it directly would
-- let a client antedate themselves and skew the online-window used by
-- push suppression. DEFINER RPCs bypass column grants.
REVOKE UPDATE ON public.users FROM authenticated;
GRANT UPDATE (
    username, full_name, avatar_url, avatar_updated_at, profile_data, status
) ON public.users TO authenticated;


-- 2b. workspaces — visible to active members.

ALTER TABLE public.workspaces ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS workspaces_member_select  ON public.workspaces;
DROP POLICY IF EXISTS workspaces_creator_insert ON public.workspaces;

CREATE POLICY workspaces_member_select ON public.workspaces
  FOR SELECT TO authenticated
  USING (internal.is_workspace_member(id));

-- Auto-bootstrap path: client/SSR INSERT a workspace row when a new doc is
-- opened. Confined to the creating user; UPDATE remains gated through
-- SECURITY DEFINER paths (e.g. join_workspace) so name/slug stay immutable
-- from PostgREST.
CREATE POLICY workspaces_creator_insert ON public.workspaces
  FOR INSERT TO authenticated
  WITH CHECK (created_by = auth.uid());


-- 2c. workspace_members — same-workspace members see each other.

ALTER TABLE public.workspace_members ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS workspace_members_select ON public.workspace_members;

CREATE POLICY workspace_members_select ON public.workspace_members
  FOR SELECT TO authenticated
  USING (internal.is_workspace_member(workspace_id));


-- 2d. channels — PUBLIC bypass + member visibility.
--     INSERT: only as creator and only into a workspace I'm a member of.
--     UPDATE: any active member can update *mutable* columns; immutable
--     columns are locked via column-level GRANT below.

ALTER TABLE public.channels ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS channels_visible_select  ON public.channels;
DROP POLICY IF EXISTS channels_member_insert   ON public.channels;
DROP POLICY IF EXISTS channels_member_update   ON public.channels;

CREATE POLICY channels_visible_select ON public.channels
  FOR SELECT TO authenticated
  USING (type = 'PUBLIC' OR internal.is_channel_member(id));

CREATE POLICY channels_member_insert ON public.channels
  FOR INSERT TO authenticated
  WITH CHECK (
    created_by = auth.uid()
    AND internal.is_workspace_member(workspace_id)
  );

CREATE POLICY channels_member_update ON public.channels
  FOR UPDATE TO authenticated
  USING      (internal.is_channel_member(id))
  WITH CHECK (internal.is_channel_member(id));

-- Column-level grant: lock id/slug/workspace_id/created_by/type/member_count
-- /deleted_at/created_at/updated_at from direct FE update. RPCs (definer)
-- bypass column grants too.
REVOKE UPDATE ON public.channels FROM authenticated;
GRANT UPDATE (
  name, description, member_limit, is_avatar_set,
  allow_emoji_reactions, mute_in_app_notifications, metadata,
  last_message_preview, last_activity_at
) ON public.channels TO authenticated;


-- 2e. channel_members — visible iff channel is readable.
--     FE: insert own row (joinChannel), update only notification + read cursor columns (column GRANT below).

ALTER TABLE public.channel_members ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS channel_members_select ON public.channel_members;

CREATE POLICY channel_members_select ON public.channel_members
  FOR SELECT TO authenticated
  USING (internal.can_read_channel(channel_id));

-- FE joinChannel uses PostgREST upsert; invoker must insert/update own row only.
-- Eligibility: PUBLIC channels (same read gate as lurkers with login) or workspace member
-- (PRIVATE heading chats before a channel_members row exists — chicken/egg vs can_read_channel).

DROP POLICY IF EXISTS channel_members_join_insert ON public.channel_members;
CREATE POLICY channel_members_join_insert ON public.channel_members
  FOR INSERT TO authenticated
  WITH CHECK (
    member_id = (SELECT auth.uid())
    AND EXISTS (
      SELECT 1 FROM public.channels c
      WHERE c.id = channel_id
        AND c.deleted_at IS NULL
        AND c.type IN ('PUBLIC', 'PRIVATE')
        AND internal.is_workspace_member(c.workspace_id)
    )
  );

DROP POLICY IF EXISTS channel_members_self_update ON public.channel_members;
CREATE POLICY channel_members_self_update ON public.channel_members
  FOR UPDATE TO authenticated
  USING (member_id = auth.uid())
  WITH CHECK (member_id = auth.uid());

REVOKE UPDATE ON public.channel_members FROM authenticated;
GRANT UPDATE (
  last_read_message_id,
  last_read_update_at,
  mute_in_app_notifications,
  notif_state
) ON public.channel_members TO authenticated;


-- 2f. messages — visible iff channel is readable.
--     INSERT: as self into a readable channel.
--     UPDATE: only own row (covers edit + soft-delete via deleted_at).

ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS messages_visible_select ON public.messages;
DROP POLICY IF EXISTS messages_self_insert    ON public.messages;
DROP POLICY IF EXISTS messages_self_update    ON public.messages;

CREATE POLICY messages_visible_select ON public.messages
  FOR SELECT TO authenticated
  USING (internal.can_read_channel(channel_id));

CREATE POLICY messages_self_insert ON public.messages
  FOR INSERT TO authenticated
  WITH CHECK (
    user_id = auth.uid()
    AND internal.can_read_channel(channel_id)
  );

CREATE POLICY messages_self_update ON public.messages
  FOR UPDATE TO authenticated
  USING      (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());


-- 2g. pinned_messages — readable iff channel is readable.
--     Writes via update_message_on_pin trigger (definer bypass).

ALTER TABLE public.pinned_messages ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS pinned_messages_select ON public.pinned_messages;

CREATE POLICY pinned_messages_select ON public.pinned_messages
  FOR SELECT TO authenticated
  USING (internal.can_read_channel(channel_id));


-- 2h. channel_message_counts — readable iff channel is readable.
--     Writes via the counter worker (definer bypass).

ALTER TABLE public.channel_message_counts ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS channel_message_counts_select ON public.channel_message_counts;

CREATE POLICY channel_message_counts_select ON public.channel_message_counts
  FOR SELECT TO authenticated
  USING (internal.can_read_channel(channel_id));


-- 2i. notifications — only your own.
--     INSERT via the notification creators (triggers, definer bypass).

ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS notifications_self_select  ON public.notifications;
DROP POLICY IF EXISTS notifications_self_update  ON public.notifications;

CREATE POLICY notifications_self_select ON public.notifications
  FOR SELECT TO authenticated
  USING (receiver_user_id = auth.uid());

CREATE POLICY notifications_self_update ON public.notifications
  FOR UPDATE TO authenticated
  USING      (receiver_user_id = auth.uid())
  WITH CHECK (receiver_user_id = auth.uid());


-- 2j. document_views (parent + future month-partitions) — analytics only.
--     enqueue_document_view (definer) and analytics RPCs (service_role)
--     bypass RLS. No SELECT/INSERT/UPDATE/DELETE policy → default deny
--     for authenticated/anon. The `create_document_views_partitions`
--     function (21-document-views.sql) is patched to enable RLS on each
--     newly-created partition so the linter stays clean every month.

ALTER TABLE public.document_views ENABLE ROW LEVEL SECURITY;
-- Existing partitions get RLS enabled by the migration. The line below
-- exists so a fresh `db reset` (which loads scripts from scratch) lands
-- in the same state without depending on migration replay. Currently a
-- no-op because the partition tables are managed by the cron function.


-- =====================================================================
-- 3. Anonymous read access to PUBLIC channels
-- =====================================================================
-- Product: anonymous visitors can READ chat in PUBLIC channels (lurking).
-- Writes (send, react, bookmark, mark-as-read) require login; the FE
-- gates those actions behind authentication, and the existing INSERT/
-- UPDATE policies (TO authenticated only) keep the DB layer correct
-- even if the FE skips its gate.
--
-- For unread display: anon has no channel_members row, so the FE shows
-- channel_message_counts.message_count as the "messages so far" total
-- (see useMapDocumentAndWorkspace.ts::fetchChannels).
--
-- Each policy is a separate `<table>_public_anon_select` rule scoped to
-- TO anon — authenticated paths above remain unchanged. This deliberately
-- re-introduces `pg_graphql_anon_table_exposed` lints on these tables;
-- that's product intent now, not an oversight.

DROP POLICY IF EXISTS channels_public_anon_select       ON public.channels;
CREATE POLICY channels_public_anon_select ON public.channels
  FOR SELECT TO anon
  USING (type = 'PUBLIC' AND deleted_at IS NULL);

DROP POLICY IF EXISTS messages_public_anon_select       ON public.messages;
CREATE POLICY messages_public_anon_select ON public.messages
  FOR SELECT TO anon
  USING (
    deleted_at IS NULL
    AND EXISTS (
      SELECT 1 FROM public.channels c
      WHERE c.id = messages.channel_id
        AND c.type = 'PUBLIC'
        AND c.deleted_at IS NULL
    )
  );

DROP POLICY IF EXISTS counts_public_anon_select         ON public.channel_message_counts;
CREATE POLICY counts_public_anon_select ON public.channel_message_counts
  FOR SELECT TO anon
  USING (
    EXISTS (
      SELECT 1 FROM public.channels c
      WHERE c.id = channel_message_counts.channel_id
        AND c.type = 'PUBLIC'
        AND c.deleted_at IS NULL
    )
  );

DROP POLICY IF EXISTS pinned_public_anon_select         ON public.pinned_messages;
CREATE POLICY pinned_public_anon_select ON public.pinned_messages
  FOR SELECT TO anon
  USING (
    EXISTS (
      SELECT 1 FROM public.channels c
      WHERE c.id = pinned_messages.channel_id
        AND c.type = 'PUBLIC'
        AND c.deleted_at IS NULL
    )
  );

DROP POLICY IF EXISTS users_public_anon_select          ON public.users;
CREATE POLICY users_public_anon_select ON public.users
  FOR SELECT TO anon
  USING (true);

DROP POLICY IF EXISTS workspaces_public_anon_select     ON public.workspaces;
CREATE POLICY workspaces_public_anon_select ON public.workspaces
  FOR SELECT TO anon
  USING (
    deleted_at IS NULL
    AND EXISTS (
      SELECT 1 FROM public.channels c
      WHERE c.workspace_id = workspaces.id
        AND c.type = 'PUBLIC'
        AND c.deleted_at IS NULL
    )
  );


-- ============================================================
-- Hardening: pin search_path = public on functions defined above
-- (idempotent — safe to re-run)
-- ============================================================
ALTER FUNCTION internal.is_workspace_member(p_workspace_id character varying) SET search_path = public;
ALTER FUNCTION internal.is_channel_member(p_channel_id character varying) SET search_path = public;
ALTER FUNCTION internal.can_read_channel(p_channel_id character varying) SET search_path = public;

-- ============================================================
-- v2 chatroom RPC grants (paired with migrations 20260513140500..20260513141500).
-- Mirrored here so privilege review reads in one place.
-- ============================================================
grant execute on function public.fetch_message_window(varchar, text, text, int, int)
  to authenticated, anon;
grant execute on function public.fetch_messages_since(varchar, bigint, int)
  to authenticated, anon;
grant execute on function public.advance_read_cursor(varchar, bigint) to authenticated;
revoke execute on function public.advance_read_cursor(varchar, bigint) from anon, public;
grant execute on function public.add_reaction(uuid, text) to authenticated;
revoke execute on function public.add_reaction(uuid, text) from anon, public;
grant execute on function public.remove_reaction(uuid, text) to authenticated;
revoke execute on function public.remove_reaction(uuid, text) from anon, public;


-- ============================================================================
-- File: 16-cron-jobs.sql
-- ============================================================================

-- Scheduled tasks for database maintenance and system operations

-- Automatically update user status to offline when inactive
-- This cron job runs every 2 minutes and updates user status to 'OFFLINE'
-- for users who haven't been active (based on online_at timestamp) for more than 2 minutes.
-- The 2-minute interval is consistent with the is_user_online() helper function
-- used by push notifications, ensuring cohesive online/offline behavior.
select cron.schedule(
    'update-user-status',
    '*/2 * * * *',
    $$
    update public.users
    set status = 'OFFLINE'
    where online_at < now() - interval '2 minutes' and status = 'ONLINE';
    $$
);

-- Drains failed/expired push subscriptions so they do not accumulate
-- forever; function body is defined in 07-4 (push pipeline).
select cron.unschedule('cleanup-push-subscriptions')
from cron.job where jobname = 'cleanup-push-subscriptions';

select cron.schedule(
    'cleanup-push-subscriptions',
    '*/5 * * * *',
    $$ select internal.cleanup_push_subscriptions(); $$
);

-- Commented out: Delete read notifications
-- This job would delete all notifications that have been read by users.
-- Uncomment if you want to periodically clean up read notifications from the database.
-- select cron.schedule(
--     'delete-read-notifications',
--     '0 0 * * *',  -- Run daily at midnight
--     $$
--     delete from public.notifications
--     where readed_at is not null;
--     $$
-- );


-- ============================================================================
-- File: 17-realtime-replica.sql
-- ============================================================================

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


-- ============================================================================
-- File: 22-user-retention.sql
-- ============================================================================

-- =============================================================================
-- User Retention Analytics (Phase 8)
-- =============================================================================
-- Provides DAU/WAU/MAU metrics, user lifecycle segments, and retention analysis.
--
-- METRICS:
--   - DAU/WAU/MAU: Active users based on online_at timestamp
--   - Stickiness: DAU/MAU ratio (engagement quality)
--   - User Lifecycle: New/Active/Returning/At Risk/Churned segments
--   - Activity Trends: Daily active user counts over time
--
-- USAGE:
--   SELECT * FROM get_retention_metrics();
--   SELECT * FROM get_user_lifecycle_segments();
--   SELECT * FROM get_dau_trend(30);
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. Get Retention Metrics (DAU/WAU/MAU/Stickiness)
-- -----------------------------------------------------------------------------
-- Optimized: Single query with FILTER instead of 7 separate COUNT queries
-- -----------------------------------------------------------------------------
create or replace function public.get_retention_metrics()
returns jsonb
language plpgsql
security definer
stable
set search_path = public
as $$
declare
    v_dau integer;
    v_wau integer;
    v_mau integer;
    v_dau_prev integer;
    v_wau_prev integer;
    v_mau_prev integer;
    v_total_users integer;
begin
    -- Single optimized query using FILTER
    select
        count(*) filter (where online_at >= now() - interval '24 hours'),
        count(*) filter (where online_at >= now() - interval '7 days'),
        count(*) filter (where online_at >= now() - interval '30 days'),
        count(*) filter (where online_at >= now() - interval '48 hours' and online_at < now() - interval '24 hours'),
        count(*) filter (where online_at >= now() - interval '14 days' and online_at < now() - interval '7 days'),
        count(*) filter (where online_at >= now() - interval '60 days' and online_at < now() - interval '30 days'),
        count(*)
    into v_dau, v_wau, v_mau, v_dau_prev, v_wau_prev, v_mau_prev, v_total_users
    from public.users;

    return jsonb_build_object(
        'dau', v_dau,
        'wau', v_wau,
        'mau', v_mau,
        'dau_prev', v_dau_prev,
        'wau_prev', v_wau_prev,
        'mau_prev', v_mau_prev,
        'total_users', v_total_users,
        'stickiness', case when v_mau > 0 then round((v_dau::numeric / v_mau) * 100, 1) else 0 end,
        'dau_change_pct', case when v_dau_prev > 0 then round(((v_dau - v_dau_prev)::numeric / v_dau_prev) * 100, 1) else 0 end,
        'wau_change_pct', case when v_wau_prev > 0 then round(((v_wau - v_wau_prev)::numeric / v_wau_prev) * 100, 1) else 0 end,
        'mau_change_pct', case when v_mau_prev > 0 then round(((v_mau - v_mau_prev)::numeric / v_mau_prev) * 100, 1) else 0 end
    );
end;
$$;

comment on function public.get_retention_metrics() is
'Returns DAU/WAU/MAU counts with period-over-period comparison and stickiness ratio.';

-- -----------------------------------------------------------------------------
-- 2. Get User Lifecycle Segments
-- -----------------------------------------------------------------------------
-- Segments:
--   - New: Created in last 7 days
--   - Active: Online in last 7 days (not new)
--   - At Risk: Last online 14-30 days ago
--   - Churned: Last online > 30 days ago
-- Optimized: Single query with FILTER instead of 5 separate COUNT queries
-- -----------------------------------------------------------------------------
create or replace function public.get_user_lifecycle_segments()
returns jsonb
language plpgsql
security definer
stable
set search_path = public
as $$
declare
    v_new integer;
    v_active integer;
    v_at_risk integer;
    v_churned integer;
    v_total integer;
begin
    -- Single optimized query using FILTER
    select
        count(*) filter (where created_at >= now() - interval '7 days'),
        count(*) filter (where online_at >= now() - interval '7 days' and created_at < now() - interval '7 days'),
        count(*) filter (where
            (online_at < now() - interval '14 days' and online_at >= now() - interval '30 days')
            or (online_at is null and created_at < now() - interval '14 days' and created_at >= now() - interval '30 days')
        ),
        count(*) filter (where
            (online_at < now() - interval '30 days')
            or (online_at is null and created_at < now() - interval '30 days')
        ),
        count(*)
    into v_new, v_active, v_at_risk, v_churned, v_total
    from public.users;

    return jsonb_build_object(
        'new', v_new,
        'active', v_active,
        'at_risk', v_at_risk,
        'churned', v_churned,
        'total', v_total,
        'new_pct', case when v_total > 0 then round((v_new::numeric / v_total) * 100, 1) else 0 end,
        'active_pct', case when v_total > 0 then round((v_active::numeric / v_total) * 100, 1) else 0 end,
        'at_risk_pct', case when v_total > 0 then round((v_at_risk::numeric / v_total) * 100, 1) else 0 end,
        'churned_pct', case when v_total > 0 then round((v_churned::numeric / v_total) * 100, 1) else 0 end
    );
end;
$$;

comment on function public.get_user_lifecycle_segments() is
'Returns user counts by lifecycle segment: New, Active, At Risk, Churned.';

-- -----------------------------------------------------------------------------
-- 3. Get DAU Trend (Daily Active Users over time)
-- -----------------------------------------------------------------------------
create or replace function public.get_dau_trend(p_days integer default 30)
returns table (
    activity_date date,
    active_users integer
)
language plpgsql
security definer
stable
set search_path = public
as $$
begin
    return query
    with date_series as (
        select generate_series(
            current_date - (p_days - 1),
            current_date,
            interval '1 day'
        )::date as d
    ),
    daily_counts as (
        select
            online_at::date as activity_date,
            count(distinct id) as active_users
        from public.users
        where online_at >= current_date - p_days
        group by online_at::date
    )
    select
        ds.d as activity_date,
        coalesce(dc.active_users, 0)::integer as active_users
    from date_series ds
    left join daily_counts dc on ds.d = dc.activity_date
    order by ds.d;
end;
$$;

comment on function public.get_dau_trend(integer) is
'Returns daily active user counts for the specified number of days.';

-- -----------------------------------------------------------------------------
-- 4. Get Activity by Hour (for heatmap)
-- -----------------------------------------------------------------------------
create or replace function public.get_activity_by_hour(p_days integer default 7)
returns table (
    hour_of_day integer,
    day_of_week integer,
    message_count bigint
)
language plpgsql
security definer
stable
set search_path = public
as $$
begin
    return query
    select
        extract(hour from m.created_at)::integer as hour_of_day,
        extract(dow from m.created_at)::integer as day_of_week,
        count(*) as message_count
    from public.messages m
    join public.channels c on m.channel_id = c.id
    where m.created_at >= now() - (p_days || ' days')::interval
      and c.type = 'PUBLIC'
    group by
        extract(hour from m.created_at),
        extract(dow from m.created_at)
    order by day_of_week, hour_of_day;
end;
$$;

comment on function public.get_activity_by_hour(integer) is
'Returns message counts by hour and day of week for activity heatmap.';

-- -----------------------------------------------------------------------------
-- 5. Get Top Active Documents (by message count)
-- -----------------------------------------------------------------------------
create or replace function public.get_top_active_documents(p_limit integer default 5, p_days integer default 7)
returns table (
    workspace_id uuid,
    document_slug text,
    message_count bigint,
    unique_users bigint
)
language plpgsql
security definer
stable
set search_path = public
as $$
begin
    return query
    select
        w.id as workspace_id,
        w.slug as document_slug,
        count(m.id) as message_count,
        count(distinct m.user_id) as unique_users
    from public.workspaces w
    join public.channels c on c.workspace_id = w.id
    join public.messages m on m.channel_id = c.id
    where m.created_at >= now() - (p_days || ' days')::interval
      and c.type = 'PUBLIC'
    group by w.id, w.slug
    order by message_count desc
    limit p_limit;
end;
$$;

comment on function public.get_top_active_documents(integer, integer) is
'Returns top documents by message activity in the specified period.';

-- -----------------------------------------------------------------------------
-- 6. Get Message Type Distribution
-- -----------------------------------------------------------------------------
create or replace function public.get_message_type_distribution(p_days integer default 7)
returns table (
    message_type text,
    count bigint,
    percentage numeric
)
language plpgsql
security definer
stable
set search_path = public
as $$
declare
    v_total bigint;
begin
    -- Get total count first
    select count(*) into v_total
    from public.messages m
    join public.channels c on m.channel_id = c.id
    where m.created_at >= now() - (p_days || ' days')::interval
      and c.type = 'PUBLIC';

    return query
    select
        coalesce(m.type, 'text') as message_type,
        count(*) as count,
        case when v_total > 0 then round((count(*)::numeric / v_total) * 100, 1) else 0 end as percentage
    from public.messages m
    join public.channels c on m.channel_id = c.id
    where m.created_at >= now() - (p_days || ' days')::interval
      and c.type = 'PUBLIC'
    group by coalesce(m.type, 'text')
    order by count desc;
end;
$$;

comment on function public.get_message_type_distribution(integer) is
'Returns message counts by type (text, image, video, etc.) for PUBLIC channels.';

-- -----------------------------------------------------------------------------
-- 7. Get Communication Stats
-- -----------------------------------------------------------------------------
create or replace function public.get_communication_stats(p_days integer default 7)
returns jsonb
language plpgsql
security definer
stable
set search_path = public
as $$
declare
    v_total_messages bigint;
    v_messages_with_reactions bigint;
    v_unique_senders bigint;
begin
    -- Count from PUBLIC channels only
    select
        count(*),
        count(*) filter (where m.reactions is not null and m.reactions != '[]'::jsonb),
        count(distinct m.user_id)
    into v_total_messages, v_messages_with_reactions, v_unique_senders
    from public.messages m
    join public.channels c on m.channel_id = c.id
    where m.created_at >= now() - (p_days || ' days')::interval
      and c.type = 'PUBLIC';

    return jsonb_build_object(
        'total_messages', v_total_messages,
        'messages_with_reactions', v_messages_with_reactions,
        'unique_senders', v_unique_senders,
        'reaction_rate', case when v_total_messages > 0 then round((v_messages_with_reactions::numeric / v_total_messages) * 100, 1) else 0 end
    );
end;
$$;

comment on function public.get_communication_stats(integer) is
'Returns communication statistics for PUBLIC channels: messages and reactions.';

-- -----------------------------------------------------------------------------
-- 8. Get Notification Reach
-- -----------------------------------------------------------------------------
create or replace function public.get_notification_reach()
returns jsonb
language plpgsql
security definer
stable
set search_path = public
as $$
declare
    v_total_users integer;
    v_push_enabled integer;
    v_email_enabled integer;
    v_notification_read_rate numeric;
begin
    select count(*) into v_total_users from public.users;

    -- Users with active push subscriptions
    select count(distinct user_id) into v_push_enabled
    from public.push_subscriptions
    where user_id is not null;

    -- Users with email notifications enabled (check profile_data.notification_preferences)
    select count(*) into v_email_enabled
    from public.users
    where (profile_data->'notification_preferences'->>'email_enabled')::boolean = true
       or profile_data->'notification_preferences'->>'email_enabled' is null; -- Default is enabled

    -- Notification read rate
    select
        case when count(*) > 0
            then round((count(*) filter (where readed_at is not null)::numeric / count(*)) * 100, 1)
            else 0
        end
    into v_notification_read_rate
    from public.notifications
    where created_at >= now() - interval '7 days';

    return jsonb_build_object(
        'total_users', v_total_users,
        'push_enabled', v_push_enabled,
        'email_enabled', v_email_enabled,
        'push_reach_pct', case when v_total_users > 0 then round((v_push_enabled::numeric / v_total_users) * 100, 1) else 0 end,
        'email_reach_pct', case when v_total_users > 0 then round((v_email_enabled::numeric / v_total_users) * 100, 1) else 0 end,
        'notification_read_rate', v_notification_read_rate
    );
end;
$$;

comment on function public.get_notification_reach() is
'Returns notification reach statistics: push/email enabled users and read rate.';

-- -----------------------------------------------------------------------------
-- Grant Permissions
-- -----------------------------------------------------------------------------
-- These functions read full-table aggregates from public.users, public.messages,
-- public.notifications, etc. Postgres grants EXECUTE to `public` by default,
-- so an explicit GRANT TO service_role is non-exclusive without a matching
-- REVOKE FROM public. Admin gating happens at the Hocuspocus controller
-- (service_role key).

revoke execute on function public.get_retention_metrics() from public, anon, authenticated;
grant  execute on function public.get_retention_metrics() to service_role;

revoke execute on function public.get_user_lifecycle_segments() from public, anon, authenticated;
grant  execute on function public.get_user_lifecycle_segments() to service_role;

revoke execute on function public.get_dau_trend(integer) from public, anon, authenticated;
grant  execute on function public.get_dau_trend(integer) to service_role;

revoke execute on function public.get_activity_by_hour(integer) from public, anon, authenticated;
grant  execute on function public.get_activity_by_hour(integer) to service_role;

revoke execute on function public.get_top_active_documents(integer, integer) from public, anon, authenticated;
grant  execute on function public.get_top_active_documents(integer, integer) to service_role;

revoke execute on function public.get_message_type_distribution(integer) from public, anon, authenticated;
grant  execute on function public.get_message_type_distribution(integer) to service_role;

revoke execute on function public.get_communication_stats(integer) from public, anon, authenticated;
grant  execute on function public.get_communication_stats(integer) to service_role;

revoke execute on function public.get_notification_reach() from public, anon, authenticated;
grant  execute on function public.get_notification_reach() to service_role;

-- ============================================================
-- Hardening: pin search_path = public on functions defined above
-- (idempotent — safe to re-run)
-- ============================================================
ALTER FUNCTION public.get_retention_metrics() SET search_path = public;
ALTER FUNCTION public.get_user_lifecycle_segments() SET search_path = public;
ALTER FUNCTION public.get_dau_trend(p_days integer) SET search_path = public;
ALTER FUNCTION public.get_activity_by_hour(p_days integer) SET search_path = public;
ALTER FUNCTION public.get_top_active_documents(p_limit integer, p_days integer) SET search_path = public;
ALTER FUNCTION public.get_message_type_distribution(p_days integer) SET search_path = public;
ALTER FUNCTION public.get_communication_stats(p_days integer) SET search_path = public;
ALTER FUNCTION public.get_notification_reach() SET search_path = public;


-- ============================================================================
-- File: 27-failed-notifications-audit.sql
-- ============================================================================

-- =============================================================================
-- Phase 17: Failed Notifications Audit — Admin Functions
-- =============================================================================
--
-- Creates 6 functions for auditing notification delivery failures.
-- All functions live in the public schema (Supabase PostgREST convention)
-- and use SECURITY DEFINER + search_path = public for safe RLS bypass.
-- Access control is enforced at the API layer via adminAuthMiddleware.
--
-- Prerequisites:
--   - public.push_subscriptions (script 19)
--   - public.email_queue (script 20)
--   - public.email_bounces (script 20)
--   - public.users
--
-- Column reference verification:
--   push_subscriptions: failed_count, last_error, is_active, updated_at, push_credentials (jsonb)
--   email_queue: status, error_message (NOT 'error'), created_at (NO 'updated_at'), attempts
--   email_bounces: bounce_type, provider, reason, email, created_at

-- =============================================================================
-- 1. Push Failure Summary (error category + platform breakdown)
-- =============================================================================

CREATE OR REPLACE FUNCTION public.get_push_failure_summary()
RETURNS TABLE (
  error_category TEXT,
  platform TEXT,
  failure_count BIGINT,
  affected_users BIGINT,
  last_failure_at TIMESTAMPTZ,
  sample_errors TEXT[]
)
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT
    CASE
      WHEN ps.last_error ILIKE '%410%' OR ps.last_error ILIKE '%expired%' THEN 'EXPIRED'
      WHEN ps.last_error ILIKE '%404%' OR ps.last_error ILIKE '%not found%' THEN 'NOT_FOUND'
      WHEN ps.last_error ILIKE '%401%' OR ps.last_error ILIKE '%unauthorized%' THEN 'UNAUTHORIZED'
      WHEN ps.last_error ILIKE '%429%' OR ps.last_error ILIKE '%rate%' THEN 'RATE_LIMITED'
      WHEN ps.last_error ILIKE '%413%' OR ps.last_error ILIKE '%payload%' THEN 'PAYLOAD_TOO_LARGE'
      WHEN ps.last_error ILIKE '%timeout%' THEN 'TIMEOUT'
      WHEN ps.last_error ILIKE '%network%' OR ps.last_error ILIKE '%connect%' THEN 'NETWORK_ERROR'
      ELSE 'OTHER'
    END AS error_category,

    CASE
      WHEN ps.push_credentials->>'endpoint' ILIKE '%fcm.googleapis.com%' THEN 'android'
      WHEN ps.push_credentials->>'endpoint' ILIKE '%web.push.apple.com%' THEN 'ios'
      WHEN ps.platform IS NOT NULL THEN ps.platform
      ELSE 'web'
    END AS platform,

    COUNT(*) AS failure_count,
    COUNT(DISTINCT ps.user_id) AS affected_users,
    MAX(ps.updated_at) AS last_failure_at,
    (array_agg(DISTINCT ps.last_error ORDER BY ps.last_error) FILTER (WHERE ps.last_error IS NOT NULL))[1:3] AS sample_errors

  FROM public.push_subscriptions ps
  WHERE ps.failed_count > 0
    AND ps.last_error IS NOT NULL
  GROUP BY 1, 2
  ORDER BY failure_count DESC;
$$;

-- =============================================================================
-- 2. Email Failure Summary (from email_queue + email_bounces)
-- =============================================================================

CREATE OR REPLACE FUNCTION public.get_email_failure_summary()
RETURNS TABLE (
  source TEXT,
  error_category TEXT,
  failure_count BIGINT,
  affected_users BIGINT,
  last_failure_at TIMESTAMPTZ
)
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  -- Failed emails from email_queue (uses error_message, NOT error)
  SELECT
    'queue' AS source,
    CASE
      WHEN eq.error_message ILIKE '%bounce%hard%' OR eq.error_message ILIKE '%invalid%email%' THEN 'HARD_BOUNCE'
      WHEN eq.error_message ILIKE '%bounce%soft%' OR eq.error_message ILIKE '%mailbox%full%' THEN 'SOFT_BOUNCE'
      WHEN eq.error_message ILIKE '%spam%' OR eq.error_message ILIKE '%complaint%' THEN 'SPAM_COMPLAINT'
      WHEN eq.error_message ILIKE '%rate%' OR eq.error_message ILIKE '%limit%' THEN 'RATE_LIMITED'
      WHEN eq.error_message ILIKE '%timeout%' THEN 'TIMEOUT'
      WHEN eq.error_message ILIKE '%Permanent failure%' THEN 'PERMANENT_FAILURE'
      ELSE 'OTHER'
    END AS error_category,
    COUNT(*) AS failure_count,
    COUNT(DISTINCT eq.user_id) AS affected_users,
    MAX(eq.created_at) AS last_failure_at  -- email_queue has NO updated_at column
  FROM public.email_queue eq
  WHERE eq.status = 'failed'
  GROUP BY 1, 2

  UNION ALL

  -- Bounces from email_bounces table (the authoritative bounce source)
  SELECT
    'bounce' AS source,
    UPPER(eb.bounce_type) AS error_category,
    COUNT(*) AS failure_count,
    COUNT(DISTINCT u.id) AS affected_users,
    MAX(eb.created_at) AS last_failure_at
  FROM public.email_bounces eb
  LEFT JOIN public.users u ON lower(u.email) = lower(eb.email)
  GROUP BY 1, 2

  ORDER BY failure_count DESC;
$$;

-- =============================================================================
-- 3. Detailed Failed Push Subscriptions (with user info)
-- =============================================================================

CREATE OR REPLACE FUNCTION public.get_failed_push_subscriptions(
  p_min_failures INTEGER DEFAULT 1,
  p_limit INTEGER DEFAULT 100
)
RETURNS TABLE (
  subscription_id UUID,
  user_id UUID,
  username TEXT,
  user_email TEXT,
  platform TEXT,
  error_category TEXT,
  last_error TEXT,
  failed_count INTEGER,
  is_active BOOLEAN,
  last_failure_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ
)
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT
    ps.id AS subscription_id,
    ps.user_id,
    u.username,
    u.email AS user_email,
    COALESCE(ps.platform,
      CASE
        WHEN ps.push_credentials->>'endpoint' ILIKE '%fcm.googleapis.com%' THEN 'android'
        WHEN ps.push_credentials->>'endpoint' ILIKE '%web.push.apple.com%' THEN 'ios'
        ELSE 'web'
      END
    ) AS platform,
    CASE
      WHEN ps.last_error ILIKE '%410%' OR ps.last_error ILIKE '%expired%' THEN 'EXPIRED'
      WHEN ps.last_error ILIKE '%404%' OR ps.last_error ILIKE '%not found%' THEN 'NOT_FOUND'
      WHEN ps.last_error ILIKE '%401%' OR ps.last_error ILIKE '%unauthorized%' THEN 'UNAUTHORIZED'
      WHEN ps.last_error ILIKE '%429%' OR ps.last_error ILIKE '%rate%' THEN 'RATE_LIMITED'
      ELSE 'OTHER'
    END AS error_category,
    ps.last_error,
    ps.failed_count,
    ps.is_active,
    ps.updated_at AS last_failure_at,
    ps.created_at
  FROM public.push_subscriptions ps
  LEFT JOIN public.users u ON u.id = ps.user_id
  WHERE ps.failed_count >= p_min_failures
  ORDER BY ps.failed_count DESC, ps.updated_at DESC
  LIMIT p_limit;
$$;

-- =============================================================================
-- 4. Email Bounces List (admin-only, shows full email)
-- =============================================================================

CREATE OR REPLACE FUNCTION public.get_email_bounces(
  p_bounce_type TEXT DEFAULT NULL,
  p_days INTEGER DEFAULT 30,
  p_limit INTEGER DEFAULT 100
)
RETURNS TABLE (
  bounce_id UUID,
  email TEXT,
  bounce_type TEXT,
  provider TEXT,
  reason TEXT,
  user_id UUID,
  username TEXT,
  bounced_at TIMESTAMPTZ
)
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT
    eb.id AS bounce_id,
    eb.email,
    eb.bounce_type,
    eb.provider,
    eb.reason,
    u.id AS user_id,
    u.username,
    eb.created_at AS bounced_at
  FROM public.email_bounces eb
  LEFT JOIN public.users u ON lower(u.email) = lower(eb.email)
  WHERE (p_bounce_type IS NULL OR eb.bounce_type = p_bounce_type)
    AND eb.created_at > now() - make_interval(days => p_days)
  ORDER BY eb.created_at DESC
  LIMIT p_limit;
$$;

-- =============================================================================
-- 5. Combined Notification Health Score
-- =============================================================================

CREATE OR REPLACE FUNCTION public.get_notification_health()
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
DECLARE
  result JSONB;
BEGIN
  SELECT jsonb_build_object(
    'push', jsonb_build_object(
      'total_subscriptions', (SELECT count(*) FROM push_subscriptions),
      'active_subscriptions', (SELECT count(*) FROM push_subscriptions WHERE is_active = true),
      'failed_subscriptions', (SELECT count(*) FROM push_subscriptions WHERE failed_count > 0),
      'disabled_subscriptions', (SELECT count(*) FROM push_subscriptions WHERE is_active = false),
      'expired_subscriptions', (SELECT count(*) FROM push_subscriptions
        WHERE is_active = false AND (last_error ILIKE '%410%' OR last_error ILIKE '%expired%')),
      'delivery_rate', CASE
        WHEN (SELECT count(*) FROM push_subscriptions WHERE is_active = true) > 0
        THEN round(
          (SELECT count(*) FROM push_subscriptions WHERE is_active = true AND failed_count = 0)::numeric /
          GREATEST((SELECT count(*) FROM push_subscriptions WHERE is_active = true)::numeric, 1) * 100, 1
        )
        ELSE 100
      END
    ),
    'email', jsonb_build_object(
      'total_queued', (SELECT count(*) FROM email_queue),
      'sent', (SELECT count(*) FROM email_queue WHERE status = 'sent'),
      'failed', (SELECT count(*) FROM email_queue WHERE status = 'failed'),
      'pending', (SELECT count(*) FROM email_queue WHERE status = 'pending'),
      'skipped', (SELECT count(*) FROM email_queue WHERE status = 'skipped'),
      'hard_bounces', (SELECT count(*) FROM email_bounces WHERE bounce_type = 'hard'),
      'soft_bounces', (SELECT count(*) FROM email_bounces WHERE bounce_type = 'soft'),
      'complaints', (SELECT count(*) FROM email_bounces WHERE bounce_type = 'complaint'),
      'delivery_rate', CASE
        WHEN (SELECT count(*) FROM email_queue WHERE status IN ('sent', 'failed')) > 0
        THEN round(
          (SELECT count(*) FROM email_queue WHERE status = 'sent')::numeric /
          GREATEST((SELECT count(*) FROM email_queue WHERE status IN ('sent', 'failed'))::numeric, 1) * 100, 1
        )
        ELSE 100
      END
    )
  ) INTO result;

  RETURN result;
END;
$$;

-- =============================================================================
-- 6. Bulk Disable Failed Push Subscriptions
-- =============================================================================

CREATE OR REPLACE FUNCTION public.disable_failed_subscriptions(
  p_min_failures INTEGER DEFAULT 5,
  p_error_pattern TEXT DEFAULT '%',
  p_subscription_ids UUID[] DEFAULT NULL
)
RETURNS TABLE (
  disabled_count INTEGER,
  subscription_ids UUID[]
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_count INTEGER;
  v_ids UUID[];
BEGIN
  IF p_subscription_ids IS NOT NULL AND array_length(p_subscription_ids, 1) > 0 THEN
    -- ID-based disable: only disable the specific subscriptions provided
    SELECT array_agg(id)
    INTO v_ids
    FROM public.push_subscriptions
    WHERE id = ANY(p_subscription_ids)
      AND is_active = true;
  ELSE
    -- Pattern-based disable: use min_failures + error pattern
    SELECT array_agg(id)
    INTO v_ids
    FROM public.push_subscriptions
    WHERE failed_count >= p_min_failures
      AND is_active = true
      AND (p_error_pattern = '%' OR last_error ILIKE p_error_pattern);
  END IF;

  UPDATE public.push_subscriptions
  SET is_active = false, updated_at = now()
  WHERE id = ANY(COALESCE(v_ids, ARRAY[]::uuid[]));

  GET DIAGNOSTICS v_count = ROW_COUNT;

  RETURN QUERY SELECT v_count, COALESCE(v_ids, ARRAY[]::uuid[]);
END;
$$;

-- =============================================================================
-- 7. Security: lock these audit functions to service_role only
-- =============================================================================
-- These functions read across ALL users' push/email failures and, in the case
-- of disable_failed_subscriptions, can deactivate many subscriptions in a
-- single call. Postgres grants EXECUTE to `public` by default; without an
-- explicit REVOKE, the existing GRANT TO service_role is non-exclusive and
-- any authenticated PostgREST caller can invoke them.
--
-- Admin gating happens at the Hocuspocus admin controller (service_role key);
-- mirror the grant pattern used in 28-ghost-accounts-audit.sql.

REVOKE EXECUTE ON FUNCTION public.get_push_failure_summary() FROM public, anon, authenticated;
GRANT  EXECUTE ON FUNCTION public.get_push_failure_summary() TO service_role;

REVOKE EXECUTE ON FUNCTION public.get_email_failure_summary() FROM public, anon, authenticated;
GRANT  EXECUTE ON FUNCTION public.get_email_failure_summary() TO service_role;

REVOKE EXECUTE ON FUNCTION public.get_failed_push_subscriptions(integer, integer) FROM public, anon, authenticated;
GRANT  EXECUTE ON FUNCTION public.get_failed_push_subscriptions(integer, integer) TO service_role;

REVOKE EXECUTE ON FUNCTION public.get_email_bounces(text, integer, integer) FROM public, anon, authenticated;
GRANT  EXECUTE ON FUNCTION public.get_email_bounces(text, integer, integer) TO service_role;

REVOKE EXECUTE ON FUNCTION public.get_notification_health() FROM public, anon, authenticated;
GRANT  EXECUTE ON FUNCTION public.get_notification_health() TO service_role;

REVOKE EXECUTE ON FUNCTION public.disable_failed_subscriptions(integer, text, uuid[]) FROM public, anon, authenticated;
GRANT  EXECUTE ON FUNCTION public.disable_failed_subscriptions(integer, text, uuid[]) TO service_role;

-- ============================================================
-- Hardening: pin search_path = public on functions defined above
-- (idempotent — safe to re-run)
-- ============================================================
ALTER FUNCTION public.get_push_failure_summary() SET search_path = public;
ALTER FUNCTION public.get_email_failure_summary() SET search_path = public;
ALTER FUNCTION public.get_failed_push_subscriptions(p_min_failures integer, p_limit integer) SET search_path = public;
ALTER FUNCTION public.get_email_bounces(p_bounce_type text, p_days integer, p_limit integer) SET search_path = public;
ALTER FUNCTION public.get_notification_health() SET search_path = public;
ALTER FUNCTION public.disable_failed_subscriptions(p_min_failures integer, p_error_pattern text, p_subscription_ids uuid[]) SET search_path = public;


-- ============================================================================
-- File: 28-ghost-accounts-audit.sql
-- ============================================================================

-- =============================================================================
-- Ghost Accounts Audit — Public Schema Helper Functions
-- =============================================================================
-- Phase 15: Admin dashboard functions for ghost account detection + cleanup.
--
-- NOTE: Ghost detection itself happens in the backend controller via
-- Supabase Admin API (auth.admin.listUsers), NOT in SQL — because
-- the auth schema is inaccessible to PostgREST / standard RPC calls.
--
-- These helper functions only query the PUBLIC schema to:
--   1. Find public.users who were never active (online_at IS NULL)
--   2. Check FK dependencies before deleting a user
--   3. Provide summary counts from public.users
-- =============================================================================

-- 1. Get public.users who have never been active
-- Used by the controller to cross-reference with auth.users ghost list
create or replace function public.get_inactive_users(
  p_min_age_days integer default 30
)
returns table (
  user_id uuid,
  email text,
  username text,
  online_at timestamptz,
  created_at timestamptz,
  age_days integer,
  message_count bigint,
  channel_count bigint
)
language sql
security definer
set search_path = public
stable
as $$
  select
    u.id as user_id,
    u.email,
    u.username,
    u.online_at,
    u.created_at,
    extract(day from now() - u.created_at)::integer as age_days,
    (select count(*) from public.messages m where m.user_id = u.id) as message_count,
    (select count(*) from public.channel_members cm where cm.member_id = u.id) as channel_count
  from public.users u
  where u.online_at is null
    and u.deleted_at is null
    and u.created_at < now() - (p_min_age_days || ' days')::interval
  order by u.created_at asc;
$$;

comment on function public.get_inactive_users(integer) is
'Returns public.users who have never been active (online_at IS NULL). Used by ghost accounts audit.';


-- 2. Get FK dependency impact before deleting a user
-- The critical check: messages.user_id uses NO ACTION, so it blocks hard-delete
create or replace function public.get_user_deletion_impact(p_user_id uuid)
returns table (
  message_count bigint,
  channel_memberships bigint,
  push_subscriptions bigint,
  email_queue_items bigint,
  notifications_received bigint,
  has_blocking_messages boolean
)
language sql
security definer
set search_path = public
stable
as $$
  select
    (select count(*) from public.messages where user_id = p_user_id) as message_count,
    (select count(*) from public.channel_members where member_id = p_user_id) as channel_memberships,
    (select count(*) from public.push_subscriptions where user_id = p_user_id) as push_subscriptions,
    (select count(*) from public.email_queue where user_id = p_user_id) as email_queue_items,
    (select count(*) from public.notifications where receiver_user_id = p_user_id) as notifications_received,
    -- messages.user_id has NO ACTION — will block hard-delete if count > 0
    exists(select 1 from public.messages where user_id = p_user_id) as has_blocking_messages;
$$;

comment on function public.get_user_deletion_impact(uuid) is
'Returns FK dependency counts for a user. has_blocking_messages=true means hard-delete will fail (messages.user_id NO ACTION).';


-- 3. Ghost accounts summary (public schema portion only)
-- Gives a quick overview of public.users health
create or replace function public.get_ghost_summary_public()
returns table (
  total_public_users bigint,
  never_active_count bigint,
  soft_deleted_count bigint,
  active_count bigint
)
language sql
security definer
set search_path = public
stable
as $$
  select
    (select count(*) from public.users) as total_public_users,
    (select count(*) from public.users where online_at is null and deleted_at is null) as never_active_count,
    (select count(*) from public.users where deleted_at is not null) as soft_deleted_count,
    (select count(*) from public.users where online_at is not null and deleted_at is null) as active_count;
$$;

comment on function public.get_ghost_summary_public() is
'Returns summary counts from public.users: total, never active, soft-deleted, and active.';


-- Grant execute to service_role (used by Hocuspocus admin controller)
grant execute on function public.get_inactive_users(integer) to service_role;
grant execute on function public.get_user_deletion_impact(uuid) to service_role;
grant execute on function public.get_ghost_summary_public() to service_role;


-- ============================================================
-- Hardening: pin search_path = public on functions defined above
-- (idempotent — safe to re-run)
-- ============================================================
ALTER FUNCTION public.get_inactive_users(p_min_age_days integer) SET search_path = public;
ALTER FUNCTION public.get_user_deletion_impact(p_user_id uuid) SET search_path = public;
ALTER FUNCTION public.get_ghost_summary_public() SET search_path = public;


-- ============================================================================
-- File: 29-lint-hardening.sql
-- ============================================================================

-- =====================================================================
-- 29 — Lint hardening sweep
-- =====================================================================
-- Loaded last by the script bootstrap so it runs after every function
-- and table is defined. Closes WARN-level Supabase linter findings:
--   • function_search_path_mutable                      (~63 fns)
--   • public_bucket_allows_listing                      (3 buckets)
--   • pg_graphql_anon_table_exposed                     (21 tables)
--   • pg_graphql_authenticated_table_exposed (admin)    (10 tables)
--   • anon_security_definer_function_executable         (31 fns)
--   • authenticated_security_definer_function_executable (selective)
--
-- Strategy: revoke broadly (DO-block sweeps), grant back the small
-- whitelist explicitly. Idempotent — every statement uses IF EXISTS /
-- ALTER / programmatic discovery so re-running is safe.
-- =====================================================================

BEGIN;

-- =====================================================================
-- 1. search_path sweep — pin SET search_path = public on every function
--    in public/internal that doesn't already have it set.
-- =====================================================================
-- Programmatic so future-added fns are caught on re-run. Skips
-- aggregates/window/procedures (only `prokind = 'f'`).

DO $$
DECLARE
    fn record;
BEGIN
    FOR fn IN
        SELECT n.nspname, p.proname,
               pg_get_function_identity_arguments(p.oid) AS args
        FROM pg_proc p
        JOIN pg_namespace n ON n.oid = p.pronamespace
        WHERE n.nspname IN ('public', 'internal')
          AND p.prokind = 'f'
          -- Only functions whose owner is the role running this migration.
          -- Local Supabase exposes some helpers as `supabase_admin`-owned;
          -- those need to be re-grant-tightened by `supabase_admin` (or
          -- left alone). Skip silently here so the migration is portable.
          AND p.proowner = current_user::regrole
          AND NOT EXISTS (
              SELECT 1
              FROM unnest(coalesce(p.proconfig, ARRAY[]::text[])) AS cfg
              WHERE cfg LIKE 'search_path=%'
          )
    LOOP
        EXECUTE format(
            'ALTER FUNCTION %I.%I(%s) SET search_path = public',
            fn.nspname, fn.proname, fn.args
        );
    END LOOP;
END
$$;


-- =====================================================================
-- 2. (Removed) public-bucket SELECT policies are kept, but scoped.
-- =====================================================================
-- Previous revisions dropped the three SELECT policies on the premise
-- that public buckets serve files via direct URL and the SELECT only
-- enables bucket-listing. That missed Supabase Storage's upload path,
-- which runs INSERT then a readback — without SELECT the readback
-- fails and storage emits a misleading 42501 "new row violates RLS".
-- 12-buckets.sql now scopes SELECT to the caller's own folder /
-- owner_id so the upload readback succeeds without exposing the
-- bucket inventory.


-- =====================================================================
-- 3. Tighten anon table access (GraphQL schema discovery)
-- =====================================================================
-- Default-deny anon across public; then re-grant SELECT for the small
-- set of tables that anon legitimately reads (PUBLIC channel lurking).
-- Read access is filtered row-by-row by the `<table>_public_anon_select`
-- policies in 13-RLS.sql §3 so anon only sees PUBLIC-channel rows.

REVOKE SELECT, INSERT, UPDATE, DELETE
    ON ALL TABLES IN SCHEMA public
    FROM anon;

-- Re-grant SELECT for the chat read path. Row-level filtering happens
-- through the anon policies; this just lifts the GRANT-layer block.
GRANT SELECT ON public.channels               TO anon;
GRANT SELECT ON public.messages               TO anon;
GRANT SELECT ON public.channel_message_counts TO anon;
GRANT SELECT ON public.pinned_messages        TO anon;
GRANT SELECT ON public.workspaces             TO anon;

-- users: column-level only — `email` is excluded from anon visibility.
GRANT SELECT (
    id, username, full_name, display_name, avatar_url, avatar_updated_at,
    profile_data, status, online_at, created_at, updated_at, deleted_at
) ON public.users TO anon;

-- channel_members + message_bookmarks: the read RPCs join these to
-- compose user-specific fields (last_read, is_bookmarked). Anon needs
-- GRANT-layer access so the JOIN doesn't 42501; RLS already yields zero
-- rows for anon (no anon-targeted policy), so user-scoped fields come
-- back NULL — the intended semantics for guest readers.
GRANT SELECT ON public.channel_members  TO anon;
GRANT SELECT ON public.message_bookmarks TO anon;


-- =====================================================================
-- 4. Tighten authenticated table access for admin/internal-only tables
-- =====================================================================
-- Tables whose only authenticated access path is via SECURITY DEFINER
-- RPCs (definer bypass). Direct PostgREST/GraphQL access is removed.

REVOKE SELECT, INSERT, UPDATE, DELETE ON public.admin_users            FROM authenticated;
REVOKE SELECT, INSERT, UPDATE, DELETE ON public.email_queue            FROM authenticated;
REVOKE SELECT, INSERT, UPDATE, DELETE ON public.email_bounces          FROM authenticated;
REVOKE SELECT, INSERT, UPDATE, DELETE ON public.push_subscriptions     FROM authenticated;
REVOKE SELECT, INSERT, UPDATE, DELETE ON public.document_view_stats    FROM authenticated;
REVOKE SELECT, INSERT, UPDATE, DELETE ON public.document_views         FROM authenticated;

-- Partition tables (document_views_YYYY_MM) are created dynamically by
-- 09-document-views.sql for current + next 3 months, so the exact set
-- depends on when the script runs. Discover and revoke at runtime.
DO $$
DECLARE
    rec record;
BEGIN
    FOR rec IN
        SELECT n.nspname, c.relname
        FROM pg_class c
        JOIN pg_namespace n ON n.oid = c.relnamespace
        WHERE n.nspname = 'public'
          AND c.relname ~ '^document_views_[0-9]{4}_[0-9]{2}$'
    LOOP
        EXECUTE format(
            'REVOKE SELECT, INSERT, UPDATE, DELETE ON %I.%I FROM authenticated',
            rec.nspname, rec.relname
        );
    END LOOP;
END
$$;

-- document_views_daily may exist on remote but not local; guard.
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM pg_class c
        JOIN pg_namespace n ON n.oid = c.relnamespace
        WHERE n.nspname='public' AND c.relname='document_views_daily'
    ) THEN
        EXECUTE 'REVOKE SELECT, INSERT, UPDATE, DELETE ON public.document_views_daily FROM authenticated';
    END IF;
END
$$;


-- =====================================================================
-- 5. Mass revoke EXECUTE FROM anon, authenticated on all public-schema
--    SECURITY DEFINER functions. Re-grant the small user-facing whitelist
--    in §6 below.
-- =====================================================================

DO $$
DECLARE
    fn record;
BEGIN
    FOR fn IN
        SELECT n.nspname, p.proname,
               pg_get_function_identity_arguments(p.oid) AS args
        FROM pg_proc p
        JOIN pg_namespace n ON n.oid = p.pronamespace
        WHERE n.nspname = 'public'
          AND p.prokind = 'f'
          AND p.prosecdef = true
          -- Only functions we own; supabase_admin-owned ones (email pgmq
          -- helpers on local) need to be revoked by their owner. Sprint 3a
          -- already covered them where ownable.
          AND p.proowner = current_user::regrole
    LOOP
        EXECUTE format(
            'REVOKE EXECUTE ON FUNCTION %I.%I(%s) FROM public, anon, authenticated',
            fn.nspname, fn.proname, fn.args
        );
    END LOOP;
END
$$;


-- =====================================================================
-- 6. GRANT EXECUTE TO authenticated — user-facing chat RPC whitelist
-- =====================================================================
-- Each entry corresponds to a file under packages/webapp/src/api/rpc/
-- (or a direct policy-primitive). Functions not in this list are
-- service_role-only (admin / worker / cron / trigger).
--
-- `_safe_grant_authenticated` wraps the GRANT in EXISTS check so a
-- function that doesn't exist locally (e.g. work-in-progress) doesn't
-- abort the migration. Keeps the apply portable across local/staging/prod.

DO $$
DECLARE
    fn record;
    fn_name text;
    user_facing_names text[] := ARRAY[
        -- Channel/feed reads
        'get_channel_aggregate_data',
        'get_channel_members_by_last_read_update',
        -- Chat writes (each gates on auth.uid + channel access internally)
        'advance_read_cursor', 'add_reaction', 'remove_reaction',
        -- Bookmarks
        'toggle_message_bookmark', 'archive_bookmark', 'mark_bookmark_as_read',
        'get_bookmark_count', 'get_bookmark_stats', 'get_user_bookmarks',
        -- Notifications
        'notifications_summary', 'get_unread_notif_count',
        'get_unread_notifications_paginated', 'get_channel_notif_state',
        'get_workspace_notifications', 'update_notification_preferences',
        -- Mentions / DMs
        'fetch_mentioned_users', 'create_direct_message_channel',
        -- Workspace / presence
        'join_workspace', 'update_user_online_at',
        -- Push subscriptions (per-user)
        'register_push_subscription', 'unregister_push_subscription',
        -- Policy primitive — used inside admin_users RLS, must remain
        -- callable in policy expressions for authenticated callers
        'is_admin'
    ];
BEGIN
    FOREACH fn_name IN ARRAY user_facing_names
    LOOP
        FOR fn IN
            SELECT p.oid, n.nspname, p.proname,
                   pg_get_function_identity_arguments(p.oid) AS args
            FROM pg_proc p
            JOIN pg_namespace n ON n.oid = p.pronamespace
            WHERE n.nspname = 'public' AND p.proname = fn_name
        LOOP
            EXECUTE format(
                'GRANT EXECUTE ON FUNCTION %I.%I(%s) TO authenticated',
                fn.nspname, fn.proname, fn.args
            );
        END LOOP;
    END LOOP;
END
$$;


-- =====================================================================
-- 7. GRANT EXECUTE TO anon (+ authenticated) — analytics + read whitelist
-- =====================================================================
-- These RPCs power anonymous document-view tracking AND anonymous read
-- access to PUBLIC chat. `get_channel_aggregate_data` gates internally
-- on `type = 'PUBLIC' OR is_channel_member(...)`, so the anon caller
-- can only fetch PUBLIC-channel rows.

GRANT EXECUTE ON FUNCTION public.enqueue_document_view(text, text, uuid, boolean, text)
    TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.update_view_duration(uuid, integer)
    TO anon, authenticated;

DO $$
DECLARE
    fn record;
BEGIN
    FOR fn IN
        SELECT n.nspname, p.proname,
               pg_get_function_identity_arguments(p.oid) AS args
        FROM pg_proc p
        JOIN pg_namespace n ON n.oid = p.pronamespace
        WHERE n.nspname = 'public'
          AND p.proname IN ('get_channel_aggregate_data')
    LOOP
        EXECUTE format(
            'GRANT EXECUTE ON FUNCTION %I.%I(%s) TO anon',
            fn.nspname, fn.proname, fn.args
        );
    END LOOP;
END
$$;


-- =====================================================================
-- 8. supabase_admin-owned cleanup
-- =====================================================================
-- A handful of email/push pgmq helpers are created under the
-- `supabase_admin` role on local Docker (Supabase-internal pattern).
-- The owner-only ACL of REVOKE means our `postgres` migration role
-- cannot strip them locally. On real Supabase projects, the migration
-- role can revoke these. Wrapped in EXCEPTION so a local apply is a
-- no-op while a remote apply succeeds.

DO $$
DECLARE
    revoke_sql text;
    revoke_sqls text[] := ARRAY[
        'REVOKE EXECUTE ON FUNCTION public.ack_email_message(bigint) FROM public, anon, authenticated',
        'REVOKE EXECUTE ON FUNCTION public.compile_digest_emails() FROM public, anon, authenticated',
        'REVOKE EXECUTE ON FUNCTION public.consume_email_queue(integer, integer) FROM public, anon, authenticated',
        'REVOKE EXECUTE ON FUNCTION public.consume_push_queue(integer, integer) FROM public, anon, authenticated',
        'REVOKE EXECUTE ON FUNCTION public.enqueue_push_notification() FROM public, anon, authenticated',
        'REVOKE EXECUTE ON FUNCTION public.record_email_bounce(text, text, text, text) FROM public, anon, authenticated',
        'REVOKE SELECT, INSERT, UPDATE, DELETE ON public.email_bounces FROM anon, authenticated'
    ];
BEGIN
    FOREACH revoke_sql IN ARRAY revoke_sqls
    LOOP
        BEGIN
            EXECUTE revoke_sql;
        EXCEPTION
            WHEN insufficient_privilege THEN
                RAISE NOTICE 'Skipped (local supabase_admin ownership): %', revoke_sql;
            WHEN undefined_function OR undefined_table THEN
                RAISE NOTICE 'Skipped (object not present): %', revoke_sql;
        END;
    END LOOP;
END
$$;


COMMIT;


-- =====================================================================
-- Post-apply verification
-- =====================================================================
-- Re-run the underlying linter SQL to confirm the four categories are clean:
--
-- (a) Mutable search_path (expect 0)
--   SELECT n.nspname || '.' || p.proname AS fn
--   FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
--   WHERE n.nspname IN ('public','internal')
--     AND p.prokind = 'f'
--     AND NOT EXISTS (
--       SELECT 1 FROM unnest(coalesce(p.proconfig, ARRAY[]::text[])) cfg
--       WHERE cfg LIKE 'search_path=%'
--     );
--
-- (b) Public-bucket listing policies (expect 0)
--   SELECT polname FROM pg_policy
--   WHERE polrelid = 'storage.objects'::regclass
--     AND polname IN (
--       'Channel Avatar is publicly accessible',
--       'Media files are publicly accessible',
--       'User Avatar is publicly accessible'
--     );
--
-- (c) anon SELECT on public tables (expect 0)
--   SELECT table_name FROM information_schema.role_table_grants
--   WHERE grantee='anon' AND table_schema='public' AND privilege_type='SELECT';
--
-- (d) anon EXECUTE on SECURITY DEFINER fns (expect 2: enqueue_document_view, update_view_duration)
--   SELECT p.proname FROM pg_proc p
--   JOIN pg_namespace n ON n.oid=p.pronamespace
--   WHERE n.nspname='public' AND p.prosecdef = true
--     AND has_function_privilege('anon', p.oid, 'EXECUTE');

