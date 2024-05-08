-- DUMMY DATA

/*
    -----------------------------------------
    1. Create Users
       Expectation: 6 users should be created.
    -----------------------------------------
*/
insert into auth.users (id, email)
values
    ('8d0fd2b3-9ca7-4d9e-a95f-9e13dded323e', 'supabot'),
    ('5f55998b-7958-4ae3-bcb7-539c65c00884', 'jack'),
    ('1059dbd0-3478-46f9-b8a9-dcd23ed0a23a', 'emma'),
    ('dc7d6520-8408-4a8b-b628-78d5f82b8b62', 'jhon'),
    ('c2e3e9e7-d0e8-4960-9b05-d263deb2722f', 'lisa'),
    ('35477c6b-f9a0-4bad-af0b-545c99b33fae', 'philip');

/*
    -----------------------------------------
    2. Create Workspaces
       Expectation: 2 workspaces should be created.
    -----------------------------------------
*/
insert into public.workspaces (id, slug, name, created_by, description)
values
    ('91fd572a-60a3-4baa-9e6a-39e7ae460d9e', 'supabase', 'Supabase', '8d0fd2b3-9ca7-4d9e-a95f-9e13dded323e', 'Supabase workspace'),
    ('5a8703b7-2fd7-45ee-9d6b-5ed3e4330a40', 'supabase-community', 'Supabase Community', '8d0fd2b3-9ca7-4d9e-a95f-9e13dded323e', 'Supabase community workspace');


/*
    -----------------------------------------
    3. Create Channels
       Expectation: 7 channels should be created with descriptions and types.
                    The created_by field should be set to the user who created the channel,
                    and that user should be added as an Admin in the channel_members table.
    -----------------------------------------
*/
insert into public.channels (id, workspace_id, slug, name, created_by, description, type)
values
    ('4b9f0f7e-6cd5-49b6-a8c3-141ef5905959', '91fd572a-60a3-4baa-9e6a-39e7ae460d9e', 'public', 'Public', '8d0fd2b3-9ca7-4d9e-a95f-9e13dded323e', 'General public discussions', 'PUBLIC'), 
    ('27c6745d-cebd-4afd-92b0-3b9b9312381b', '91fd572a-60a3-4baa-9e6a-39e7ae460d9e', 'random', 'Random', '8d0fd2b3-9ca7-4d9e-a95f-9e13dded323e', 'Random thoughts and ideas', 'PUBLIC'), 
    ('7ea75977-9bc0-4008-b5b8-13c56d16a588', '91fd572a-60a3-4baa-9e6a-39e7ae460d9e', 'game-boy', 'GameBoy', '35477c6b-f9a0-4bad-af0b-545c99b33fae', 'Game boy, win game awards, etc.', 'BROADCAST'),
    ('4d582754-4d72-48f8-9e72-f6aa63dacada', '91fd572a-60a3-4baa-9e6a-39e7ae460d9e', 'netfilix', 'Netfilix', '35477c6b-f9a0-4bad-af0b-545c99b33fae', 'Let’s talk about Netflix series', 'PRIVATE'),
    ('70ceab8b-2cf6-4004-8561-219de9b11ec2', '91fd572a-60a3-4baa-9e6a-39e7ae460d9e', 'movie-night', 'Movie Night', '1059dbd0-3478-46f9-b8a9-dcd23ed0a23a', 'Movie suggestions and discussions', 'DIRECT'),
    ('dc6a0f60-5260-456b-a5c7-b799cece8807', '91fd572a-60a3-4baa-9e6a-39e7ae460d9e', 'openai', 'OpenAI', 'dc7d6520-8408-4a8b-b628-78d5f82b8b62', 'What’s happening with OpenAI?', 'BROADCAST'),
    ('1292efc2-0cdc-470c-9364-ba76f19ce75d', '91fd572a-60a3-4baa-9e6a-39e7ae460d9e', 'tech-talk', 'Tech Yalk', 'c2e3e9e7-d0e8-4960-9b05-d263deb2722f', 'Discussions about the latest in tech', 'GROUP');

-- Mapping of channels with types and the user who created them.
-- public       -> PUBLIC       -> supabot
-- random       -> PUBLIC       -> supabot
-- game-boy     -> BROADCAST    -> philip
-- netfilix     -> PRIVATE      -> philip
-- movie-night  -> DIRECT       -> emma
-- openai       -> BROADCAST    -> jhon
-- tech-talk    -> GROUP        -> lisa

