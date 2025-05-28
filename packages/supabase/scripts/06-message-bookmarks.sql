-- Table: public.message_bookmarks
-- Description: Stores user bookmarks for messages. Allows users to save messages for later reference and organize them.
create table public.message_bookmarks (
    id bigint generated always as identity primary key,
    user_id uuid not null references public.users(id) on delete cascade,
    message_id uuid not null references public.messages(id) on delete cascade,
    created_at timestamp with time zone default timezone('utc', now()) not null,
    updated_at timestamp with time zone default timezone('utc', now()) not null,
    archived_at timestamp with time zone, -- When the bookmark was archived by the user
    marked_at timestamp with time zone, -- When the bookmark was marked as read by the user
    metadata jsonb default '{}'::jsonb, -- For future features like folders, tags, priority levels, etc.
    unique(user_id, message_id) -- Prevent users from bookmarking the same message multiple times
);

comment on table public.message_bookmarks is 'Stores user bookmarks for messages, allowing users to save and organize messages for later reference with archive and read status tracking.';

-- Column comments for better documentation
comment on column public.message_bookmarks.id is 'Unique identifier for the bookmark';
comment on column public.message_bookmarks.user_id is 'Reference to the user who created this bookmark';
comment on column public.message_bookmarks.message_id is 'Reference to the bookmarked message';
comment on column public.message_bookmarks.created_at is 'Timestamp when the message was bookmarked';
comment on column public.message_bookmarks.updated_at is 'Timestamp when the bookmark was last updated';
comment on column public.message_bookmarks.archived_at is 'Timestamp when the bookmark was archived, null if active';
comment on column public.message_bookmarks.marked_at is 'Timestamp when the bookmark was marked as read, null if unread';
comment on column public.message_bookmarks.metadata is 'Additional configurable properties for organizing bookmarks (folders, tags, etc.)';

-- Indexes for performance
create index message_bookmarks_user_id_idx on public.message_bookmarks (user_id);
create index message_bookmarks_message_id_idx on public.message_bookmarks (message_id);
create index message_bookmarks_created_at_idx on public.message_bookmarks (created_at desc);
create index message_bookmarks_archived_at_idx on public.message_bookmarks (archived_at) where archived_at is not null;
create index message_bookmarks_marked_at_idx on public.message_bookmarks (marked_at) where marked_at is not null;

-- Trigger to automatically update updated_at timestamp
create or replace function update_message_bookmarks_updated_at()
returns trigger as $$
begin
    new.updated_at = timezone('utc', now());
    return new;
end;
$$ language plpgsql;

create trigger update_message_bookmarks_updated_at
    before update on public.message_bookmarks
    for each row
    execute function update_message_bookmarks_updated_at();

-- Enable Row Level Security
alter table public.message_bookmarks enable row level security;

-- RLS Policies
create policy "Users can view their own bookmarks"
    on public.message_bookmarks
    for select
    using (auth.uid() = user_id);

create policy "Users can create their own bookmarks"
    on public.message_bookmarks
    for insert
    with check (auth.uid() = user_id);

create policy "Users can update their own bookmarks"
    on public.message_bookmarks
    for update
    using (auth.uid() = user_id)
    with check (auth.uid() = user_id);

create policy "Users can delete their own bookmarks"
    on public.message_bookmarks
    for delete
    using (auth.uid() = user_id);
