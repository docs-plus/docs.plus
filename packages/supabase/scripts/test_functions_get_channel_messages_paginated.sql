-- ========================================
-- Test Script for get_channel_messages_paginated Function
-- ========================================

-- Start a transaction to encapsulate the test and allow for rollback.
BEGIN;

-- ========================================
-- 1. Setup Test Data
-- ========================================

-- Clear existing test data to avoid conflicts.
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
    ('f2779985-4bc9-4bd2-a953-2da6095bd336', 'user1@example.com'), -- 'user1', 'User One'
    ('6fa3f0df-2ace-4da0-a76f-918119f2c263', 'user2@example.com'), -- 'user2', 'User Two'
    ('655fa447-7eb1-458f-8404-8c47062e43c0', 'user3@example.com'); -- 'user3', 'User Three'

-- ----------------------------------------
-- 1.2 Create Workspace
-- ----------------------------------------
INSERT INTO public.workspaces (id, slug, name, created_by, description)
VALUES
    ('041d0a84-f53f-4a88-a6c8-56ecd7b1aec5', 'test-workspace', 'Test Workspace', 'f2779985-4bc9-4bd2-a953-2da6095bd336', 'A workspace for testing');

-- ----------------------------------------
-- 1.3 Create Channel
-- ----------------------------------------
INSERT INTO public.channels (id, workspace_id, slug, name, created_by, description, type)
VALUES
    ('9aac48b7-c88f-41c3-8cba-1d3a72460034', '041d0a84-f53f-4a88-a6c8-56ecd7b1aec5', 'test-channel', 'Test Channel', 'f2779985-4bc9-4bd2-a953-2da6095bd336', 'A channel for testing', 'PUBLIC');

-- ----------------------------------------
-- 1.4 Add Members to Channel
-- ----------------------------------------
-- Add user1 and user2 to the channel.
INSERT INTO public.channel_members (channel_id, member_id, joined_at)
VALUES
    -- ('9aac48b7-c88f-41c3-8cba-1d3a72460034', 'f2779985-4bc9-4bd2-a953-2da6095bd336', NOW()),
    -- Note: user1 is the creator of the channel, so we don't need to add them to the channel members.
    ('9aac48b7-c88f-41c3-8cba-1d3a72460034', '6fa3f0df-2ace-4da0-a76f-918119f2c263', NOW());

-- ----------------------------------------
-- 1.5 Create Messages in Channel
-- ----------------------------------------
-- Create 50 messages to test pagination.
DO $$
DECLARE
    i INT;
BEGIN
    FOR i IN 1..50 LOOP
        INSERT INTO public.messages (id, content, channel_id, user_id, created_at)
        VALUES (uuid_generate_v4(), 'Message ' || i || ' from User One', '9aac48b7-c88f-41c3-8cba-1d3a72460034', 'f2779985-4bc9-4bd2-a953-2da6095bd336', NOW() - (i || ' minutes')::interval);
    END LOOP;
END $$;

-- ----------------------------------------
-- 1.6 Set Authenticated User
-- ----------------------------------------
-- Simulate user1 as the authenticated user.
SET LOCAL "app.current_user_id" = 'f2779985-4bc9-4bd2-a953-2da6095bd336';

-- ========================================
-- 2. Test Cases for get_channel_messages_paginated
-- ========================================

-- ----------------------------------------
-- Test Case 1: Fetch first page of messages (default page_size)
-- ----------------------------------------

SELECT * FROM get_channel_messages_paginated('9aac48b7-c88f-41c3-8cba-1d3a72460034', 1);

-- Expected Outcome:
-- - Returns the first 20 messages (as page_size defaults to 20).
-- - Messages should be ordered by 'created_at' DESC (newest first).
-- - The messages should include user_details and replied_message_details if applicable.

-- Validation:
-- - Verify that the messages are messages 1 to 20, ordered by 'created_at' DESC.

-- ----------------------------------------
-- Test Case 2: Fetch second page of messages
-- ----------------------------------------

SELECT * FROM get_channel_messages_paginated('9aac48b7-c88f-41c3-8cba-1d3a72460034', 2);

-- Expected Outcome:
-- - Returns messages 21 to 40.
-- - Messages should be ordered by 'created_at' DESC.

-- Validation:
-- - Verify that the messages are messages 21 to 40, ordered by 'created_at' DESC.

-- ----------------------------------------
-- Test Case 3: Fetch third page of messages
-- ----------------------------------------

SELECT * FROM get_channel_messages_paginated('9aac48b7-c88f-41c3-8cba-1d3a72460034', 3);

