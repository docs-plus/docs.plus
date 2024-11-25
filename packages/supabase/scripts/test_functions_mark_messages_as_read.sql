-- ========================================
-- Test Script for mark_messages_as_read Function
-- ========================================

-- Start a transaction to encapsulate the test and allow for rollback.
BEGIN;

-- ========================================
-- 1. Setup Test Data
-- ========================================

-- Clear existing test data to avoid conflicts.
DELETE FROM public.notifications;
DELETE FROM public.messages;
DELETE FROM public.channel_members;
DELETE FROM public.channels;
DELETE FROM public.workspaces;
DELETE FROM auth.users;

-- create a system user for system messages
insert into auth.users (id, email)
values ('992bb85e-78f8-4747-981a-fd63d9317ff1', 'system@system.com');



-- ----------------------------------------
-- 1.1 Create Users
-- ----------------------------------------
INSERT INTO auth.users (id, email)
VALUES
    ('cccdb4c2-b44a-46f7-95f3-d0af248f9da6', 'user1@example.com'), -- , 'user1', 'User One'
    ('47a0cf2b-0a5e-4b8f-8445-64dddcd27ccc', 'user2@example.com'), -- , 'user2', 'User Two'
    ('bb214339-653f-4b0c-b974-954e06fd97b1', 'user3@example.com'); -- , 'user3', 'User Three'

-- ----------------------------------------
-- 1.2 Create Workspace
-- ----------------------------------------
INSERT INTO public.workspaces (id, slug, name, created_by, description)
VALUES
    ('acce5f52-8a94-4e17-bc8e-80c0f59279c3', 'test-workspace', 'Test Workspace', 'cccdb4c2-b44a-46f7-95f3-d0af248f9da6', 'A workspace for testing');

-- ----------------------------------------
-- 1.3 Create Channel
-- ----------------------------------------
INSERT INTO public.channels (id, workspace_id, slug, name, created_by, description, type)
VALUES
    ('4b66fef0-3a80-48bc-b822-fde569b0aa36', 'acce5f52-8a94-4e17-bc8e-80c0f59279c3', 'test-channel', 'Test Channel', 'cccdb4c2-b44a-46f7-95f3-d0af248f9da6', 'A channel for testing', 'PUBLIC');

-- ----------------------------------------
-- 1.4 Add Members to Channel
-- ----------------------------------------
-- Add user1 and user2 to the channel.
INSERT INTO public.channel_members (channel_id, member_id, joined_at, unread_message_count)
VALUES
    -- ('4b66fef0-3a80-48bc-b822-fde569b0aa36', 'cccdb4c2-b44a-46f7-95f3-d0af248f9da6', NOW(), 0),
    -- Note: user1 is the creator of the channel, so we don't need to add them to the channel members.
    ('4b66fef0-3a80-48bc-b822-fde569b0aa36', '47a0cf2b-0a5e-4b8f-8445-64dddcd27ccc', NOW(), 0);

-- ----------------------------------------
-- 1.5 Create Messages in Channel
-- ----------------------------------------
-- Messages sent by user2 to simulate unread messages for user1.
INSERT INTO public.messages (id, content, channel_id, user_id, created_at)
VALUES
    ('cb19931c-ca96-4dc6-9c61-43f6a80323be', 'Message 1 from User Two', '4b66fef0-3a80-48bc-b822-fde569b0aa36', '47a0cf2b-0a5e-4b8f-8445-64dddcd27ccc', NOW() - INTERVAL '10 minutes'),
    ('3c2ee3f0-eb9c-4b11-8dbd-de9fa121183a', 'Message 2 from User Two', '4b66fef0-3a80-48bc-b822-fde569b0aa36', '47a0cf2b-0a5e-4b8f-8445-64dddcd27ccc', NOW() - INTERVAL '5 minutes'),
    ('1a652259-6b95-4059-8de2-28850adaba51', 'Message 3 from User Two', '4b66fef0-3a80-48bc-b822-fde569b0aa36', '47a0cf2b-0a5e-4b8f-8445-64dddcd27ccc', NOW());

