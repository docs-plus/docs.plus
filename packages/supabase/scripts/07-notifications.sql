-- Table: public.notifications
-- Description: Manages notifications sent to users within the application. Notifications can be related to messages, channel activities, mentions, or other events.
-- This table tracks the notification's type, associated references (messages, channels), and its read status.
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
