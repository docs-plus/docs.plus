/*
 * Notification Functions
 * This file contains functions related to notification management:
 * - Retrieving workspace-specific notifications
 * - Filtering by read/unread status
 * - Pagination support for notification listings
 */

/**
 * Function: get_workspace_notifications
 * Description: Retrieves notifications for a specific user filtered by workspace
 * Parameters:
 *   - p_user_id: UUID of the user to get notifications for
 *   - p_workspace_id: ID of the workspace to filter notifications by
 *   - p_limit: Maximum number of notifications to return (default: 10)
 *   - p_offset: Number of notifications to skip for pagination (default: 0)
 *   - p_is_read: Whether to return read (true) or unread (false) notifications (default: true)
 * Returns: A set of JSON objects containing notification data with sender information
 */
create or replace function get_workspace_notifications(
  p_user_id uuid,
  p_workspace_id varchar,
  p_limit int default 10,
  p_offset int default 0,
  p_is_read boolean default true
)
returns setof json as $$
begin
  -- Return filtered notifications based on workspace and read status
  if p_is_read then
    return query
    with workspace_channels as (
      select id from channels where workspace_id = p_workspace_id
    ),
    workspace_messages as (
      select m.id
      from messages m
      join workspace_channels wc on m.channel_id = wc.id
    )
    select json_build_object(
      'id', n.id,
      'type', n.type,
      'sender_user_id', n.sender_user_id,
      'receiver_user_id', n.receiver_user_id,
      'message_id', n.message_id,
      'channel_id', n.channel_id,
      'message_preview', n.message_preview,
      'created_at', n.created_at,
      'readed_at', n.readed_at,
      'action_url', n.action_url,
      'sender', json_build_object(
        'id', u.id,
        'avatar_updated_at', u.avatar_updated_at,
        'avatar_url', u.avatar_url,
        'display_name', u.display_name,
        'full_name', u.full_name,
        'username', u.username
      )
    )
    from notifications n
    left join users u on n.sender_user_id = u.id
    where n.receiver_user_id = p_user_id
    and n.readed_at is not null
    and (
      -- Include system notifications (no channel or message)
      (n.channel_id is null and n.message_id is null)
      -- Include notifications for channels in this workspace
      or n.channel_id in (select id from workspace_channels)
      -- Include notifications for messages in channels in this workspace
      or n.message_id in (select id from workspace_messages)
    )
    order by n.created_at desc
    limit p_limit offset p_offset;
  else
    return query
    with workspace_channels as (
      select id from channels where workspace_id = p_workspace_id
    ),
    workspace_messages as (
      select m.id
      from messages m
      join workspace_channels wc on m.channel_id = wc.id
    )
    select json_build_object(
      'id', n.id,
      'type', n.type,
      'sender_user_id', n.sender_user_id,
      'receiver_user_id', n.receiver_user_id,
      'message_id', n.message_id,
      'channel_id', n.channel_id,
      'message_preview', n.message_preview,
      'created_at', n.created_at,
      'readed_at', n.readed_at,
      'action_url', n.action_url,
      'sender', json_build_object(
        'id', u.id,
        'avatar_updated_at', u.avatar_updated_at,
        'avatar_url', u.avatar_url,
        'display_name', u.display_name,
        'full_name', u.full_name,
        'username', u.username
      )
    )
    from notifications n
    left join users u on n.sender_user_id = u.id
    where n.receiver_user_id = p_user_id
    and n.readed_at is null
    and (
      -- Include system notifications (no channel or message)
      (n.channel_id is null and n.message_id is null)
      -- Include notifications for channels in this workspace
      or n.channel_id in (select id from workspace_channels)
      -- Include notifications for messages in channels in this workspace
      or n.message_id in (select id from workspace_messages)
    )
    order by n.created_at desc
    limit p_limit offset p_offset;
  end if;
end;
$$ language plpgsql;

comment on function get_workspace_notifications(uuid, varchar, int, int, boolean) is
'Returns notifications for a specific user filtered by workspace, with pagination and read/unread filtering options.';
