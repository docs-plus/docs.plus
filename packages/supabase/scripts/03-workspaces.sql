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
