-- =====================================================================
-- 20260513140000_add_messages_seq_client_id_and_last_read_seq.sql
-- =====================================================================
-- Adds messages.seq (global monotonic bigint, dual-sequence backfilled),
-- messages.client_id (idempotency token), channel_members.last_read_seq.
-- Mirrors scripts/05-0-message.sql, 08-channel_members.sql, 11-indexes.sql.
-- =====================================================================

alter table public.messages add column seq bigint;
create sequence public.messages_seq_seq owned by public.messages.seq;
alter table public.messages alter column seq set default nextval('public.messages_seq_seq');
select setval('public.messages_seq_seq', 1000000000, false);

-- Backfill sequence is capped below the live sequence floor so every historical
-- row keeps seq < every live insert, even after backfill completes.
create sequence public.messages_seq_backfill maxvalue 999999999 no cycle;

do $$
declare
  batch_size int := 5000;
  rows_updated int;
begin
  loop
    with cte as (
      select id from public.messages
      where seq is null
      order by created_at asc, id asc
      limit batch_size
      for update skip locked
    )
    update public.messages m
    set seq = nextval('public.messages_seq_backfill')
    from cte where m.id = cte.id;
    get diagnostics rows_updated = row_count;
    exit when rows_updated = 0;
    perform pg_sleep(0.05);
  end loop;
end$$;

alter table public.messages alter column seq set not null;
alter table public.messages add constraint messages_seq_key unique (seq);

alter table public.messages add column client_id text;
create unique index idx_messages_client_id
  on public.messages (client_id)
  where client_id is not null;

create index idx_messages_channel_id_seq_desc
  on public.messages (channel_id, seq desc)
  where deleted_at is null;

alter table public.channel_members add column last_read_seq bigint not null default 0;

create index idx_channel_members_channel_member_lastread
  on public.channel_members (channel_id, member_id, last_read_seq);
