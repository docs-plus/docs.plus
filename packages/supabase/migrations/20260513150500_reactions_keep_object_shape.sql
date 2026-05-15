-- =====================================================================
-- 20260513150500_reactions_keep_object_shape.sql
-- =====================================================================
-- The just-shipped add_reaction / remove_reaction RPCs persisted the
-- emoji set as a flat array [{user_id, emoji, at}, …]. Every existing
-- display consumer (ReactionList, AddReactionButton, retention stats)
-- reads the v1 object shape { [emoji]: [{user_id, created_at}, …] }
-- and the messages.reactions column comment is still
-- "JSON object mapping emoji reactions to arrays of user IDs".
--
-- Rather than fan a shape change across every reader, rewrite the RPCs
-- to keep the v1 object shape. Anon callers are still blocked; the
-- channel-readable + row-lock semantics from the prior migration are
-- preserved. Mirrors scripts/10-3-func-message.sql.
-- =====================================================================

create or replace function public.add_reaction(
  p_message_id uuid,
  p_emoji      text
) returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_uid uuid := (select auth.uid());
  v_channel_id varchar(36);
  v_reactions jsonb;
  v_users jsonb;
  v_already_reacted boolean;
begin
  if v_uid is null then
    raise exception 'not authenticated' using errcode = '42501';
  end if;
  if length(p_emoji) = 0 or length(p_emoji) > 16 then
    raise exception 'invalid emoji' using errcode = '22023';
  end if;

  select channel_id into v_channel_id
  from public.messages
  where id = p_message_id and deleted_at is null;
  if v_channel_id is null then
    raise exception 'message not found' using errcode = '42501';
  end if;
  if not internal.can_read_channel(v_channel_id) then
    raise exception 'forbidden' using errcode = '42501';
  end if;

  select coalesce(reactions, '{}'::jsonb) into v_reactions
  from public.messages where id = p_message_id for update;

  v_users := coalesce(v_reactions -> p_emoji, '[]'::jsonb);
  v_already_reacted := exists (
    select 1 from jsonb_array_elements(v_users) elt
    where elt->>'user_id' = v_uid::text
  );

  if not v_already_reacted then
    v_users := v_users || jsonb_build_array(
      jsonb_build_object(
        'user_id', v_uid::text,
        'created_at', to_char(now() at time zone 'utc', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"')
      )
    );
    v_reactions := v_reactions || jsonb_build_object(p_emoji, v_users);
    update public.messages set reactions = v_reactions where id = p_message_id;
  end if;

  return v_reactions;
end;
$$;

grant execute on function public.add_reaction(uuid, text) to authenticated;
revoke execute on function public.add_reaction(uuid, text) from anon, public;

create or replace function public.remove_reaction(
  p_message_id uuid,
  p_emoji      text
) returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_uid uuid := (select auth.uid());
  v_channel_id varchar(36);
  v_reactions jsonb;
  v_users jsonb;
begin
  if v_uid is null then
    raise exception 'not authenticated' using errcode = '42501';
  end if;

  select channel_id into v_channel_id
  from public.messages
  where id = p_message_id and deleted_at is null;
  if v_channel_id is null then
    raise exception 'message not found' using errcode = '42501';
  end if;
  if not internal.can_read_channel(v_channel_id) then
    raise exception 'forbidden' using errcode = '42501';
  end if;

  select coalesce(reactions, '{}'::jsonb) into v_reactions
  from public.messages where id = p_message_id for update;

  v_users := coalesce(v_reactions -> p_emoji, '[]'::jsonb);
  v_users := coalesce((
    select jsonb_agg(elt)
    from jsonb_array_elements(v_users) elt
    where elt->>'user_id' <> v_uid::text
  ), '[]'::jsonb);

  if jsonb_array_length(v_users) = 0 then
    v_reactions := v_reactions - p_emoji;
  else
    v_reactions := v_reactions || jsonb_build_object(p_emoji, v_users);
  end if;

  update public.messages set reactions = v_reactions where id = p_message_id;

  return v_reactions;
end;
$$;

grant execute on function public.remove_reaction(uuid, text) to authenticated;
revoke execute on function public.remove_reaction(uuid, text) from anon, public;