-- Update unread_message_count for user1 to reflect unread messages.
UPDATE public.channel_members
SET unread_message_count = 3
WHERE channel_id = '4b66fef0-3a80-48bc-b822-fde569b0aa36' AND member_id = 'cccdb4c2-b44a-46f7-95f3-d0af248f9da6';

-- ----------------------------------------
-- 1.6 Create Notifications for User1
-- ----------------------------------------
-- Notifications for the messages sent by user2.
INSERT INTO public.notifications (id, type, channel_id, message_id, receiver_user_id, created_at)
VALUES
    (uuid_generate_v4(), 'message', '4b66fef0-3a80-48bc-b822-fde569b0aa36', 'cb19931c-ca96-4dc6-9c61-43f6a80323be', 'cccdb4c2-b44a-46f7-95f3-d0af248f9da6', NOW() - INTERVAL '10 minutes'),
    (uuid_generate_v4(), 'message', '4b66fef0-3a80-48bc-b822-fde569b0aa36', '3c2ee3f0-eb9c-4b11-8dbd-de9fa121183a', 'cccdb4c2-b44a-46f7-95f3-d0af248f9da6', NOW() - INTERVAL '5 minutes'),
    (uuid_generate_v4(), 'message', '4b66fef0-3a80-48bc-b822-fde569b0aa36', '1a652259-6b95-4059-8de2-28850adaba51', 'cccdb4c2-b44a-46f7-95f3-d0af248f9da6', NOW());

-- ----------------------------------------
-- 1.7 Set Authenticated User
-- ----------------------------------------
-- Simulate user1 as the authenticated user.
SET LOCAL app.current_user_id = 'cccdb4c2-b44a-46f7-95f3-d0af248f9da6';

-- Note: Adjust the function to replace 'auth.uid()' with 'current_setting('app.current_user_id')::uuid' for testing.

-- ========================================
-- 2. Test Cases for mark_messages_as_read
-- ========================================

-- ----------------------------------------
-- Test Case 1: Mark messages as read up to '3c2ee3f0-eb9c-4b11-8dbd-de9fa121183a'
-- ----------------------------------------

-- Execute the function.
SELECT mark_messages_as_read('4b66fef0-3a80-48bc-b822-fde569b0aa36', '3c2ee3f0-eb9c-4b11-8dbd-de9fa121183a');

-- Expected Outcomes:
-- - Messages 'cb19931c-ca96-4dc6-9c61-43f6a80323be' and '3c2ee3f0-eb9c-4b11-8dbd-de9fa121183a' should have 'readed_at' set.
-- - Message '1a652259-6b95-4059-8de2-28850adaba51' should remain unread.
-- - Notifications for 'cb19931c-ca96-4dc6-9c61-43f6a80323be' and '3c2ee3f0-eb9c-4b11-8dbd-de9fa121183a' should have 'readed_at' set.
-- - Unread message count for user1 should be updated to reflect 1 unread message.
-- - 'last_read_message_id' should be updated to '3c2ee3f0-eb9c-4b11-8dbd-de9fa121183a'.

-- Validation Queries:

-- Check messages' 'readed_at' status.
SELECT id, readed_at FROM public.messages
WHERE id IN ('cb19931c-ca96-4dc6-9c61-43f6a80323be', '3c2ee3f0-eb9c-4b11-8dbd-de9fa121183a', '1a652259-6b95-4059-8de2-28850adaba51');

-- Check notifications' 'readed_at' status.
SELECT message_id, readed_at FROM public.notifications
WHERE receiver_user_id = 'cccdb4c2-b44a-46f7-95f3-d0af248f9da6';

-- Check 'channel_members' for 'last_read_message_id' and 'unread_message_count'.
SELECT last_read_message_id, unread_message_count FROM public.channel_members
WHERE channel_id = '4b66fef0-3a80-48bc-b822-fde569b0aa36' AND member_id = 'cccdb4c2-b44a-46f7-95f3-d0af248f9da6';

