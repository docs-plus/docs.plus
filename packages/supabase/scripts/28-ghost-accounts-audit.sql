-- =============================================================================
-- Ghost Accounts Audit — Public Schema Helper Functions
-- =============================================================================
-- Phase 15: Admin dashboard functions for ghost account detection + cleanup.
--
-- NOTE: Ghost detection itself happens in the backend controller via
-- Supabase Admin API (auth.admin.listUsers), NOT in SQL — because
-- the auth schema is inaccessible to PostgREST / standard RPC calls.
--
-- These helper functions only query the PUBLIC schema to:
--   1. Find public.users who were never active (online_at IS NULL)
--   2. Check FK dependencies before deleting a user
--   3. Provide summary counts from public.users
-- =============================================================================

-- 1. Get public.users who have never been active
-- Used by the controller to cross-reference with auth.users ghost list
create or replace function public.get_inactive_users(
  p_min_age_days integer default 30
)
returns table (
  user_id uuid,
  email text,
  username text,
  online_at timestamptz,
  created_at timestamptz,
  age_days integer,
  message_count bigint,
  channel_count bigint
)
language sql
security definer
set search_path = public
stable
as $$
  select
    u.id as user_id,
    u.email,
    u.username,
    u.online_at,
    u.created_at,
    extract(day from now() - u.created_at)::integer as age_days,
    (select count(*) from public.messages m where m.user_id = u.id) as message_count,
    (select count(*) from public.channel_members cm where cm.member_id = u.id) as channel_count
  from public.users u
  where u.online_at is null
    and u.deleted_at is null
    and u.created_at < now() - (p_min_age_days || ' days')::interval
  order by u.created_at asc;
$$;

comment on function public.get_inactive_users(integer) is
'Returns public.users who have never been active (online_at IS NULL). Used by ghost accounts audit.';


-- 2. Get FK dependency impact before deleting a user
-- The critical check: messages.user_id uses NO ACTION, so it blocks hard-delete
create or replace function public.get_user_deletion_impact(p_user_id uuid)
returns table (
  message_count bigint,
  channel_memberships bigint,
  push_subscriptions bigint,
  email_queue_items bigint,
  notifications_received bigint,
  has_blocking_messages boolean
)
language sql
security definer
set search_path = public
stable
as $$
  select
    (select count(*) from public.messages where user_id = p_user_id) as message_count,
    (select count(*) from public.channel_members where member_id = p_user_id) as channel_memberships,
    (select count(*) from public.push_subscriptions where user_id = p_user_id) as push_subscriptions,
    (select count(*) from public.email_queue where user_id = p_user_id) as email_queue_items,
    (select count(*) from public.notifications where receiver_user_id = p_user_id) as notifications_received,
    -- messages.user_id has NO ACTION — will block hard-delete if count > 0
    exists(select 1 from public.messages where user_id = p_user_id) as has_blocking_messages;
$$;

comment on function public.get_user_deletion_impact(uuid) is
'Returns FK dependency counts for a user. has_blocking_messages=true means hard-delete will fail (messages.user_id NO ACTION).';


-- 3. Ghost accounts summary (public schema portion only)
-- Gives a quick overview of public.users health
create or replace function public.get_ghost_summary_public()
returns table (
  total_public_users bigint,
  never_active_count bigint,
  soft_deleted_count bigint,
  active_count bigint
)
language sql
security definer
set search_path = public
stable
as $$
  select
    (select count(*) from public.users) as total_public_users,
    (select count(*) from public.users where online_at is null and deleted_at is null) as never_active_count,
    (select count(*) from public.users where deleted_at is not null) as soft_deleted_count,
    (select count(*) from public.users where online_at is not null and deleted_at is null) as active_count;
$$;

comment on function public.get_ghost_summary_public() is
'Returns summary counts from public.users: total, never active, soft-deleted, and active.';


-- Grant execute to service_role (used by Hocuspocus admin controller)
grant execute on function public.get_inactive_users(integer) to service_role;
grant execute on function public.get_user_deletion_impact(uuid) to service_role;
grant execute on function public.get_ghost_summary_public() to service_role;

