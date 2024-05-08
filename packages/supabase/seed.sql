
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
-- Table: public.users
-- Description: This table holds essential information about each user within the application. 
-- It includes user identification, personal and contact details, and system-related information.
CREATE TABLE public.users (
    id              UUID NOT NULL PRIMARY KEY REFERENCES auth.users ON DELETE CASCADE,
    username        TEXT NOT NULL UNIQUE,      -- The username chosen by the user, ensured to be unique across the system.
    full_name       TEXT,               -- Full name of the user.
    display_name    TEXT,              -- Display name of the user.
    status      user_status DEFAULT 'OFFLINE'::public.user_status,  -- Current online/offline status of the user. Defaults to 'OFFLINE'.
    updated_at  TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc', now()) NOT NULL, -- Timestamp of the last update, automatically set to the current UTC time.
    created_at  TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc', now()) NOT NULL, -- Timestamp of the user's creation, automatically set to the current UTC time.
    avatar_url  TEXT,               -- URL of the user's avatar image.
    website     TEXT,               -- User's personal or professional website.
    email       TEXT UNIQUE,        -- User's email address.
    job_title   TEXT NULL,
    company     TEXT NULL,
    about       TEXT,               -- Brief description or bio of the user.
    CONSTRAINT username_length CHECK (char_length(username) >= 3), -- Ensures that usernames are at least 3 characters long.
    online_at TIMESTAMP WITH TIME ZONE  -- Timestamp of the last time the user was seen online.
);

COMMENT ON TABLE public.users IS 'Profile data for each user, including identification, personal info, and system timestamps.';
COMMENT ON COLUMN public.users.id IS 'References the internal Supabase Auth user ID, ensuring linkage with authentication data.';
COMMENT ON COLUMN public.users.username IS 'Unique username for each user, serving as a key identifier within the system.';
COMMENT ON COLUMN public.users.status IS 'Represents the current online/offline status of the user, based on the user_status enum.';
-- Table: public.workspaces
-- Description: Represents various workspaces. Each workspace can contain multiple channels.
CREATE TABLE public.workspaces (
    id                UUID DEFAULT uuid_generate_v4() NOT NULL PRIMARY KEY,
    name              TEXT NOT NULL CHECK (length(name) <= 100), -- Workspace name, limited to 100 characters.
    slug              TEXT NOT NULL UNIQUE CHECK (length(slug) <= 100), -- Unique slug for the workspace, used for user-friendly URLs, limited to 100 characters.
    description       TEXT CHECK (length(description) <= 1000), -- Optional description of the workspace, limited to 1000 characters.
    metadata          JSONB DEFAULT '{}'::jsonb, -- Optional metadata about the workspace in JSONB format.
    created_by        UUID NOT NULL REFERENCES public.users, -- The ID of the user who created the workspace, referencing the users table.
    created_at        TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc', now()) NOT NULL, -- The timestamp when the workspace was created, set to the current UTC time.
    updated_at        TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc', now()) -- The timestamp when the workspace was last updated, set to the current UTC time.
);

