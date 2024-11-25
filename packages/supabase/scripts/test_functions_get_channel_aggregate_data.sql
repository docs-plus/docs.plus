-- ========================================
-- Test Script for get_channel_aggregate_data Function
-- ========================================

-- Wrap the entire test in a transaction so it can be rolled back if needed.
BEGIN;

-- ========================================
-- 1. Setup Test Data
-- ========================================

-- Clear existing test data to avoid conflicts.
DELETE FROM public.pinned_messages;
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
-- Create test users with necessary details.
INSERT INTO auth.users (id, email)
VALUES
    ('4b90fc19-8f0c-45bf-8573-a2f273ca3b8e', 'user1@example.com'), -- , 'user1', 'User One'
    ('d902d011-916d-45fc-8d38-6b2fd45710ff', 'user2@example.com'), -- , 'user2', 'User Two'
    ('d2c7563c-0171-4282-b46d-ea39ad5a0980', 'user3@example.com'); -- , 'user3', 'User Three'

-- ----------------------------------------
-- 1.2 Create Workspace
-- ----------------------------------------
INSERT INTO public.workspaces (id, slug, name, created_by, description)
VALUES
    ('6b05c967-24de-4a43-8852-d803c40f997a', 'test-workspace', 'Test Workspace', '4b90fc19-8f0c-45bf-8573-a2f273ca3b8e', 'A workspace for testing');

-- ----------------------------------------
-- 1.3 Create Channels
-- ----------------------------------------
-- Channel 1: Exists, user is a member, has messages, has pinned messages.
INSERT INTO public.channels (id, workspace_id, slug, name, created_by, description, type)
VALUES
    ('7fd8dc87-4222-4fce-a39f-9abd4ad190ee', '6b05c967-24de-4a43-8852-d803c40f997a', 'channel-one', 'Channel One', '4b90fc19-8f0c-45bf-8573-a2f273ca3b8e', 'Test Channel One', 'PUBLIC');

-- Channel 2: Exists, user is not a member.
INSERT INTO public.channels (id, workspace_id, slug, name, created_by, description, type)
VALUES
    ('27dd799b-f4e0-4f73-942b-6dc69f4910ba', '6b05c967-24de-4a43-8852-d803c40f997a', 'channel-two', 'Channel Two', '4b90fc19-8f0c-45bf-8573-a2f273ca3b8e', 'Test Channel Two', 'PUBLIC');

-- Channel 3: Does not exist (we will not create it).

-- Channel 4: Deleted channel.
INSERT INTO public.channels (id, workspace_id, slug, name, created_by, description, type, deleted_at)
VALUES
    ('2e2c31fc-184f-483a-91bb-968c81fa3c32', '6b05c967-24de-4a43-8852-d803c40f997a', 'channel-four', 'Channel Four', '4b90fc19-8f0c-45bf-8573-a2f273ca3b8e', 'Test Channel Four', 'PUBLIC', NOW());

-- ----------------------------------------
-- 1.4 Add Members to Channels
-- ----------------------------------------
-- Add user1 and user2 to Channel 1.
INSERT INTO public.channel_members (channel_id, member_id, joined_at)
VALUES
    -- ('7fd8dc87-4222-4fce-a39f-9abd4ad190ee', '4b90fc19-8f0c-45bf-8573-a2f273ca3b8e', NOW()),
    -- Note: user1 is the creator of the channel, so we don't need to add them to the channel members.
    ('7fd8dc87-4222-4fce-a39f-9abd4ad190ee', 'd902d011-916d-45fc-8d38-6b2fd45710ff', NOW());

-- Do not add any members to Channel 2.

-- ----------------------------------------
-- 1.5 Create Messages in Channel 1
-- ----------------------------------------
-- Message 1: Created by user1.
INSERT INTO public.messages (id, content, channel_id, user_id, created_at)
VALUES
    ('327d118b-df08-4ccd-bf46-c5f2a1aace89', 'Hello from User One', '7fd8dc87-4222-4fce-a39f-9abd4ad190ee', '4b90fc19-8f0c-45bf-8573-a2f273ca3b8e', NOW() - INTERVAL '10 minutes');

-- Message 2: Created by user2.
INSERT INTO public.messages (id, content, channel_id, user_id, created_at)
VALUES
    ('31d31ace-a690-45cc-8ed5-fe8c35068ac8', 'Hello from User Two', '7fd8dc87-4222-4fce-a39f-9abd4ad190ee', 'd902d011-916d-45fc-8d38-6b2fd45710ff', NOW() - INTERVAL '5 minutes');

