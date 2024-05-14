-- Table: public.notifications
-- Description: Manages notifications sent to users within the application. Notifications can be related to messages, channel activities, mentions, or other events.
-- This table tracks the notification's type, associated references (messages, channels), and its read status.
CREATE TABLE public.notifications (
    id                  UUID DEFAULT uuid_generate_v4() NOT NULL PRIMARY KEY,
    receiver_user_id    UUID NOT NULL REFERENCES public.users, -- The ID of the user who will receive the notification.
    type                notification_category NOT NULL, -- Type of the notification (e.g., message, invite, mention).
    message_id          UUID REFERENCES public.messages ON DELETE CASCADE,  -- ID of the associated message, if the notification is message-related.
    channel_id          VARCHAR(36) REFERENCES public.channels ON DELETE CASCADE, -- ID of the associated channel, if the notification is channel-related.
    message_preview     TEXT, -- Preview of the content related to the notification (if applicable).
    created_at          TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc', now()) NOT NULL, -- Timestamp when the notification was created.
    readed_at           TIMESTAMP WITH TIME ZONE, -- Timestamp when the notification was marked as read by the user.
    action_url          TEXT, -- URL or deep link to direct the user to a specific page or action in the application.
    sender_user_id      UUID REFERENCES public.users ON DELETE CASCADE -- ID of the user who sent the notification (if applicable).
);

COMMENT ON TABLE public.notifications IS 'Table to store and manage notifications for various user interactions and activities within the application.';
