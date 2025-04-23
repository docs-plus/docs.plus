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
