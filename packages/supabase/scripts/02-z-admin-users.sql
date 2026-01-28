-- -----------------------------------------------------------------------------
-- Table: public.admin_users
-- -----------------------------------------------------------------------------
-- Description: Tracks users who have admin dashboard access. This table is
-- separate from the main users table to avoid confusion with channel/document
-- roles and to provide clear separation of concerns.
-- -----------------------------------------------------------------------------

create table public.admin_users (
    -- Primary Key (references users table)
    user_id         uuid not null primary key
                    references public.users(id) on delete cascade,

    -- Audit Fields
    created_at      timestamp with time zone not null
                    default timezone('utc', now()),
    created_by      uuid references public.users(id)
                    on delete set null                           -- Who granted admin access
);

-- Table Comments
comment on table public.admin_users is 'Tracks users with admin dashboard access, separate from app/channel roles';
comment on column public.admin_users.user_id is 'Reference to the user who has admin access';
comment on column public.admin_users.created_at is 'When admin access was granted';
comment on column public.admin_users.created_by is 'Who granted the admin access (null if system/migration)';

-- Index for quick lookups
create index if not exists idx_admin_users_created_at
    on public.admin_users (created_at desc);

-- -----------------------------------------------------------------------------
-- Function: public.is_admin
-- -----------------------------------------------------------------------------
-- Security definer function to check admin status without RLS recursion
-- -----------------------------------------------------------------------------
create or replace function public.is_admin(check_user_id uuid)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1 from admin_users where user_id = check_user_id
  );
$$;

comment on function public.is_admin(uuid) is 'Check if a user has admin dashboard access';

-- Grant execute to authenticated users
grant execute on function public.is_admin(uuid) to authenticated;

-- -----------------------------------------------------------------------------
-- RLS Policies
-- -----------------------------------------------------------------------------
alter table public.admin_users enable row level security;

-- Users can check their own admin status (for auth check)
create policy "Users can check own admin status"
    on public.admin_users for select
    using (user_id = auth.uid());

-- Admins can view all admin users
create policy "Admins can view all"
    on public.admin_users for select
    using (public.is_admin(auth.uid()));

-- Admins can add new admins
create policy "Admins can insert"
    on public.admin_users for insert
    with check (public.is_admin(auth.uid()));

-- Admins can remove other admins (not themselves to prevent lockout)
create policy "Admins can delete others"
    on public.admin_users for delete
    using (
        user_id != auth.uid() and 
        public.is_admin(auth.uid())
    );
