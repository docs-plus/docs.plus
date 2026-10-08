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
-- Defined here so later 10-x RPC scripts can call them; 13-RLS.sql owns grants.
-- A nested SECURITY DEFINER call pays a SET search_path switch per row, which
-- doubled chat read time. So the three primitives copy the can_open_document
-- predicate inline. Keep all four copies identical.

CREATE SCHEMA IF NOT EXISTS internal;

-- A Private document opens only for its owner (#396). No row means public.
-- An ownerless Private row opens for nobody, and a null user never owns one.
CREATE OR REPLACE FUNCTION internal.can_open_document(p_document_id varchar, p_user_id uuid)
RETURNS boolean
LANGUAGE sql STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT NOT EXISTS (
    SELECT 1 FROM public.document_access da
    WHERE da.document_id = p_document_id
      AND da.is_private
      AND coalesce(da.owner_id = p_user_id, false) = false
  );
$$;

COMMENT ON FUNCTION internal.can_open_document(varchar, uuid) IS
'False when the document is Private and the user is not its owner. Reads public.document_access.';

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
  )
  AND NOT EXISTS (
    SELECT 1 FROM public.document_access da
    WHERE da.document_id = p_workspace_id
      AND da.is_private
      AND coalesce(da.owner_id = auth.uid(), false) = false
  );
$$;

COMMENT ON FUNCTION internal.is_workspace_member(varchar) IS
'Active workspace membership predicate for RLS policies. False on a Private document the caller does not own.';

CREATE OR REPLACE FUNCTION internal.is_channel_member(p_channel_id varchar)
RETURNS boolean
LANGUAGE sql STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.channel_members cm
    JOIN public.channels c ON c.id = cm.channel_id
    WHERE cm.channel_id = p_channel_id
      AND cm.member_id  = auth.uid()
      AND cm.left_at IS NULL
      AND NOT EXISTS (
        SELECT 1 FROM public.document_access da
        WHERE da.document_id = c.workspace_id
          AND da.is_private
          AND coalesce(da.owner_id = auth.uid(), false) = false
      )
  );
$$;

COMMENT ON FUNCTION internal.is_channel_member(varchar) IS
'Active channel membership predicate for RLS policies. False on a Private document the caller does not own.';

CREATE OR REPLACE FUNCTION internal.can_read_channel(p_channel_id varchar)
RETURNS boolean
LANGUAGE sql STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.channels c
    WHERE c.id = p_channel_id
      AND NOT EXISTS (
        SELECT 1 FROM public.document_access da
        WHERE da.document_id = c.workspace_id
          AND da.is_private
          AND coalesce(da.owner_id = auth.uid(), false) = false
      )
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
'PUBLIC bypass + active channel membership; read-eligibility predicate. False on a Private document the caller does not own.';
