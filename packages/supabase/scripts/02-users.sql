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