-- Constraint: check_slug_format
ALTER TABLE public.workspaces ADD CONSTRAINT check_slug_format CHECK (slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$');

COMMENT ON TABLE public.workspaces IS 'This table contains information about various workspaces, which are collections of channels for group discussions and messaging. Workspaces provide a higher-level organization structure within the application, allowing for segregation and grouping of channels.';
-- Table: public.channels
-- Description: Represents various channels in the application, similar to chat rooms or discussion groups.
-- Channels have attributes like privacy settings, member limits, activity timestamps, and user interaction settings.
CREATE TABLE public.channels (
    id                              UUID DEFAULT uuid_generate_v4() NOT NULL PRIMARY KEY,
    workspace_id                    UUID NOT NULL REFERENCES public.workspaces,
    created_at                      TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc', now()) NOT NULL,
    updated_at                      TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc', now()) NOT NULL,
    slug                            TEXT NOT NULL UNIQUE,
    name                            TEXT NOT NULL CHECK (length(name) <= 100),
    created_by                      UUID NOT NULL REFERENCES public.users,
    description                     TEXT CHECK (length(description) <= 1000),
    member_limit                    INT,
    last_activity_at                TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc', now()) NOT NULL,
    last_message_preview            TEXT,
    is_avatar_set                   BOOLEAN DEFAULT false,
    allow_emoji_reactions           BOOLEAN DEFAULT true, -- Indicates if emoji reactions are allowed in the channel.
    mute_in_app_notifications       BOOLEAN DEFAULT false, -- Indicates if notifications are muted for the channel.
    type                            channel_type DEFAULT 'PUBLIC'::public.channel_type,
    metadata                        JSONB DEFAULT '{}'::jsonb,
    member_count                    INT DEFAULT 0 NOT NULL -- The number of members in the channel.
);

-- Constraint: check_slug_format
ALTER TABLE public.channels ADD CONSTRAINT check_slug_format CHECK (slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$');

COMMENT ON TABLE public.channels IS 'This table contains information about various channels used for group discussions and messaging in the application, including settings for user interactions and notifications.';

-- NOTE: write more about the purpose of each column.


-- Table: public.messages
-- Description: Stores all messages exchanged in the application. This includes various types of messages like text, image, video, or audio. 
-- The table also tracks message status (edited, deleted) and associations (user, channel, replies, and forwardings).
CREATE TABLE public.messages (
    id                     UUID DEFAULT uuid_generate_v4() NOT NULL PRIMARY KEY,
    created_at             TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc', now()) NOT NULL, -- Creation timestamp of the message.
    updated_at             TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc', now()) NOT NULL, -- Last update timestamp of the message.
    deleted_at             TIMESTAMP WITH TIME ZONE, -- Timestamp for when the message was marked as deleted.
    edited_at              TIMESTAMP WITH TIME ZONE, -- Timestamp for when the message was edited.
    content                TEXT CHECK (length(content) <= 3000),  -- The actual text content of the message.
    html                   TEXT CHECK (length(html) <= 3000), -- The actual HTML content of the message.
    medias                 JSONB, -- Stores URLs to media (images, videos, etc.) associated with the message.
    user_id                UUID NOT NULL REFERENCES public.users, -- The ID of the user who sent the message.
    channel_id             UUID NOT NULL REFERENCES public.channels ON DELETE SET NULL, -- The ID of the channel where the message was sent.
    reactions              JSONB, -- JSONB field storing user reactions to the message.
    type                   message_type, -- Enumerated type of the message (text, image, video, etc.).
    metadata               JSONB, -- Additional metadata about the message in JSONB format.
    reply_to_message_id    UUID REFERENCES public.messages(id) ON DELETE SET NULL, -- The ID of the message this message is replying to, if any.
    replied_message_preview TEXT, -- Preview text of the message being replied to.
    origin_message_id      UUID REFERENCES public.messages(id) ON DELETE SET NULL, -- ID of the original message if this is a forwarded message.
    thread_id              UUID REFERENCES public.messages(id) ON DELETE SET NULL, -- ID of the thread this message belongs to.
    thread_depth           INT DEFAULT 0, -- Depth of the message in the thread.
    is_thread_root         BOOLEAN DEFAULT false, -- Indicates if the message is the root of a thread.
    thread_owner_id        UUID REFERENCES public.users ON DELETE SET NULL, -- ID of the user who owns/opens the thread.
    readed_at              TIMESTAMP WITH TIME ZONE -- Timestamp for when the message was read by a user.
);

COMMENT ON TABLE public.messages IS 'Contains individual messages sent by users, including their content, type, and associated metadata.';
-- TODO: partition by channel_id and created_at

-- NOTE: write more about the purpose of each column.


-- public.messages.reaction and .medias Jsonb can be look like this:

-- TODO: forwardChain must be split into a separate table
-- const metadata = {
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

-- const medias = [
--   {
--     url: 'https://www.youtube.com/watch?v=9bZkp7q19f0',
--     type: 'video',
--     description: "Gangnam Style"
--   },
--   {
--     url: 'https://www.youtube.com/watch?v=9bZkp7q19f0',
--     type: 'video',
--     description: "Gangnam Style"
--   }
-- ]

-- const reactions = {
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
-- Table: public.pinned_messages
-- Description: Maintains a record of messages that are pinned in various channels. Pinned messages are typically important or frequently referenced.
CREATE TABLE public.pinned_messages (
    id            UUID DEFAULT uuid_generate_v4() NOT NULL PRIMARY KEY,
    channel_id    UUID NOT NULL REFERENCES public.channels ON DELETE CASCADE, -- The ID of the channel in which the message is pinned.
    message_id    UUID NOT NULL REFERENCES public.messages ON DELETE CASCADE, -- The ID of the message that is pinned.
    pinned_at     TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc', now()) NOT NULL, -- Timestamp when the message was pinned.
    pinned_by     UUID NOT NULL REFERENCES public.users, -- The ID of the user who pinned the message.
    content       TEXT NOT NULL, -- The content of the message that is pinned.
    UNIQUE (channel_id, message_id)
);

COMMENT ON TABLE public.pinned_messages IS 'Tracks messages that are pinned in each channel for easy access and reference.';

-- NOTE: write more about the purpose of each column.
-- Table: public.notifications
-- Description: Manages notifications sent to users within the application. Notifications can be related to messages, channel activities, mentions, or other events.
-- This table tracks the notification's type, associated references (messages, channels), and its read status.
CREATE TABLE public.notifications (
    id                  UUID DEFAULT uuid_generate_v4() NOT NULL PRIMARY KEY,
    receiver_user_id    UUID NOT NULL REFERENCES public.users, -- The ID of the user who will receive the notification.
    type                notification_category NOT NULL, -- Type of the notification (e.g., message, invite, mention).
    message_id          UUID REFERENCES public.messages ON DELETE CASCADE,  -- ID of the associated message, if the notification is message-related.
    channel_id          UUID REFERENCES public.channels ON DELETE CASCADE, -- ID of the associated channel, if the notification is channel-related.
    message_preview     TEXT, -- Preview of the content related to the notification (if applicable).
    created_at          TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc', now()) NOT NULL, -- Timestamp when the notification was created.
    readed_at           TIMESTAMP WITH TIME ZONE, -- Timestamp when the notification was marked as read by the user.
    action_url          TEXT, -- URL or deep link to direct the user to a specific page or action in the application.
    sender_user_id      UUID REFERENCES public.users ON DELETE CASCADE -- ID of the user who sent the notification (if applicable).
);

COMMENT ON TABLE public.notifications IS 'Table to store and manage notifications for various user interactions and activities within the application.';
-- Table: public.channel_members
-- Description: Manages the membership of users within channels. This table tracks which messages each user has read in a channel, 
-- enabling the application to maintain an up-to-date read status. This is crucial for message-based applications where read receipts are important.
CREATE TABLE public.channel_members (
    id                    UUID DEFAULT uuid_generate_v4() NOT NULL PRIMARY KEY, -- Unique ID for the channel member record.
    channel_id            UUID NOT NULL REFERENCES public.channels ON DELETE CASCADE, -- The ID of the channel. If the channel is deleted, associated member records are also deleted.
    member_id             UUID NOT NULL REFERENCES public.users ON DELETE CASCADE, -- The ID of the channel member (user). If the user is deleted, their membership records are also deleted.
    last_read_message_id  UUID REFERENCES public.messages, -- The ID of the last message read by the user in the channel. Helps in tracking read status.
    last_read_update_at   TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc', now()), -- Timestamp when the user's last read status was updated.
    joined_at             TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc', now()) NOT NULL, -- Timestamp when the user joined the channel.
    left_at               TIMESTAMP WITH TIME ZONE, -- Timestamp when the user left the channel.
    mute_in_app_notifications BOOLEAN DEFAULT false, -- Indicates if notifications are muted for the channel.
    channel_member_role   channel_member_role DEFAULT 'MEMBER'::public.channel_member_role, -- The role of the user in the channel (e.g., admin, moderator, member).
    unread_message_count  INT DEFAULT 0, -- The number of unread messages for the user in the channel.
    created_at            TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc', now()) NOT NULL, -- Timestamp when the membership record was created.
    updated_at            TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc', now()) -- Timestamp when the membership record was last updated.
);

COMMENT ON TABLE public.channel_members IS 'Tracks user membership in channels, including the status of the last message read by each user in a specific channel. The created_at and updated_at columns help monitor the history and changes in user-channel relationships.';
-- We use regular views instead of materialized views.
-- Later for performance improvement, we can change them to materialized views.
-- But it will require more time to test, maintain, and deploy.
-- So for now, we will use regular views.

-- CREATE OR REPLACE VIEW public.view_pinned_messages AS
-- SELECT
--     pm.id AS pinned_message_id,
--     pm.channel_id,
--     pm.pinned_at,
--     pm.pinned_by,
--     m.content,
--     m.html,
--     m.medias,
--     m.reactions,
--     m.metadata,
--     m.created_at AS message_created_at,
--     m.updated_at AS message_updated_at,
--     m.user_id AS message_user_id,
--     m.type AS message_type,
--     u.username AS pinner_username,
--     u.full_name AS pinner_full_name,
--     u.avatar_url AS pinner_avatar_url
-- FROM
--     public.pinned_messages pm
--     JOIN public.messages m ON pm.message_id = m.id
--     JOIN public.users u ON pm.pinned_by = u.id;

-- -- If you need member_count alive run this query
-- CREATE OR REPLACE VIEW public.view_channels AS
-- SELECT
--     c.id AS channel_id,
--     c.slug,
--     c.name,
--     c.created_at,
--     c.created_by,
--     c.description,
--     c.member_limit,
--     c.last_activity_at,
--     c.last_message_preview,
--     c.is_avatar_set,
--     c.allow_emoji_reactions,
--     c.mute_in_app_notifications,
--     c.type AS channel_type,
--     c.metadata,
--     COUNT(cm.member_id) AS member_count
-- FROM
--     public.channels c
--     LEFT JOIN public.channel_members cm ON c.id = cm.channel_id
-- GROUP BY
--     c.id;
/*
Helper functions
*/

CREATE OR REPLACE FUNCTION truncate_content(input_content TEXT, max_length INT DEFAULT NULL) RETURNS TEXT AS $$
DECLARE
    -- Define a constant for the default max length
    DEFAULT_MAX_LENGTH CONSTANT INT := 80;
BEGIN
    -- Use the provided max_length or the default if not provided
    IF max_length IS NULL THEN
        max_length := DEFAULT_MAX_LENGTH;
    END IF;

    RETURN CASE
        WHEN LENGTH(input_content) > max_length THEN LEFT(input_content, max_length - 3) || '...'
        ELSE input_content
    END;
END;
$$ LANGUAGE plpgsql;
/*
  Function: handle_new_user
  Description: Inserts a new user row and assigns roles based on provided meta-data.
*/
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
DECLARE
  username text;
BEGIN
  IF new.raw_user_meta_data->>'full_name' IS NULL THEN
    username := new.email; 
  ELSE
    username := new.raw_user_meta_data->>'full_name'; 
  END IF;

  INSERT INTO public.users (id, full_name, avatar_url, email, username)
  VALUES (
    new.id,
    new.raw_user_meta_data->>'full_name',
    new.raw_user_meta_data->>'avatar_url',
    new.email,
    username
  );

  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- Trigger: on_auth_user_created
-- Description: Executes handle_new_user function after a new user is created in auth.users table.
CREATE TRIGGER on_auth_user_created
AFTER INSERT ON auth.users
FOR EACH ROW
EXECUTE PROCEDURE public.handle_new_user();

----------------------------------------------------
----------------------------------------------------


CREATE OR REPLACE FUNCTION update_online_at()
RETURNS TRIGGER AS $$
BEGIN
    -- Check if the 'status' column is being updated
    IF OLD.status IS DISTINCT FROM NEW.status THEN
        -- Update 'online_at' to the current timestamp
        NEW.online_at := timezone('utc', now());
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_online_at
BEFORE UPDATE OF status ON public.users
FOR EACH ROW
EXECUTE FUNCTION update_online_at();
/*
    -----------------------------------------
    -----------------------------------------
    1.
        Trigger: trigger_add_creator_as_admin
        Description: Trigger that invokes add_channel_creator_as_admin function
                     to add the channel creator as an admin in channel_members table 
                     after a new channel is created.
    -----------------------------------------
    -----------------------------------------
*/

-- Function: add_channel_creator_as_admin()
CREATE OR REPLACE FUNCTION add_channel_creator_as_admin() RETURNS TRIGGER AS $$
BEGIN
    -- Insert the channel creator as an admin into the channel_members table.
    -- This function is automatically triggered after a new channel is created.
    -- It ensures that the creator of the channel is immediately added as an admin member of the channel.
    INSERT INTO public.channel_members (channel_id, member_id, channel_member_role, joined_at)
    VALUES (NEW.id, NEW.created_by, 'ADMIN', NOW());

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION add_channel_creator_as_admin() IS 'Trigger function that adds the creator of a new channel as an admin in the channel_members table.';

-- Trigger: trigger_add_creator_as_admin
CREATE TRIGGER trigger_add_creator_as_admin
AFTER INSERT ON public.channels
FOR EACH ROW
EXECUTE FUNCTION add_channel_creator_as_admin();

COMMENT ON TRIGGER trigger_add_creator_as_admin ON public.channels IS 'Trigger that invokes add_channel_creator_as_admin function to add the channel creator as an admin in channel_members table after a new channel is created.';

----------------------------------------------------------------------------------

-- Function to create a notification message when a new channel is created
-- For multilingual and other purposes, you can gather more information from the metadata.
CREATE OR REPLACE FUNCTION public.notify_new_channel_creation()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO public.messages (channel_id, type, user_id, content, metadata)
    VALUES (
        NEW.id, 
        'notification', 
        '992bb85e-78f8-4747-981a-fd63d9317ff1', 
        'Channel created', 
        jsonb_build_object(
            'type', 'channel_created'
        )
    );
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;


-- Trigger to invoke the function when a new channel is created
CREATE TRIGGER trigger_new_channel_creation
AFTER INSERT ON public.channels
FOR EACH ROW
EXECUTE FUNCTION public.notify_new_channel_creation();

----------------------------------------------------------------------------------
----------------------------------------------------------------------------------


-- CREATE OR REPLACE FUNCTION update_last_read_time()
-- RETURNS TRIGGER AS $$
-- BEGIN
--     -- Update the last_read_update_at if there's a change in last_read_message_id
--     IF OLD.last_read_message_id IS DISTINCT FROM NEW.last_read_message_id THEN
--         NEW.last_read_update_at := timezone('utc', now());
--     END IF;
--     RETURN NEW;
-- END;
-- $$ LANGUAGE plpgsql;

-- CREATE TRIGGER trigger_update_last_read_time
-- BEFORE UPDATE ON public.channel_members
-- FOR EACH ROW
-- EXECUTE FUNCTION update_last_read_time();

----------------------------------------------------------------------------------


-- Function to create a notification message when a channel's name is changed
-- For multilingual and other purposes, you can gather more information from the metadata.
CREATE OR REPLACE FUNCTION public.notify_channel_name_change()
RETURNS TRIGGER AS $$
BEGIN
    IF OLD.name IS DISTINCT FROM NEW.name THEN
        INSERT INTO public.messages (channel_id, type, user_id, content, metadata)
        VALUES (
            NEW.id, 
            'notification', 
            '992bb85e-78f8-4747-981a-fd63d9317ff1', 
            'Channel name was changed to "' || NEW.name || '"', 
            jsonb_build_object(
                'type', 'channel_name_changed', 
                'name', NEW.name
            )
        );
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;


-- Trigger to invoke the function when a channel's name is changed
CREATE TRIGGER trigger_channel_name_change
AFTER UPDATE OF name ON public.channels
FOR EACH ROW
WHEN (OLD.name IS DISTINCT FROM NEW.name)
EXECUTE FUNCTION public.notify_channel_name_change();


----------------------------------------------------------------------------------
----------------------------------------------------------------------------------



-- Function to create a notification message card when a user joins a channel
-- For multilingual and other purposes, you can gather more information from the metadata.
CREATE OR REPLACE FUNCTION public.notify_user_join_channel()
RETURNS TRIGGER AS $$
DECLARE
    joining_username TEXT;
BEGIN
    SELECT username INTO joining_username FROM public.users WHERE id = NEW.member_id;

    INSERT INTO public.messages (user_id, channel_id, type, content, metadata)
    VALUES (
        NEW.member_id, 
        NEW.channel_id, 
        'notification', 
        joining_username || ' joined the channel', 
        jsonb_build_object(
            'type', 'user_join_channel', 
            'user_name', joining_username
        )
    );
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to invoke  the function when a user join a channel
CREATE TRIGGER trigger_user_join_channel
AFTER INSERT ON public.channel_members
FOR EACH ROW
EXECUTE FUNCTION public.notify_user_join_channel();

----------------------------------------------------------------------------------
----------------------------------------------------------------------------------


-- Function to create a notification message when a user leaves a channel
-- For multilingual and other purposes, you can gather more information from the metadata.
CREATE OR REPLACE FUNCTION public.notify_user_leave_channel()
RETURNS TRIGGER AS $$
DECLARE
    leaving_username TEXT;
BEGIN
    SELECT username INTO leaving_username FROM public.users WHERE id = OLD.member_id;

    INSERT INTO public.messages (user_id, channel_id, type, content, metadata)
    VALUES (
        OLD.member_id, 
        OLD.channel_id, 
        'notification', 
        leaving_username || ' left the channel', 
        jsonb_build_object(
            'type', 'user_leave_channel', 
            'user_name', leaving_username
        )
    );
    
    RETURN OLD;
END;
$$ LANGUAGE plpgsql;


-- Trigger to invoke the function when a user leaves a channel
CREATE TRIGGER trigger_user_leave_channel
AFTER DELETE ON public.channel_members
FOR EACH ROW
EXECUTE FUNCTION public.notify_user_leave_channel();




----------------------------------------------------------------------------------
----------------------------------------------------------------------------------
-- In case transactions involving member addition or removal are rolled back,
-- the triggers will automatically handle the increment and decrement operations as the INSERT and DELETE on channel_members will be rolled back as well.
----------------------------------------------------------------------------------
-- Since your member records are deleted when a user is deleted (due to the ON DELETE CASCADE),
-- the delete trigger on channel_members will also handle decrementing the member_count when a user is deleted.

CREATE OR REPLACE FUNCTION increment_member_count()
RETURNS TRIGGER AS $$
BEGIN
    UPDATE public.channels SET member_count = member_count + 1
    WHERE id = NEW.channel_id;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION decrement_member_count()
RETURNS TRIGGER AS $$
BEGIN
    UPDATE public.channels SET member_count = member_count - 1
    WHERE id = OLD.channel_id;
    RETURN OLD;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_increment_member_count
AFTER INSERT ON public.channel_members
FOR EACH ROW
EXECUTE FUNCTION increment_member_count();

CREATE TRIGGER trg_decrement_member_count
AFTER DELETE ON public.channel_members
FOR EACH ROW
EXECUTE FUNCTION decrement_member_count();
CREATE OR REPLACE FUNCTION handle_soft_delete() RETURNS TRIGGER AS $$
DECLARE
    truncated_content TEXT;
    currentMetadata JSONB;
BEGIN
    -- Set deleted_at timestamp for soft delete
    NEW.deleted_at := NOW();

    IF TG_OP = 'UPDATE' THEN
        -- Truncate content if necessary for soft deleted messages
        truncated_content := truncate_content(NEW.content);

        -- Delete pinned message
        DELETE FROM public.pinned_messages WHERE message_id = OLD.id;

        -- Delete associated notifications
        DELETE FROM public.notifications WHERE message_id = OLD.id;

        -- Update reply previews
        UPDATE public.messages
        SET replied_message_preview = 'The message has been deleted'
        WHERE reply_to_message_id = OLD.id;

        -- Update last message preview in the channel
        WITH last_msg AS (
            SELECT id, content
            FROM public.messages
            WHERE channel_id = OLD.channel_id AND deleted_at IS NULL AND id <> OLD.id
            ORDER BY created_at DESC
            LIMIT 1
        )
        UPDATE public.channels
        SET last_message_preview = truncated_content,
            last_activity_at = NOW()
        WHERE id = OLD.channel_id;

                -- Remove the reply from the metadata of the original message
        SELECT metadata INTO currentMetadata FROM public.messages
        WHERE id = NEW.reply_to_message_id;

        IF currentMetadata IS NOT NULL THEN
            -- Remove the deleted message ID from the 'replied' array
            currentMetadata := jsonb_set(currentMetadata, '{replied}', (currentMetadata->'replied') - NEW.id::text);

            -- Update the original message's metadata
            UPDATE public.messages
            SET metadata = currentMetadata
            WHERE id = NEW.reply_to_message_id;
        END IF;

        RETURN NEW;
    END IF;

    RETURN NULL; -- Should not reach here for an UPDATE trigger
END;
$$ LANGUAGE plpgsql;



CREATE TRIGGER handle_soft_delete_trigger
AFTER UPDATE OF deleted_at ON public.messages
FOR EACH ROW
EXECUTE FUNCTION handle_soft_delete();

COMMENT ON TRIGGER handle_soft_delete_trigger ON public.messages IS 'Trigger to handle additional actions on message soft-delete.';


/*
    --------------------------------------------------------
    Trigger Function: update_message_preview_on_edit
    Description: Updates message previews in various tables when a message's content is edited.
                Previews are truncated to 67 characters with ellipsis if longer than 70 characters.
    --------------------------------------------------------
*/

CREATE OR REPLACE FUNCTION update_message_preview_on_edit()
RETURNS TRIGGER AS $$
DECLARE
    truncated_content TEXT; -- Declaration of the variable
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

    -- Update previews for messages that are forwards of the edited message
    UPDATE public.messages
    SET content = NEW.content
    WHERE origin_message_id = NEW.id;

    -- Update last message preview in the channel of the edited message
    IF NEW.thread_id IS NULL THEN
        UPDATE public.channels
        SET last_message_preview = truncated_content
        WHERE id = NEW.channel_id;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

/*
    --------------------------------------------------------
    Trigger: update_message_content_on_edit_trigger
    Description: Activates upon editing the content of a message.
                 Invokes the update_message_preview_on_edit function to update related previews.
    --------------------------------------------------------
*/

CREATE TRIGGER update_message_content_on_edit_trigger
AFTER UPDATE OF content ON public.messages
FOR EACH ROW
WHEN (OLD.content IS DISTINCT FROM NEW.content)
EXECUTE FUNCTION update_message_preview_on_edit();


-----------------------------------------

CREATE OR REPLACE FUNCTION update_edited_at() RETURNS TRIGGER AS $$
BEGIN
    -- Check if the content or html column has been updated
    IF OLD.content IS DISTINCT FROM NEW.content OR OLD.html IS DISTINCT FROM NEW.html THEN
        -- Update the edited_at timestamp
        NEW.edited_at := NOW();
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;


CREATE TRIGGER trigger_update_edited_at
BEFORE UPDATE OF content, html ON public.messages
FOR EACH ROW
EXECUTE FUNCTION update_edited_at();
----------------------------------------------------------------------------------
----------------------------------------------------------------------------------


-- CREATE OR REPLACE FUNCTION update_last_read_status()
-- RETURNS TRIGGER AS $$
-- BEGIN
--     -- Check if it's a message insert or delete operation
--     IF TG_OP = 'INSERT' THEN
--         -- Update last_read_message_id and last_read_update only for the user who sent the message
--         UPDATE public.channel_members
--         SET last_read_message_id = NEW.id,
--             last_read_update_at = timezone('utc', now())
--         WHERE channel_id = NEW.channel_id AND member_id = NEW.user_id;
--     ELSIF TG_OP = 'UPDATE' AND NEW.deleted_at IS NOT NULL THEN
--         -- If the message is soft-deleted, set last_read_message_id to null for this message
--         UPDATE public.channel_members
--         SET last_read_message_id = NULL
--         WHERE last_read_message_id = NEW.id;
--     END IF;

--     RETURN NEW;
-- END;
-- $$ LANGUAGE plpgsql;

-- -- Trigger for new message insertion
-- CREATE TRIGGER trigger_update_on_new_message
-- AFTER INSERT ON public.messages
-- FOR EACH ROW
-- EXECUTE FUNCTION update_last_read_status();

-- -- Trigger for message update (soft deletion)
-- CREATE TRIGGER trigger_update_on_message_delete
-- AFTER UPDATE OF deleted_at ON public.messages
-- FOR EACH ROW
-- WHEN (OLD.deleted_at IS NULL AND NEW.deleted_at IS NOT NULL)
-- EXECUTE FUNCTION update_last_read_status();


-- TODO: Revise
-- CREATE OR REPLACE FUNCTION update_message_reads(last_message_id VARCHAR(36), channel_id VARCHAR(36))
-- RETURNS VOID AS $$
-- DECLARE
--     current_user_id VARCHAR(36) := auth.uid(); -- Get current user's ID
--     last_read_timestamp TIMESTAMP WITH TIME ZONE;
--     last_message_timestamp TIMESTAMP WITH TIME ZONE;
--     messages_to_read VARCHAR(36)[]; -- Array to hold message IDs for batch insertion
-- BEGIN
--     -- Retrieve the timestamp of the last read message for the current user in the specified channel
--     SELECT created_at INTO last_read_timestamp
--     FROM public.messages
--     WHERE id = (SELECT last_read_message_id
--                 FROM public.channel_members
--                 WHERE channel_id = channel_id AND member_id = current_user_id);

--     -- Retrieve the timestamp of the last_message_id
--     SELECT created_at INTO last_message_timestamp
--     FROM public.messages
--     WHERE id = last_message_id;

--     -- Check if both timestamps are valid (non-NULL)
--     IF last_read_timestamp IS NOT NULL AND last_message_timestamp IS NOT NULL THEN
--         -- Collect message IDs for messages sent after the last read message and up to the last_message_id
--         SELECT array_agg(id) INTO messages_to_read
--         FROM public.messages
--         WHERE channel_id = channel_id
--           AND user_id != current_user_id
--           AND created_at > last_read_timestamp
--           AND created_at <= last_message_timestamp
--         ORDER BY created_at;

--         -- Perform batch insertion into message_reads table
--         INSERT INTO public.message_reads (channel_id, message_id, reader_id, read_at)
--         SELECT channel_id, unnest(messages_to_read), current_user_id, now()
--         FROM unnest(messages_to_read)
--         ON CONFLICT (channel_id, message_id, reader_id) DO NOTHING; -- Avoid duplicates
--     END IF;
-- END;
-- $$ LANGUAGE plpgsql VOLATILE SECURITY DEFINER;


-- TODO: Revise
-- CREATE TABLE public.message_reads (
--     channel_id           VARCHAR(36) NOT NULL REFERENCES public.channels ON DELETE CASCADE,
--     message_id           VARCHAR(36) NOT NULL REFERENCES public.messages ON DELETE CASCADE,
--     reader_id            UUID NOT NULL REFERENCES public.users ON DELETE CASCADE,
--     read_at              TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc', now()) NOT NULL,
--     PRIMARY KEY (channel_id, message_id, reader_id)
-- );

-- CREATE INDEX idx_message_reads_channel_id_message_id ON public.message_reads (channel_id, message_id);

-----------------------------------------
-----------------------------------------

CREATE OR REPLACE FUNCTION handle_set_thread_depth()
RETURNS TRIGGER AS $$
DECLARE
    parent_thread_depth INT;
BEGIN
    -- Check if the new message has a thread_id and retrieve the thread_depth of the parent message
    SELECT thread_depth INTO parent_thread_depth FROM public.messages WHERE id = NEW.thread_id;

    -- Set the thread_depth of the new message if parent_thread_depth is not null
    IF parent_thread_depth IS NOT NULL THEN
        NEW.thread_depth := parent_thread_depth + 1;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_set_thread_depth
BEFORE INSERT ON public.messages
FOR EACH ROW
WHEN (NEW.thread_id IS NOT NULL)
EXECUTE FUNCTION handle_set_thread_depth();

-----------------------------------------
-----------------------------------------
CREATE OR REPLACE FUNCTION create_thread_message(
    p_content TEXT,
    p_html TEXT,
    p_thread_id UUID,
    p_workspace_id UUID
)
RETURNS VOID
AS $$
DECLARE
    v_channel_exists BOOLEAN;
    v_is_user_member BOOLEAN;
    v_is_thread_root BOOLEAN;
    v_thread_owner_id UUID;
BEGIN
    -- Check if the channel exists and if the user is a member
    SELECT
        EXISTS (
            SELECT 1
            FROM public.channels
            WHERE id = p_thread_id
        ),
        EXISTS (
            SELECT 1
            FROM public.channel_members
            WHERE channel_id = p_thread_id
            AND member_id = auth.uid()
        )
    INTO v_channel_exists, v_is_user_member;

    -- If the channel doesn't exist, create a new one and add the user as an admin
    IF NOT v_channel_exists THEN
        INSERT INTO public.channels (id, workspace_id, slug, name, created_by, description, type)
        VALUES (p_thread_id, p_workspace_id, 'thread-' || uuid_generate_v4(), 'Thread Channel', auth.uid(), 'Automatically created channel for thread', 'THREAD');

        v_is_user_member := TRUE;
    -- If the user is not a member, add them as a member
    ELSIF NOT v_is_user_member THEN
        INSERT INTO public.channel_members (channel_id, member_id, channel_member_role)
        VALUES (p_thread_id, auth.uid(), 'MEMBER')
        ON CONFLICT DO NOTHING;

        v_is_user_member := TRUE;
    END IF;

    -- If the user is a member, update the thread and insert the new message
    IF v_is_user_member THEN
        -- Update the message to mark it as a thread root if needed
        WITH cte_thread_root AS (
            UPDATE public.messages
            SET thread_owner_id = COALESCE(thread_owner_id, auth.uid()),
                is_thread_root = TRUE
            WHERE id = p_thread_id
            AND (thread_owner_id IS NULL OR NOT is_thread_root)
            RETURNING thread_owner_id, is_thread_root
        )
        SELECT thread_owner_id, is_thread_root
        INTO v_thread_owner_id, v_is_thread_root
        FROM cte_thread_root;

        -- Insert the new message
        INSERT INTO public.messages (content, channel_id, user_id, html, thread_id)
        VALUES (p_content, p_thread_id, auth.uid(), p_html, p_thread_id);
    END IF;
END;
$$ LANGUAGE plpgsql;

-----------------------------------------
-----------------------------------------

CREATE OR REPLACE FUNCTION increment_thread_message_count()
RETURNS TRIGGER AS $$
DECLARE
    root_id UUID;
    current_metadata JSONB;
BEGIN
    -- Find the root message ID from the thread_id of the newly inserted message
    IF NEW.thread_id IS NOT NULL THEN
        root_id := NEW.thread_id;

        -- Retrieve current metadata or initialize if null
        SELECT metadata INTO current_metadata FROM public.messages WHERE id = root_id;
        IF current_metadata IS NULL THEN
            current_metadata := '{}'::jsonb;
        END IF;

        -- Ensure 'thread' object exists, initialize if not
        IF NOT (current_metadata ? 'thread') THEN
            current_metadata := jsonb_build_object('thread', jsonb_build_object('message_count', 0));
        END IF;

        -- Increment the message_count
        current_metadata := jsonb_set(current_metadata, '{thread, message_count}', 
            ((current_metadata->'thread'->>'message_count')::int + 1)::text::jsonb, true);

        -- Update the root message's metadata
        UPDATE public.messages
        SET metadata = current_metadata
        WHERE id = root_id;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;


CREATE TRIGGER trigger_increment_thread_message_count
BEFORE INSERT ON public.messages
FOR EACH ROW
EXECUTE FUNCTION increment_thread_message_count();

-----------------------------------------
-----------------------------------------
CREATE OR REPLACE FUNCTION decrement_thread_message_count()
RETURNS TRIGGER AS $$
DECLARE
    root_id VARCHAR;
    current_metadata JSONB;
BEGIN
    -- Check for the root message ID from the thread_id of the message being deleted or soft-deleted
    IF OLD.thread_id IS NOT NULL AND OLD.deleted_at IS NOT NULL THEN
        root_id := NEW.thread_id;
        
        -- Retrieve current metadata or initialize if null
        SELECT metadata INTO current_metadata FROM public.messages WHERE id = root_id;
        IF current_metadata IS NULL THEN
            current_metadata := '{}'::jsonb;
        END IF;

        -- Ensure 'thread' object exists, initialize if not
        IF NOT (current_metadata ? 'thread') THEN
            current_metadata := jsonb_build_object('thread', jsonb_build_object('message_count', 1));  -- Default to 1 to avoid negative counts
        END IF;

        -- Decrement the message_count but do not go below zero
        current_metadata := jsonb_set(current_metadata, '{thread, message_count}', 
            GREATEST((current_metadata->'thread'->>'message_count')::int - 1, 0)::text::jsonb, true);

        -- Update the root message's metadata
        UPDATE public.messages
        SET metadata = current_metadata
        WHERE id = root_id;
    END IF;

    RETURN OLD;
END;
$$ LANGUAGE plpgsql;


CREATE TRIGGER trigger_decrement_thread_message_count
AFTER UPDATE OF deleted_at ON public.messages
FOR EACH ROW
WHEN (OLD.thread_id IS NOT NULL AND NEW.deleted_at IS NOT NULL)
EXECUTE FUNCTION decrement_thread_message_count();

-----------------------------------------
-----------------------------------------

-- Create the trigger function
CREATE OR REPLACE FUNCTION soft_delete_thread_root_messages()
RETURNS TRIGGER AS $$
BEGIN
    -- Check if the updated message is a soft-delete and the user is the owner
    IF NEW.thread_owner_id = auth.uid() THEN
        -- Delete all messages in the same thread
        DELETE FROM public.messages WHERE thread_id = NEW.thread_id;

        -- Delete the channel associated with this thread
        DELETE FROM public.channels WHERE id = NEW.thread_id;

        -- Delete all notifications related to the channel
        DELETE FROM public.notifications WHERE channel_id = NEW.thread_id;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create the trigger
CREATE TRIGGER trigger_soft_delete_thread_root_messages
AFTER UPDATE ON public.messages
FOR EACH ROW
WHEN (OLD.deleted_at IS NULL AND NEW.deleted_at IS NOT NULL )
EXECUTE PROCEDURE soft_delete_thread_root_messages();



-----------------------------------------
-----------------------------------------
-----------------------------------------
CREATE OR REPLACE FUNCTION update_replied_message_preview()
RETURNS TRIGGER AS $$
DECLARE
    originalMessageContent TEXT;
    truncatedContent TEXT;
BEGIN
    -- Only proceed if this message is a reply
    IF NEW.reply_to_message_id IS NOT NULL THEN
        -- Retrieve the content of the original message
        SELECT content INTO originalMessageContent FROM public.messages
        WHERE id = NEW.reply_to_message_id;

        -- Update the replied_message_preview of the new message
        NEW.replied_message_preview := truncate_content(originalMessageContent) truncatedContent;
    END IF;

    -- Proceed with the insert operation
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;


CREATE TRIGGER before_insert_reply_message_add_message_preview
BEFORE INSERT ON public.messages
FOR EACH ROW
EXECUTE FUNCTION update_replied_message_preview();

-----------------------------------------


/*
    --------------------------------------------------------
    Trigger Function: update_replied_metadata_before_insert
    Description: Updates the metadata of the original message when a reply is posted.
                 The metadata is updated to include the ID of the new reply message.
    --------------------------------------------------------
*/


CREATE OR REPLACE FUNCTION update_replied_metadata_before_insert()
RETURNS TRIGGER AS $$
DECLARE
    currentMetadata JSONB;
BEGIN
    -- Only proceed if this message is a reply
    IF NEW.reply_to_message_id IS NOT NULL THEN

        -- Generate a new ID if not provided
        IF NEW.id IS NULL THEN
            NEW.id := uuid_generate_v4();
        END IF;

        -- Retrieve the current metadata of the original message
        SELECT metadata INTO currentMetadata FROM public.messages
        WHERE id = NEW.reply_to_message_id;

        -- Initialize metadata if null
        IF currentMetadata IS NULL THEN
            currentMetadata := '{}'::jsonb;
        END IF;

        -- Check if the 'replied' key exists, if not initialize it as an empty array
        IF NOT (currentMetadata ? 'replied') THEN
            currentMetadata := currentMetadata || jsonb_build_object('replied', '[]'::jsonb);
        END IF;

        -- Append the new message ID to the 'replied' array
        currentMetadata := jsonb_set(currentMetadata, '{replied}', (currentMetadata->'replied') || to_jsonb(NEW.id::text));

        -- Update the original message's metadata
        UPDATE public.messages
        SET metadata = currentMetadata
        WHERE id = NEW.reply_to_message_id;

    END IF;

    -- Proceed with the insert operation
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;


CREATE TRIGGER before_insert_message
BEFORE INSERT ON public.messages
FOR EACH ROW
EXECUTE FUNCTION update_replied_metadata_before_insert();


/*
    --------------------------------------------------------
    Trigger Function: update_message_preview_on_reply
    Description: Updates the preview of the message being replied to when a reply is posted.
    --------------------------------------------------------
*/

CREATE OR REPLACE FUNCTION update_channel_preview_on_new_message() RETURNS TRIGGER AS $$
DECLARE
    truncated_content TEXT; -- Declaration of the variable
BEGIN
    -- Check if the message is part of a thread. If it is, don't update the channel preview.
    IF NEW.thread_id IS NULL THEN
        -- Update the last message preview in the channel with the new message content
        -- Note: We can also add truncation logic here if required
        truncated_content := truncate_content(NEW.content);

        UPDATE public.channels
        SET last_message_preview = truncated_content,
            last_activity_at = NOW()
        WHERE id = NEW.channel_id;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION update_channel_preview_on_new_message() IS 'Function to update the last message preview in a channel when a new message is inserted, except for messages that are part of a thread.';


/*
    --------------------------------------------------------
    Trigger: update_channel_preview_on_new_message_trigger
    Description:  Activates after a new message is inserted.
                  Invokes the update_channel_preview_on_new_message function to update the last message preview in the channel.
    --------------------------------------------------------
*/

CREATE TRIGGER update_channel_preview_on_new_message_trigger
AFTER INSERT ON public.messages
FOR EACH ROW
EXECUTE FUNCTION update_channel_preview_on_new_message();

COMMENT ON TRIGGER update_channel_preview_on_new_message_trigger ON public.messages IS 'Trigger to update the last message preview in the corresponding channel when a new message is inserted.';

/*
    --------------------------------------------------------
    Trigger Function: copy_content_for_forwarded_message
    Description: Prepares a new message record before insertion when the message is a forward. 
                 It copies the content and media from the original message, resetting certain fields to ensure integrity.
    --------------------------------------------------------
*/
-- TODO: metadata for forwarded chains not good choice
CREATE OR REPLACE FUNCTION copy_content_for_forwarded_message()
RETURNS TRIGGER AS $$
DECLARE
  original_message RECORD;
  forwarding_user RECORD;
  user_details JSONB;
BEGIN
  -- Check if the message is a forward by the presence of origin_message_id
  IF NEW.origin_message_id IS NOT NULL THEN
    -- Retrieve content, media, and metadata from the original message
    SELECT content, html, medias, metadata, user_id INTO original_message 
    FROM public.messages 
    WHERE id = NEW.origin_message_id;

    -- Retrieve the forwarding user's details
    SELECT id, username, full_name, avatar_url INTO forwarding_user
    FROM public.users
    WHERE id = original_message.user_id; -- Assuming NEW.user_id is the ID of the user who is forwarding the message

    -- Prepare user details JSON object
    user_details := jsonb_build_object(
        'id', forwarding_user.id,
        'username', forwarding_user.username,
        'full_name', forwarding_user.full_name,
        'avatar_url', forwarding_user.avatar_url
    );

    -- Check if original_message.metadata has 'forwarding_chain' key
    IF original_message.metadata ? 'forwarding_chain' THEN
        -- Append the new user details to the existing array
        NEW.metadata := jsonb_set(original_message.metadata, '{forwarding_chain}', original_message.metadata->'forwarding_chain' || user_details);
    ELSE
        -- Create a new 'forwarding_chain' array with the user details
        NEW.metadata := jsonb_build_object('forwarding_chain', jsonb_build_array(user_details));
    END IF;

    -- Populate the new message record with content and media from the original
    NEW.content := original_message.content;
    NEW.medias := original_message.medias;
    NEW.html := original_message.html;

    -- Clear other fields not relevant for a forwarded message
    NEW.reactions := null;
    NEW.reply_to_message_id := null;
    NEW.replied_message_preview := null;
  END IF;

  RETURN NEW; -- Return the modified message record
END;
$$ LANGUAGE plpgsql;

/*
    --------------------------------------------------------
    Trigger: forward_message_content_before_insert_trigger
    Description: Activated before inserting a new message. It invokes copy_content_for_forwarded_message 
                 function to replicate content and media for forwarded messages, ensuring that certain fields are reset.
    --------------------------------------------------------
*/

CREATE TRIGGER forward_message_content_before_insert_trigger
BEFORE INSERT ON public.messages
FOR EACH ROW
EXECUTE FUNCTION copy_content_for_forwarded_message();
-----------------------------------------

-- Function to update message metadata
CREATE OR REPLACE FUNCTION update_message_metadata_on_pin()
RETURNS TRIGGER AS $$
DECLARE
    current_metadata JSONB;
    message_content TEXT;
BEGIN
    -- Retrieve current metadata and content from the messages table for the given message_id
    SELECT metadata, content INTO current_metadata, message_content FROM public.messages WHERE id = NEW.message_id;

    -- Check if metadata is null and initialize it if necessary
    IF current_metadata IS NULL THEN
        current_metadata := '{}'::JSONB;
    END IF;

    -- Update the metadata with "pinned": true
    current_metadata := jsonb_set(current_metadata, '{pinned}', 'true');

    -- Update the messages table with new metadata
    UPDATE public.messages SET metadata = current_metadata WHERE id = NEW.message_id;

    -- Set the content of the pinned message
    NEW.content :=  truncate_content(message_content) ;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;


-- Trigger on the pinned_messages table
CREATE TRIGGER trigger_update_message_on_pin
BEFORE INSERT ON public.pinned_messages
FOR EACH ROW EXECUTE FUNCTION update_message_metadata_on_pin();

-----------------------------------------

-- Function to update message metadata when a pinned message is deleted
CREATE OR REPLACE FUNCTION update_message_metadata_on_unpin()
RETURNS TRIGGER AS $$
DECLARE
    current_metadata JSONB;
BEGIN
    -- Retrieve current metadata from the messages table for the given message_id
    SELECT metadata INTO current_metadata FROM public.messages WHERE id = OLD.message_id;

    -- Check if metadata is null and initialize it if necessary
    IF current_metadata IS NULL THEN
        current_metadata := '{}'::JSONB;
    END IF;

    -- Update the metadata with "pinned": false
    current_metadata := jsonb_set(current_metadata, '{pinned}', 'false');

    -- Update the messages table
    UPDATE public.messages SET metadata = current_metadata WHERE id = OLD.message_id;

    RETURN OLD;
END;
$$ LANGUAGE plpgsql;

-- Trigger on the pinned_messages table for deletion
CREATE TRIGGER trigger_update_message_on_unpin
AFTER DELETE ON public.pinned_messages
FOR EACH ROW EXECUTE FUNCTION update_message_metadata_on_unpin();


/*
    --------------------------------------------------------
    Trigger Function: update_channel_activity_on_pin
    Description: Updates the last activity timestamp of a channel when a message is pinned to it. 
                 This helps in tracking the latest interactions within the channel.
    --------------------------------------------------------
*/

CREATE OR REPLACE FUNCTION update_channel_activity_on_pin() RETURNS TRIGGER AS $$
BEGIN
    -- Update the last_activity_at timestamp of the channel where the message is pinned
    UPDATE public.channels
    SET last_activity_at = NOW()
    WHERE id = NEW.channel_id;

    RETURN NEW; -- Return the new pinned message record
END;
$$ LANGUAGE plpgsql;


/*
    --------------------------------------------------------
    Trigger: channel_activity_update_on_message_pin_trigger
    Description: Triggered after a message is pinned. It invokes update_channel_activity_on_pin 
                 function to refresh the channel's last activity timestamp.
    --------------------------------------------------------
*/

CREATE TRIGGER channel_activity_update_on_message_pin_trigger
AFTER INSERT ON public.pinned_messages
FOR EACH ROW
EXECUTE FUNCTION update_channel_activity_on_pin();

CREATE OR REPLACE FUNCTION create_notifications_for_mentions()
RETURNS TRIGGER AS $$
DECLARE
    mentioned_user_id UUID;
    is_channel_muted BOOLEAN;
    truncated_content TEXT;
BEGIN
    -- Check if notifications are muted for the channel
    SELECT mute_in_app_notifications INTO is_channel_muted
    FROM public.channels
    WHERE id = NEW.channel_id;

    IF is_channel_muted THEN
        RETURN NEW; -- Exit if notifications are muted for the channel
    END IF;

    truncated_content := truncate_content(NEW.content);

    -- Find all mentioned usernames in the message
    FOR mentioned_user_id IN
        SELECT u.id
        FROM public.users u
        WHERE NEW.content LIKE '%@' || u.username || ' %'
           OR NEW.content LIKE '%@' || u.username || '%'
    LOOP
        -- Check if the mentioned user has muted notifications
        IF NOT (SELECT mute_in_app_notifications
                FROM public.channel_members
                WHERE channel_id = NEW.channel_id
                  AND member_id = mentioned_user_id) THEN
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
                NOW()
            );
        END IF;
    END LOOP;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_on_new_message_for_mention_notifications
AFTER INSERT ON public.messages
FOR EACH ROW
WHEN (NEW.content LIKE '%@%')
EXECUTE FUNCTION create_notifications_for_mentions();


--------------------------------------------------------
--------------------------------------------------------
--------------------------------------------------------

-- Function to handle '@everyone' notifications
CREATE OR REPLACE FUNCTION create_notifications_for_everyone()
RETURNS TRIGGER AS $$
DECLARE
    channel_member_id UUID;
    is_channel_muted BOOLEAN;
    truncated_content TEXT;
BEGIN
    -- Check if notifications are muted for the channel
    SELECT mute_in_app_notifications INTO is_channel_muted
    FROM public.channels
    WHERE id = NEW.channel_id;

    IF is_channel_muted THEN
        RETURN NEW; -- Exit if notifications are muted for the channel
    END IF;

    truncated_content := truncate_content(NEW.content);

    -- Handle '@everyone' mention, but exclude the sender
    IF NEW.content LIKE '%@everyone%' THEN
        FOR channel_member_id IN
            SELECT member_id
            FROM public.channel_members
            WHERE channel_id = NEW.channel_id
              AND member_id != NEW.user_id
        LOOP
            -- Check if the channel member has muted notifications
            IF NOT (SELECT mute_in_app_notifications
                    FROM public.channel_members
                    WHERE channel_id = NEW.channel_id
                      AND member_id = channel_member_id) THEN
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
                    NOW()
                );
            END IF;
        END LOOP;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

--------------------------------------------------------
--------------------------------------------------------
--------------------------------------------------------

CREATE TRIGGER trigger_on_new_message_for_everyone_notifications
AFTER INSERT ON public.messages
FOR EACH ROW
WHEN (NEW.content LIKE '%@everyone%')
EXECUTE FUNCTION create_notifications_for_everyone();

-- Function to handle regular message notifications
-- Description: Creates a notification for each member of the channel, excluding the sender,
--              only if the channel is not muted, the member has not muted notifications,
--              and the member is not currently online.
--              If the user is online, they do not need a notification for the current and other channels; 
--              instead, they only need the unread count and mention notifications.
CREATE OR REPLACE FUNCTION create_notifications_for_regular_messages()
RETURNS TRIGGER AS $$
DECLARE
    is_channel_muted BOOLEAN;
    truncated_content TEXT;
BEGIN

    -- Check if notifications are muted for the channel
    SELECT mute_in_app_notifications INTO is_channel_muted
    FROM public.channels
    WHERE id = NEW.channel_id;

    IF is_channel_muted THEN
        RETURN NEW; -- Exit if notifications are muted for the channel
    END IF;

    truncated_content := truncate_content(NEW.content);

    -- Create notifications for channel members who have not muted notifications
    INSERT INTO public.notifications (
        receiver_user_id,
        sender_user_id,
        type,
        message_id,
        channel_id,
        message_preview,
        created_at
    )
    SELECT
        cm.member_id,
        NEW.user_id,
        CASE
            WHEN NEW.thread_id IS NOT NULL THEN 'thread_message'::notification_category
            WHEN NEW.reply_to_message_id IS NOT NULL AND m.user_id = cm.member_id THEN 'reply'::notification_category
            ELSE 'message'::notification_category
        END,
        NEW.id,
        NEW.channel_id,
        truncated_content,
        NOW()
    FROM public.channel_members cm
    LEFT JOIN public.messages m ON m.id = NEW.reply_to_message_id
    LEFT JOIN public.users u ON u.id = cm.member_id
    WHERE cm.channel_id = NEW.channel_id
      AND u.status != 'ONLINE'
      AND cm.member_id != NEW.user_id
      AND cm.mute_in_app_notifications = FALSE;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_on_new_message_for_regular_notifications
AFTER INSERT ON public.messages
FOR EACH ROW
WHEN (NEW.content NOT LIKE '%@%' OR NEW.content NOT LIKE '%@everyone%')
EXECUTE FUNCTION create_notifications_for_regular_messages();

--------------------------------------------------------
--------------------------------------------------------
--------------------------------------------------------

CREATE OR REPLACE FUNCTION create_notifications_for_new_unique_reactions()
RETURNS TRIGGER AS $$
DECLARE
    old_reactions JSONB;
    new_reactions JSONB;
    reaction_key TEXT;
    new_reaction JSONB;
BEGIN
    -- Extract the old and new reactions into separate variables
    old_reactions := OLD.reactions;
    new_reactions := NEW.reactions;

    -- Loop through each reaction type key in the new reactions JSONB
    FOR reaction_key IN SELECT jsonb_object_keys(new_reactions)
    LOOP
        -- Loop through each new reaction for the current key
        FOR new_reaction IN SELECT jsonb_array_elements(new_reactions -> reaction_key)
        LOOP
            -- Check if the new reaction exists in the old reactions
            IF (old_reactions ? reaction_key) AND
               (old_reactions -> reaction_key) @> jsonb_build_array(new_reaction)
            THEN
                -- Reaction already exists, skip
                CONTINUE;
            ELSE
                -- Create a new notification
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
                    OLD.user_id,
                    (new_reaction ->> 'user_id')::UUID,
                    'reaction',
                    NEW.id,
                    NEW.channel_id,
                    COALESCE(truncate_content(NEW.content), ''),
                    NOW()
                );
            END IF;
        END LOOP;
    END LOOP;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_on_reaction_update_for_notifications
AFTER UPDATE OF reactions ON public.messages
FOR EACH ROW
WHEN (OLD.reactions IS DISTINCT FROM NEW.reactions)
EXECUTE FUNCTION create_notifications_for_new_unique_reactions();


/*
    --------------------------------------------------------
    Function: increment_unread_count_on_new_message
    Description: Increments the unread message count for each channel member when a new message is posted.
                 The count is incremented only for members who have not read messages up to the time of the new message.
    --------------------------------------------------------
*/

CREATE OR REPLACE FUNCTION increment_unread_count_on_new_message() RETURNS TRIGGER AS $$
BEGIN
    -- Increment unread message count for all channel members who have not read up to this new message
    UPDATE public.channel_members
    SET unread_message_count = unread_message_count + 1
    WHERE channel_id = NEW.channel_id
      AND member_id != NEW.user_id
      AND last_read_update_at < NEW.created_at;

    RETURN NEW; -- Return the new message record
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION increment_unread_count_on_new_message() IS 'Function to increment unread message count for channel members upon the insertion of a new message, optimized to perform a single update for all eligible members.';

/*
    --------------------------------------------------------
    Trigger: increment_unread_count_after_new_message
    Description: Triggered after a new message is inserted. Calls the 
                 increment_unread_count_on_new_message function to update unread message counts
                 for members in the message's channel.
    --------------------------------------------------------
*/

CREATE TRIGGER increment_unread_count_after_new_message
AFTER INSERT ON public.messages
FOR EACH ROW
EXECUTE FUNCTION increment_unread_count_on_new_message();

COMMENT ON TRIGGER increment_unread_count_after_new_message ON public.messages IS 'Trigger to increment unread message count for channel members in the channel_members table after a new message is posted.';




CREATE OR REPLACE FUNCTION decrement_unread_message_count() RETURNS TRIGGER AS $$
DECLARE
    channel_member RECORD;
    notification_count INT;
    channel_id_used UUID;
BEGIN
    -- Determine whether it's a soft delete (update) or hard delete
    IF TG_OP = 'DELETE' THEN
        channel_id_used := OLD.channel_id;
    ELSE
        channel_id_used := NEW.channel_id;
    END IF;

    -- Decrement unread message count for channel members
    FOR channel_member IN SELECT * FROM public.channel_members WHERE channel_id = channel_id_used LOOP
        -- Count the notifications associated with the message for this particular user
        SELECT COUNT(*) INTO notification_count 
        FROM public.notifications 
        WHERE receiver_user_id = channel_member.member_id AND channel_id = channel_id_used AND readed_at IS NULL;

        UPDATE public.channel_members
        SET unread_message_count = notification_count
        WHERE channel_id = channel_id_used AND member_id = channel_member.member_id;
    END LOOP;

    RETURN NULL; -- Return value is not used for AFTER triggers
END;
$$ LANGUAGE plpgsql;


CREATE TRIGGER decrement_unread_message_count_trigger_soft_delete
AFTER UPDATE OF deleted_at ON public.messages
FOR EACH ROW
WHEN (OLD.deleted_at IS NULL AND NEW.deleted_at IS NOT NULL)
EXECUTE FUNCTION decrement_unread_message_count();

CREATE TRIGGER decrement_unread_message_count_trigger_hard_delete
AFTER DELETE ON public.messages
FOR EACH ROW
EXECUTE FUNCTION decrement_unread_message_count();

--- in decrement unread message count, I have to listen to update channel_member table
--- in order if the
-- Test
-- SELECT * FROM get_channel_aggregate_data('99634205-5238-4ffc-90ec-c64be3ad25cf');
CREATE OR REPLACE FUNCTION get_channel_aggregate_data(
    input_channel_id UUID,
    message_limit INT DEFAULT 20
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
    last_read_message_timestamp TIMESTAMP WITH TIME ZONE
) AS $$
DECLARE
    channel_result JSONB;
    messages_result JSONB;
    pinned_result JSONB;
    is_member_result BOOLEAN;
    channel_member_info_result JSONB;
    last_read_message_id UUID;
    last_read_message_timestamp TIMESTAMP WITH TIME ZONE;
    unread_message BOOLEAN := FALSE;
BEGIN
 
    -- Get the last_read_message_id for the current user in the channel
    SELECT cm.last_read_message_id INTO last_read_message_id
    FROM public.channel_members cm
    WHERE cm.channel_id = input_channel_id AND cm.member_id = auth.uid();

    -- Get the timestamp of the last read message
    SELECT created_at INTO last_read_message_timestamp
    FROM public.messages
    WHERE id = last_read_message_id;

    -- Count messages since the last read message and adjust message_limit
    SELECT COUNT(*) INTO total_messages_since_last_read
    FROM public.messages 
    WHERE channel_id = input_channel_id 
        AND created_at >= last_read_message_timestamp
        AND deleted_at IS NULL;

   IF total_messages_since_last_read >= message_limit THEN
        message_limit := total_messages_since_last_read;
        unread_message := TRUE;
    END IF;

    -- Query for channel information
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
    WHERE c.id = input_channel_id;

    -- Query for the last 10 messages with user details, including replied message details
    SELECT json_agg(t) INTO messages_result
    FROM (
        SELECT m.*,
            json_build_object(
                'id', u.id, 
                'username', u.username, 
                'fullname', u.full_name, 
                'avatar_url', u.avatar_url
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
                                'avatar_url', ru.avatar_url
                            )
                        ) FROM public.messages rm
                        LEFT JOIN public.users ru ON rm.user_id = ru.id
                        WHERE rm.id = m.reply_to_message_id)
                ELSE NULL
            END AS replied_message_details
        FROM public.messages m
        LEFT JOIN public.users u ON m.user_id = u.id
        WHERE m.channel_id = input_channel_id
            AND m.deleted_at IS NULL
            AND (
                CASE
                    WHEN total_messages_since_last_read < 20 THEN TRUE
                    ELSE m.created_at >= COALESCE(last_read_message_timestamp, 'epoch')
                END
            )
        ORDER BY m.created_at DESC
        LIMIT message_limit
    ) t;

    IF total_messages_since_last_read <= 0 THEN
        total_messages_since_last_read := message_limit;
    END IF;
        
    -- Query for the pinned messages
    SELECT json_agg(pm) INTO pinned_result
    FROM public.pinned_messages pm
    JOIN public.messages m ON pm.message_id = m.id
    WHERE pm.channel_id = input_channel_id;

    -- Attempt to get channel member details
    SELECT json_build_object(
            'last_read_message_id', cm.last_read_message_id,
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

    -- Return the results including the user data
    RETURN QUERY SELECT channel_result, messages_result, pinned_result, is_member_result, channel_member_info_result, total_messages_since_last_read, unread_message, last_read_message_id, last_read_message_timestamp;
END;
$$ LANGUAGE plpgsql;

-------------------------------------------------
-- p_message_id =: is the last message inserted in the channel
CREATE OR REPLACE FUNCTION mark_messages_as_read(
    p_channel_id UUID, 
    p_message_id UUID
)
RETURNS VOID AS $$
DECLARE
    current_utc_timestamp TIMESTAMP WITH TIME ZONE := timezone('utc', now());
    target_timestamp TIMESTAMP WITH TIME ZONE;
    is_last_message BOOLEAN;
    messages_to_mark_count INT;
BEGIN
    -- Get the timestamp of the specified message
    SELECT created_at INTO target_timestamp
    FROM public.messages
    WHERE id = p_message_id;

    -- Check if the target_timestamp is valid (non-NULL)
    IF target_timestamp IS NOT NULL THEN
        -- Check if the given message ID is the last message in the channel by timestamp
        SELECT created_at = (SELECT MAX(created_at) FROM public.messages WHERE channel_id = p_channel_id)
        INTO is_last_message
        FROM public.messages
        WHERE id = p_message_id;

        -- Count the number of unread messages sent before or at the target timestamp, excluding those sent by the current user
        SELECT COUNT(*)
        INTO messages_to_mark_count
        FROM public.messages
        WHERE channel_id = p_channel_id
          AND user_id != auth.uid()
          AND created_at <= target_timestamp
          AND thread_id IS NULL
          AND readed_at IS NULL;

        IF messages_to_mark_count > 0 THEN
            -- Update readed_at for these messages
            UPDATE public.messages
            SET readed_at = current_utc_timestamp
            WHERE channel_id = p_channel_id
              AND user_id != auth.uid()
              AND created_at <= target_timestamp
              AND thread_id IS NULL
              AND readed_at IS NULL;

            -- Mark the notification as read
            UPDATE public.notifications
            SET readed_at = current_utc_timestamp
            WHERE channel_id = p_channel_id
              AND receiver_user_id = auth.uid()
              AND message_id = p_message_id
              AND readed_at IS NULL;
        END IF;

        -- Update the last_read_message_id and adjust the unread_message_count
        UPDATE public.channel_members
        SET last_read_message_id = p_message_id,
            last_read_update_at = current_utc_timestamp,
            unread_message_count = CASE WHEN is_last_message THEN 0 ELSE GREATEST(unread_message_count - messages_to_mark_count, 0) END
        WHERE channel_id = p_channel_id AND member_id = auth.uid();
    END IF;
END;
$$ LANGUAGE plpgsql VOLATILE SECURITY DEFINER;


--------------------------------------------------

CREATE OR REPLACE FUNCTION get_channel_messages_paginated(
    input_channel_id UUID,
    page INT,
    page_size INT DEFAULT 20 
)
RETURNS TABLE(
    messages JSONB
) AS $$
DECLARE
    message_offset INT; -- Renamed 'offset' to 'message_offset' to avoid keyword conflict
BEGIN
    -- Calculate the message_offset based on the page number and page size
    message_offset := (page - 1) * page_size;

    -- Query to fetch messages with pagination
    SELECT json_agg(t) INTO messages
    FROM (
        SELECT m.*,
            json_build_object(
                'id', u.id, 
                'username', u.username, 
                'fullname', u.full_name, 
                'avatar_url', u.avatar_url
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
                                'avatar_url', ru.avatar_url
                            )
                        ) FROM public.messages rm
                        LEFT JOIN public.users ru ON rm.user_id = ru.id
                        WHERE rm.id = m.reply_to_message_id)
                ELSE NULL
            END AS replied_message_details
        FROM public.messages m
        LEFT JOIN public.users u ON m.user_id = u.id
        WHERE m.channel_id = input_channel_id 
            AND m.deleted_at IS NULL 
            AND m.thread_id IS NULL
        ORDER BY m.created_at DESC 
        LIMIT page_size OFFSET message_offset
    ) t;

    RETURN QUERY SELECT messages;
