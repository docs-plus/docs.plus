-- Grant and RLS guard. Read-only; run against prod after every db push. Zero rows = pass.
-- A default_acl_* row means a new object would start open again (#316).
-- Each allowlist here copies a script list (29-lint-hardening.sql §3 and §6, 13-RLS.sql grants).
-- check-grant-allowlists.ts fails when a copy drifts, so this file stays pasteable.
with anon_read_ok(t) as (values
    ('channels'), ('messages'), ('channel_message_counts'), ('pinned_messages'),
    ('workspaces'), ('channel_members'), ('message_bookmarks'),
    ('users')), -- column grant; anon_hidden_column checks the hidden columns
anon_definer_ok(schema_name, fn) as (values
    ('internal', 'can_open_document')),
authenticated_definer_ok(schema_name, fn) as (
  select 'public', unnest(array[
    'get_channel_aggregate_data', 'get_channel_members_by_last_read_update',
    'advance_read_cursor', 'add_reaction', 'remove_reaction',
    'toggle_message_bookmark', 'archive_bookmark', 'mark_bookmark_as_read',
    'get_bookmark_stats', 'get_user_bookmarks',
    'notifications_summary', 'get_unread_notif_count',
    'get_unread_notifications_paginated', 'get_channel_notif_state',
    'get_workspace_notifications', 'update_notification_preferences',
    'get_notification_preferences',
    'fetch_mentioned_users',
    'join_workspace',
    'get_document_member_previews', 'get_document_members',
    'set_document_follow', 'get_document_follow_state',
    'register_push_subscription', 'unregister_push_subscription',
    'admin_get_failed_push_subs', 'admin_get_recent_push_activity',
    'is_admin'])
  union all
  select 'internal', unnest(array['can_open_document', 'is_workspace_member', 'is_channel_member', 'can_read_channel'])),
rels as (
  select c.oid, c.relname::text as relname, c.relkind, c.relrowsecurity
  from pg_class c join pg_namespace n on n.oid = c.relnamespace
  where n.nspname = 'public' and c.relkind in ('r', 'p', 'v', 'm', 'f'))
select 'rls_off' as kind, relname as obj from rels
where relkind in ('r', 'p') and not relrowsecurity
union all
select 'anon_write', relname from rels
where has_table_privilege('anon', oid, 'INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER')
   or has_any_column_privilege('anon', oid, 'INSERT,UPDATE,REFERENCES')
union all
select 'anon_read_not_allowed', relname from rels
where has_any_column_privilege('anon', oid, 'SELECT')
  and relname not in (select t from anon_read_ok)
union all
select 'anon_hidden_column', 'users.' || c
from unnest(array['email', 'status', 'online_at']) as c
where has_column_privilege('anon', 'public.users', c, 'SELECT')
union all
select 'definer_exec', p.oid::regprocedure::text
from pg_proc p join pg_namespace n on n.oid = p.pronamespace
where n.nspname in ('public', 'internal') and p.prosecdef
  and p.prorettype not in ('trigger'::regtype, 'event_trigger'::regtype)
  and ((has_schema_privilege('anon', n.oid, 'USAGE')
        and has_function_privilege('anon', p.oid, 'EXECUTE')
        and (n.nspname::text, p.proname::text) not in (select schema_name, fn from anon_definer_ok))
    or (has_schema_privilege('authenticated', n.oid, 'USAGE')
        and has_function_privilege('authenticated', p.oid, 'EXECUTE')
        and (n.nspname::text, p.proname::text) not in (select schema_name, fn from authenticated_definer_ok)))
union all
select 'default_acl_anon', d.defaclobjtype::text || ':' || string_agg(a.privilege_type, ',' order by a.privilege_type)
from pg_default_acl d, aclexplode(d.defaclacl) a
where d.defaclrole = 'postgres'::regrole and d.defaclnamespace = 'public'::regnamespace
  and a.grantee = 'anon'::regrole
group by d.defaclobjtype
union all
select 'default_acl_authenticated_exec', 'f:EXECUTE'
where exists (
  select 1 from pg_default_acl d, aclexplode(d.defaclacl) a
  where d.defaclrole = 'postgres'::regrole and d.defaclnamespace = 'public'::regnamespace
    and d.defaclobjtype = 'f' and a.grantee = 'authenticated'::regrole)
union all
-- With no global function row, built-in defaults give PUBLIC execute on every new function.
select 'default_acl_public_exec', 'f:EXECUTE'
where not exists (
    select 1 from pg_default_acl d
    where d.defaclrole = 'postgres'::regrole and d.defaclnamespace = 0 and d.defaclobjtype = 'f')
  or exists (
    select 1 from pg_default_acl d, aclexplode(d.defaclacl) a
    where d.defaclrole = 'postgres'::regrole and d.defaclnamespace = 0
      and d.defaclobjtype = 'f' and a.grantee = 0)
order by 1, 2;