/* 
    -----------------------------------------
    3. Join Users to Channels
       Expectation: Users should be joined to channels as members.
    -----------------------------------------
*/
insert into public.channel_members (channel_id, member_id)
values

    -- Owner and Admin -> philip
    ('7ea75977-9bc0-4008-b5b8-13c56d16a588', '5f55998b-7958-4ae3-bcb7-539c65c00884'), -- game-boy   ==join==>   jack
    ('7ea75977-9bc0-4008-b5b8-13c56d16a588', '1059dbd0-3478-46f9-b8a9-dcd23ed0a23a'), -- game-boy   ==join==>   emma
    
    -- Owner and Admin -> philip
    ('4d582754-4d72-48f8-9e72-f6aa63dacada', 'c2e3e9e7-d0e8-4960-9b05-d263deb2722f'), -- netfilix   ==join==>   lisa
    ('4d582754-4d72-48f8-9e72-f6aa63dacada', '1059dbd0-3478-46f9-b8a9-dcd23ed0a23a'), -- netfilix   ==join==>   emma

    -- Owner and Admin -> emma
    ('70ceab8b-2cf6-4004-8561-219de9b11ec2', 'c2e3e9e7-d0e8-4960-9b05-d263deb2722f'), -- movie-night   ==join==>   lisa

    -- Owner and Admin -> lisa
    ('1292efc2-0cdc-470c-9364-ba76f19ce75d', '5f55998b-7958-4ae3-bcb7-539c65c00884'), -- tech-talk  ==join==>   jack
    ('1292efc2-0cdc-470c-9364-ba76f19ce75d', '1059dbd0-3478-46f9-b8a9-dcd23ed0a23a'), -- tech-talk  ==join==>   emma
    ('1292efc2-0cdc-470c-9364-ba76f19ce75d', 'dc7d6520-8408-4a8b-b628-78d5f82b8b62'), -- tech-talk  ==join==>   jhon
    ('1292efc2-0cdc-470c-9364-ba76f19ce75d', '35477c6b-f9a0-4bad-af0b-545c99b33fae'), -- tech-talk  ==join==>   philip

    -- Owner and Admin -> john
    ('dc6a0f60-5260-456b-a5c7-b799cece8807', '35477c6b-f9a0-4bad-af0b-545c99b33fae'), -- openai     ==join==>   philip
    ('dc6a0f60-5260-456b-a5c7-b799cece8807', '5f55998b-7958-4ae3-bcb7-539c65c00884'); -- openai     ==join==>   jack

/* 
    -----------------------------------------
    4. Create Random Messages
       Expectations: 
           - Five messages should be created.
           - Channel's last message preview must be updated.
           - Messages longer than 70 characters should be truncated.
           - Update unread message counts and previews for each channel.
           - Ensure the total number of notifications equals the number of unread messages.
    -----------------------------------------
*/

insert into public.messages (id, content, channel_id, user_id)
values
    (
    '84fd39d1-4467-4181-b07d-b4e9573bc8f9', 
    'Hello World 👋',
    '4b9f0f7e-6cd5-49b6-a8c3-141ef5905959', '8d0fd2b3-9ca7-4d9e-a95f-9e13dded323e' -- public -- supabot
    ),
    (
    '0363b237-8a72-462c-91b5-f5ee40958cf5', 
    'Perfection is attained, not when there is nothing more to add, but when there is nothing left to take away.', 
    '27c6745d-cebd-4afd-92b0-3b9b9312381b',  '8d0fd2b3-9ca7-4d9e-a95f-9e13dded323e' -- random -- supabot
    ),
    (
    '5de80678-2e4b-4850-ae0e-4e71afaf61bb',
    'hey, whats up, what do we have for this weekend?', 
    '4d582754-4d72-48f8-9e72-f6aa63dacada', 'c2e3e9e7-d0e8-4960-9b05-d263deb2722f'  -- netfilix -- lisa
    ),
    (
    '46e33eff-3a56-4619-bb7c-07e3e96af041',
    'whats up?',
    '4d582754-4d72-48f8-9e72-f6aa63dacada', 'c2e3e9e7-d0e8-4960-9b05-d263deb2722f' -- netfilix -- lisa
    ),
    (
    '7e84eca7-cf38-4eee-8127-847e78727ea5',
    'We have new event, follow up in this link...',
    '7ea75977-9bc0-4008-b5b8-13c56d16a588',  '35477c6b-f9a0-4bad-af0b-545c99b33fae' -- game-boy -- philip
    );



/*
    -----------------------------------------
    5. Pin Messages
       Expectation: A new pinned message for the game-boy channel should be created by Philip.
    -----------------------------------------
*/

-- step 1: create a message
INSERT INTO public.messages (id, content, channel_id, user_id)
values
(
    'b35dc5bc-ac7f-4fbe-a039-7822034e9dca',
    'New Events coming soon!',
    '7ea75977-9bc0-4008-b5b8-13c56d16a588',  '35477c6b-f9a0-4bad-af0b-545c99b33fae' -- game-boy -- philip

);

-- step 2: pin the message
insert into public.pinned_messages (channel_id, message_id, pinned_by)
values
    ('7ea75977-9bc0-4008-b5b8-13c56d16a588', 'b35dc5bc-ac7f-4fbe-a039-7822034e9dca', '35477c6b-f9a0-4bad-af0b-545c99b33fae');

/*
    -----------------------------------------
    6. Emoji Reactions to Messages
       Expectation: Two reactions should be added to the message.
    -----------------------------------------
*/
-- step 1: create a message
INSERT INTO public.messages (id, content, channel_id, user_id)
VALUES (
    'f8d2002b-01ff-4c4a-9375-92c24e942950',
    'Exciting news about upcoming features!', 
    '4d582754-4d72-48f8-9e72-f6aa63dacada',  -- netfilix
    '1059dbd0-3478-46f9-b8a9-dcd23ed0a23a' -- emma
);

-- step 2: add a reaction to the message - lisa reaction
UPDATE public.messages
SET reactions = jsonb_set(
    COALESCE(reactions, '{}'), 
    '{😄}', 
    COALESCE(reactions->'😄', '[]') || jsonb_build_array(jsonb_build_object('user_id', 'c2e3e9e7-d0e8-4960-9b05-d263deb2722f', 'created_at', current_timestamp)),
    true
)
WHERE id = 'f8d2002b-01ff-4c4a-9375-92c24e942950';