-- Message 3: Created by user1.
INSERT INTO public.messages (id, content, channel_id, user_id, created_at)
VALUES
    ('952dca89-f952-4e5d-96fd-e474723a8aad', 'Another message from User One', '7fd8dc87-4222-4fce-a39f-9abd4ad190ee', '4b90fc19-8f0c-45bf-8573-a2f273ca3b8e', NOW());

-- ----------------------------------------
-- 1.6 Pin a Message in Channel 1
-- ----------------------------------------
INSERT INTO public.pinned_messages (channel_id, message_id, pinned_by, pinned_at)
VALUES
    ('7fd8dc87-4222-4fce-a39f-9abd4ad190ee', '327d118b-df08-4ccd-bf46-c5f2a1aace89', '4b90fc19-8f0c-45bf-8573-a2f273ca3b8e', NOW());

-- ----------------------------------------
-- 1.7 Set Last Read Message for User1
-- ----------------------------------------
-- Assume user1 has read up to message1.
UPDATE public.channel_members
SET last_read_message_id = '327d118b-df08-4ccd-bf46-c5f2a1aace89', last_read_update_at = NOW() - INTERVAL '9 minutes'
WHERE channel_id = '7fd8dc87-4222-4fce-a39f-9abd4ad190ee' AND member_id = '4b90fc19-8f0c-45bf-8573-a2f273ca3b8e';

-- ----------------------------------------
-- 1.8 Set Authenticated User
-- ----------------------------------------
-- For testing purposes, we need to set the authenticated user.
-- In PostgreSQL, we can set the session authorization.

-- Note: Replace 'auth.uid()' function in your functions with 'current_setting('app.current_user_id')::uuid'
-- For testing, we can set this setting.

-- Set the current user to user1.
SET LOCAL app.current_user_id = '4b90fc19-8f0c-45bf-8573-a2f273ca3b8e';

-- ========================================
-- 2. Test Cases for get_channel_aggregate_data
-- ========================================

-- ----------------------------------------
-- Test Case 1: User is a member of the channel with messages and pinned messages.
-- ----------------------------------------

SELECT * FROM get_channel_aggregate_data('7fd8dc87-4222-4fce-a39f-9abd4ad190ee');

-- Expected Results:
-- - channel_info: JSON containing channel details.
-- - last_messages: JSON array with the last messages (up to message_limit).
-- - pinned_messages: JSON array with pinned messages.
-- - is_user_channel_member: TRUE.
-- - channel_member_info: JSON with membership details.
-- - total_messages_since_last_read: Number of messages since last read (should be 2 for user1).
-- - unread_message: TRUE.
-- - last_read_message_id: '327d118b-df08-4ccd-bf46-c5f2a1aace89'.
-- - last_read_message_timestamp: Timestamp of '327d118b-df08-4ccd-bf46-c5f2a1aace89'.

-- ----------------------------------------
-- Test Case 2: User is not a member of the channel.
-- ----------------------------------------

-- Set current user to user3 (who is not a member of any channel).
SET LOCAL app.current_user_id = 'd2c7563c-0171-4282-b46d-ea39ad5a0980';

SELECT * FROM get_channel_aggregate_data('7fd8dc87-4222-4fce-a39f-9abd4ad190ee');

-- Expected Results:
-- - channel_info: JSON containing channel details.
-- - last_messages: JSON array with the last messages (up to message_limit).
-- - pinned_messages: JSON array with pinned messages.
-- - is_user_channel_member: FALSE.
-- - channel_member_info: NULL.
-- - total_messages_since_last_read: Should be total messages in the channel since user is not a member.
-- - unread_message: TRUE.
-- - last_read_message_id: NULL.
-- - last_read_message_timestamp: NULL.

-- ----------------------------------------
-- Test Case 3: Channel does not exist.
-- ----------------------------------------

-- Attempt to get data for a non-existent channel.
SELECT * FROM get_channel_aggregate_data('51c85d2f-f211-4125-a07e-9c932a6bdc66');

-- Expected Result:
-- - An exception should be raised: 'Channel % does not exist or has been deleted.'

-- ----------------------------------------
-- Test Case 4: Channel is deleted.
-- ----------------------------------------

-- Attempt to get data for a deleted channel.
SELECT * FROM get_channel_aggregate_data('2e2c31fc-184f-483a-91bb-968c81fa3c32');

-- Expected Result:
-- - An exception should be raised: 'Channel % does not exist or has been deleted.'

-- ----------------------------------------
-- Test Case 5: Channel with no messages.
-- ----------------------------------------

-- Create a new channel with no messages.
INSERT INTO public.channels (id, workspace_id, slug, name, created_by, description, type)
VALUES
    ('7754d187-3322-48af-b7fc-271ffc8f35ce', '6b05c967-24de-4a43-8852-d803c40f997a', 'channel-five', 'Channel Five', '4b90fc19-8f0c-45bf-8573-a2f273ca3b8e', 'Empty Channel', 'PUBLIC');