END;
$$ LANGUAGE plpgsql;


-- TEST
--- SELECT * FROM get_channel_messages_paginated('<channel_id>', 2, 10);


-------------------------------
-------------------------------
CREATE OR REPLACE FUNCTION create_direct_message_channel(
    workspace_uid UUID,
    user_id UUID
) RETURNS JSONB AS $$
DECLARE
    user_name TEXT;
    display_name TEXT;
    full_name TEXT;
    email TEXT;
    new_channel JSONB;  -- Declaring as JSONB
    existing_channel JSONB;  -- Declaring as JSONB
    current_user_id UUID := auth.uid(); -- Store the current user ID
BEGIN
    -- Get the name of the user
    SELECT users.username, users.full_name, users.display_name, users.email
    INTO user_name, full_name, display_name, email
    FROM public.users WHERE users.id = user_id;

    -- Create display name based on the priority: display_name, full_name, username, email
    user_name := COALESCE(display_name, full_name, user_name, email);

    -- Check if the direct message channel already exists between the two users
    SELECT to_jsonb(ch.*) INTO existing_channel FROM public.channels ch
    WHERE ch.type = 'DIRECT'
    AND ch.workspace_id = workspace_uid
    AND EXISTS (
        SELECT 1
        FROM public.channel_members cm
        WHERE cm.channel_id = ch.id
        AND cm.member_id IN (current_user_id, user_id)
        GROUP BY cm.channel_id
        HAVING COUNT(DISTINCT cm.member_id) = 2
    );

    -- If the channel already exists, return it
    IF existing_channel IS NOT NULL THEN
        RETURN existing_channel;
    END IF;

    -- Otherwise, create a new channel
    INSERT INTO public.channels (workspace_id, type, name, slug, created_by)
    VALUES (workspace_uid, 'DIRECT', user_name, uuid_generate_v4(), current_user_id)
    RETURNING to_jsonb(public.channels.*) INTO new_channel;

    -- Add both users as members to the new channel
    INSERT INTO public.channel_members (channel_id, member_id, joined_at)
    VALUES (new_channel->>'id', user_id, now());

    RETURN new_channel;