-- step 3: add another reaction to the message - philip racation
UPDATE public.messages
SET reactions = jsonb_set(
    COALESCE(reactions, '{}'), 
    '{👍}', 
    COALESCE(reactions->'👍', '[]') || jsonb_build_array(jsonb_build_object('user_id', '35477c6b-f9a0-4bad-af0b-545c99b33fae', 'created_at', current_timestamp)),
    true
)
WHERE id = 'f8d2002b-01ff-4c4a-9375-92c24e942950';

/*
    -----------------------------------------
    7. Reply to Messages
       Expectation: 
            1. Two messages should be attached to the first message (ID '1a3485e7-48eb-4fd1-afe1-3bb5506e4fe1') as replies.
            2. Notifications should be created for the replies:
                a. A 'reply' type notification should be sent to the user with ID '1059dbd0-3478-46f9-b8a9-dcd23ed0a23a' (emma), as she is the owner of the original message.
                b. 'message' type notifications should be sent to all other members of the channel '4d582754-4d72-48f8-9e72-f6aa63dacada' (netfilix), excluding the senders of the replies (lisa and philip) and any members who have muted notifications.
            3. The metadata of the first message should be updated to reflect these replies.
    -----------------------------------------
*/

-- step 1: create a message
INSERT INTO public.messages (id, content, channel_id, user_id )
VALUES 
(   
    '1a3485e7-48eb-4fd1-afe1-3bb5506e4fe1', -- ID
    'Whos excited for the new Netflix series?', -- Content
    '4d582754-4d72-48f8-9e72-f6aa63dacada', -- Channel: netfilix
    '1059dbd0-3478-46f9-b8a9-dcd23ed0a23a' -- User: emma
);

-- step 2: reply to the message
INSERT INTO public.messages (channel_id, user_id, content, reply_to_message_id)
VALUES 
(
    '4d582754-4d72-48f8-9e72-f6aa63dacada', -- Channel: netfilix
    'c2e3e9e7-d0e8-4960-9b05-d263deb2722f', -- User: lisa
    'I am! Cant wait to watch it.', -- Content
    '1a3485e7-48eb-4fd1-afe1-3bb5506e4fe1' -- original message id
),
(
    '4d582754-4d72-48f8-9e72-f6aa63dacada', -- Channel: netfilix
    '35477c6b-f9a0-4bad-af0b-545c99b33fae', -- User: philip
    'Do you know when its releasing?', -- Content
    '1a3485e7-48eb-4fd1-afe1-3bb5506e4fe1' -- original message id
);


/*
    -----------------------------------------
    8. Forward Messages
       Expectation: ---
    -----------------------------------------
*/

-- step 1: create a message
INSERT INTO public.messages (id, content, channel_id, user_id )
values
(
    '0486ed3d-8e48-49ed-b8af-2387909f642f', -- ID
    'Exciting news about upcoming features!', -- Content
    '4d582754-4d72-48f8-9e72-f6aa63dacada', -- Channel: netfilix
    '35477c6b-f9a0-4bad-af0b-545c99b33fae' -- User: Philip
);

-- step 2: emma react to the message
UPDATE public.messages
SET reactions = jsonb_set(
    COALESCE(reactions, '{}'), 
    '{👍}', 
    COALESCE(reactions->'👍', '[]') || jsonb_build_array(jsonb_build_object('user_id', '1059dbd0-3478-46f9-b8a9-dcd23ed0a23a', 'created_at', current_timestamp)),
    true
)
WHERE id = '0486ed3d-8e48-49ed-b8af-2387909f642f';

-- step 3: add a custom metadata to the message
UPDATE public.messages
SET metadata = jsonb_set(
    COALESCE(metadata, '{}'), 
    '{is_important}', 
    'true',
    true
)
WHERE id = '0486ed3d-8e48-49ed-b8af-2387909f642f';

-- step 5: reply to the message
INSERT INTO public.messages (channel_id, user_id, content, reply_to_message_id)
VALUES(
    '4d582754-4d72-48f8-9e72-f6aa63dacada', -- Channel: netfilix
    'c2e3e9e7-d0e8-4960-9b05-d263deb2722f', -- User: lisa
    'I am! Cant wait to watch it.', -- Content
    '0486ed3d-8e48-49ed-b8af-2387909f642f' -- original message id
);

-- step 6: forward the message in to two channels
INSERT INTO public.messages (id, channel_id, user_id, origin_message_id)
values
(   
    'b9a33e13-3fd0-43f7-b46e-1291253587ad', -- ID
    'dc6a0f60-5260-456b-a5c7-b799cece8807', -- Channel: openai
    '35477c6b-f9a0-4bad-af0b-545c99b33fae', -- User: philip
    '0486ed3d-8e48-49ed-b8af-2387909f642f' -- original message id
),
(
    'bb27aacc-e31a-4664-9606-103972702dd5', -- ID
    '1292efc2-0cdc-470c-9364-ba76f19ce75d', -- Channel: tech-talk
    '1059dbd0-3478-46f9-b8a9-dcd23ed0a23a', -- User: emma
    '0486ed3d-8e48-49ed-b8af-2387909f642f' -- original message id
);