-- Add user1 as a member.
INSERT INTO public.channel_members (channel_id, member_id, joined_at)
VALUES
    ('7754d187-3322-48af-b7fc-271ffc8f35ce', '4b90fc19-8f0c-45bf-8573-a2f273ca3b8e', NOW());

-- Set current user back to user1.
SET LOCAL app.current_user_id = '4b90fc19-8f0c-45bf-8573-a2f273ca3b8e';

SELECT * FROM get_channel_aggregate_data('7754d187-3322-48af-b7fc-271ffc8f35ce');

-- Expected Results:
-- - channel_info: JSON containing channel details.
-- - last_messages: NULL or empty JSON array.
-- - pinned_messages: NULL or empty JSON array.
-- - is_user_channel_member: TRUE.
-- - channel_member_info: JSON with membership details.
-- - total_messages_since_last_read: 0.
-- - unread_message: FALSE.
-- - last_read_message_id: NULL.
-- - last_read_message_timestamp: NULL.

-- ----------------------------------------
-- Test Case 6: User has read all messages.
-- ----------------------------------------

-- Update last_read_message_id to the latest message for user1 in Channel 1.
UPDATE public.channel_members
SET last_read_message_id = '952dca89-f952-4e5d-96fd-e474723a8aad', last_read_update_at = NOW()
WHERE channel_id = '7fd8dc87-4222-4fce-a39f-9abd4ad190ee' AND member_id = '4b90fc19-8f0c-45bf-8573-a2f273ca3b8e';

SELECT * FROM get_channel_aggregate_data('7fd8dc87-4222-4fce-a39f-9abd4ad190ee');

-- Expected Results:
-- - total_messages_since_last_read: 0.
-- - unread_message: FALSE.

-- ----------------------------------------
-- Test Case 7: User has unread messages exceeding message_limit.
-- ----------------------------------------

-- Insert more messages to exceed the default message_limit (20).
DO $$
BEGIN
    FOR i IN 1..25 LOOP
        INSERT INTO public.messages (id, content, channel_id, user_id, created_at)
        VALUES (uuid_generate_v4(), 'Test message ' || i, '7fd8dc87-4222-4fce-a39f-9abd4ad190ee', 'd902d011-916d-45fc-8d38-6b2fd45710ff', NOW() + (i || ' seconds')::interval);
    END LOOP;
END $$;

-- User1's last_read_message_id is still '952dca89-f952-4e5d-96fd-e474723a8aad'.

SELECT * FROM get_channel_aggregate_data('7fd8dc87-4222-4fce-a39f-9abd4ad190ee');

-- Expected Results:
-- - total_messages_since_last_read: Should be greater than or equal to 25.
-- - unread_message: TRUE.
-- - last_messages: Should include all unread messages since last read.

-- ----------------------------------------
-- Test Case 8: Channel has pinned messages that are deleted.
-- ----------------------------------------

-- Soft-delete the pinned message.
UPDATE public.messages
SET deleted_at = NOW()
WHERE id = '327d118b-df08-4ccd-bf46-c5f2a1aace89';

-- Run the function again.
SELECT * FROM get_channel_aggregate_data('7fd8dc87-4222-4fce-a39f-9abd4ad190ee');

-- Expected Results:
-- - pinned_messages: Should not include the deleted message.
-- - last_messages: Should not include the deleted message.
-- - total_messages_since_last_read: Should adjust accordingly.

-- ----------------------------------------
-- Test Case 9: Message replies and user details.
-- ----------------------------------------

-- Create a reply to a message.
INSERT INTO public.messages (id, content, channel_id, user_id, reply_to_message_id, created_at)
VALUES
    ('7ba1f5a5-6f22-4804-8198-e1ea4385531e', 'This is a reply to message2', '7fd8dc87-4222-4fce-a39f-9abd4ad190ee', '4b90fc19-8f0c-45bf-8573-a2f273ca3b8e', '31d31ace-a690-45cc-8ed5-fe8c35068ac8', NOW() + INTERVAL '1 minute');

-- Run the function.
SELECT * FROM get_channel_aggregate_data('7fd8dc87-4222-4fce-a39f-9abd4ad190ee');

-- Expected Results:
-- - last_messages: Should include the reply.
-- - Each message should include 'user_details' with user info.
-- - Replied messages should include 'replied_message_details' with message and user info.

-- ========================================
-- 3. Cleanup (Optional)
-- ========================================

-- If you want to undo the test data, uncomment the following line:
-- ROLLBACK;

-- If you want to keep the test data, uncomment the following line:
-- COMMIT;
