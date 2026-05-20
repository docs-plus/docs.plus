-- One-shot production catchup after v2 read-cursor rollout: align every active
-- channel_members row with the tail of its channel so TOC unread badges and
-- fetch_message_window first_unread anchors match "fully caught up".
-- Not mirrored in scripts/ — do not re-run on db reset (dev seed state differs).

with channel_tail as (
  select distinct on (m.channel_id)
    m.channel_id,
    m.id as message_id,
    m.seq as tail_seq
  from public.messages m
  where m.deleted_at is null
  order by m.channel_id, m.seq desc, m.id desc
)
update public.channel_members cm
set
  last_read_seq = ct.tail_seq,
  last_read_message_id = ct.message_id,
  unread_message_count = 0,
  last_read_update_at = timezone('utc', now()),
  updated_at = timezone('utc', now())
from channel_tail ct
where cm.channel_id = ct.channel_id
  and cm.left_at is null;

update public.channel_members cm
set
  last_read_seq = 0,
  last_read_message_id = null,
  unread_message_count = 0,
  last_read_update_at = timezone('utc', now()),
  updated_at = timezone('utc', now())
where cm.left_at is null
  and not exists (
    select 1
    from public.messages m
    where m.channel_id = cm.channel_id
      and m.deleted_at is null
  );