END;
$$ LANGUAGE plpgsql;
/*https://github.com/orgs/supabase/discussions/5152*/
/*----------------  Events TABLE  ---------------------*/


create table public.events ( 
  -- a primary key is necessary for realtime RLS to work 
  id int generated always as identity primary key, 
  -- `null` if the event is public, and the `auth.uid` if the event is for specific user. 
  uid uuid,
  -- customized topic including filters (e.g. "messages_view|{otherUID}" or "comments|{postID}") 
  topic text, 
  -- The inserted/updated data wrapped in a json object
  data json,
  -- `INSERT`, `UPDATE`, or `DELETE` 
  event_type text,
  -- used to delete old events by a cron job
  created_at timestamp with time zone DEFAULT now() NOT NULL

);

/*----------------  REALTIME SETUP  ---------------------*/

-- clients can only listen to the events table and only for insert events. 
ALTER PUBLICATION supabase_realtime SET (publish = 'insert');
ALTER PUBLICATION supabase_realtime ADD TABLE events;


/*----------------- SECURITY  ---------------------*/

-- RLS not good for performance

-- ALTER TABLE public.events ENABLE ROW LEVEL SECURITY;

-- CREATE POLICY events_policy
-- ON public.events
-- FOR SELECT USING (
--   events.uid is NULL OR events.uid = auth.uid()
-- );


