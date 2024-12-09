-- RLS: Row Level Security
-- RLS is used to restrict access to rows in a table

-- CREATE TYPE public.channel_type AS ENUM
-- (
--     'PUBLIC',     -- PUBLIC: Open for all users. Any user of the application can join and participate.
--     'PRIVATE',    -- PRIVATE: Restricted access. Users can join only by invitation or approval.
--     'BROADCAST',  -- BROADCAST: One-way communication channel where selected users can post, but all users can view.
--     'ARCHIVE',    -- ARCHIVE: Read-only channel for historical/reference purposes. No new messages can be posted.
--     'DIRECT',     -- DIRECT: One-on-one private conversation between two users.
--     'GROUP'       -- GROUP: For a specific set of users, typically used for group discussions or team collaborations.
-- );

-- 1. only admin user can archive channel
-- 2. only admin user can insert pinned message
-- 3. only admin user can delete pinned message
-- 4. only user who is joined in channel can send messages
-- 5. only user who is joined in channel can reply to messages
-- 6. only user who is joined in channel can edit own messages
-- 7. only user who is joined in channel can delete own messages
-- 8. only user who is joined in channel can forward a message to this channel
-- 9. only user who is joined in channel can forward a message to other channel if user is joined in that channel
-- 10. noone can insert, delete, update messages in channel which is archived
-- 11. only admin user can insert, delete, update messages in channel which is broadcast

-- 12. owner of the message just can access to the message metadata
-- 13. owner of the channel can mention to everyone in the channel



-- -- Enable Row Level Security on the users table
-- ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;

-- -- Policy: Allow the user to select their own data.
-- CREATE POLICY "Select_own" ON public.users
-- FOR SELECT
-- USING (auth.uid() = id);

-- -- Policy: Allow the user to update their own data.
-- CREATE POLICY "Update_own" ON public.users
-- FOR UPDATE
-- USING (auth.uid() = id);

-- -- Policy: Allow insertion only if the inserted id matches the current auth.uid(),
-- -- ensuring that users can only create their own row.
-- CREATE POLICY "Insert_self" ON public.users
-- FOR INSERT
-- WITH CHECK (
--   auth.uid() = id
-- );

-- -- Policy: Allow the user to delete only their own record.
-- CREATE POLICY "Delete_own" ON public.users
-- FOR DELETE
-- USING (auth.uid() = id);
