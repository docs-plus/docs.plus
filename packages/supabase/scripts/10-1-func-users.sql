/*
 * User Management Functions
 * This file contains functions and triggers related to user account management.
 */

-- Create internal schema for private helper functions
CREATE SCHEMA IF NOT EXISTS internal;
GRANT USAGE ON SCHEMA internal TO authenticated, service_role;

/**
 * Function: handle_new_user
 * Description: Creates a new user record in public.users when a new auth user is registered.
 * Trigger: Executes after INSERT on auth.users, and after the UPDATE that turns an
 *          anonymous user into a permanent one (see on_auth_user_converted below)
 * Action: Generates a username based on name or email, sanitizes it, ensures uniqueness,
 *         and creates the public user profile with data from auth metadata.
 * Returns: The NEW record (trigger standard)
 */

-- Create function with explicit ownership
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  raw_username TEXT;
  sanitized_username TEXT;
  final_username TEXT;
  name_suffix INT := 0;
  user_full_name TEXT;
  user_avatar_url TEXT;
BEGIN
  -- Skip profile creation for anonymous users entirely.
  -- Anonymous users (created by Supabase Anonymous Auth for document view tracking)
  -- don't need public.users entries — they have no email, no profile.
  -- The webapp's useOnAuthStateChange also skips getUserProfile for anonymous users.
  IF new.is_anonymous = true THEN
    RETURN new;
  END IF;

  -- Extract full_name from metadata (Google uses 'name', others might use 'full_name')
  user_full_name := COALESCE(
    new.raw_user_meta_data->>'full_name',
    new.raw_user_meta_data->>'name',
    NULL
  );

  -- Extract avatar_url from metadata
  user_avatar_url := COALESCE(
    new.raw_user_meta_data->>'avatar_url',
    new.raw_user_meta_data->>'picture',
    NULL
  );

  -- Extract initial username from meta-data or email
  -- Note: trim() is not in pg_catalog, so we use btrim() or unqualified trim()
  IF user_full_name IS NOT NULL THEN
    raw_username := pg_catalog.lower(pg_catalog.btrim(user_full_name));
  ELSIF new.email IS NOT NULL THEN
    raw_username := pg_catalog.lower(pg_catalog.split_part(new.email, '@', 1));
  ELSE
    -- Fallback: generate username from UUID if no email/name
    raw_username := 'user_' || pg_catalog.replace(pg_catalog.substr(new.id::text, 1, 8), '-', '');
  END IF;

  -- Sanitize username: replace invalid chars with underscores
  sanitized_username := pg_catalog.regexp_replace(raw_username, '[^a-z0-9_-]', '_', 'g');

  -- Ensure username starts with a letter
  IF sanitized_username !~ '^[a-z]' THEN
    sanitized_username := 'user_' || sanitized_username;
  END IF;

  -- Apply length constraints (max 30 chars)
  sanitized_username := pg_catalog.left(sanitized_username, 30);

  -- Ensure minimum length requirement (3 chars)
  IF pg_catalog.char_length(sanitized_username) < 3 THEN
    sanitized_username := sanitized_username || '_usr';
  END IF;

  -- Ensure username uniqueness
  final_username := sanitized_username;
  WHILE EXISTS (SELECT 1 FROM public.users WHERE public.users.username = final_username) LOOP
    name_suffix := name_suffix + 1;
    final_username := pg_catalog.left(sanitized_username || '_' || name_suffix::TEXT, 30);
  END LOOP;

  -- Ensure email is not NULL (required by public.users constraint)
  IF new.email IS NULL THEN
    RAISE EXCEPTION 'Email is required for user creation';
  END IF;

  -- The conversion trigger re-enters this function for an id that may already
  -- have a profile; a raise here would abort GoTrue's transaction and break sign-up.
  INSERT INTO public.users (id, full_name, avatar_url, email, username)
  VALUES (new.id, user_full_name, user_avatar_url, new.email, final_username)
  ON CONFLICT (id) DO NOTHING;

  RETURN new;
END;
$$;


-- Trigger: on_auth_user_created
-- Description: Executes handle_new_user function after a new user is created in auth.users table.
CREATE TRIGGER on_auth_user_created
AFTER INSERT ON auth.users
FOR EACH ROW
EXECUTE PROCEDURE public.handle_new_user();

-- Trigger: on_auth_user_converted
-- Description: Creates the profile an anonymous user never got once they become permanent.
-- auth.users.id survives the conversion, so this back-fills every row already attributed to
-- that id. GoTrue clears is_anonymous in its own statement, before the address lands, so the
-- address side of the guard is what completes most conversions.
DROP TRIGGER IF EXISTS on_auth_user_converted ON auth.users;
CREATE TRIGGER on_auth_user_converted
AFTER UPDATE OF is_anonymous, email ON auth.users
FOR EACH ROW
WHEN (
  new.is_anonymous = false
  AND new.email IS NOT NULL
  AND (old.is_anonymous = true OR old.email IS NULL)
)
EXECUTE PROCEDURE public.handle_new_user();

----------------------------------------------------
----------------------------------------------------

CREATE OR REPLACE FUNCTION public.update_user_online_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
    -- Stamp even when status is unchanged, so is_user_online sees the heartbeat.
    -- now() is timestamptz, which matches online_at whatever the session TimeZone.
    NEW.online_at := now();
    RETURN NEW;
END;
$$;

