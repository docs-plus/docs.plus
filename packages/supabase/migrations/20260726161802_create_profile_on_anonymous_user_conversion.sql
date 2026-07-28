-- Create the public.users profile an anonymous user never got, once they become permanent.
-- Objects: public.handle_new_user() (adds ON CONFLICT), new trigger on_auth_user_converted
-- on auth.users. Only on_auth_user_created existed, and it is INSERT-only, so a conversion —
-- an UPDATE of the same auth.users row — left the account profile-less forever.
-- Mirrors packages/supabase/scripts/10-1-func-users.sql. Idempotent; no data is rewritten.

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

-- Mirrors the hardening block at the foot of `scripts/10-1-func-users.sql`, which
-- deliberately overrides the body's `search_path = ''` with `public`. Without this
-- line CREATE OR REPLACE would leave the function on `''` and diverge from prod.
ALTER FUNCTION public.handle_new_user() SET search_path = public;

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