/*----------------- INDEXES  ---------------------*/

CREATE INDEX events_topic_idx ON public.events (topic);
CREATE INDEX events_uid_idx ON public.events (uid);
CREATE INDEX events_created_at_idx ON public.events (created_at);

COMMENT ON TABLE public.events IS 'Stores all changes to the database. Used for realtime and to trigger webhooks.';

/*----------------- TRIGGERS  ---------------------*/

-- Indexes on public.users Table
-- Optimizes queries filtering or sorting by username.
CREATE INDEX idx_users_username ON public.users (username);

-- Indexes on public.messages Table
-- Optimizes query performance for frequently accessed columns.
CREATE INDEX idx_messages_channel_id ON public.messages (channel_id);
CREATE INDEX idx_messages_user_id ON public.messages (user_id);
CREATE INDEX idx_messages_updated_at ON public.messages (updated_at);
CREATE INDEX idx_messages_type ON public.messages (type);
CREATE INDEX idx_thread_id_created_at ON public.messages(thread_id, created_at);

-- Composite Index on public.messages
-- Optimizes query performance for filtering by channel_id and sorting by updated_at.
CREATE INDEX idx_messages_channel_id_updated_at ON public.messages (channel_id, updated_at);

-- Indexes on public.channels Table
-- Optimizes query performance for slug, created_by, and last_activity_at.
CREATE INDEX idx_channels_slug ON public.channels (slug);
CREATE INDEX idx_channels_created_by ON public.channels (created_by);

-- Indexes on public.pinned_messages Table
-- Optimizes query performance for channel_id and message_id.
CREATE INDEX idx_pinned_messages_channel_id ON public.pinned_messages (channel_id);
CREATE INDEX idx_pinned_messages_message_id ON public.pinned_messages (message_id);

-- Indexes on public.channel_members Table
-- Optimizes query performance for channel_id and member_id.
CREATE INDEX idx_channel_members_channel_id ON public.channel_members (channel_id);
CREATE INDEX idx_channel_members_member_id ON public.channel_members (member_id);

-- Indexes on public.notifications Table
-- Optimizes query performance for receiver_user_id and created_at.
CREATE INDEX idx_notifications_receiver_user_id ON public.notifications (receiver_user_id);
CREATE INDEX idx_notifications_created_at ON public.notifications (created_at);

-- Indexes on public.workspaces Table
-- Optimizes query performance for created_by.
CREATE INDEX idx_channels_workspace_id ON public.channels (workspace_id);
CREATE INDEX idx_workspaces_slug ON public.workspaces (slug);


-- create a system user for system messages
insert into auth.users (id, email)
values ('992bb85e-78f8-4747-981a-fd63d9317ff1', 'system@system.com');
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
*/

-- User Avatars Bucket Configuration
-- Purpose: Store user profile images.
-- Max File Size: 1MB (1,048,576 bytes).
-- Allowed MIME Types: JPEG, PNG, SVG, GIF, WebP.
INSERT INTO storage.buckets
    (id, name, public, file_size_limit, allowed_mime_types)
VALUES
    ('user_avatars', 'user_avatars', true, 1048576,
     '{"image/jpeg", "image/png", "image/svg+xml", "image/gif", "image/webp"}');

-- Policies for User Avatars Bucket
CREATE POLICY "User Avatar is publicly accessible" ON storage.objects
    FOR SELECT TO authenticated USING (bucket_id = 'user_avatars');
CREATE POLICY "User can upload an avatar" ON storage.objects
    FOR INSERT WITH CHECK (bucket_id = 'user_avatars');
CREATE POLICY "User can update own avatar" ON storage.objects
    FOR UPDATE TO authenticated USING (auth.uid() = owner AND bucket_id = 'user_avatars');
CREATE POLICY "User can delete own avatar" ON storage.objects
    FOR DELETE TO authenticated USING (auth.uid() = owner AND  bucket_id = 'user_avatars');

-- Channel Avatars Bucket Configuration
-- Purpose: Store images for chat channels.
-- Max File Size: 1MB (1,048,576 bytes).
-- Allowed MIME Types: JPEG, PNG, SVG, GIF, WebP.
INSERT INTO storage.buckets
    (id, name, public, file_size_limit, allowed_mime_types)
VALUES
    ('channel_avatars', 'channel_avatars', true, 1048576,
     '{"image/jpeg", "image/png", "image/svg+xml", "image/gif", "image/webp"}');

-- Policies for Channel Avatars Bucket
CREATE POLICY "Channel Avatar is publicly accessible" ON storage.objects
    FOR SELECT TO authenticated USING (bucket_id = 'channel_avatars');
CREATE POLICY "User can upload a channel avatar" ON storage.objects
    FOR INSERT WITH CHECK (bucket_id = 'channel_avatars');
CREATE POLICY "User can update own channel avatar" ON storage.objects
    FOR UPDATE TO authenticated USING (auth.uid() = owner AND bucket_id = 'channel_avatars');
CREATE POLICY "User can delete own channel avatar" ON storage.objects
    FOR DELETE TO authenticated USING (auth.uid() = owner AND bucket_id = 'channel_avatars');

-- Media Files Bucket Configuration
-- Purpose: Store various media files related to messages.
-- Max File Size: 2MB (2,097,152 bytes).
-- Allowed MIME Types: All file types.
INSERT INTO storage.buckets
    (id, name, public, file_size_limit, allowed_mime_types)
VALUES
    ('media', 'media', true, 2097152, '{"*/*"}');

-- Policies for Media Files Bucket
CREATE POLICY "Media files are publicly accessible" ON storage.objects
    FOR SELECT TO authenticated USING (bucket_id = 'media');
CREATE POLICY "User can upload media files" ON storage.objects
    FOR INSERT TO authenticated WITH CHECK (bucket_id = 'media');
CREATE POLICY "User can update own media files" ON storage.objects
    FOR UPDATE TO authenticated USING (auth.uid() = owner AND bucket_id = 'media');
CREATE POLICY "User can delete own media files" ON storage.objects
    FOR DELETE TO authenticated USING (auth.uid() = owner AND bucket_id = 'media');
-- RLS: Row Level Security
-- RLS is used to restrict access to rows in a table

-- CREATE TYPE public.channel_type AS ENUM
-- (
--     'PUBLIC',     -- PUBLIC: Open for all users. Any user of the application can join and participate.
--     'PRIVATE',    -- PRIVATE: Restricted access. Users can join only by invitation or approval.
--     'BROADCAST',  -- BROADCAST: One-way communication channel where selected users can post, but all users can view.
--     'ARCHIVE',    -- ARCHIVE: Read-only channel for historical/reference purposes. No new messages can be posted.
--     'DIRECT',     -- DIRECT: One-on-one private conversation between two users.
--     'GROUP'       -- GROUP: For a specific set of users, typically used for group discussions or team collaborations.
-- );

-- 1. only admin user can archive channel
-- 2. only admin user can insert pinned message
-- 3. only admin user can delete pinned message
-- 4. only user who is joined in channel can send messages
-- 5. only user who is joined in channel can reply to messages
-- 6. only user who is joined in channel can edit own messages
-- 7. only user who is joined in channel can delete own messages
-- 8. only user who is joined in channel can forward a message to this channel
-- 9. only user who is joined in channel can forward a message to other channel if user is joined in that channel
-- 10. noone can insert, delete, update messages in channel which is archived
-- 11. only admin user can insert, delete, update messages in channel which is broadcast

-- 12. owner of the message just can access to the message metadata
-- 13. owner of the channel can mention to everyone in the channel
-- add tables to the publication
-- reflace the tables changes to all subscribers
alter publication supabase_realtime add table public.users;
alter publication supabase_realtime add table public.channels;
alter publication supabase_realtime add table public.messages;
alter publication supabase_realtime add table public.channel_members;

-- Send "previous data" on change
-- for tracking row changed in realtime
alter table public.users replica identity full;
alter table public.channels replica identity full;
alter table public.messages replica identity full;
-- Check availability of 'pg_cron' extension in PostgreSQL.
-- SELECT * FROM pg_available_extensions WHERE name = 'pg_cron';

-- Enable 'pg_cron' extension for scheduling tasks within the database.
CREATE EXTENSION IF NOT EXISTS pg_cron;

-- Confirm that 'pg_cron' extension is activated.
-- SELECT * FROM pg_extension WHERE extname = 'pg_cron';
-- This cron job is scheduled to run every 5 minutes. Its purpose is to update the status of users in the `public.users` table. 
-- It sets the status to 'OFFLINE' for users who have not been active (as indicated by their `last_seen_at` timestamp) for more than 5 minutes.
-- This ensures that the user status remains up-to-date, reflecting whether they are currently active or inactive in the application.
-- NOTE: Active the pg_cron Extension in Supabase.
SELECT cron.schedule(
    'update-user-status',
    '*/5 * * * *',
    $$ 
    UPDATE public.users
    SET status = 'OFFLINE'
    WHERE online_at < NOW() - INTERVAL '5 minutes' AND status = 'ONLINE';
    $$ 
);