-- step 7: forward the forwarded message
INSERT INTO public.messages (id, channel_id, user_id, origin_message_id)
values
(
    '4701aef9-cfcc-45e2-80ec-e0f3ffdc25dc', -- ID
    '70ceab8b-2cf6-4004-8561-219de9b11ec2', -- Channel: movie-night
    '1059dbd0-3478-46f9-b8a9-dcd23ed0a23a', -- User: Emma
    'b9a33e13-3fd0-43f7-b46e-1291253587ad' -- original message id
);

-- step 8: lisa react to the forwarded message
UPDATE public.messages
SET reactions = jsonb_set(
    COALESCE(reactions, '{}'), 
    '{😼}', 
    COALESCE(reactions->'😼', '[]') || jsonb_build_array(jsonb_build_object('user_id', 'c2e3e9e7-d0e8-4960-9b05-d263deb2722f', 'created_at', current_timestamp)),
    true
)
WHERE id = '4701aef9-cfcc-45e2-80ec-e0f3ffdc25dc';

-- step 9: add a custom metadata to the forwarded message
UPDATE public.messages
SET metadata = jsonb_set(
    COALESCE(metadata, '{}'), 
    '{is_important}', 
    'true',
    true
)
WHERE id = '4701aef9-cfcc-45e2-80ec-e0f3ffdc25dc';


-- step 10: reply to the forwarded message
INSERT INTO public.messages (channel_id, user_id, content, reply_to_message_id)
VALUES(
    '70ceab8b-2cf6-4004-8561-219de9b11ec2', -- Channel: movie-night
    'c2e3e9e7-d0e8-4960-9b05-d263deb2722f', -- User: Lisa
    'I am! Cant wait to watch it.', -- Content
    '4701aef9-cfcc-45e2-80ec-e0f3ffdc25dc' -- original message id
);

/*
    -----------------------------------------
    9. Mention @user in Messages
       Expectation: Jack should receive a mention notification from Philip in the game-boy channel.
    -----------------------------------------
*/

insert into public.messages (id, content, channel_id, user_id)
values
(
    '61db563c-a4fa-4ec1-bff5-543e620c9ec2', -- ID
    'Hey, @jack would you please call me?',
    '7ea75977-9bc0-4008-b5b8-13c56d16a588', -- chanel: game-boy
    '35477c6b-f9a0-4bad-af0b-545c99b33fae' -- user: philip
);

/*
    -----------------------------------------
    9. Mention multiple @user in Messages
       Expectation: Jack and Emma should receive a mention notifications from Philip in the game.
                    and also they must receive a message notification from Philip.
    -----------------------------------------
*/

insert into public.messages (id, content, channel_id, user_id)
values
(
    'd329a926-fd5a-400f-880f-e3678eee5758', -- ID
    'Hey, @jack would you please call me? @emma and I need your help.',
    '7ea75977-9bc0-4008-b5b8-13c56d16a588', -- chanel: game-boy
    '35477c6b-f9a0-4bad-af0b-545c99b33fae' -- user: philip
);


/*
    -----------------------------------------
    10. Mention @everyone in Messages
       Expectation: Philip and Jack should receive notifications from John in the openai channel.
    -----------------------------------------
*/
insert into public.messages (id, content, channel_id, user_id)
values
(
    '447d5510-741c-4aca-bd54-6f8344da89ea', -- ID
    'Hey, @everyone, lets talk about the last season of Stranger Things! I just finished watching it and I have a lot of thoughts.',
    'dc6a0f60-5260-456b-a5c7-b799cece8807', -- chanel: openai
    '5f55998b-7958-4ae3-bcb7-539c65c00884' -- user: jack
);


/*
    -----------------------------------------
    11. Update Message Content
       Expectation: All message previews, from reply to forwarded messages, channel message previews, and notification message previews should be updated.
    -----------------------------------------
*/


-- step 1: create a message
INSERT INTO public.messages (id, content, channel_id, user_id)
VALUES
(
    '5716352d-9380-49aa-9509-71e06f8b3d23', -- ID
    'Exciting news about upcoming features!', -- Content
    '4d582754-4d72-48f8-9e72-f6aa63dacada', -- Channel: netfilix
    '35477c6b-f9a0-4bad-af0b-545c99b33fae' -- User: Philip
);

-- step 2: reply to the message
INSERT INTO public.messages (channel_id, user_id, content, reply_to_message_id)
values
(
    '4d582754-4d72-48f8-9e72-f6aa63dacada', -- Channel: netfilix
    '5f55998b-7958-4ae3-bcb7-539c65c00884', -- User: Jack
    'YUP! Lets talk about it!', -- Content
    '5716352d-9380-49aa-9509-71e06f8b3d23' -- original message id
);

-- step 3: forward the message
INSERT INTO public.messages (id, channel_id, user_id, origin_message_id)
values
(
    'd00a10a3-e476-4067-8a66-689d3cc4b0f5', -- ID
    'dc6a0f60-5260-456b-a5c7-b799cece8807', -- Channel: openai
    'dc7d6520-8408-4a8b-b628-78d5f82b8b62', -- User: Jhon
    '5716352d-9380-49aa-9509-71e06f8b3d23' -- original message id
),
(
    'de4eda37-f6a1-4ffa-ab2a-089025d2f0f9', -- ID
    '1292efc2-0cdc-470c-9364-ba76f19ce75d', -- Channel: tech-talk
    'c2e3e9e7-d0e8-4960-9b05-d263deb2722f', -- User: Lisa
    '5716352d-9380-49aa-9509-71e06f8b3d23' -- original message id
);