-- Expected Outcome:
-- - Returns messages 41 to 50.
-- - Messages should be ordered by 'created_at' DESC.

-- Validation:
-- - Verify that the messages are messages 41 to 50, ordered by 'created_at' DESC.

-- ----------------------------------------
-- Test Case 4: Fetch page beyond available messages
-- ----------------------------------------

SELECT * FROM get_channel_messages_paginated('9aac48b7-c88f-41c3-8cba-1d3a72460034', 4);

-- Expected Outcome:
-- - Returns an empty result (no messages).

-- ----------------------------------------
-- Test Case 5: Fetch messages with custom page_size
-- ----------------------------------------

SELECT * FROM get_channel_messages_paginated('9aac48b7-c88f-41c3-8cba-1d3a72460034', 1, 10);

-- Expected Outcome:
-- - Returns the first 10 messages.

-- Validation:
-- - Verify that the messages are messages 1 to 10, ordered by 'created_at' DESC.

-- ----------------------------------------
-- Test Case 6: Invalid page number (zero or negative)
-- ----------------------------------------

-- Attempt to fetch page 0
DO $$
BEGIN
    PERFORM get_channel_messages_paginated('9aac48b7-c88f-41c3-8cba-1d3a72460034', 0);
EXCEPTION
    WHEN OTHERS THEN
        RAISE NOTICE 'Expected exception for page 0: %', SQLERRM;
END $$;

-- Attempt to fetch page -1
DO $$
BEGIN
    PERFORM get_channel_messages_paginated('9aac48b7-c88f-41c3-8cba-1d3a72460034', -1);
EXCEPTION
    WHEN OTHERS THEN
        RAISE NOTICE 'Expected exception for negative page: %', SQLERRM;
END $$;

-- Expected Outcome:
-- - Exceptions should be raised indicating invalid page numbers.

-- ----------------------------------------
-- Test Case 7: Invalid page_size (zero or negative)
-- ----------------------------------------

-- Attempt to fetch with page_size 0
DO $$
BEGIN
    PERFORM get_channel_messages_paginated('9aac48b7-c88f-41c3-8cba-1d3a72460034', 1, 0);
EXCEPTION
    WHEN OTHERS THEN
        RAISE NOTICE 'Expected exception for page_size 0: %', SQLERRM;
END $$;

-- Attempt to fetch with page_size -10
DO $$
BEGIN
    PERFORM get_channel_messages_paginated('9aac48b7-c88f-41c3-8cba-1d3a72460034', 1, -10);
EXCEPTION
    WHEN OTHERS THEN
        RAISE NOTICE 'Expected exception for negative page_size: %', SQLERRM;
END $$;

-- Expected Outcome:
-- - Exceptions should be raised indicating invalid page_size.

-- ----------------------------------------
-- Test Case 8: User is not a member of the channel
-- ----------------------------------------

-- Simulate user3 as the authenticated user (not a member)
SET LOCAL app.current_user_id = '655fa447-7eb1-458f-8404-8c47062e43c0';

SELECT * FROM get_channel_messages_paginated('9aac48b7-c88f-41c3-8cba-1d3a72460034', 1);

-- Expected Outcome:
-- - Function should execute successfully.
-- - Messages should be returned if the channel is public.
-- - If access control is enforced, the function may raise an exception.

-- Note: Depending on your access control logic, you may need to adjust this test.

-- ----------------------------------------
-- Test Case 9: Channel does not exist
-- ----------------------------------------

DO $$
BEGIN
    PERFORM get_channel_messages_paginated('non-existent-9aac48b7-c88f-41c3-8cba-1d3a72460034', 1);
EXCEPTION
    WHEN OTHERS THEN
        RAISE NOTICE 'Expected exception for non-existent channel: %', SQLERRM;
END $$;

-- Expected Outcome:
-- - Exception should be raised: 'Channel % does not exist or has been deleted.'

-- ----------------------------------------
-- Test Case 10: Channel is deleted
-- ----------------------------------------

-- Soft-delete the channel
UPDATE public.channels
SET deleted_at = NOW()
WHERE id = '9aac48b7-c88f-41c3-8cba-1d3a72460034';

-- Attempt to fetch messages
DO $$
BEGIN
    PERFORM get_channel_messages_paginated('9aac48b7-c88f-41c3-8cba-1d3a72460034', 1);
EXCEPTION
    WHEN OTHERS THEN
        RAISE NOTICE 'Expected exception for deleted channel: %', SQLERRM;
END $$;

