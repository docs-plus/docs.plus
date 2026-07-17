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
-- Self-check only: the parameter is kept for backward compatibility with
-- callers that pass `auth.uid()` explicitly, but `is_admin(other_uuid)`
-- now always returns false. Prevents authenticated users from probing
-- which platform users hold admin status.
create or replace function public.is_admin(check_user_id uuid)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select check_user_id = auth.uid()
     and exists (select 1 from admin_users where user_id = auth.uid());
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
    using (user_id = (select auth.uid()));

-- Admins can view all admin users
create policy "Admins can view all"
    on public.admin_users for select
    using ((select public.is_admin((select auth.uid()))));

-- Admins can add new admins
create policy "Admins can insert"
    on public.admin_users for insert
    with check ((select public.is_admin((select auth.uid()))));

-- Admins can remove other admins (not themselves to prevent lockout)
create policy "Admins can delete others"
    on public.admin_users for delete
    using (
        user_id != (select auth.uid()) and
        (select public.is_admin((select auth.uid())))
    );

-- ============================================================
-- Hardening: pin search_path = public on functions defined above
-- (idempotent — safe to re-run)
-- ============================================================
ALTER FUNCTION public.is_admin(check_user_id uuid) SET search_path = public;
