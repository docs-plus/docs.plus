/*
    -----------------------------------------
    -----------------------------------------
    1.
        Trigger: trigger_add_creator_as_admin
        Description: Trigger that invokes add_channel_creator_as_admin function
                     to add the channel creator as an admin in channel_members table 
                     after a new channel is created.
    -----------------------------------------
    -----------------------------------------
*/

-- Function: add_channel_creator_as_admin()
CREATE OR REPLACE FUNCTION add_channel_creator_as_admin() RETURNS TRIGGER AS $$
BEGIN
    -- Insert the channel creator as an admin into the channel_members table.
    -- This function is automatically triggered after a new channel is created.
    -- It ensures that the creator of the channel is immediately added as an admin member of the channel.
    INSERT INTO public.channel_members (channel_id, member_id, channel_member_role, joined_at)
    VALUES (NEW.id, NEW.created_by, 'ADMIN', NOW());

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION add_channel_creator_as_admin() IS 'Trigger function that adds the creator of a new channel as an admin in the channel_members table.';

-- Trigger: trigger_add_creator_as_admin
CREATE TRIGGER trigger_add_creator_as_admin
AFTER INSERT ON public.channels
FOR EACH ROW
EXECUTE FUNCTION add_channel_creator_as_admin();

COMMENT ON TRIGGER trigger_add_creator_as_admin ON public.channels IS 'Trigger that invokes add_channel_creator_as_admin function to add the channel creator as an admin in channel_members table after a new channel is created.';

----------------------------------------------------------------------------------

-- Function to create a notification message when a new channel is created
-- For multilingual and other purposes, you can gather more information from the metadata.
CREATE OR REPLACE FUNCTION public.notify_new_channel_creation()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO public.messages (channel_id, type, user_id, content, metadata)
    VALUES (
        NEW.id, 
        'notification', 
        '992bb85e-78f8-4747-981a-fd63d9317ff1', 
        'Channel created', 
        jsonb_build_object(
            'type', 'channel_created'
        )
    );
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;


-- Trigger to invoke the function when a new channel is created
CREATE TRIGGER trigger_new_channel_creation
AFTER INSERT ON public.channels
FOR EACH ROW
EXECUTE FUNCTION public.notify_new_channel_creation();

----------------------------------------------------------------------------------
----------------------------------------------------------------------------------


-- CREATE OR REPLACE FUNCTION update_last_read_time()
-- RETURNS TRIGGER AS $$
-- BEGIN
--     -- Update the last_read_update_at if there's a change in last_read_message_id
--     IF OLD.last_read_message_id IS DISTINCT FROM NEW.last_read_message_id THEN
--         NEW.last_read_update_at := timezone('utc', now());
--     END IF;
--     RETURN NEW;
-- END;
-- $$ LANGUAGE plpgsql;

-- CREATE TRIGGER trigger_update_last_read_time
-- BEFORE UPDATE ON public.channel_members
-- FOR EACH ROW
-- EXECUTE FUNCTION update_last_read_time();

----------------------------------------------------------------------------------


-- Function to create a notification message when a channel's name is changed
-- For multilingual and other purposes, you can gather more information from the metadata.
CREATE OR REPLACE FUNCTION public.notify_channel_name_change()
RETURNS TRIGGER AS $$
BEGIN
    IF OLD.name IS DISTINCT FROM NEW.name THEN
        INSERT INTO public.messages (channel_id, type, user_id, content, metadata)
        VALUES (
            NEW.id, 
            'notification', 
            '992bb85e-78f8-4747-981a-fd63d9317ff1', 
            'Channel name was changed to "' || NEW.name || '"', 
            jsonb_build_object(
                'type', 'channel_name_changed', 
                'name', NEW.name
            )
        );
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;


-- Trigger to invoke the function when a channel's name is changed
CREATE TRIGGER trigger_channel_name_change
AFTER UPDATE OF name ON public.channels
FOR EACH ROW
WHEN (OLD.name IS DISTINCT FROM NEW.name)
EXECUTE FUNCTION public.notify_channel_name_change();


