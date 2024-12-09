/*
  Function: handle_new_user
  Description: Inserts a new user row and assigns roles based on provided meta-data.
*/
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
DECLARE
  derived_username TEXT; -- Renamed variable to avoid ambiguity
  suffix INT := 0;
BEGIN
  -- If full_name is provided, use it as the base for the username
  IF new.raw_user_meta_data->>'full_name' IS NOT NULL THEN
    derived_username := lower(trim(new.raw_user_meta_data->>'full_name'));
  ELSE
    -- If full_name is not provided, derive username from the email before '@'
    derived_username := lower(split_part(new.email, '@', 1));
  END IF;

  -- Sanitize the username to ensure it conforms to the pattern
  -- Replace invalid characters with underscores
  derived_username := regexp_replace(derived_username, '[^a-z0-9_-]', '_', 'g');

  -- Ensure the username starts with a letter; if not, prefix 'user_'
  IF derived_username !~ '^[a-z]' THEN
    derived_username := 'user_' || derived_username;
  END IF;

  -- Truncate username to a maximum of 30 characters
  derived_username := left(derived_username, 30);

  -- Ensure the username is at least 3 characters long by appending 'usr' if too short
  IF char_length(derived_username) < 3 THEN
    derived_username := derived_username || '_usr';
  END IF;

  -- Check for uniqueness and append a numeric suffix if the username already exists
  WHILE EXISTS (SELECT 1 FROM public.users WHERE public.users.username = derived_username) LOOP
    suffix := suffix + 1;
    derived_username := left(derived_username || '_' || suffix::TEXT, 30);
  END LOOP;

  -- Insert the new user into the users table
  INSERT INTO public.users (id, full_name, avatar_url, email, username)
  VALUES (
    new.id,
    new.raw_user_meta_data->>'full_name',
    new.raw_user_meta_data->>'avatar_url',
    new.email,
    derived_username
  );

  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger: on_auth_user_created
-- Description: Executes handle_new_user function after a new user is created in auth.users table.
CREATE TRIGGER on_auth_user_created
AFTER INSERT ON auth.users
FOR EACH ROW
EXECUTE PROCEDURE public.handle_new_user();

----------------------------------------------------
----------------------------------------------------


CREATE OR REPLACE FUNCTION update_online_at()
RETURNS TRIGGER AS $$
BEGIN
    -- Check if the 'status' column is being updated
    IF OLD.status IS DISTINCT FROM NEW.status THEN
        -- Update 'online_at' to the current timestamp
        NEW.online_at := timezone('utc', now());
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_online_at
BEFORE UPDATE OF status ON public.users
FOR EACH ROW
EXECUTE FUNCTION update_online_at();
