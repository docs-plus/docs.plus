-- ========================================
-- Test Script for create_direct_message_channel Function
-- ========================================

-- Start a transaction to encapsulate the test and allow for rollback.
BEGIN;

-- ========================================
-- 1. Setup Test Data
-- ========================================

-- Clear existing test data to avoid conflicts.
DELETE FROM public.channel_members;
DELETE FROM public.channels;
DELETE FROM public.workspaces;
DELETE FROM public.users;
DELETE FROM auth.users;

-- create a system user for system messages
insert into auth.users (id, email)
values ('992bb85e-78f8-4747-981a-fd63d9317ff1', 'system@system.com');


-- ----------------------------------------
-- 1.1 Create Users
-- ----------------------------------------
-- Create users in both auth.users and public.users tables if needed.

-- Insert users into auth.users table.
INSERT INTO auth.users (id, email)
VALUES
    ('29936a8d-8991-4c06-b5ab-ea90e6955a81', 'user1@example.com'),
    ('4f87014b-7f26-4796-a9b0-ac13826fe3ae', 'user2@example.com'),
    ('4c7a7d6e-a7e0-4877-bca1-f964a9500fbf', 'user3@example.com');


-- ----------------------------------------
-- 1.2 Create Workspace
-- ----------------------------------------
INSERT INTO public.workspaces (id, slug, name, created_by, description)
VALUES
    ('fffc89f9-a75f-4894-a168-56b960283490', 'test-workspace', 'Test Workspace', '29936a8d-8991-4c06-b5ab-ea90e6955a81', 'A workspace for testing');

-- ----------------------------------------
-- 1.3 Set Authenticated User
-- ----------------------------------------
-- Simulate user1 as the authenticated user.
SET "app.current_user_id" = '29936a8d-8991-4c06-b5ab-ea90e6955a81';

-- ========================================
-- 2. Test Cases for create_direct_message_channel
-- ========================================

-- ----------------------------------------
-- Test Case 1: Create a new direct message channel between user1 and user2
-- ----------------------------------------


-- Execute the function.
SELECT create_direct_message_channel('fffc89f9-a75f-4894-a168-56b960283490', '4f87014b-7f26-4796-a9b0-ac13826fe3ae') AS new_channel;

-- Expected Outcome:
-- - A new channel is created.
-- - The channel type is 'DIRECT'.
-- - The channel includes both user1 and user2 as members.
-- - The function returns the newly created channel as JSONB.

-- Validation:

-- Check that the channel is created.
SELECT * FROM public.channels WHERE type = 'DIRECT' AND workspace_id = 'fffc89f9-a75f-4894-a168-56b960283490';

-- Check that both users are members of the channel.
SELECT * FROM public.channel_members WHERE channel_id = (SELECT id FROM public.channels WHERE type = 'DIRECT' AND workspace_id = 'fffc89f9-a75f-4894-a168-56b960283490') AND member_id IN ('29936a8d-8991-4c06-b5ab-ea90e6955a81', '4f87014b-7f26-4796-a9b0-ac13826fe3ae');

-- ----------------------------------------
-- Test Case 2: Attempt to create a direct message channel that already exists
-- ----------------------------------------

-- Execute the function again with the same users.
SET "app.current_user_id" = '29936a8d-8991-4c06-b5ab-ea90e6955a81';
SELECT create_direct_message_channel('fffc89f9-a75f-4894-a168-56b960283490', '4f87014b-7f26-4796-a9b0-ac13826fe3ae') AS existing_channel;

-- Expected Outcome:
-- - The function should return the existing channel.
-- - No new channel is created.
-- - The returned channel should be the same as the one created in Test Case 1.

-- Validation:

-- Check that only one direct message channel exists between the two users.
SELECT COUNT(*) FROM public.channels ch
JOIN public.channel_members cm1 ON cm1.channel_id = ch.id AND cm1.member_id = '29936a8d-8991-4c06-b5ab-ea90e6955a81'
JOIN public.channel_members cm2 ON cm2.channel_id = ch.id AND cm2.member_id = '4f87014b-7f26-4796-a9b0-ac13826fe3ae'
WHERE ch.type = 'DIRECT' AND ch.workspace_id = 'fffc89f9-a75f-4894-a168-56b960283490';

-- Expected count: 1

-- ----------------------------------------
-- Test Case 3: Create a direct message channel with a user who does not exist
-- ----------------------------------------

-- Attempt to create a direct message channel with a non-existent user.
DO $$
BEGIN
    PERFORM create_direct_message_channel('fffc89f9-a75f-4894-a168-56b960283490', 'non-existent-user-uuid');