-- ----------------------------------------
-- Test Case 2: Mark all messages as read up to the latest message.
-- ----------------------------------------

-- Execute the function for the latest message.
SELECT mark_messages_as_read('4b66fef0-3a80-48bc-b822-fde569b0aa36', '1a652259-6b95-4059-8de2-28850adaba51');

-- Expected Outcomes:
-- - All messages should have 'readed_at' set.
-- - All notifications should have 'readed_at' set.
-- - Unread message count for user1 should be 0.
-- - 'last_read_message_id' should be updated to '1a652259-6b95-4059-8de2-28850adaba51'.

-- Validation Queries:

-- Check messages' 'readed_at' status.
SELECT id, readed_at FROM public.messages
WHERE id IN ('cb19931c-ca96-4dc6-9c61-43f6a80323be', '3c2ee3f0-eb9c-4b11-8dbd-de9fa121183a', '1a652259-6b95-4059-8de2-28850adaba51');

-- Check notifications' 'readed_at' status.
SELECT message_id, readed_at FROM public.notifications
WHERE receiver_user_id = 'cccdb4c2-b44a-46f7-95f3-d0af248f9da6';

-- Check 'channel_members' for 'last_read_message_id' and 'unread_message_count'.
SELECT last_read_message_id, unread_message_count FROM public.channel_members
WHERE channel_id = '4b66fef0-3a80-48bc-b822-fde569b0aa36' AND member_id = 'cccdb4c2-b44a-46f7-95f3-d0af248f9da6';

-- ----------------------------------------
-- Test Case 3: Attempt to mark messages as read with a message that does not exist.
-- ----------------------------------------

-- Attempt to mark messages up to a non-existent message.
DO $$
BEGIN
    PERFORM mark_messages_as_read('4b66fef0-3a80-48bc-b822-fde569b0aa36', 'non-existent-message-uuid');
EXCEPTION
    WHEN OTHERS THEN
        RAISE NOTICE 'Expected exception: %', SQLERRM;
END $$;

-- Expected Outcome:
-- - An exception should be raised: 'Message % does not exist or has been deleted.'

-- ----------------------------------------
-- Test Case 4: User is not a member of the channel.
-- ----------------------------------------

-- Simulate user3 as the authenticated user.
SET LOCAL app.current_user_id = 'bb214339-653f-4b0c-b974-954e06fd97b1';

-- Attempt to mark messages as read.
DO $$
BEGIN
    PERFORM mark_messages_as_read('4b66fef0-3a80-48bc-b822-fde569b0aa36', '1a652259-6b95-4059-8de2-28850adaba51');
EXCEPTION
    WHEN OTHERS THEN
        RAISE NOTICE 'Expected exception: %', SQLERRM;
END $$;

-- Expected Outcome:
-- - An exception should be raised: 'User % is not a member of channel %.'

-- ----------------------------------------
-- Test Case 5: Channel does not exist.
-- ----------------------------------------

-- Attempt to mark messages in a non-existent channel.
DO $$
BEGIN
    PERFORM mark_messages_as_read('non-existent-4b66fef0-3a80-48bc-b822-fde569b0aa36', '1a652259-6b95-4059-8de2-28850adaba51');
EXCEPTION
    WHEN OTHERS THEN
        RAISE NOTICE 'Expected exception: %', SQLERRM;
END $$;

-- Expected Outcome:
-- - An exception should be raised: 'Channel % does not exist or has been deleted.'

-- ----------------------------------------
-- Test Case 6: Messages are already marked as read.
-- ----------------------------------------

-- Set current user back to user1.
SET LOCAL app.current_user_id = 'cccdb4c2-b44a-46f7-95f3-d0af248f9da6';

-- Ensure all messages are already read.
UPDATE public.messages
SET readed_at = NOW()
WHERE channel_id = '4b66fef0-3a80-48bc-b822-fde569b0aa36' AND user_id != 'cccdb4c2-b44a-46f7-95f3-d0af248f9da6';

