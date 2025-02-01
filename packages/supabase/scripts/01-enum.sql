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
create type public.user_status as enum ('ONLINE', 'OFFLINE', 'AWAY', 'BUSY', 'INVISIBLE');

-- Define the types of messages that can be sent.
-- 'text' is a standard text message,
-- 'image' is a message with an image attachment,
-- 'video' is a message with a video attachment,
-- 'audio' is a message with an audio attachment.
create type public.message_type as enum ('text', 'image', 'video', 'audio', 'link', 'giphy', 'file', 'notification');


-- NOTE: The following types are not currently used in the schema.
-- Define the types of notifications that can be sent.
create type public.notification_type as enum (
  'message', 'channel_invite', 'mention', 'reply', 'thread_update',
  'channel_update', 'member_join', 'member_leave', 'user_activity',
  'task_assignment', 'event_reminder', 'system_update', 'security_alert',
  'like_reaction', 'feedback_request', 'performance_insight'
);

-- Type: public.channel_type
-- Description: Enumeration of different types of channels supported in the application.
-- Each type defines the purpose and accessibility of the channel.

CREATE TYPE public.channel_type AS ENUM
(
    'PUBLIC',     -- PUBLIC: Open for all users. Any user of the application can join and participate.
    'PRIVATE',    -- PRIVATE: Restricted access. Users can join only by invitation or approval.
    'BROADCAST',  -- BROADCAST: One-way communication channel where selected users can post, but all users can view.
    'ARCHIVE',    -- ARCHIVE: Read-only channel for historical/reference purposes. No new messages can be posted.
    'DIRECT',     -- DIRECT: One-on-one private conversation between two users.
    'GROUP',      -- GROUP: For a specific set of users, typically used for group discussions or team collaborations.
    'THREAD'      -- THREAD: A channel created for a specific thread or conversation, often temporary or focused on a specific topic.
);

COMMENT ON TYPE public.channel_type IS 'Defines the types of channels available in the application, each with specific accessibility and interaction rules.';

-- Type: public.channel_member_role
-- Description: Enumeration of different roles that a member can have within a channel.
CREATE TYPE public.channel_member_role AS ENUM (
    'MEMBER',    -- Regular member with standard privileges.
    'ADMIN',     -- Administrator with elevated privileges like managing channel settings and members.
    'MODERATOR', -- Moderator with privileges like moderating content and managing user interactions.
    'GUEST'      -- Guest with limited privileges, typically read-only access.
);

COMMENT ON TYPE public.channel_member_role IS 'Defines the roles of channel members, determining their privileges and access within the channel.';

-- Create the enumeration type for notification categories
CREATE TYPE notification_category AS ENUM (
    'mention',
    'message',
    'reply',
    'reaction',
    'thread_message',
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
CREATE TYPE public.channel_notification_state AS ENUM (
    'MENTIONS',  -- Only receive notifications for @mentions
    'ALL',      -- Receive all notifications from the channel
    'MUTED'     -- Receive no notifications from the channel
);

COMMENT ON TYPE public.channel_notification_state IS 'Defines the notification preferences for a user in a channel';