EXCEPTION
    WHEN OTHERS THEN
        RAISE NOTICE 'Expected exception: %', SQLERRM;
END $$;

-- Expected Outcome:
-- - An exception is raised: 'User % does not exist or has been deleted.'

-- ----------------------------------------
-- Test Case 4: Create a direct message channel in a workspace that does not exist
-- ----------------------------------------

-- Attempt to create a direct message channel in a non-existent workspace.
DO $$
BEGIN
    PERFORM create_direct_message_channel('non-existent-fffc89f9-a75f-4894-a168-56b960283490', '4f87014b-7f26-4796-a9b0-ac13826fe3ae');
EXCEPTION
    WHEN OTHERS THEN
        RAISE NOTICE 'Expected exception: %', SQLERRM;
END $$;

-- Expected Outcome:
-- - An exception is raised: 'Workspace % does not exist or has been deleted.'

-- ----------------------------------------
-- Test Case 5: Create a direct message channel with oneself
-- ----------------------------------------

-- Attempt to create a direct message channel with the current user.
SET "app.current_user_id" = '29936a8d-8991-4c06-b5ab-ea90e6955a81';
SELECT create_direct_message_channel('fffc89f9-a75f-4894-a168-56b960283490', '29936a8d-8991-4c06-b5ab-ea90e6955a81') AS self_channel;

-- Expected Outcome:
-- - The function creates a direct message channel with oneself (depending on business logic).
-- - Alternatively, the function raises an exception if creating a channel with oneself is not allowed.

-- Validation:

-- Check if a channel exists where both members are '29936a8d-8991-4c06-b5ab-ea90e6955a81'.
SELECT * FROM public.channels ch
JOIN public.channel_members cm ON cm.channel_id = ch.id AND cm.member_id = '29936a8d-8991-4c06-b5ab-ea90e6955a81'
WHERE ch.type = 'DIRECT' AND ch.workspace_id = 'fffc89f9-a75f-4894-a168-56b960283490';

-- ----------------------------------------
-- Test Case 6: Create multiple direct message channels with different users
-- ----------------------------------------

-- Create a direct message channel with user3.
SET "app.current_user_id" = '29936a8d-8991-4c06-b5ab-ea90e6955a81';
SELECT create_direct_message_channel('fffc89f9-a75f-4894-a168-56b960283490', '4c7a7d6e-a7e0-4877-bca1-f964a9500fbf') AS new_channel_with_user3;

-- Expected Outcome:
-- - A new channel is created between user1 and user3.
-- - The channel includes both user1 and user3 as members.

-- Validation:

-- Check that the channel is created.
-- SET "app.current_user_id" = '29936a8d-8991-4c06-b5ab-ea90e6955a81';
-- SELECT * FROM public.channels WHERE type = 'DIRECT'
--   AND workspace_id = 'fffc89f9-a75f-4894-a168-56b960283490'
--   AND id = (SELECT (new_channel_with_user3->>'id')::uuid FROM (SELECT create_direct_message_channel('fffc89f9-a75f-4894-a168-56b960283490', '4c7a7d6e-a7e0-4877-bca1-f964a9500fbf') AS new_channel_with_user3) sub);

-- ----------------------------------------
-- Test Case 7: Verify that channels are not created between users in different workspaces

-- Create another workspace.
INSERT INTO public.workspaces (id, slug, name, created_by, description)
VALUES
    ('ca81dd59-bb3f-4cb0-86b6-42b8ef1817a9', 'test-workspace-2', 'Test Workspace 2', '29936a8d-8991-4c06-b5ab-ea90e6955a81', 'Another workspace for testing');

-- Attempt to create a direct message channel with user2 in the new workspace.
SET "app.current_user_id" = '29936a8d-8991-4c06-b5ab-ea90e6955a81';
SELECT create_direct_message_channel('ca81dd59-bb3f-4cb0-86b6-42b8ef1817a9', '4f87014b-7f26-4796-a9b0-ac13826fe3ae') AS new_channel_in_workspace2;

-- Expected Outcome:
-- - A new channel is created in 'ca81dd59-bb3f-4cb0-86b6-42b8ef1817a9'.
-- - The channel in 'fffc89f9-a75f-4894-a168-56b960283490' remains unaffected.

-- Validation:

-- Check that the channel exists in the new workspace.
SELECT * FROM public.channels WHERE type = 'DIRECT' AND workspace_id = 'ca81dd59-bb3f-4cb0-86b6-42b8ef1817a9';


-- ========================================
-- 3. Cleanup (Optional)
-- ========================================

-- If you want to undo the test data, uncomment the following line:
-- ROLLBACK;

-- If you want to keep the test data, uncomment the following line:
-- COMMIT;