-- Reset unread_message_count to 0.
UPDATE public.channel_members
SET unread_message_count = 0
WHERE channel_id = '4b66fef0-3a80-48bc-b822-fde569b0aa36' AND member_id = 'cccdb4c2-b44a-46f7-95f3-d0af248f9da6';

-- Attempt to mark messages as read again.
SELECT mark_messages_as_read('4b66fef0-3a80-48bc-b822-fde569b0aa36', '1a652259-6b95-4059-8de2-28850adaba51');

-- Expected Outcome:
-- - Function executes without error.
-- - No changes occur since messages are already read.

-- Validation Queries:

-- Check messages' 'readed_at' timestamps remain the same.
SELECT id, readed_at FROM public.messages
WHERE id IN ('cb19931c-ca96-4dc6-9c61-43f6a80323be', '3c2ee3f0-eb9c-4b11-8dbd-de9fa121183a', '1a652259-6b95-4059-8de2-28850adaba51');

-- Check 'unread_message_count' remains 0.
SELECT unread_message_count FROM public.channel_members
WHERE channel_id = '4b66fef0-3a80-48bc-b822-fde569b0aa36' AND member_id = 'cccdb4c2-b44a-46f7-95f3-d0af248f9da6';

-- ----------------------------------------
-- Test Case 7: Messages sent by the current user should not be marked as read.
-- ----------------------------------------

-- Create new messages from user1 (current user).
INSERT INTO public.messages (id, content, channel_id, user_id, created_at)
VALUES
    ('ce502f60-4138-4d21-9b6a-d238165b2273', 'Message 4 from User One', '4b66fef0-3a80-48bc-b822-fde569b0aa36', 'cccdb4c2-b44a-46f7-95f3-d0af248f9da6', NOW());

-- Update 'unread_message_count' for user1 to simulate an incorrect count.
UPDATE public.channel_members
SET unread_message_count = 1
WHERE channel_id = '4b66fef0-3a80-48bc-b822-fde569b0aa36' AND member_id = 'cccdb4c2-b44a-46f7-95f3-d0af248f9da6';

-- Attempt to mark messages as read up to 'ce502f60-4138-4d21-9b6a-d238165b2273'.
SELECT mark_messages_as_read('4b66fef0-3a80-48bc-b822-fde569b0aa36', 'ce502f60-4138-4d21-9b6a-d238165b2273');

-- Expected Outcomes:
-- - 'ce502f60-4138-4d21-9b6a-d238165b2273' should not be marked as read since it's sent by the current user.
-- - 'unread_message_count' should be corrected to 0.
-- - 'last_read_message_id' should be updated to 'ce502f60-4138-4d21-9b6a-d238165b2273'.

-- Validation Queries:

-- Check 'readed_at' for 'ce502f60-4138-4d21-9b6a-d238165b2273' remains NULL.
SELECT id, readed_at FROM public.messages
WHERE id = 'ce502f60-4138-4d21-9b6a-d238165b2273';

-- Check 'unread_message_count' is 0.
SELECT unread_message_count FROM public.channel_members
WHERE channel_id = '4b66fef0-3a80-48bc-b822-fde569b0aa36' AND member_id = 'cccdb4c2-b44a-46f7-95f3-d0af248f9da6';

-- ----------------------------------------
-- Test Case 8: Messages sent before the target message remain unread.
-- ----------------------------------------

-- Create new messages from user2.
INSERT INTO public.messages (id, content, channel_id, user_id, created_at)
VALUES
    ('b60e4e30-f813-4956-ab21-524804dbdfdc', 'Message 5 from User Two', '4b66fef0-3a80-48bc-b822-fde569b0aa36', '47a0cf2b-0a5e-4b8f-8445-64dddcd27ccc', NOW() + INTERVAL '1 minute'),
    ('f439f7ea-65d4-444f-8854-02aeabd917b4', 'Message 6 from User Two', '4b66fef0-3a80-48bc-b822-fde569b0aa36', '47a0cf2b-0a5e-4b8f-8445-64dddcd27ccc', NOW() + INTERVAL '2 minutes');