-- Cron Job: delete-read-notifications
-- Schedule: Runs daily at midnight (0 0 * * *)
-- Purpose: This job deletes all notifications from the 'public.notifications' table where the 'readed_at' field is not null.
-- This cleanup helps maintain the efficiency of the notifications table by removing entries that are no longer needed.
-- SELECT cron.schedule(
--     'delete-read-notifications',
--     '0 0 * * *',
--     $$
--     DELETE FROM public.notifications
--     WHERE readed_at IS NOT NULL;
--     $$
-- );
-- DUMMY DATA

/*
    -----------------------------------------
    1. Create Users
       Expectation: 6 users should be created.
    -----------------------------------------
*/
insert into auth.users (id, email)
values
    ('8d0fd2b3-9ca7-4d9e-a95f-9e13dded323e', 'supabot'),
    ('5f55998b-7958-4ae3-bcb7-539c65c00884', 'jack'),
    ('1059dbd0-3478-46f9-b8a9-dcd23ed0a23a', 'emma'),
    ('dc7d6520-8408-4a8b-b628-78d5f82b8b62', 'jhon'),
    ('c2e3e9e7-d0e8-4960-9b05-d263deb2722f', 'lisa'),
    ('35477c6b-f9a0-4bad-af0b-545c99b33fae', 'philip');

/*
    -----------------------------------------
    2. Create Workspaces
       Expectation: 2 workspaces should be created.
    -----------------------------------------
*/
insert into public.workspaces (id, slug, name, created_by, description)
values
    ('91fd572a-60a3-4baa-9e6a-39e7ae460d9e', 'supabase', 'Supabase', '8d0fd2b3-9ca7-4d9e-a95f-9e13dded323e', 'Supabase workspace'),
    ('5a8703b7-2fd7-45ee-9d6b-5ed3e4330a40', 'supabase-community', 'Supabase Community', '8d0fd2b3-9ca7-4d9e-a95f-9e13dded323e', 'Supabase community workspace');


/*
    -----------------------------------------
    3. Create Channels
       Expectation: 7 channels should be created with descriptions and types.
                    The created_by field should be set to the user who created the channel,
                    and that user should be added as an Admin in the channel_members table.
    -----------------------------------------
*/
insert into public.channels (id, workspace_id, slug, name, created_by, description, type)
values
    ('4b9f0f7e-6cd5-49b6-a8c3-141ef5905959', '91fd572a-60a3-4baa-9e6a-39e7ae460d9e', 'public', 'Public', '8d0fd2b3-9ca7-4d9e-a95f-9e13dded323e', 'General public discussions', 'PUBLIC'), 
    ('27c6745d-cebd-4afd-92b0-3b9b9312381b', '91fd572a-60a3-4baa-9e6a-39e7ae460d9e', 'random', 'Random', '8d0fd2b3-9ca7-4d9e-a95f-9e13dded323e', 'Random thoughts and ideas', 'PUBLIC'), 
    ('7ea75977-9bc0-4008-b5b8-13c56d16a588', '91fd572a-60a3-4baa-9e6a-39e7ae460d9e', 'game-boy', 'GameBoy', '35477c6b-f9a0-4bad-af0b-545c99b33fae', 'Game boy, win game awards, etc.', 'BROADCAST'),
    ('4d582754-4d72-48f8-9e72-f6aa63dacada', '91fd572a-60a3-4baa-9e6a-39e7ae460d9e', 'netfilix', 'Netfilix', '35477c6b-f9a0-4bad-af0b-545c99b33fae', 'Let’s talk about Netflix series', 'PRIVATE'),
    ('70ceab8b-2cf6-4004-8561-219de9b11ec2', '91fd572a-60a3-4baa-9e6a-39e7ae460d9e', 'movie-night', 'Movie Night', '1059dbd0-3478-46f9-b8a9-dcd23ed0a23a', 'Movie suggestions and discussions', 'DIRECT'),
    ('dc6a0f60-5260-456b-a5c7-b799cece8807', '91fd572a-60a3-4baa-9e6a-39e7ae460d9e', 'openai', 'OpenAI', 'dc7d6520-8408-4a8b-b628-78d5f82b8b62', 'What’s happening with OpenAI?', 'BROADCAST'),
    ('1292efc2-0cdc-470c-9364-ba76f19ce75d', '91fd572a-60a3-4baa-9e6a-39e7ae460d9e', 'tech-talk', 'Tech Yalk', 'c2e3e9e7-d0e8-4960-9b05-d263deb2722f', 'Discussions about the latest in tech', 'GROUP');

-- Mapping of channels with types and the user who created them.
-- public       -> PUBLIC       -> supabot
-- random       -> PUBLIC       -> supabot
-- game-boy     -> BROADCAST    -> philip
-- netfilix     -> PRIVATE      -> philip
-- movie-night  -> DIRECT       -> emma
-- openai       -> BROADCAST    -> jhon
-- tech-talk    -> GROUP        -> lisa

/* 
    -----------------------------------------
    3. Join Users to Channels
       Expectation: Users should be joined to channels as members.
    -----------------------------------------
*/
insert into public.channel_members (channel_id, member_id)
values

    -- Owner and Admin -> philip
    ('7ea75977-9bc0-4008-b5b8-13c56d16a588', '5f55998b-7958-4ae3-bcb7-539c65c00884'), -- game-boy   ==join==>   jack
    ('7ea75977-9bc0-4008-b5b8-13c56d16a588', '1059dbd0-3478-46f9-b8a9-dcd23ed0a23a'), -- game-boy   ==join==>   emma
    
    -- Owner and Admin -> philip
    ('4d582754-4d72-48f8-9e72-f6aa63dacada', 'c2e3e9e7-d0e8-4960-9b05-d263deb2722f'), -- netfilix   ==join==>   lisa
    ('4d582754-4d72-48f8-9e72-f6aa63dacada', '1059dbd0-3478-46f9-b8a9-dcd23ed0a23a'), -- netfilix   ==join==>   emma

    -- Owner and Admin -> emma
    ('70ceab8b-2cf6-4004-8561-219de9b11ec2', 'c2e3e9e7-d0e8-4960-9b05-d263deb2722f'), -- movie-night   ==join==>   lisa

    -- Owner and Admin -> lisa
    ('1292efc2-0cdc-470c-9364-ba76f19ce75d', '5f55998b-7958-4ae3-bcb7-539c65c00884'), -- tech-talk  ==join==>   jack
    ('1292efc2-0cdc-470c-9364-ba76f19ce75d', '1059dbd0-3478-46f9-b8a9-dcd23ed0a23a'), -- tech-talk  ==join==>   emma
    ('1292efc2-0cdc-470c-9364-ba76f19ce75d', 'dc7d6520-8408-4a8b-b628-78d5f82b8b62'), -- tech-talk  ==join==>   jhon
    ('1292efc2-0cdc-470c-9364-ba76f19ce75d', '35477c6b-f9a0-4bad-af0b-545c99b33fae'), -- tech-talk  ==join==>   philip

    -- Owner and Admin -> john
    ('dc6a0f60-5260-456b-a5c7-b799cece8807', '35477c6b-f9a0-4bad-af0b-545c99b33fae'), -- openai     ==join==>   philip
    ('dc6a0f60-5260-456b-a5c7-b799cece8807', '5f55998b-7958-4ae3-bcb7-539c65c00884'); -- openai     ==join==>   jack

/* 
    -----------------------------------------
    4. Create Random Messages
       Expectations: 
           - Five messages should be created.
           - Channel's last message preview must be updated.
           - Messages longer than 70 characters should be truncated.
           - Update unread message counts and previews for each channel.
           - Ensure the total number of notifications equals the number of unread messages.
    -----------------------------------------
*/

insert into public.messages (id, content, channel_id, user_id)
values
    (
    '84fd39d1-4467-4181-b07d-b4e9573bc8f9', 
    'Hello World 👋',
    '4b9f0f7e-6cd5-49b6-a8c3-141ef5905959', '8d0fd2b3-9ca7-4d9e-a95f-9e13dded323e' -- public -- supabot
    ),
    (
    '0363b237-8a72-462c-91b5-f5ee40958cf5', 
    'Perfection is attained, not when there is nothing more to add, but when there is nothing left to take away.', 
    '27c6745d-cebd-4afd-92b0-3b9b9312381b',  '8d0fd2b3-9ca7-4d9e-a95f-9e13dded323e' -- random -- supabot
    ),
    (
    '5de80678-2e4b-4850-ae0e-4e71afaf61bb',
    'hey, whats up, what do we have for this weekend?', 
    '4d582754-4d72-48f8-9e72-f6aa63dacada', 'c2e3e9e7-d0e8-4960-9b05-d263deb2722f'  -- netfilix -- lisa
    ),
    (
    '46e33eff-3a56-4619-bb7c-07e3e96af041',
    'whats up?',
    '4d582754-4d72-48f8-9e72-f6aa63dacada', 'c2e3e9e7-d0e8-4960-9b05-d263deb2722f' -- netfilix -- lisa
    ),
    (
    '7e84eca7-cf38-4eee-8127-847e78727ea5',
    'We have new event, follow up in this link...',
    '7ea75977-9bc0-4008-b5b8-13c56d16a588',  '35477c6b-f9a0-4bad-af0b-545c99b33fae' -- game-boy -- philip
    );



/*
    -----------------------------------------
    5. Pin Messages
       Expectation: A new pinned message for the game-boy channel should be created by Philip.
    -----------------------------------------
*/

-- step 1: create a message
INSERT INTO public.messages (id, content, channel_id, user_id)
values
(
    'b35dc5bc-ac7f-4fbe-a039-7822034e9dca',
    'New Events coming soon!',
    '7ea75977-9bc0-4008-b5b8-13c56d16a588',  '35477c6b-f9a0-4bad-af0b-545c99b33fae' -- game-boy -- philip

);

-- step 2: pin the message
insert into public.pinned_messages (channel_id, message_id, pinned_by)
values
    ('7ea75977-9bc0-4008-b5b8-13c56d16a588', 'b35dc5bc-ac7f-4fbe-a039-7822034e9dca', '35477c6b-f9a0-4bad-af0b-545c99b33fae');

/*
    -----------------------------------------
    6. Emoji Reactions to Messages
       Expectation: Two reactions should be added to the message.
    -----------------------------------------
*/
-- step 1: create a message
INSERT INTO public.messages (id, content, channel_id, user_id)
VALUES (
    'f8d2002b-01ff-4c4a-9375-92c24e942950',
    'Exciting news about upcoming features!', 
    '4d582754-4d72-48f8-9e72-f6aa63dacada',  -- netfilix
    '1059dbd0-3478-46f9-b8a9-dcd23ed0a23a' -- emma
);

-- step 2: add a reaction to the message - lisa reaction
UPDATE public.messages
SET reactions = jsonb_set(
    COALESCE(reactions, '{}'), 
    '{😄}', 
    COALESCE(reactions->'😄', '[]') || jsonb_build_array(jsonb_build_object('user_id', 'c2e3e9e7-d0e8-4960-9b05-d263deb2722f', 'created_at', current_timestamp)),
    true
)
WHERE id = 'f8d2002b-01ff-4c4a-9375-92c24e942950';

-- step 3: add another reaction to the message - philip racation
UPDATE public.messages
SET reactions = jsonb_set(
    COALESCE(reactions, '{}'), 
    '{👍}', 
    COALESCE(reactions->'👍', '[]') || jsonb_build_array(jsonb_build_object('user_id', '35477c6b-f9a0-4bad-af0b-545c99b33fae', 'created_at', current_timestamp)),
    true
)
WHERE id = 'f8d2002b-01ff-4c4a-9375-92c24e942950';

/*
    -----------------------------------------
    7. Reply to Messages
       Expectation: 
            1. Two messages should be attached to the first message (ID '1a3485e7-48eb-4fd1-afe1-3bb5506e4fe1') as replies.
            2. Notifications should be created for the replies:
                a. A 'reply' type notification should be sent to the user with ID '1059dbd0-3478-46f9-b8a9-dcd23ed0a23a' (emma), as she is the owner of the original message.
                b. 'message' type notifications should be sent to all other members of the channel '4d582754-4d72-48f8-9e72-f6aa63dacada' (netfilix), excluding the senders of the replies (lisa and philip) and any members who have muted notifications.
            3. The metadata of the first message should be updated to reflect these replies.
    -----------------------------------------
*/

-- step 1: create a message
INSERT INTO public.messages (id, content, channel_id, user_id )
VALUES 
(   
    '1a3485e7-48eb-4fd1-afe1-3bb5506e4fe1', -- ID
    'Whos excited for the new Netflix series?', -- Content
    '4d582754-4d72-48f8-9e72-f6aa63dacada', -- Channel: netfilix
    '1059dbd0-3478-46f9-b8a9-dcd23ed0a23a' -- User: emma
);

-- step 2: reply to the message
INSERT INTO public.messages (channel_id, user_id, content, reply_to_message_id)
VALUES 
(
    '4d582754-4d72-48f8-9e72-f6aa63dacada', -- Channel: netfilix
    'c2e3e9e7-d0e8-4960-9b05-d263deb2722f', -- User: lisa
    'I am! Cant wait to watch it.', -- Content
    '1a3485e7-48eb-4fd1-afe1-3bb5506e4fe1' -- original message id
),
(
    '4d582754-4d72-48f8-9e72-f6aa63dacada', -- Channel: netfilix
    '35477c6b-f9a0-4bad-af0b-545c99b33fae', -- User: philip
    'Do you know when its releasing?', -- Content
    '1a3485e7-48eb-4fd1-afe1-3bb5506e4fe1' -- original message id
);


/*
    -----------------------------------------
    8. Forward Messages
       Expectation: ---
    -----------------------------------------
*/

-- step 1: create a message
INSERT INTO public.messages (id, content, channel_id, user_id )
values
(
    '0486ed3d-8e48-49ed-b8af-2387909f642f', -- ID
    'Exciting news about upcoming features!', -- Content
    '4d582754-4d72-48f8-9e72-f6aa63dacada', -- Channel: netfilix
    '35477c6b-f9a0-4bad-af0b-545c99b33fae' -- User: Philip
);

-- step 2: emma react to the message
UPDATE public.messages
SET reactions = jsonb_set(
    COALESCE(reactions, '{}'), 
    '{👍}', 
    COALESCE(reactions->'👍', '[]') || jsonb_build_array(jsonb_build_object('user_id', '1059dbd0-3478-46f9-b8a9-dcd23ed0a23a', 'created_at', current_timestamp)),
    true
)
WHERE id = '0486ed3d-8e48-49ed-b8af-2387909f642f';

-- step 3: add a custom metadata to the message
UPDATE public.messages
SET metadata = jsonb_set(
    COALESCE(metadata, '{}'), 
    '{is_important}', 
    'true',
    true
)
WHERE id = '0486ed3d-8e48-49ed-b8af-2387909f642f';

-- step 5: reply to the message
INSERT INTO public.messages (channel_id, user_id, content, reply_to_message_id)
VALUES(
    '4d582754-4d72-48f8-9e72-f6aa63dacada', -- Channel: netfilix
    'c2e3e9e7-d0e8-4960-9b05-d263deb2722f', -- User: lisa
    'I am! Cant wait to watch it.', -- Content
    '0486ed3d-8e48-49ed-b8af-2387909f642f' -- original message id
);

