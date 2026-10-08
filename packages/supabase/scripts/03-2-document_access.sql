-- Table: public.document_access
-- The Private mirror: the Supabase copy of a document's Private flag and owner. Prisma holds the source.
-- Hocuspocus writes it with the service role when a request sets the Private flag,
-- and when a Private document leaves Trash (#396).
-- A missing row means the document is public. internal.can_open_document reads it.
create table if not exists public.document_access (
    document_id varchar(36) primary key, -- The documentId verbatim, the same value as channels.workspace_id.
    is_private  boolean not null,
    owner_id    uuid, -- No foreign key: Prisma owns the owner fact.
    updated_at  timestamp with time zone not null default now()
);

comment on table public.document_access is
'Private flag and owner of a document, copied from Prisma by Hocuspocus with the service role. A missing row means public. Clients have no access.';

-- RLS with no policy, and no client grant. Hosted Supabase grants a new public
-- table to anon and authenticated, so the revoke is load-bearing.
alter table public.document_access enable row level security;
revoke all on public.document_access from anon, authenticated;
grant all on public.document_access to service_role;
