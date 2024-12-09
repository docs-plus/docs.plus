-- -----------------------------------------------------------------------------
-- Table: public.users
-- -----------------------------------------------------------------------------
-- Description: Core user profile table that maintains essential user information,
-- authentication linkage, and profile data. This table serves as the central
-- reference for user management within the application.
-- -----------------------------------------------------------------------------

CREATE TABLE public.users (
    -- Core Identity Fields
    id              UUID NOT NULL PRIMARY KEY
                    REFERENCES auth.users(id) ON DELETE CASCADE,
    username        TEXT NOT NULL UNIQUE
                    CHECK (
                        username ~ '^[a-z][a-z0-9_-]{2,29}$' AND  -- Format validation
                        username = lower(username)                 -- Enforce lowercase
                    ),
    email           TEXT UNIQUE NOT NULL,                         -- Required email address

    -- Profile Information
    full_name       TEXT,
    display_name    TEXT,
    avatar_url      TEXT CHECK (
                        avatar_url IS NULL OR
                        avatar_url ~ '^(https?://\S+|http://localhost(:[0-9]+)?/\S+)$'  -- Validate URL format including localhost
                    ),
    avatar_updated_at TIMESTAMP WITH TIME ZONE,                 -- New field for avatar updates
    profile_data    JSONB DEFAULT '{}'::jsonb NOT NULL,         -- Structured profile data

    -- Status Management
    status          user_status NOT NULL
                    DEFAULT 'OFFLINE'::public.user_status,
    online_at       TIMESTAMP WITH TIME ZONE,
    deleted_at      TIMESTAMP WITH TIME ZONE,                    -- Soft delete timestamp

    -- Audit Timestamps
    created_at      TIMESTAMP WITH TIME ZONE NOT NULL
                    DEFAULT timezone('utc', now()),
    updated_at      TIMESTAMP WITH TIME ZONE NOT NULL
                    DEFAULT timezone('utc', now()),

    -- Constraints
    CONSTRAINT username_length
        CHECK (char_length(username) >= 3),
    CONSTRAINT valid_profile_data
        CHECK (jsonb_typeof(profile_data) = 'object'),
    CONSTRAINT valid_deletion
        CHECK (
            (deleted_at IS NULL) OR
            (deleted_at > created_at)
        )
);

-- Table Comments
COMMENT ON TABLE public.users IS 'Core user profiles table linking authentication with application user data';

-- Column Comments
COMMENT ON COLUMN public.users.id IS 'Primary key linked to auth.users, ensuring authentication system integration';
COMMENT ON COLUMN public.users.username IS 'Unique username (3-30 chars, lowercase alphanumeric with underscore/hyphen, must start with letter)';
COMMENT ON COLUMN public.users.email IS 'User''s verified email address';
COMMENT ON COLUMN public.users.full_name IS 'User''s full display name';
COMMENT ON COLUMN public.users.avatar_url IS 'URL to user''s profile picture (must be valid HTTP/HTTPS URL)';
COMMENT ON COLUMN public.users.avatar_updated_at IS 'Timestamp of when the user''s avatar was last updated';
COMMENT ON COLUMN public.users.profile_data IS 'Extensible JSON profile data including social links, bio, and preferences';
COMMENT ON COLUMN public.users.status IS 'Current user online status (ONLINE/OFFLINE/AWAY/DND)';
COMMENT ON COLUMN public.users.online_at IS 'Timestamp of user''s last online presence';
COMMENT ON COLUMN public.users.deleted_at IS 'Soft deletion timestamp - null indicates active user';
COMMENT ON COLUMN public.users.created_at IS 'Account creation timestamp (UTC)';
COMMENT ON COLUMN public.users.updated_at IS 'Last profile update timestamp (UTC)';

-- Profile Data Schema Documentation, it's just example, you can add more fields
COMMENT ON COLUMN public.users.profile_data IS E'Expected schema:\n{
  "job_title": string?,
  "company": string?,
  "about": string?,
  "website": string?,
  "social_links": [{
    "url": string,
    "type": "github" | "twitter" | "linkedin" | "other"
  }]
}';
