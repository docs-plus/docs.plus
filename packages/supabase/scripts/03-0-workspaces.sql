-- Table: public.workspaces
-- Description: Represents various workspaces. Each workspace can contain multiple channels.
create table public.workspaces (
    id                varchar(36) default uuid_generate_v4() not null primary key,
    name              text not null check (length(name) <= 100), -- Workspace name, limited to 100 characters.
    slug              text not null unique check (length(slug) <= 100), -- Unique slug for the workspace, used for user-friendly URLs, limited to 100 characters.
    description       text check (length(description) <= 1000), -- Optional description of the workspace, limited to 1000 characters.
    metadata          jsonb default '{}'::jsonb, -- Optional metadata about the workspace in JSONB format.
    created_by        uuid references public.users(id) on delete set null, -- The ID of the user who created the workspace.
    created_at        timestamp with time zone default timezone('utc', now()) not null, -- The timestamp when the workspace was created, set to the current UTC time.
    updated_at        timestamp with time zone default timezone('utc', now()), -- The timestamp when the workspace was last updated, set to the current UTC time.
    deleted_at        timestamp with time zone -- The timestamp when the workspace was soft deleted, NULL if not deleted.
);

-- Constraint: check_slug_format
alter table public.workspaces add constraint check_slug_format check (slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$');

comment on table public.workspaces is 'This table contains information about various workspaces, which are collections of channels for group discussions and messaging. Workspaces provide a higher-level organization structure within the application, allowing for segregation and grouping of channels.';