COMMENT ON FUNCTION public.update_user_online_at() IS 'Stamps online_at on every status write, so the heartbeat keeps it fresh for is_user_online.';

CREATE TRIGGER trigger_update_user_online_at
BEFORE UPDATE OF status ON public.users
FOR EACH ROW
EXECUTE FUNCTION public.update_user_online_at();

COMMENT ON TRIGGER trigger_update_user_online_at ON public.users IS 'Stamps online_at on every status write, so the heartbeat keeps it fresh.';

----------------------------------------------------
----------------------------------------------------

/**
 * Function: is_user_online
 * Description: Checks if a user is actively online based on status and recent activity.
 * Parameters: p_user_id - The UUID of the user to check
 * Returns: TRUE if user has status='ONLINE' AND online_at within last 2 minutes
 *
 * Usage: Used by push notification trigger to skip push for active users.
 * The 2-minute threshold is more aggressive than the cron cleanup (also 2 min)
 * to ensure we catch users who are actively engaged.
 */
CREATE OR REPLACE FUNCTION internal.is_user_online(p_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
AS $$
    SELECT EXISTS (
        SELECT 1 FROM public.users
        WHERE id = p_user_id
          AND status = 'ONLINE'
          AND online_at > now() - interval '2 minutes'
    );
$$;

COMMENT ON FUNCTION internal.is_user_online(uuid) IS
'Checks if user is actively online. Returns true if status is ONLINE and online_at is within last 2 minutes.';

-- Grant execute to service_role for push notification trigger
GRANT EXECUTE ON FUNCTION internal.is_user_online(uuid) TO service_role;

-- ============================================================
-- Hardening: pin search_path = public on functions defined above
-- (idempotent — safe to re-run)
-- ============================================================
ALTER FUNCTION public.handle_new_user() SET search_path = public;
ALTER FUNCTION public.update_user_online_at() SET search_path = public;
ALTER FUNCTION internal.is_user_online(p_user_id uuid) SET search_path = public;

-- Trigger functions run as postgres (DEFINER) so internal side effects
-- (counters, previews, notifications) bypass RLS on side-effect tables.
-- search_path is already pinned above; flipping security mode is safe.
ALTER FUNCTION public.update_user_online_at() SECURITY DEFINER;

----------------------------------------------------
----------------------------------------------------

/**
 * Function: update_profile
 * Saves the owner's profile. Merges only the top-level profile_data keys it is given,
 * so saving the bio never replaces links another device just wrote. An omitted
 * name or username keeps its column. Invoker rights: the column grants and users_self_update still apply.
 */
CREATE OR REPLACE FUNCTION public.update_profile(
    p_username text DEFAULT NULL,
    p_full_name text DEFAULT NULL,
    p_profile_patch jsonb DEFAULT '{}'::jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
    v_saved jsonb;
BEGIN
    IF (select auth.uid()) IS NULL THEN
        RAISE EXCEPTION 'unauthenticated' USING errcode = '42501';
    END IF;
    IF p_profile_patch IS NULL OR jsonb_typeof(p_profile_patch) <> 'object' THEN
        RAISE EXCEPTION 'patch_must_be_object' USING errcode = '22023';
    END IF;
    UPDATE public.users
       SET username = coalesce(p_username, username),
           full_name = coalesce(p_full_name, full_name),
           profile_data = profile_data || p_profile_patch
     WHERE id = (select auth.uid())
     RETURNING jsonb_build_object(
         'username', username,
         'full_name', full_name,
         'profile_data', profile_data
     ) INTO v_saved;
    RETURN v_saved;
END;
$$;

REVOKE ALL ON FUNCTION public.update_profile(text, text, jsonb) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.update_profile(text, text, jsonb) TO authenticated;

----------------------------------------------------
----------------------------------------------------

/**
 * Function: broadcast_profile_change
 * Tells every open client of the owner that their profile or settings changed.
 * The payload carries no values: clients refetch through their own grants.
 */
CREATE OR REPLACE FUNCTION public.broadcast_profile_change()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    PERFORM realtime.send(
        jsonb_build_object('user_id', NEW.id),
        'profile_changed',
        'profile:' || NEW.id::text,
        TRUE
    );
    RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS users_profile_changed ON public.users;

-- The column list and the guard keep the status heartbeat and cron out.
CREATE TRIGGER users_profile_changed
AFTER UPDATE OF username, full_name, avatar_url, avatar_updated_at, profile_data, notification_preferences
ON public.users
FOR EACH ROW
WHEN (
    OLD.username IS DISTINCT FROM NEW.username
    OR OLD.full_name IS DISTINCT FROM NEW.full_name
    OR OLD.avatar_url IS DISTINCT FROM NEW.avatar_url
    OR OLD.avatar_updated_at IS DISTINCT FROM NEW.avatar_updated_at
    OR OLD.profile_data IS DISTINCT FROM NEW.profile_data
    OR OLD.notification_preferences IS DISTINCT FROM NEW.notification_preferences
)
EXECUTE FUNCTION public.broadcast_profile_change();

DROP POLICY IF EXISTS "profile_topic_access" ON realtime.messages;

CREATE POLICY "profile_topic_access"
ON realtime.messages
FOR SELECT
TO authenticated
USING (
  realtime.messages.topic = 'profile:' || (select auth.uid())::text
);

-- A line comment, not comment on policy: postgres does not own realtime.messages.
-- profile_topic_access: a user subscribes only to profile:<auth.uid()>, the
-- private topic broadcast_profile_change() sends to.