-- Expected Outcome:
-- - Exception should be raised: 'Channel % does not exist or has been deleted.'

-- Revert channel deletion for further tests
UPDATE public.channels
SET deleted_at = NULL
WHERE id = '9aac48b7-c88f-41c3-8cba-1d3a72460034';

-- ----------------------------------------
-- Test Case 11: Messages are soft-deleted
-- ----------------------------------------

-- Soft-delete some messages
UPDATE public.messages
SET deleted_at = NOW()
WHERE channel_id = '9aac48b7-c88f-41c3-8cba-1d3a72460034' AND content LIKE 'Message 1%';

-- Fetch first page of messages
SELECT * FROM get_channel_messages_paginated('9aac48b7-c88f-41c3-8cba-1d3a72460034', 1);

-- Expected Outcome:
-- - Soft-deleted messages should not be included.
-- - The result should start with messages that are not deleted.

-- Validation:
-- - Verify that messages with content 'Message 1%' are not in the result.

-- ----------------------------------------
-- Test Case 12: Messages with replies and user details
-- ----------------------------------------

-- Create a message with a reply
INSERT INTO public.messages (id, content, channel_id, user_id, created_at)
VALUES ('0daca044-a26f-4495-ad62-23e68878dda2', 'Parent message', '9aac48b7-c88f-41c3-8cba-1d3a72460034', 'f2779985-4bc9-4bd2-a953-2da6095bd336', NOW() - INTERVAL '1 minute');

INSERT INTO public.messages (id, content, channel_id, user_id, reply_to_message_id, created_at)
VALUES ('cd5a2ac2-94a2-43b8-b1de-51af2efbf2ec', 'This is a reply', '9aac48b7-c88f-41c3-8cba-1d3a72460034', '6fa3f0df-2ace-4da0-a76f-918119f2c263', '0daca044-a26f-4495-ad62-23e68878dda2', NOW());

-- Fetch messages
SELECT * FROM get_channel_messages_paginated('9aac48b7-c88f-41c3-8cba-1d3a72460034', 1);

-- Expected Outcome:
-- - The messages should include 'user_details'.
-- - The reply message should include 'replied_message_details'.

-- Validation:
-- - Verify that 'replied_message_details' contains the correct parent message and user info.

-- ----------------------------------------
-- Test Case 13: Pagination with messages less than page_size
-- ----------------------------------------

-- Fetch messages with page_size larger than total messages
SELECT * FROM get_channel_messages_paginated('9aac48b7-c88f-41c3-8cba-1d3a72460034', 1, 100);

-- Expected Outcome:
-- - Returns all available messages up to the total number.

-- ----------------------------------------
-- Test Case 14: Messages from different channels
-- ----------------------------------------

-- Create another channel
INSERT INTO public.channels (id, workspace_id, slug, name, created_by, description, type)
VALUES ('8f2f672d-4bf5-4b12-b13b-dfed65849553', '041d0a84-f53f-4a88-a6c8-56ecd7b1aec5', 'test-channel-2', 'Test Channel 2', 'f2779985-4bc9-4bd2-a953-2da6095bd336', 'Another channel', 'PUBLIC');

-- Add messages to the new channel
INSERT INTO public.messages (id, content, channel_id, user_id, created_at)
VALUES (uuid_generate_v4(), 'Message in Channel 2', '8f2f672d-4bf5-4b12-b13b-dfed65849553', 'f2779985-4bc9-4bd2-a953-2da6095bd336', NOW());

-- Fetch messages for '8f2f672d-4bf5-4b12-b13b-dfed65849553'
SELECT * FROM get_channel_messages_paginated('8f2f672d-4bf5-4b12-b13b-dfed65849553', 1);

-- Expected Outcome:
-- - Only messages from '8f2f672d-4bf5-4b12-b13b-dfed65849553' should be returned.

-- Validation:
-- - Verify that messages from '9aac48b7-c88f-41c3-8cba-1d3a72460034' are not included.

-- ----------------------------------------
-- Test Case 15: Ordering of messages
-- ----------------------------------------

-- Fetch messages and verify the ordering
SELECT * FROM get_channel_messages_paginated('9aac48b7-c88f-41c3-8cba-1d3a72460034', 1);

-- Expected Outcome:
-- - Messages should be ordered by 'created_at' DESC.

-- Validation:
-- - Verify that the first message in the result set is the most recent one.

-- ========================================
-- 3. Cleanup (Optional)
-- ========================================

-- If you want to undo the test data, uncomment the following line:
-- ROLLBACK;

-- If you want to keep the test data, uncomment the following line:
-- COMMIT;
