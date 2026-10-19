-- Issue #315. Each new document_views partition enables RLS and revokes the browser roles
-- itself, because prod's default ACL grants anon ALL on a new table. Re-runs safely.
-- Pair: scripts/09-document-views.sql. CREATE OR REPLACE only: a drop resets the ACL.
-- 20261008140000 (#314) closed older partitions; the loop below closes any made since.

set local lock_timeout = '5s';

create or replace function public.create_document_views_partitions()
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
    start_date date;
    end_date date;
    partition_name text;
begin
    -- Create partitions for next 3 months
    for i in 1..3 loop
        start_date := date_trunc('month', current_date + (i || ' months')::interval);
        end_date := start_date + interval '1 month';
        partition_name := 'document_views_' || to_char(start_date, 'YYYY_MM');

        if not exists (
            select 1 from pg_class c
            join pg_namespace n on n.oid = c.relnamespace
            where c.relname = partition_name and n.nspname = 'public'
        ) then
            execute format(
                'create table public.%I partition of public.document_views
                 for values from (%L) to (%L)',
                partition_name, start_date, end_date
            );
            execute format(
                'create index %I on public.%I (document_slug, viewed_at)',
                partition_name || '_slug_idx', partition_name
            );
            -- Unique index for ON CONFLICT dedup
            execute format(
                'create unique index %I on public.%I (session_id, document_slug, view_date)',
                partition_name || '_dedup_idx', partition_name
            );
            -- A partition checks its own RLS and grants, not the parent's. Prod's
            -- default ACL grants anon ALL on a new table, so revoke it here.
            execute format(
                'alter table public.%I enable row level security',
                partition_name
            );
            execute format(
                'revoke all on public.%I from public, anon, authenticated',
                partition_name
            );
        end if;
    end loop;
end;
$$;

comment on function public.create_document_views_partitions() is
'Creates future partitions for document_views table with RLS enabled and no browser-role grants. Run monthly via pg_cron.';

-- Close the partitions the old cron function made since 20261008140000 ran. The cron job
-- makes a new one on the 1st of each month, open under prod's default ACL.
do $$
declare r record;
begin
  for r in
    select c.relname, c.relrowsecurity
    from pg_class c join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public' and c.relkind = 'r'
      and c.relname ~ '^document_views_[0-9]{4}_[0-9]{2}$'
  loop
    if not r.relrowsecurity then
      execute format('alter table public.%I enable row level security', r.relname);
    end if;
    execute format('revoke all on public.%I from public, anon, authenticated', r.relname);
  end loop;
end $$;

-- Any partition still open aborts the migration.
do $$
declare t record; bad text[] := '{}';
begin
  for t in
    select c.oid, c.relname, c.relrowsecurity
    from pg_class c join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public' and c.relkind = 'r'
      and c.relname ~ '^document_views_[0-9]{4}_[0-9]{2}$'
  loop
    if not t.relrowsecurity then
      bad := bad || ('RLS off on ' || t.relname);
    end if;
    if has_table_privilege('anon', t.oid, 'SELECT,INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER') then
      bad := bad || ('anon has rights on ' || t.relname);
    end if;
    if has_table_privilege('authenticated', t.oid, 'SELECT,INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER') then
      bad := bad || ('authenticated has rights on ' || t.relname);
    end if;
  end loop;
  if cardinality(bad) > 0 then
    raise exception 'document_views partition assert failed: %', bad;
  end if;
end $$;
