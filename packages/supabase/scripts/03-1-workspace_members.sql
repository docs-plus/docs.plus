-- Table: public.workspace_members
-- Description: Manages the membership of users within workspaces. This table tracks when users joined or left a workspace,
-- enabling the application to maintain workspace membership records.
create table public.workspace_members (
    id                uuid default uuid_generate_v4() not null primary key, -- Unique ID for the workspace member record.
    workspace_id      varchar(36) not null references public.workspaces(id) on delete cascade, -- The ID of the workspace. If the workspace is deleted, associated member records are also deleted.
    member_id         uuid not null references public.users(id) on delete cascade, -- The ID of the workspace member (user). If the user is deleted, their membership records are also deleted.
    left_at           timestamp with time zone, -- Timestamp when the user left the workspace.
    created_at        timestamp with time zone default timezone('utc', now()) not null, -- Timestamp when the membership record was created.
    updated_at        timestamp with time zone default timezone('utc', now()) -- Timestamp when the membership record was last updated.
);

comment on table public.workspace_members is 'Tracks user membership in workspaces, including when users joined or left specific workspaces. The created_at and updated_at columns help monitor the history and changes in user-workspace relationships.';

-- Column comments for better documentation
comment on column public.workspace_members.id is 'Unique identifier for this workspace membership record';
comment on column public.workspace_members.workspace_id is 'Reference to the workspace this membership belongs to';
comment on column public.workspace_members.member_id is 'Reference to the user who is a member of the workspace';
comment on column public.workspace_members.left_at is 'Timestamp when the user left this workspace, null if still active';
comment on column public.workspace_members.created_at is 'Timestamp when this membership record was created';
comment on column public.workspace_members.updated_at is 'Timestamp when this membership record was last updated';

-- Create a unique constraint to prevent duplicate memberships
alter table public.workspace_members add constraint workspace_members_workspace_id_member_id_key unique (workspace_id, member_id);