-- Update 'unread_message_count' for user1 to 2.
UPDATE public.channel_members
SET unread_message_count = 2
WHERE channel_id = '4b66fef0-3a80-48bc-b822-fde569b0aa36' AND member_id = 'cccdb4c2-b44a-46f7-95f3-d0af248f9da6';

-- Attempt to mark messages as read up to 'b60e4e30-f813-4956-ab21-524804dbdfdc'.
SELECT mark_messages_as_read('4b66fef0-3a80-48bc-b822-fde569b0aa36', 'b60e4e30-f813-4956-ab21-524804dbdfdc');

-- Expected Outcomes:
-- - 'b60e4e30-f813-4956-ab21-524804dbdfdc' should be marked as read.
-- - 'f439f7ea-65d4-444f-8854-02aeabd917b4' should remain unread.
-- - 'unread_message_count' should be updated to 1.
-- - 'last_read_message_id' should be updated to 'b60e4e30-f813-4956-ab21-524804dbdfdc'.

-- Validation Queries:

-- Check 'readed_at' statuses.
SELECT id, readed_at FROM public.messages
WHERE id IN ('b60e4e30-f813-4956-ab21-524804dbdfdc', 'f439f7ea-65d4-444f-8854-02aeabd917b4');

-- Check 'unread_message_count' is 1.
SELECT unread_message_count FROM public.channel_members
WHERE channel_id = '4b66fef0-3a80-48bc-b822-fde569b0aa36' AND member_id = 'cccdb4c2-b44a-46f7-95f3-d0af248f9da6';

-- ----------------------------------------
-- Test Case 9: Soft-deleted messages should not affect the count.
-- ----------------------------------------

-- Soft-delete 'f439f7ea-65d4-444f-8854-02aeabd917b4'.
UPDATE public.messages
SET deleted_at = NOW()
WHERE id = 'f439f7ea-65d4-444f-8854-02aeabd917b4';

-- Update 'unread_message_count' manually to 1 to simulate inconsistency.
UPDATE public.channel_members
SET unread_message_count = 1
WHERE channel_id = '4b66fef0-3a80-48bc-b822-fde569b0aa36' AND member_id = 'cccdb4c2-b44a-46f7-95f3-d0af248f9da6';

-- Attempt to mark messages as read up to 'f439f7ea-65d4-444f-8854-02aeabd917b4'.
SELECT mark_messages_as_read('4b66fef0-3a80-48bc-b822-fde569b0aa36', 'f439f7ea-65d4-444f-8854-02aeabd917b4');

-- Expected Outcomes:
-- - Function should raise an exception since 'f439f7ea-65d4-444f-8854-02aeabd917b4' is deleted.
-- - 'unread_message_count' should remain as is.
-- - Alternatively, if function handles deleted messages gracefully, it should skip the deleted message.

-- Validation Queries:

-- Check if 'unread_message_count' remains 1.
SELECT unread_message_count FROM public.channel_members
WHERE channel_id = '4b66fef0-3a80-48bc-b822-fde569b0aa36' AND member_id = 'cccdb4c2-b44a-46f7-95f3-d0af248f9da6';

-- ----------------------------------------
-- Test Case 10: User marks messages as read in a channel with no unread messages.
-- ----------------------------------------

-- Ensure 'unread_message_count' is 0.
UPDATE public.channel_members
SET unread_message_count = 0
WHERE channel_id = '4b66fef0-3a80-48bc-b822-fde569b0aa36' AND member_id = 'cccdb4c2-b44a-46f7-95f3-d0af248f9da6';

-- Attempt to mark messages as read.
SELECT mark_messages_as_read('4b66fef0-3a80-48bc-b822-fde569b0aa36', 'b60e4e30-f813-4956-ab21-524804dbdfdc');

-- Expected Outcome:
-- - Function executes without error.
-- - No changes occur since there are no unread messages.

-- ========================================
-- 3. Cleanup (Optional)
-- ========================================

-- If you want to undo the test data, uncomment the following line:
-- ROLLBACK;

-- If you want to keep the test data, uncomment the following line:
-- COMMIT;