-- step 6: forward the message in to two channels
INSERT INTO public.messages (id, channel_id, user_id, origin_message_id)
values
(   
    'b9a33e13-3fd0-43f7-b46e-1291253587ad', -- ID
    'dc6a0f60-5260-456b-a5c7-b799cece8807', -- Channel: openai
    '35477c6b-f9a0-4bad-af0b-545c99b33fae', -- User: philip
    '0486ed3d-8e48-49ed-b8af-2387909f642f' -- original message id
),
(
    'bb27aacc-e31a-4664-9606-103972702dd5', -- ID
    '1292efc2-0cdc-470c-9364-ba76f19ce75d', -- Channel: tech-talk
    '1059dbd0-3478-46f9-b8a9-dcd23ed0a23a', -- User: emma
    '0486ed3d-8e48-49ed-b8af-2387909f642f' -- original message id
);

-- step 7: forward the forwarded message
INSERT INTO public.messages (id, channel_id, user_id, origin_message_id)
values
(
    '4701aef9-cfcc-45e2-80ec-e0f3ffdc25dc', -- ID
    '70ceab8b-2cf6-4004-8561-219de9b11ec2', -- Channel: movie-night
    '1059dbd0-3478-46f9-b8a9-dcd23ed0a23a', -- User: Emma
    'b9a33e13-3fd0-43f7-b46e-1291253587ad' -- original message id
);

-- step 8: lisa react to the forwarded message
UPDATE public.messages
SET reactions = jsonb_set(
    COALESCE(reactions, '{}'), 
    '{😼}', 
    COALESCE(reactions->'😼', '[]') || jsonb_build_array(jsonb_build_object('user_id', 'c2e3e9e7-d0e8-4960-9b05-d263deb2722f', 'created_at', current_timestamp)),
    true
)
WHERE id = '4701aef9-cfcc-45e2-80ec-e0f3ffdc25dc';

-- step 9: add a custom metadata to the forwarded message
UPDATE public.messages
SET metadata = jsonb_set(
    COALESCE(metadata, '{}'), 
    '{is_important}', 
    'true',
    true
)
WHERE id = '4701aef9-cfcc-45e2-80ec-e0f3ffdc25dc';


-- step 10: reply to the forwarded message
INSERT INTO public.messages (channel_id, user_id, content, reply_to_message_id)
VALUES(
    '70ceab8b-2cf6-4004-8561-219de9b11ec2', -- Channel: movie-night
    'c2e3e9e7-d0e8-4960-9b05-d263deb2722f', -- User: Lisa
    'I am! Cant wait to watch it.', -- Content
    '4701aef9-cfcc-45e2-80ec-e0f3ffdc25dc' -- original message id
);

/*
    -----------------------------------------
    9. Mention @user in Messages
       Expectation: Jack should receive a mention notification from Philip in the game-boy channel.
    -----------------------------------------
*/

insert into public.messages (id, content, channel_id, user_id)
values
(
    '61db563c-a4fa-4ec1-bff5-543e620c9ec2', -- ID
    'Hey, @jack would you please call me?',
    '7ea75977-9bc0-4008-b5b8-13c56d16a588', -- chanel: game-boy
    '35477c6b-f9a0-4bad-af0b-545c99b33fae' -- user: philip
);

/*
    -----------------------------------------
    9. Mention multiple @user in Messages
       Expectation: Jack and Emma should receive a mention notifications from Philip in the game.
                    and also they must receive a message notification from Philip.
    -----------------------------------------
*/

insert into public.messages (id, content, channel_id, user_id)
values
(
    'd329a926-fd5a-400f-880f-e3678eee5758', -- ID
    'Hey, @jack would you please call me? @emma and I need your help.',
    '7ea75977-9bc0-4008-b5b8-13c56d16a588', -- chanel: game-boy
    '35477c6b-f9a0-4bad-af0b-545c99b33fae' -- user: philip
);


/*
    -----------------------------------------
    10. Mention @everyone in Messages
       Expectation: Philip and Jack should receive notifications from John in the openai channel.
    -----------------------------------------
*/
insert into public.messages (id, content, channel_id, user_id)
values
(
    '447d5510-741c-4aca-bd54-6f8344da89ea', -- ID
    'Hey, @everyone, lets talk about the last season of Stranger Things! I just finished watching it and I have a lot of thoughts.',
    'dc6a0f60-5260-456b-a5c7-b799cece8807', -- chanel: openai
    '5f55998b-7958-4ae3-bcb7-539c65c00884' -- user: jack
);


/*
    -----------------------------------------
    11. Update Message Content
       Expectation: All message previews, from reply to forwarded messages, channel message previews, and notification message previews should be updated.
    -----------------------------------------
*/


-- step 1: create a message
INSERT INTO public.messages (id, content, channel_id, user_id)
VALUES
(
    '5716352d-9380-49aa-9509-71e06f8b3d23', -- ID
    'Exciting news about upcoming features!', -- Content
    '4d582754-4d72-48f8-9e72-f6aa63dacada', -- Channel: netfilix
    '35477c6b-f9a0-4bad-af0b-545c99b33fae' -- User: Philip
);

-- step 2: reply to the message
INSERT INTO public.messages (channel_id, user_id, content, reply_to_message_id)
values
(
    '4d582754-4d72-48f8-9e72-f6aa63dacada', -- Channel: netfilix
    '5f55998b-7958-4ae3-bcb7-539c65c00884', -- User: Jack
    'YUP! Lets talk about it!', -- Content
    '5716352d-9380-49aa-9509-71e06f8b3d23' -- original message id
);

-- step 3: forward the message
INSERT INTO public.messages (id, channel_id, user_id, origin_message_id)
values
(
    'd00a10a3-e476-4067-8a66-689d3cc4b0f5', -- ID
    'dc6a0f60-5260-456b-a5c7-b799cece8807', -- Channel: openai
    'dc7d6520-8408-4a8b-b628-78d5f82b8b62', -- User: Jhon
    '5716352d-9380-49aa-9509-71e06f8b3d23' -- original message id
),
(
    'de4eda37-f6a1-4ffa-ab2a-089025d2f0f9', -- ID
    '1292efc2-0cdc-470c-9364-ba76f19ce75d', -- Channel: tech-talk
    'c2e3e9e7-d0e8-4960-9b05-d263deb2722f', -- User: Lisa
    '5716352d-9380-49aa-9509-71e06f8b3d23' -- original message id
);

-- step 4: update the message
UPDATE public.messages
SET content = 'Exciting news about upcoming features! I am so excited to share this with you all. Stay tuned for more updates!'
WHERE id = '5716352d-9380-49aa-9509-71e06f8b3d23';



/*
    -----------------------------------------
    12. Soft Delete a Message
       Expectation: 
       This scenario tests the soft deletion of a message within the application, focusing on the comprehensive effects of such an action.
       Specifically, it examines the following outcomes:
       1. The targeted message should be soft-deleted, indicated by the 'deleted_at' timestamp being set.
       2. Any pinned instance of the soft-deleted message should be automatically removed from the 'public.pinned_messages' table.
       3. Replies and forwardings of the soft-deleted message should remain intact but should reflect the deletion status in any associated previews or metadata.
       4. The 'unread_message_count' in 'public.channel_members' should be decremented for members who have not read the message, ensuring accurate read status tracking.
       5. replied in the metadata must be recalculate
    -----------------------------------------
*/

-- step 1: create two messages
INSERT INTO public.messages (id, content, channel_id, user_id)
VALUES
(
    '2ed171d6-7247-46b2-8f6f-7703cf2634bf', -- ID
    'Exciting news about upcoming features!', -- Content
    '4d582754-4d72-48f8-9e72-f6aa63dacada', -- Channel: netfilix
    '35477c6b-f9a0-4bad-af0b-545c99b33fae' -- User: Philip
),
(
    'de4b69f5-a304-4afa-80cc-89882d612d20', -- ID
    'Hows ready for releas news!?', -- Content
    '4d582754-4d72-48f8-9e72-f6aa63dacada', -- Channel: netfilix
    '35477c6b-f9a0-4bad-af0b-545c99b33fae' -- User: Philip
);

-- step 2: pinning the message
-- expect: adfter soft delete the pinned message must delete
INSERT INTO public.pinned_messages (channel_id, message_id, pinned_by)
values
(
    '4d582754-4d72-48f8-9e72-f6aa63dacada', -- Channel: netfilix
    'de4b69f5-a304-4afa-80cc-89882d612d20', -- Message: Exciting news about upcoming features!
    '35477c6b-f9a0-4bad-af0b-545c99b33fae' -- User: Philip
);


-- step 3: reply to the message
INSERT INTO public.messages (channel_id, user_id, content, reply_to_message_id)
values
(
    '4d582754-4d72-48f8-9e72-f6aa63dacada', -- Channel: netfilix
    'c2e3e9e7-d0e8-4960-9b05-d263deb2722f', -- User: lisa
    'YUP! Lets talk about it!', -- Content
    'de4b69f5-a304-4afa-80cc-89882d612d20' -- original message id
);


-- step 4: forward the message
INSERT INTO public.messages (id, channel_id, user_id, origin_message_id)
values
(
    '97ebede7-9107-4636-8060-45b08db6ce6a', -- ID
    'dc6a0f60-5260-456b-a5c7-b799cece8807', -- Channel: openai
    'dc7d6520-8408-4a8b-b628-78d5f82b8b62', -- User: Jhon
    'de4b69f5-a304-4afa-80cc-89882d612d20' -- original message id
),
(
    'add87e8b-9e15-478c-8bb5-e7f074c9568c', -- ID
    '1292efc2-0cdc-470c-9364-ba76f19ce75d', -- Channel: tech-talk
    'c2e3e9e7-d0e8-4960-9b05-d263deb2722f', -- User: Lisa
    'de4b69f5-a304-4afa-80cc-89882d612d20' -- original message id
);

-- step 5: soft delete the message
UPDATE public.messages
SET deleted_at = now()
WHERE id = 'de4b69f5-a304-4afa-80cc-89882d612d20';


-- Expected queries to validate the test case:
-- 1. Verify the soft deletion of the message.
-- SELECT * FROM public.messages WHERE id = 'de4b69f5-a304-4afa-80cc-89882d612d20';

-- 2. Confirm removal of the message from pinned messages.
-- SELECT * FROM public.pinned_messages WHERE message_id = 'de4b69f5-a304-4afa-80cc-89882d612d20';

-- 3. Check the status of replies and forwards related to the soft-deleted message.
-- SELECT * FROM public.messages WHERE reply_to_message_id = 'de4b69f5-a304-4afa-80cc-89882d612d20'
--    OR origin_message_id = 'de4b69f5-a304-4afa-80cc-89882d612d20';

-- 4. Validate the updated unread_message_count for channel members.
-- SELECT * FROM public.channel_members WHERE channel_id = '4d582754-4d72-48f8-9e72-f6aa63dacada';


/*
    -----------------------------------------
    13. update the messgae content
        Expectation: 
            1. The message content should be updated.
            2. The message preview should be updated.
            3. The edited_at timestamp should be updated.
    -----------------------------------------
*/

-- step 1: create a message
INSERT INTO public.messages (id, content, channel_id, user_id)
VALUES
(
    '4b858af7-fceb-4f94-a8fb-b0af4c2a3cde', -- ID
    'Exciting news about upcoming features!', -- Content
    '4d582754-4d72-48f8-9e72-f6aa63dacada', -- Channel: netfilix
    '35477c6b-f9a0-4bad-af0b-545c99b33fae' -- User: Philip
);

-- step 2: update the content of the message
UPDATE public.messages
SET content = 'Exciting news about upcoming features! I am so excited to share this with you all. Stay tuned for more updates!'
WHERE id = '4b858af7-fceb-4f94-a8fb-b0af4c2a3cde';



/*
    -----------------------------------------
    14. thread a message
        Expectation: 
            1. The message should be threaded.
            2. The message preview in channel should not be update.
            3. --
    -----------------------------------------
*/

-- step 1: create a message
INSERT INTO public.messages (id, content, channel_id, user_id)
VALUES
(
    '5fb62876-c099-4284-8295-f3e898ad88e0', -- ID
    'Has anyone heard about the new Netflix series?', -- Content
    '4d582754-4d72-48f8-9e72-f6aa63dacada', -- Channel: netfilix
    '35477c6b-f9a0-4bad-af0b-545c99b33fae' -- User: Philip
);


-- step 2: reply to the message
INSERT INTO public.messages (id, channel_id, user_id, content, reply_to_message_id)
values
(   
    'd9ad17c9-6431-47ee-8ef7-09d7a1abb68c', -- ID
    '4d582754-4d72-48f8-9e72-f6aa63dacada', -- Channel: netfilix
    'c2e3e9e7-d0e8-4960-9b05-d263deb2722f', -- User: lisa
    'Please do not spoil it!', -- Content
    '5fb62876-c099-4284-8295-f3e898ad88e0' -- original message id
);

-- step 3: open a thread (update the first message), we will update the is_threaded_root to true with trigger
UPDATE public.messages
SET 
    thread_id = '5fb62876-c099-4284-8295-f3e898ad88e0',
    thread_owner_id = 'c2e3e9e7-d0e8-4960-9b05-d263deb2722f'
WHERE id = '5fb62876-c099-4284-8295-f3e898ad88e0';


-- step 4: message to the thread
INSERT INTO public.messages (id, channel_id, user_id, content, thread_id)
values
(
    '5f1ae43c-4cd5-4d97-bad8-2e9607ade415', -- ID
    '4d582754-4d72-48f8-9e72-f6aa63dacada', -- Channel: netfilix
    '1059dbd0-3478-46f9-b8a9-dcd23ed0a23a', -- User: emma
    'I have not heard about it yet.', -- Content
    '5fb62876-c099-4284-8295-f3e898ad88e0' -- thread id
);

-- step 5: message to the thread
INSERT INTO public.messages (id, channel_id, user_id, content, thread_id)
values
(
    '94f6903b-b13d-4b37-b757-c4dab8c05b07', -- ID
    '4d582754-4d72-48f8-9e72-f6aa63dacada', -- Channel: netfilix
    'c2e3e9e7-d0e8-4960-9b05-d263deb2722f', -- User: lisa
    'New franchise for Stranger Things?', -- Content
    '5fb62876-c099-4284-8295-f3e898ad88e0' -- thread id
);

-- step 6: reply to the lisa message
INSERT INTO public.messages (id, channel_id, user_id, content, thread_id, reply_to_message_id)
values
(
    'f5ac64c5-7b1f-486c-8cb6-f7c18e2569ba', -- ID
    '4d582754-4d72-48f8-9e72-f6aa63dacada', -- Channel: netfilix
    '35477c6b-f9a0-4bad-af0b-545c99b33fae', -- User: philip
    'Yes! Thats a new thing! But we have a new surprise. I heard from the bosss call that they are going to create a new franchise from ''The Boys'' series!', -- Content
    '5fb62876-c099-4284-8295-f3e898ad88e0', -- thread id
    '94f6903b-b13d-4b37-b757-c4dab8c05b07' -- original message id
);

-- step 7: reaction to the thread message, emma
UPDATE public.messages
SET reactions = jsonb_set(
    COALESCE(reactions, '{}'), 
    '{👍}', 
    COALESCE(reactions->'👍', '[]') || jsonb_build_array(jsonb_build_object('user_id', '1059dbd0-3478-46f9-b8a9-dcd23ed0a23a', 'created_at', current_timestamp)),
    true
)
WHERE id = '5fb62876-c099-4284-8295-f3e898ad88e0';


/*
    -----------------------------------------
    15. seed netflix channel with messages
    -----------------------------------------
*/

