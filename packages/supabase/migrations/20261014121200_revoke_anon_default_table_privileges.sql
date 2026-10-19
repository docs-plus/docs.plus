-- Issue #470. Prod never ran 29-lint-hardening.sql §3, so anon holds default rights on tables
-- the 2026-09-28 hand fix did not name. Revokes them all, then grants back the guest chat read
-- path. Re-runs safely. The users list omits email, status and online_at (#434); keep it equal
-- to §3.

set local lock_timeout = '5s';

revoke all on all tables in schema public from anon;

grant select on public.channels, public.messages, public.channel_message_counts,
                public.pinned_messages, public.workspaces, public.channel_members,
                public.message_bookmarks
  to anon;
grant select (id, username, full_name, display_name, avatar_url, avatar_updated_at,
              profile_data, created_at, updated_at, deleted_at)
  on public.users to anon;

-- A revoke by a non-owner only warns, so check the result and fail loudly.
do $$
declare
  r record;
  bad text[] := '{}';
  read_ok text[] := array['channels', 'messages', 'channel_message_counts', 'pinned_messages',
                          'workspaces', 'channel_members', 'message_bookmarks', 'users'];
begin
  for r in
    select c.oid, c.relname::text as relname
    from pg_class c join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public' and c.relkind in ('r', 'p', 'v', 'm', 'f')
  loop
    if has_table_privilege('anon', r.oid, 'INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER')
       or has_any_column_privilege('anon', r.oid, 'INSERT,UPDATE,REFERENCES') then
      bad := bad || ('anon can write ' || r.relname);
    end if;
    if r.relname <> all (read_ok) and has_any_column_privilege('anon', r.oid, 'SELECT') then
      bad := bad || ('anon can read ' || r.relname);
    end if;
    if r.relname = any (read_ok) and r.relname <> 'users'
       and not has_table_privilege('anon', r.oid, 'SELECT') then
      bad := bad || ('anon cannot read ' || r.relname);
    end if;
  end loop;

  if has_column_privilege('anon', 'public.users', 'email', 'SELECT')
     or has_column_privilege('anon', 'public.users', 'status', 'SELECT')
     or has_column_privilege('anon', 'public.users', 'online_at', 'SELECT') then
    bad := bad || 'anon can read a hidden users column'::text;
  end if;
  if not has_column_privilege('anon', 'public.users', 'username', 'SELECT') then
    bad := bad || 'anon cannot read users.username'::text;
  end if;

  if cardinality(bad) > 0 then
    raise exception 'anon table grant check failed: %', bad;
  end if;
end $$;