-- step 4: update the message
UPDATE public.messages
SET content = 'Exciting news about upcoming features! I am so excited to share this with you all. Stay tuned for more updates!'
WHERE id = '5716352d-9380-49aa-9509-71e06f8b3d23';



/*
    -----------------------------------------
    12. Soft Delete a Message
       Expectation: 
       This scenario tests the soft deletion of a message within the application, focusing on the comprehensive effects of such an action.
       Specifically, it examines the following outcomes:
       1. The targeted message should be soft-deleted, indicated by the 'deleted_at' timestamp being set.
       2. Any pinned instance of the soft-deleted message should be automatically removed from the 'public.pinned_messages' table.
       3. Replies and forwardings of the soft-deleted message should remain intact but should reflect the deletion status in any associated previews or metadata.
       4. The 'unread_message_count' in 'public.channel_members' should be decremented for members who have not read the message, ensuring accurate read status tracking.
       5. replied in the metadata must be recalculate
    -----------------------------------------
*/

-- step 1: create two messages
INSERT INTO public.messages (id, content, channel_id, user_id)
VALUES
(
    '2ed171d6-7247-46b2-8f6f-7703cf2634bf', -- ID
    'Exciting news about upcoming features!', -- Content
    '4d582754-4d72-48f8-9e72-f6aa63dacada', -- Channel: netfilix
    '35477c6b-f9a0-4bad-af0b-545c99b33fae' -- User: Philip
),
(
    'de4b69f5-a304-4afa-80cc-89882d612d20', -- ID
    'Hows ready for releas news!?', -- Content
    '4d582754-4d72-48f8-9e72-f6aa63dacada', -- Channel: netfilix
    '35477c6b-f9a0-4bad-af0b-545c99b33fae' -- User: Philip
);

-- step 2: pinning the message
-- expect: adfter soft delete the pinned message must delete
INSERT INTO public.pinned_messages (channel_id, message_id, pinned_by)
values
(
    '4d582754-4d72-48f8-9e72-f6aa63dacada', -- Channel: netfilix
    'de4b69f5-a304-4afa-80cc-89882d612d20', -- Message: Exciting news about upcoming features!
    '35477c6b-f9a0-4bad-af0b-545c99b33fae' -- User: Philip
);


-- step 3: reply to the message
INSERT INTO public.messages (channel_id, user_id, content, reply_to_message_id)
values
(
    '4d582754-4d72-48f8-9e72-f6aa63dacada', -- Channel: netfilix
    'c2e3e9e7-d0e8-4960-9b05-d263deb2722f', -- User: lisa
    'YUP! Lets talk about it!', -- Content
    'de4b69f5-a304-4afa-80cc-89882d612d20' -- original message id
);


-- step 4: forward the message
INSERT INTO public.messages (id, channel_id, user_id, origin_message_id)
values
(
    '97ebede7-9107-4636-8060-45b08db6ce6a', -- ID
    'dc6a0f60-5260-456b-a5c7-b799cece8807', -- Channel: openai
    'dc7d6520-8408-4a8b-b628-78d5f82b8b62', -- User: Jhon
    'de4b69f5-a304-4afa-80cc-89882d612d20' -- original message id
),
(
    'add87e8b-9e15-478c-8bb5-e7f074c9568c', -- ID
    '1292efc2-0cdc-470c-9364-ba76f19ce75d', -- Channel: tech-talk
    'c2e3e9e7-d0e8-4960-9b05-d263deb2722f', -- User: Lisa
    'de4b69f5-a304-4afa-80cc-89882d612d20' -- original message id
);

-- step 5: soft delete the message
UPDATE public.messages
SET deleted_at = now()
WHERE id = 'de4b69f5-a304-4afa-80cc-89882d612d20';


-- Expected queries to validate the test case:
-- 1. Verify the soft deletion of the message.
-- SELECT * FROM public.messages WHERE id = 'de4b69f5-a304-4afa-80cc-89882d612d20';

-- 2. Confirm removal of the message from pinned messages.
-- SELECT * FROM public.pinned_messages WHERE message_id = 'de4b69f5-a304-4afa-80cc-89882d612d20';

-- 3. Check the status of replies and forwards related to the soft-deleted message.
-- SELECT * FROM public.messages WHERE reply_to_message_id = 'de4b69f5-a304-4afa-80cc-89882d612d20'
--    OR origin_message_id = 'de4b69f5-a304-4afa-80cc-89882d612d20';

-- 4. Validate the updated unread_message_count for channel members.
-- SELECT * FROM public.channel_members WHERE channel_id = '4d582754-4d72-48f8-9e72-f6aa63dacada';


/*
    -----------------------------------------
    13. update the messgae content
        Expectation: 
            1. The message content should be updated.
            2. The message preview should be updated.
            3. The edited_at timestamp should be updated.
    -----------------------------------------
*/