INSERT INTO public.messages (content, channel_id, user_id)
VALUES
(
    'Hey! Have you started watching ''The Midnight Chronicles'' on Netflix? It''s the new talk of the town!', -- Content
    '4d582754-4d72-48f8-9e72-f6aa63dacada', -- Channel: netflix
    '35477c6b-f9a0-4bad-af0b-545c99b33fae' -- User: Philip
),
(
    'Just started yesterday. It''s intriguing! The way they blend mystery and sci-fi is mind-blowing.', -- Content
    '4d582754-4d72-48f8-9e72-f6aa63dacada', -- Channel: netflix
    '1059dbd0-3478-46f9-b8a9-dcd23ed0a23a' -- User: Emma
),
(
    'Totally agree. Episode 3''s twist was unexpected. Did you see that coming?', -- Content
    '4d582754-4d72-48f8-9e72-f6aa63dacada', -- Channel: netflix
    '35477c6b-f9a0-4bad-af0b-545c99b33fae' -- User: Philip
),
(
    'No way! I was completely shocked. Also, the cinematography is stunning, don''t you think?', -- Content
    '4d582754-4d72-48f8-9e72-f6aa63dacada', -- Channel: netflix
    '1059dbd0-3478-46f9-b8a9-dcd23ed0a23a' -- User: Emma
),
(
    'Absolutely, the visuals are a feast for the eyes. And the soundtrack complements it so well.', -- Content
    '4d582754-4d72-48f8-9e72-f6aa63dacada', -- Channel: netflix
    '35477c6b-f9a0-4bad-af0b-545c99b33fae' -- User: Philip
),
(
    'Speaking of soundtrack, did you recognize the song in the opening of episode 4? It sounded familiar.', -- Content
    '4d582754-4d72-48f8-9e72-f6aa63dacada', -- Channel: netflix
    '1059dbd0-3478-46f9-b8a9-dcd23ed0a23a' -- User: Emma
),
(
    'Exactly why I''m hooked. Can''t remember the last time I was this excited for a series.', -- Content
    '4d582754-4d72-48f8-9e72-f6aa63dacada', -- Channel: netflix
    '35477c6b-f9a0-4bad-af0b-545c99b33fae' -- User: Philip
),
(
    'Me neither. It''s the highlight of my week. Can''t wait to see how the season ends!', -- Content
    '4d582754-4d72-48f8-9e72-f6aa63dacada', -- Channel: netflix
    '1059dbd0-3478-46f9-b8a9-dcd23ed0a23a' -- User: Emma
),
(
    'Yeah, it''s quite immersive. Adds a whole new layer to the series experience.', -- Content
    '4d582754-4d72-48f8-9e72-f6aa63dacada', -- Channel: netflix
    '35477c6b-f9a0-4bad-af0b-545c99b33fae' -- User: Philip
),
(
    'Sounds cool. I''ll check it out. Do you have a favorite character so far?', -- Content
    '4d582754-4d72-48f8-9e72-f6aa63dacada', -- Channel: netflix
    '1059dbd0-3478-46f9-b8a9-dcd23ed0a23a' -- User: Emma
),
(
    'Hard to choose, but probably the AI. Her character arc is fascinating.', -- Content
    '4d582754-4d72-48f8-9e72-f6aa63dacada', -- Channel: netflix
    '35477c6b-f9a0-4bad-af0b-545c99b33fae' -- User: Philip
),
(
    'She''s great. I''m leaning towards the detective. His backstory is intriguing.', -- Content
    '4d582754-4d72-48f8-9e72-f6aa63dacada', -- Channel: netflix
    '1059dbd0-3478-46f9-b8a9-dcd23ed0a23a' -- User: Emma
),
(
    'True, they''ve done a great job with his character. Adds a lot of depth to the plot.', -- Content
    '4d582754-4d72-48f8-9e72-f6aa63dacada', -- Channel: netflix
    '35477c6b-f9a0-4bad-af0b-545c99b33fae' -- User: Philip
),
(
    'For sure. Also, what did you think about the revelation in episode 7 about the main antagonist?', -- Content
    '4d582754-4d72-48f8-9e72-f6aa63dacada', -- Channel: netflix
    '1059dbd0-3478-46f9-b8a9-dcd23ed0a23a' -- User: Emma
),
(
    'That was a game-changer! Completely changed my perspective on the whole story.', -- Content
    '4d582754-4d72-48f8-9e72-f6aa63dacada', -- Channel: netflix
    '35477c6b-f9a0-4bad-af0b-545c99b33fae' -- User: Philip
),
(
    'Same here. It''s rare for a show to surprise me like this one does.', -- Content
    '4d582754-4d72-48f8-9e72-f6aa63dacada', -- Channel: netflix
    '1059dbd0-3478-46f9-b8a9-dcd23ed0a23a' -- User: Emma
),
(
    'Exactly why I''m hooked. Can''t remember the last time I was this excited for a series.', -- Content
    '4d582754-4d72-48f8-9e72-f6aa63dacada', -- Channel: netflix
    '35477c6b-f9a0-4bad-af0b-545c99b33fae' -- User: Philip
),
(
    'Me neither. It''s the highlight of my week. Can''t wait to see how the season ends!', -- Content
    '4d582754-4d72-48f8-9e72-f6aa63dacada', -- Channel: netflix
    '1059dbd0-3478-46f9-b8a9-dcd23ed0a23a' -- User: Emma
),
(
    'Emma, did you notice the incredible camera work in the last episode? The long takes were amazing!', -- Content
    '4d582754-4d72-48f8-9e72-f6aa63dacada', -- Channel: netflix
    '35477c6b-f9a0-4bad-af0b-545c99b33fae' -- User: Philip
),
(
    'Absolutely, Philip! Those long takes added so much tension. Also, the use of lighting was so dramatic.', -- Content
    '4d582754-4d72-48f8-9e72-f6aa63dacada', -- Channel: netflix
    '1059dbd0-3478-46f9-b8a9-dcd23ed0a23a' -- User: Emma
),
(
    'For sure. And what''s your take on the subplot with the mysterious organization? It''s getting more complex.', -- Content
    '4d582754-4d72-48f8-9e72-f6aa63dacada', -- Channel: netflix
    '35477c6b-f9a0-4bad-af0b-545c99b33fae' -- User: Philip
),
(
    'I think it''s leading to a major reveal. Maybe they''re connected to the protagonist''s past?', -- Content
    '4d582754-4d72-48f8-9e72-f6aa63dacada', -- Channel: netflix
    '1059dbd0-3478-46f9-b8a9-dcd23ed0a23a' -- User: Emma
),
(
    'That''s an interesting theory! It could tie up a lot of loose ends. Also, the dialogues in the show are so sharp.', -- Content
    '4d582754-4d72-48f8-9e72-f6aa63dacada', -- Channel: netflix
    '35477c6b-f9a0-4bad-af0b-545c99b33fae' -- User: Philip
),
(
    'True, every line seems to have a deeper meaning. By the way, did you catch the reference to that classic sci-fi movie?', -- Content
    '4d582754-4d72-48f8-9e72-f6aa63dacada', -- Channel: netflix
    '1059dbd0-3478-46f9-b8a9-dcd23ed0a23a' -- User: Emma
),
(
    'I did! That was a clever homage. This show really respects its genre roots. Plus, the soundtrack is spot on.', -- Content
    '4d582754-4d72-48f8-9e72-f6aa63dacada', -- Channel: netflix
    '35477c6b-f9a0-4bad-af0b-545c99b33fae' -- User: Philip
),
(
    'The soundtrack is a character in itself! It perfectly sets the mood for every scene. Also, the costume design is so detailed.', -- Content
    '4d582754-4d72-48f8-9e72-f6aa63dacada', -- Channel: netflix
    '1059dbd0-3478-46f9-b8a9-dcd23ed0a23a' -- User: Emma
),
(
    'Absolutely, the costumes add so much to the world-building. Every character''s style tells a story.', -- Content
    '4d582754-4d72-48f8-9e72-f6aa63dacada', -- Channel: netflix
    '35477c6b-f9a0-4bad-af0b-545c99b33fae' -- User: Philip
),
(
    'Exactly. And speaking of stories, any predictions for the season finale? I''m expecting a big twist!', -- Content
    '4d582754-4d72-48f8-9e72-f6aa63dacada', -- Channel: netflix
    '1059dbd0-3478-46f9-b8a9-dcd23ed0a23a' -- User: Emma
),
(
    'I''m curious about the new character introduced last episode. Any thoughts on their role?', -- Content
    '4d582754-4d72-48f8-9e72-f6aa63dacada', -- Channel: netflix
    '35477c6b-f9a0-4bad-af0b-545c99b33fae' -- User: Philip
),
(
    'My guess is they''re key to the main plot twist. Maybe a hidden ally? The suspense is killing me!', -- Content
    '4d582754-4d72-48f8-9e72-f6aa63dacada', -- Channel: netflix
    '1059dbd0-3478-46f9-b8a9-dcd23ed0a23a' -- User: Emma
),
(
    'Agreed! Also, the latest episode''s cliffhanger was epic. How do you think they''ll resolve that?', -- Content
    '4d582754-4d72-48f8-9e72-f6aa63dacada', -- Channel: netflix
    '35477c6b-f9a0-4bad-af0b-545c99b33fae' -- User: Philip
),
(
    'I have no idea, but I''m expecting a major plot twist. This show always surprises us!', -- Content
    '4d582754-4d72-48f8-9e72-f6aa63dacada', -- Channel: netflix
    '1059dbd0-3478-46f9-b8a9-dcd23ed0a23a' -- User: Emma
),
(
    'Exactly! Also, have you noticed the subtle hints about the protagonist''s past? They''re adding up.', -- Content
    '4d582754-4d72-48f8-9e72-f6aa63dacada', -- Channel: netflix
    '35477c6b-f9a0-4bad-af0b-545c99b33fae' -- User: Philip
),
(
    'Yes, those breadcrumbs are leading to something big. Cant wait to see how they tie everything together.', -- Content
    '4d582754-4d72-48f8-9e72-f6aa63dacada', -- Channel: netflix
    '1059dbd0-3478-46f9-b8a9-dcd23ed0a23a' -- User: Emma
),
(
    'And what about the special effects in the last battle scene? They were out of this world!', -- Content
    '4d582754-4d72-48f8-9e72-f6aa63dacada', -- Channel: netflix
    '35477c6b-f9a0-4bad-af0b-545c99b33fae' -- User: Philip
),
(
    'Truly spectacular! It felt like watching a high-budget movie. The production value is incredible.', -- Content
    '4d582754-4d72-48f8-9e72-f6aa63dacada', -- Channel: netflix
    '1059dbd0-3478-46f9-b8a9-dcd23ed0a23a' -- User: Emma
),
(
    'Agree. Also, the evolving dynamics between the main characters is so well written. It feels natural.', -- Content
    '4d582754-4d72-48f8-9e72-f6aa63dacada', -- Channel: netflix
    '35477c6b-f9a0-4bad-af0b-545c99b33fae' -- User: Philip
),
(
    'Definitely. The character development is top-notch. Makes you invest in their journey.', -- Content
    '4d582754-4d72-48f8-9e72-f6aa63dacada', -- Channel: netflix
    '1059dbd0-3478-46f9-b8a9-dcd23ed0a23a' -- User: Emma
);
-- -- 1/ message preview and praivcy
-- -- 2/ when user delete, all data that belong to user will be deleted, like message, channel, channel_member, notification, etc
-- -- 3/ channel_invites table

-- -- Table: public.user_roles
-- -- Description: This table defines the roles assigned to each user. Roles are used to manage access and permissions within the application.
-- CREATE TABLE public.user_roles (
--     id        VARCHAR(36) DEFAULT uuid_generate_v4() NOT NULL PRIMARY KEY,
--     user_id   VARCHAR(36) NOT NULL REFERENCES public.users ON DELETE CASCADE,
--     role      app_role NOT NULL,
--     UNIQUE (user_id, role)
-- );

-- COMMENT ON TABLE public.user_roles IS 'Stores the roles assigned to each user, linking to the users table.';

-- -- Table: public.role_permissions
-- -- Description: This table maps each role to its respective permissions, defining what actions each role can perform within the application.
-- CREATE TABLE public.role_permissions (
--     id           VARCHAR(36) DEFAULT uuid_generate_v4() NOT NULL PRIMARY KEY,
--     role         app_role NOT NULL,
--     permission   app_permission NOT NULL,
--     UNIQUE (role, permission)
-- );

-- COMMENT ON TABLE public.role_permissions IS 'Details the specific permissions associated with each role, used for access control.';

-- -- Secure the tables
-- alter table public.users enable row level security;
-- alter table public.channels enable row level security;
-- alter table public.messages enable row level security;
-- alter table public.user_roles enable row level security;
-- alter table public.role_permissions enable row level security;
-- create policy "Allow logged-in read access" on public.users for select using ( auth.role() = 'authenticated' );
-- create policy "Allow individual insert access" on public.users for insert with check ( auth.uid() = id );
-- create policy "Allow individual update access" on public.users for update using ( auth.uid() = id );
-- create policy "Allow logged-in read access" on public.channels for select using ( auth.role() = 'authenticated' );
-- create policy "Allow individual insert access" on public.channels for insert with check ( auth.uid() = created_by );
-- create policy "Allow individual delete access" on public.channels for delete using ( auth.uid() = created_by );
-- create policy "Allow authorized delete access" on public.channels for delete using ( authorize('channels.delete', auth.uid()) );
-- create policy "Allow logged-in read access" on public.messages for select using ( auth.role() = 'authenticated' );
-- create policy "Allow individual insert access" on public.messages for insert with check ( auth.uid() = user_id );
-- create policy "Allow individual update access" on public.messages for update using ( auth.uid() = user_id );
-- create policy "Allow individual delete access" on public.messages for delete using ( auth.uid() = user_id );
-- create policy "Allow authorized delete access" on public.messages for delete using ( authorize('messages.delete', auth.uid()) );
-- create policy "Allow individual read access" on public.user_roles for select using ( auth.uid() = user_id );

-- insert into public.role_permissions (role, permission)
-- values
--     ('admin', 'channels.delete'),
--     ('admin', 'messages.delete'),
--     ('moderator', 'messages.delete');


-- -- Indexes on public.user_roles Table
-- -- Optimizes query performance for user_id.
-- CREATE INDEX idx_user_roles_user_id ON public.user_roles (user_id);


-- -- Indexes on public.role_permissions Table
-- -- Optimizes query performance for role.
-- CREATE INDEX idx_role_permissions_role ON public.role_permissions (role);

-- /*
--   Function: authorize
--   Description: Authorizes user actions based on role-based access control (RBAC).
-- */
-- CREATE OR REPLACE FUNCTION authorize(
--   requested_permission app_permission,
--   user_id VARCHAR(36)
-- )
-- RETURNS BOOLEAN AS $$
-- DECLARE
--   permission_count INT;
-- BEGIN
--   SELECT COUNT(*)
--   INTO permission_count
--   FROM public.role_permissions
--   INNER JOIN public.user_roles ON role_permissions.role = user_roles.role
--   WHERE role_permissions.permission = requested_permission
--     AND user_roles.user_id = user_id;

--   RETURN permission_count > 0;
-- END;
-- $$ LANGUAGE plpgsql SECURITY DEFINER;

-- /*
--   Realtime Subscriptions Setup
--   Description: Configures the realtime publication for the database.
-- */
-- BEGIN;
--   -- Drop existing publication if exists
--   DROP PUBLICATION IF EXISTS supabase_realtime;
--   -- Create a new publication without enabling it for any tables
--   CREATE PUBLICATION supabase_realtime;
-- COMMIT;

