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
 * Trigger: Executes after INSERT on auth.users
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

  INSERT INTO public.users (id, full_name, avatar_url, email, username)
  VALUES (new.id, user_full_name, user_avatar_url, new.email, final_username);

  RETURN new;
END;
$$;


-- Trigger: on_auth_user_created
-- Description: Executes handle_new_user function after a new user is created in auth.users table.
CREATE TRIGGER on_auth_user_created
AFTER INSERT ON auth.users
FOR EACH ROW
EXECUTE PROCEDURE public.handle_new_user();

----------------------------------------------------
----------------------------------------------------

/**
 * Function: update_user_online_at
 * Description: Updates the online_at timestamp when a user's status changes
 * Trigger: Executes before UPDATE of status on public.users
 * Action: Sets the online_at timestamp to current UTC time when status changes
 * Returns: The modified NEW record
 */
CREATE OR REPLACE FUNCTION public.update_user_online_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
    -- Check if the 'status' column is being updated
    IF OLD.status IS DISTINCT FROM NEW.status THEN
        -- Update 'online_at' to the current timestamp
        NEW.online_at := timezone('utc', now());
    END IF;
    RETURN NEW;
END;
$$;

COMMENT ON FUNCTION public.update_user_online_at() IS 'Updates the online_at timestamp whenever a user status changes, for tracking user activity.';

CREATE TRIGGER trigger_update_user_online_at
BEFORE UPDATE OF status ON public.users
FOR EACH ROW
EXECUTE FUNCTION public.update_user_online_at();

COMMENT ON TRIGGER trigger_update_user_online_at ON public.users IS 'Automatically updates the online_at timestamp when a user status changes.';

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
