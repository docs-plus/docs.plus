-- Table: public.channels
-- Description: Represents various channels in the application, similar to chat rooms or discussion groups.
-- Channels have attributes like privacy settings, member limits, activity timestamps, and user interaction settings.
CREATE TABLE public.channels (
    id                              VARCHAR(36) DEFAULT uuid_generate_v4() NOT NULL PRIMARY KEY,
    workspace_id                    VARCHAR(36) NOT NULL REFERENCES public.workspaces,
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


