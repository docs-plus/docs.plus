/*
 * Helper Functions
 * This file contains utility functions used throughout the application.
 */

/**
 * Function: truncate_content
 * Description: Truncates text content to a specified maximum length, adding ellipsis if needed.
 * Parameters:
 *   - input_content: The text content to truncate
 *   - max_length: Maximum length of the output text (optional, defaults to 80)
 * Returns: Truncated text with ellipsis appended if truncation occurred
 * Usage: Used for generating preview text throughout the application
 */
create or replace function truncate_content(
    input_content text,
    max_length int default null
) returns text as $$
declare
    -- Define a constant for the default max length
    default_max_length constant int := 80;
begin
    -- Use the provided max_length or the default if not provided
    if max_length is null then
        max_length := default_max_length;
    end if;

    return case
        when length(input_content) > max_length then left(input_content, max_length - 3) || '...'
        else input_content
    end;
end;
$$ language plpgsql;

comment on function truncate_content(text, int) is
'Utility function to truncate text content to a specified length with ellipsis, used for preview text generation.';

/**
 * Preview label for a message row — prefers text, then attachment metadata.
 */
create or replace function message_content_preview(
    p_content text,
    p_medias jsonb,
    p_type public.message_type default 'text'
) returns text as $$
declare
    media_count int;
    first_name text;
    first_type text;
begin
    if coalesce(trim(p_content), '') <> '' then
        return truncate_content(p_content);
    end if;

    if p_medias is null or jsonb_typeof(p_medias) <> 'array' then
        return truncate_content('');
    end if;

    media_count := jsonb_array_length(p_medias);
    if media_count = 0 then
        return truncate_content('');
    end if;

    first_name := p_medias->0->>'name';
    first_type := coalesce(p_medias->0->>'type', p_type::text);

    if media_count > 1 then
        return truncate_content(media_count || ' attachments');
    end if;

    if first_type = 'file' and coalesce(first_name, '') <> '' then
        return truncate_content(first_name);
    end if;

    return truncate_content(case first_type
        when 'image' then 'Photo'
        when 'video' then 'Video'
        when 'audio' then 'Audio'
        when 'file' then 'File'
        else 'Attachment'
    end);
end;
$$ language plpgsql;

comment on function message_content_preview(text, jsonb, public.message_type) is
'Generates sidebar/reply/notification preview text from message content or attachment metadata.';

-- ============================================================
-- Hardening: pin search_path = public on functions defined above
-- (idempotent — safe to re-run)
-- ============================================================
ALTER FUNCTION public.truncate_content(input_content text, max_length integer) SET search_path = public;
ALTER FUNCTION public.message_content_preview(text, jsonb, public.message_type) SET search_path = public;

-- =====================================================================
-- internal policy primitives (RLS)
-- =====================================================================
-- Defined here (not 13-RLS.sql) so later 10-x RPC scripts can call them at
-- seed time; 13-RLS.sql owns their grants, hardening, and the policies.
-- SECURITY DEFINER + SET search_path = public — search-path-hijack safe.
-- STABLE SQL bodies are inlined by the planner, so policy expressions
-- effectively become the inlined EXISTS subqueries against:
--   workspace_members_workspace_id_member_id_key  → is_workspace_member
--   idx_channel_members_channel_id_member_id      → is_channel_member
--   channels_pkey + the above                     → can_read_channel

CREATE SCHEMA IF NOT EXISTS internal;

CREATE OR REPLACE FUNCTION internal.is_workspace_member(p_workspace_id varchar)
RETURNS boolean
LANGUAGE sql STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.workspace_members
    WHERE workspace_id = p_workspace_id
      AND member_id    = auth.uid()
      AND left_at IS NULL
  );
$$;

COMMENT ON FUNCTION internal.is_workspace_member(varchar) IS
'Active workspace membership predicate for RLS policies.';

CREATE OR REPLACE FUNCTION internal.is_channel_member(p_channel_id varchar)
RETURNS boolean
LANGUAGE sql STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.channel_members
    WHERE channel_id = p_channel_id
      AND member_id  = auth.uid()
      AND left_at IS NULL
  );
$$;

COMMENT ON FUNCTION internal.is_channel_member(varchar) IS
'Active channel membership predicate for RLS policies.';

CREATE OR REPLACE FUNCTION internal.can_read_channel(p_channel_id varchar)
RETURNS boolean
LANGUAGE sql STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.channels c
    WHERE c.id = p_channel_id
      AND (
        c.type = 'PUBLIC'
        OR EXISTS (
          SELECT 1 FROM public.channel_members cm
          WHERE cm.channel_id = c.id
            AND cm.member_id  = auth.uid()
            AND cm.left_at IS NULL
        )
      )
  );
$$;

COMMENT ON FUNCTION internal.can_read_channel(varchar) IS
'PUBLIC bypass + active channel membership; read-eligibility predicate.';
