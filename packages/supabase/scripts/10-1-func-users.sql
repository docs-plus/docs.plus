/*
  Function: handle_new_user
  Description: Inserts a new user row and assigns roles based on provided meta-data.
*/
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
DECLARE
  username text;
BEGIN
  IF new.raw_user_meta_data->>'full_name' IS NULL THEN
    username := new.email; 
  ELSE
    username := new.raw_user_meta_data->>'full_name'; 
  END IF;

  INSERT INTO public.users (id, full_name, avatar_url, email, username)
  VALUES (
    new.id,
    new.raw_user_meta_data->>'full_name',
    new.raw_user_meta_data->>'avatar_url',
    new.email,
    username
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