-- step 1: create a message
INSERT INTO public.messages (id, content, channel_id, user_id)
VALUES
(
    '4b858af7-fceb-4f94-a8fb-b0af4c2a3cde', -- ID
    'Exciting news about upcoming features!', -- Content
    '4d582754-4d72-48f8-9e72-f6aa63dacada', -- Channel: netfilix
    '35477c6b-f9a0-4bad-af0b-545c99b33fae' -- User: Philip
);

-- step 2: update the content of the message
UPDATE public.messages
SET content = 'Exciting news about upcoming features! I am so excited to share this with you all. Stay tuned for more updates!'
WHERE id = '4b858af7-fceb-4f94-a8fb-b0af4c2a3cde';



/*
    -----------------------------------------
    14. thread a message
        Expectation: 
            1. The message should be threaded.
            2. The message preview in channel should not be update.
            3. --
    -----------------------------------------
*/

-- step 1: create a message
INSERT INTO public.messages (id, content, channel_id, user_id)
VALUES
(
    '5fb62876-c099-4284-8295-f3e898ad88e0', -- ID
    'Has anyone heard about the new Netflix series?', -- Content
    '4d582754-4d72-48f8-9e72-f6aa63dacada', -- Channel: netfilix
    '35477c6b-f9a0-4bad-af0b-545c99b33fae' -- User: Philip
);


-- step 2: reply to the message
INSERT INTO public.messages (id, channel_id, user_id, content, reply_to_message_id)
values
(   
    'd9ad17c9-6431-47ee-8ef7-09d7a1abb68c', -- ID
    '4d582754-4d72-48f8-9e72-f6aa63dacada', -- Channel: netfilix
    'c2e3e9e7-d0e8-4960-9b05-d263deb2722f', -- User: lisa
    'Please do not spoil it!', -- Content
    '5fb62876-c099-4284-8295-f3e898ad88e0' -- original message id
);

-- step 3: open a thread (update the first message), we will update the is_threaded_root to true with trigger
UPDATE public.messages
SET 
    thread_id = '5fb62876-c099-4284-8295-f3e898ad88e0',
    thread_owner_id = 'c2e3e9e7-d0e8-4960-9b05-d263deb2722f'
WHERE id = '5fb62876-c099-4284-8295-f3e898ad88e0';


-- step 4: message to the thread
INSERT INTO public.messages (id, channel_id, user_id, content, thread_id)
values
(
    '5f1ae43c-4cd5-4d97-bad8-2e9607ade415', -- ID
    '4d582754-4d72-48f8-9e72-f6aa63dacada', -- Channel: netfilix
    '1059dbd0-3478-46f9-b8a9-dcd23ed0a23a', -- User: emma
    'I have not heard about it yet.', -- Content
    '5fb62876-c099-4284-8295-f3e898ad88e0' -- thread id
);

-- step 5: message to the thread
INSERT INTO public.messages (id, channel_id, user_id, content, thread_id)
values
(
    '94f6903b-b13d-4b37-b757-c4dab8c05b07', -- ID
    '4d582754-4d72-48f8-9e72-f6aa63dacada', -- Channel: netfilix
    'c2e3e9e7-d0e8-4960-9b05-d263deb2722f', -- User: lisa
    'New franchise for Stranger Things?', -- Content
    '5fb62876-c099-4284-8295-f3e898ad88e0' -- thread id
);

-- step 6: reply to the lisa message
INSERT INTO public.messages (id, channel_id, user_id, content, thread_id, reply_to_message_id)
values
(
    'f5ac64c5-7b1f-486c-8cb6-f7c18e2569ba', -- ID
    '4d582754-4d72-48f8-9e72-f6aa63dacada', -- Channel: netfilix
    '35477c6b-f9a0-4bad-af0b-545c99b33fae', -- User: philip
    'Yes! Thats a new thing! But we have a new surprise. I heard from the bosss call that they are going to create a new franchise from ''The Boys'' series!', -- Content
    '5fb62876-c099-4284-8295-f3e898ad88e0', -- thread id
    '94f6903b-b13d-4b37-b757-c4dab8c05b07' -- original message id
);

-- step 7: reaction to the thread message, emma
UPDATE public.messages
SET reactions = jsonb_set(
    COALESCE(reactions, '{}'), 
    '{👍}', 
    COALESCE(reactions->'👍', '[]') || jsonb_build_array(jsonb_build_object('user_id', '1059dbd0-3478-46f9-b8a9-dcd23ed0a23a', 'created_at', current_timestamp)),
    true
)
WHERE id = '5fb62876-c099-4284-8295-f3e898ad88e0';


/*
    -----------------------------------------
    15. seed netflix channel with messages
    -----------------------------------------
*/