----------------------------------------------------------------------------------
----------------------------------------------------------------------------------



-- Function to create a notification message card when a user joins a channel
-- For multilingual and other purposes, you can gather more information from the metadata.
CREATE OR REPLACE FUNCTION public.notify_user_join_channel()
RETURNS TRIGGER AS $$
DECLARE
    joining_username TEXT;
BEGIN
    SELECT username INTO joining_username FROM public.users WHERE id = NEW.member_id;

    INSERT INTO public.messages (user_id, channel_id, type, content, metadata)
    VALUES (
        NEW.member_id, 
        NEW.channel_id, 
        'notification', 
        joining_username || ' joined the channel', 
        jsonb_build_object(
            'type', 'user_join_channel', 
            'user_name', joining_username
        )
    );
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to invoke  the function when a user join a channel
CREATE TRIGGER trigger_user_join_channel
AFTER INSERT ON public.channel_members
FOR EACH ROW
EXECUTE FUNCTION public.notify_user_join_channel();

----------------------------------------------------------------------------------
----------------------------------------------------------------------------------


-- Function to create a notification message when a user leaves a channel
-- For multilingual and other purposes, you can gather more information from the metadata.
CREATE OR REPLACE FUNCTION public.notify_user_leave_channel()
RETURNS TRIGGER AS $$
DECLARE
    leaving_username TEXT;
BEGIN
    SELECT username INTO leaving_username FROM public.users WHERE id = OLD.member_id;

    INSERT INTO public.messages (user_id, channel_id, type, content, metadata)
    VALUES (
        OLD.member_id, 
        OLD.channel_id, 
        'notification', 
        leaving_username || ' left the channel', 
        jsonb_build_object(
            'type', 'user_leave_channel', 
            'user_name', leaving_username
        )
    );
    
    RETURN OLD;
END;
$$ LANGUAGE plpgsql;


-- Trigger to invoke the function when a user leaves a channel
CREATE TRIGGER trigger_user_leave_channel
AFTER DELETE ON public.channel_members
FOR EACH ROW
EXECUTE FUNCTION public.notify_user_leave_channel();




----------------------------------------------------------------------------------
----------------------------------------------------------------------------------
-- In case transactions involving member addition or removal are rolled back,
-- the triggers will automatically handle the increment and decrement operations as the INSERT and DELETE on channel_members will be rolled back as well.
----------------------------------------------------------------------------------
-- Since your member records are deleted when a user is deleted (due to the ON DELETE CASCADE),
-- the delete trigger on channel_members will also handle decrementing the member_count when a user is deleted.

CREATE OR REPLACE FUNCTION increment_member_count()
RETURNS TRIGGER AS $$
BEGIN
    UPDATE public.channels SET member_count = member_count + 1
    WHERE id = NEW.channel_id;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION decrement_member_count()
RETURNS TRIGGER AS $$
BEGIN
    UPDATE public.channels SET member_count = member_count - 1
    WHERE id = OLD.channel_id;
    RETURN OLD;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_increment_member_count
AFTER INSERT ON public.channel_members
FOR EACH ROW
EXECUTE FUNCTION increment_member_count();

CREATE TRIGGER trg_decrement_member_count
AFTER DELETE ON public.channel_members
FOR EACH ROW
EXECUTE FUNCTION decrement_member_count();


--------------------------------------------
--------------------------------------------
CREATE OR REPLACE FUNCTION prevent_duplicate_channel_member()
RETURNS TRIGGER AS $$
BEGIN
    -- Check if a record already exists with the same channel_id and member_id
    IF EXISTS (
        SELECT 1 FROM public.channel_members
        WHERE channel_id = NEW.channel_id AND member_id = NEW.member_id
    ) THEN
        -- If exists, raise an exception
        RAISE EXCEPTION 'This user is already a member of the channel.';
    END IF;
    -- If not, allow the insertion
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER check_duplicate_member
BEFORE INSERT ON public.channel_members
FOR EACH ROW EXECUTE FUNCTION prevent_duplicate_channel_member();
