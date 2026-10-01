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
    profile_data    jsonb default '{}'::jsonb not null,         -- Public profile data
    notification_preferences jsonb default '{}'::jsonb not null, -- Private; no client SELECT grant

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
    -- profile_data is readable by every visitor; private settings must not return there.
    constraint profile_data_has_no_notification_preferences
        check (not profile_data ? 'notification_preferences'),
    constraint valid_notification_preferences
        check (jsonb_typeof(notification_preferences) = 'object'),
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
comment on column public.users.status is 'Current user online status (ONLINE/OFFLINE/AWAY/DND)';
comment on column public.users.online_at is 'Timestamp of user''s last online presence';
comment on column public.users.deleted_at is 'Soft deletion timestamp - null indicates active user';
comment on column public.users.created_at is 'Account creation timestamp (UTC)';
comment on column public.users.updated_at is 'Last profile update timestamp (UTC)';

comment on column public.users.profile_data is E'Public profile data, readable by every visitor:\n{
  "bio": string?,
  "linkTree": [{ "url": string, "type": string, "metadata": object? }]
}';
comment on column public.users.notification_preferences is 'Private notification settings. No anon or authenticated SELECT grant: the owner reads it through get_notification_preferences() and writes it through update_notification_preferences().';

-- Partial index for efficient online user queries
-- Only indexes users with status='ONLINE', keeping the index small and fast
create index if not exists idx_users_online_status
    on public.users (id, online_at)
    where status = 'ONLINE';