INSERT INTO public.messages (content, channel_id, user_id)
VALUES
(
    'Hey! Have you started watching ''The Midnight Chronicles'' on Netflix? It''s the new talk of the town!', -- Content
    '4d582754-4d72-48f8-9e72-f6aa63dacada', -- Channel: netflix
    '35477c6b-f9a0-4bad-af0b-545c99b33fae' -- User: Philip
),
(
    'Just started yesterday. It''s intriguing! The way they blend mystery and sci-fi is mind-blowing.', -- Content
    '4d582754-4d72-48f8-9e72-f6aa63dacada', -- Channel: netflix
    '1059dbd0-3478-46f9-b8a9-dcd23ed0a23a' -- User: Emma
),
(
    'Totally agree. Episode 3''s twist was unexpected. Did you see that coming?', -- Content
    '4d582754-4d72-48f8-9e72-f6aa63dacada', -- Channel: netflix
    '35477c6b-f9a0-4bad-af0b-545c99b33fae' -- User: Philip
),
(
    'No way! I was completely shocked. Also, the cinematography is stunning, don''t you think?', -- Content
    '4d582754-4d72-48f8-9e72-f6aa63dacada', -- Channel: netflix
    '1059dbd0-3478-46f9-b8a9-dcd23ed0a23a' -- User: Emma
),
(
    'Absolutely, the visuals are a feast for the eyes. And the soundtrack complements it so well.', -- Content
    '4d582754-4d72-48f8-9e72-f6aa63dacada', -- Channel: netflix
    '35477c6b-f9a0-4bad-af0b-545c99b33fae' -- User: Philip
),
(
    'Speaking of soundtrack, did you recognize the song in the opening of episode 4? It sounded familiar.', -- Content
    '4d582754-4d72-48f8-9e72-f6aa63dacada', -- Channel: netflix
    '1059dbd0-3478-46f9-b8a9-dcd23ed0a23a' -- User: Emma
),
(
    'Exactly why I''m hooked. Can''t remember the last time I was this excited for a series.', -- Content
    '4d582754-4d72-48f8-9e72-f6aa63dacada', -- Channel: netflix
    '35477c6b-f9a0-4bad-af0b-545c99b33fae' -- User: Philip
),
(
    'Me neither. It''s the highlight of my week. Can''t wait to see how the season ends!', -- Content
    '4d582754-4d72-48f8-9e72-f6aa63dacada', -- Channel: netflix
    '1059dbd0-3478-46f9-b8a9-dcd23ed0a23a' -- User: Emma
),
(
    'Yeah, it''s quite immersive. Adds a whole new layer to the series experience.', -- Content
    '4d582754-4d72-48f8-9e72-f6aa63dacada', -- Channel: netflix
    '35477c6b-f9a0-4bad-af0b-545c99b33fae' -- User: Philip
),
(
    'Sounds cool. I''ll check it out. Do you have a favorite character so far?', -- Content
    '4d582754-4d72-48f8-9e72-f6aa63dacada', -- Channel: netflix
    '1059dbd0-3478-46f9-b8a9-dcd23ed0a23a' -- User: Emma
),
(
    'Hard to choose, but probably the AI. Her character arc is fascinating.', -- Content
    '4d582754-4d72-48f8-9e72-f6aa63dacada', -- Channel: netflix
    '35477c6b-f9a0-4bad-af0b-545c99b33fae' -- User: Philip
),
(
    'She''s great. I''m leaning towards the detective. His backstory is intriguing.', -- Content
    '4d582754-4d72-48f8-9e72-f6aa63dacada', -- Channel: netflix
    '1059dbd0-3478-46f9-b8a9-dcd23ed0a23a' -- User: Emma
),
(
    'True, they''ve done a great job with his character. Adds a lot of depth to the plot.', -- Content
    '4d582754-4d72-48f8-9e72-f6aa63dacada', -- Channel: netflix
    '35477c6b-f9a0-4bad-af0b-545c99b33fae' -- User: Philip
),
(
    'For sure. Also, what did you think about the revelation in episode 7 about the main antagonist?', -- Content
    '4d582754-4d72-48f8-9e72-f6aa63dacada', -- Channel: netflix
    '1059dbd0-3478-46f9-b8a9-dcd23ed0a23a' -- User: Emma
),
(
    'That was a game-changer! Completely changed my perspective on the whole story.', -- Content
    '4d582754-4d72-48f8-9e72-f6aa63dacada', -- Channel: netflix
    '35477c6b-f9a0-4bad-af0b-545c99b33fae' -- User: Philip
),
(
    'Same here. It''s rare for a show to surprise me like this one does.', -- Content
    '4d582754-4d72-48f8-9e72-f6aa63dacada', -- Channel: netflix
    '1059dbd0-3478-46f9-b8a9-dcd23ed0a23a' -- User: Emma
),
(
    'Exactly why I''m hooked. Can''t remember the last time I was this excited for a series.', -- Content
    '4d582754-4d72-48f8-9e72-f6aa63dacada', -- Channel: netflix
    '35477c6b-f9a0-4bad-af0b-545c99b33fae' -- User: Philip
),
(
    'Me neither. It''s the highlight of my week. Can''t wait to see how the season ends!', -- Content
    '4d582754-4d72-48f8-9e72-f6aa63dacada', -- Channel: netflix
    '1059dbd0-3478-46f9-b8a9-dcd23ed0a23a' -- User: Emma
),
(
    'Emma, did you notice the incredible camera work in the last episode? The long takes were amazing!', -- Content
    '4d582754-4d72-48f8-9e72-f6aa63dacada', -- Channel: netflix
    '35477c6b-f9a0-4bad-af0b-545c99b33fae' -- User: Philip
),
(
    'Absolutely, Philip! Those long takes added so much tension. Also, the use of lighting was so dramatic.', -- Content
    '4d582754-4d72-48f8-9e72-f6aa63dacada', -- Channel: netflix
    '1059dbd0-3478-46f9-b8a9-dcd23ed0a23a' -- User: Emma
),
(
    'For sure. And what''s your take on the subplot with the mysterious organization? It''s getting more complex.', -- Content
    '4d582754-4d72-48f8-9e72-f6aa63dacada', -- Channel: netflix
    '35477c6b-f9a0-4bad-af0b-545c99b33fae' -- User: Philip
),
(
    'I think it''s leading to a major reveal. Maybe they''re connected to the protagonist''s past?', -- Content
    '4d582754-4d72-48f8-9e72-f6aa63dacada', -- Channel: netflix
    '1059dbd0-3478-46f9-b8a9-dcd23ed0a23a' -- User: Emma
),
(
    'That''s an interesting theory! It could tie up a lot of loose ends. Also, the dialogues in the show are so sharp.', -- Content
    '4d582754-4d72-48f8-9e72-f6aa63dacada', -- Channel: netflix
    '35477c6b-f9a0-4bad-af0b-545c99b33fae' -- User: Philip
),
(
    'True, every line seems to have a deeper meaning. By the way, did you catch the reference to that classic sci-fi movie?', -- Content
    '4d582754-4d72-48f8-9e72-f6aa63dacada', -- Channel: netflix
    '1059dbd0-3478-46f9-b8a9-dcd23ed0a23a' -- User: Emma
),
(
    'I did! That was a clever homage. This show really respects its genre roots. Plus, the soundtrack is spot on.', -- Content
    '4d582754-4d72-48f8-9e72-f6aa63dacada', -- Channel: netflix
    '35477c6b-f9a0-4bad-af0b-545c99b33fae' -- User: Philip
),
(
    'The soundtrack is a character in itself! It perfectly sets the mood for every scene. Also, the costume design is so detailed.', -- Content
    '4d582754-4d72-48f8-9e72-f6aa63dacada', -- Channel: netflix
    '1059dbd0-3478-46f9-b8a9-dcd23ed0a23a' -- User: Emma
),
(
    'Absolutely, the costumes add so much to the world-building. Every character''s style tells a story.', -- Content
    '4d582754-4d72-48f8-9e72-f6aa63dacada', -- Channel: netflix
    '35477c6b-f9a0-4bad-af0b-545c99b33fae' -- User: Philip
),
(
    'Exactly. And speaking of stories, any predictions for the season finale? I''m expecting a big twist!', -- Content
    '4d582754-4d72-48f8-9e72-f6aa63dacada', -- Channel: netflix
    '1059dbd0-3478-46f9-b8a9-dcd23ed0a23a' -- User: Emma
),
(
    'I''m curious about the new character introduced last episode. Any thoughts on their role?', -- Content
    '4d582754-4d72-48f8-9e72-f6aa63dacada', -- Channel: netflix
    '35477c6b-f9a0-4bad-af0b-545c99b33fae' -- User: Philip
),
(
    'My guess is they''re key to the main plot twist. Maybe a hidden ally? The suspense is killing me!', -- Content
    '4d582754-4d72-48f8-9e72-f6aa63dacada', -- Channel: netflix
    '1059dbd0-3478-46f9-b8a9-dcd23ed0a23a' -- User: Emma
),
(
    'Agreed! Also, the latest episode''s cliffhanger was epic. How do you think they''ll resolve that?', -- Content
    '4d582754-4d72-48f8-9e72-f6aa63dacada', -- Channel: netflix
    '35477c6b-f9a0-4bad-af0b-545c99b33fae' -- User: Philip
),
(
    'I have no idea, but I''m expecting a major plot twist. This show always surprises us!', -- Content
    '4d582754-4d72-48f8-9e72-f6aa63dacada', -- Channel: netflix
    '1059dbd0-3478-46f9-b8a9-dcd23ed0a23a' -- User: Emma
),
(
    'Exactly! Also, have you noticed the subtle hints about the protagonist''s past? They''re adding up.', -- Content
    '4d582754-4d72-48f8-9e72-f6aa63dacada', -- Channel: netflix
    '35477c6b-f9a0-4bad-af0b-545c99b33fae' -- User: Philip
),
(
    'Yes, those breadcrumbs are leading to something big. Cant wait to see how they tie everything together.', -- Content
    '4d582754-4d72-48f8-9e72-f6aa63dacada', -- Channel: netflix
    '1059dbd0-3478-46f9-b8a9-dcd23ed0a23a' -- User: Emma
),
(
    'And what about the special effects in the last battle scene? They were out of this world!', -- Content
    '4d582754-4d72-48f8-9e72-f6aa63dacada', -- Channel: netflix
    '35477c6b-f9a0-4bad-af0b-545c99b33fae' -- User: Philip
),
(
    'Truly spectacular! It felt like watching a high-budget movie. The production value is incredible.', -- Content
    '4d582754-4d72-48f8-9e72-f6aa63dacada', -- Channel: netflix
    '1059dbd0-3478-46f9-b8a9-dcd23ed0a23a' -- User: Emma
),
(
    'Agree. Also, the evolving dynamics between the main characters is so well written. It feels natural.', -- Content
    '4d582754-4d72-48f8-9e72-f6aa63dacada', -- Channel: netflix
    '35477c6b-f9a0-4bad-af0b-545c99b33fae' -- User: Philip
),
(
    'Definitely. The character development is top-notch. Makes you invest in their journey.', -- Content
    '4d582754-4d72-48f8-9e72-f6aa63dacada', -- Channel: netflix
    '1059dbd0-3478-46f9-b8a9-dcd23ed0a23a' -- User: Emma
);
