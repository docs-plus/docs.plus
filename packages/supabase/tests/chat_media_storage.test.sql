-- Chat media policies on storage.objects, bucket media (scripts/12-buckets.sql, #432, #583).
-- Paths are {userId}/{channelId}/{file}. The rollback leaves the shared local stack unchanged.
begin;
create extension if not exists pgtap with schema extensions;

-- 29-lint-hardening.sql §9 takes PUBLIC EXECUTE from new functions that postgres owns.
-- The checks below call pgTAP as anon and authenticated, so grant what they lack.
do $$
declare
    fn oid;
begin
    for fn in
        select d.objid
          from pg_depend d
          join pg_extension e on e.oid = d.refobjid
         where e.extname = 'pgtap'
           and d.classid = 'pg_proc'::regclass
           and d.deptype = 'e'
           and not (has_function_privilege('anon', d.objid, 'execute')
                    and has_function_privilege('authenticated', d.objid, 'execute'))
    loop
        execute format('grant execute on function %s to anon, authenticated', fn::regprocedure);
    end loop;
end
$$;

select plan(14);

-- a1 is the channel member, b1 the non-member. handle_new_user creates public.users rows.
insert into auth.users (id, email) values
    ('58310000-0000-4000-8000-0000000000a1', 'media-member-583@example.test'),
    ('58310000-0000-4000-8000-0000000000b1', 'media-other-583@example.test');

-- No workspace_members rows: the unread trigger would enrol them into the channel.
insert into public.workspaces (id, name, slug)
values ('58310000-0000-4000-8000-0000000000c1', 'Test 583 media', 'test-583-media');

-- channel_creator_as_admin makes a1 the only member of both channels.
insert into public.channels (id, workspace_id, heading_id, slug, name, created_by, type) values
    ('58310000-0000-4000-8000-0000000000d1', '58310000-0000-4000-8000-0000000000c1',
     '58310000-0000-4000-8000-0000000000d1', 'test-583-public', 'Test 583 public',
     '58310000-0000-4000-8000-0000000000a1', 'PUBLIC'),
    ('58310000-0000-4000-8000-0000000000d2', '58310000-0000-4000-8000-0000000000c1',
     '58310000-0000-4000-8000-0000000000d2', 'test-583-direct', 'Test 583 direct',
     '58310000-0000-4000-8000-0000000000a1', 'DIRECT');

-- validate_message_medias needs each object to exist before its message.
insert into storage.objects (bucket_id, name) values
    ('media', '58310000-0000-4000-8000-0000000000a1/58310000-0000-4000-8000-0000000000d1/named.png'),
    ('media', '58310000-0000-4000-8000-0000000000a1/58310000-0000-4000-8000-0000000000d1/unnamed.png'),
    ('media', '58310000-0000-4000-8000-0000000000a1/58310000-0000-4000-8000-0000000000d1/gone.png'),
    ('media', '58310000-0000-4000-8000-0000000000b1/58310000-0000-4000-8000-0000000000d1/other.png'),
    ('media', '58310000-0000-4000-8000-0000000000a1/58310000-0000-4000-8000-0000000000d2/direct.png');

-- A soft-delete UPDATE clears medias and deletes the object, which would hide the policy term.
-- So the gone.png message is inserted with deleted_at already set and medias kept.
insert into public.messages (channel_id, user_id, content, medias, deleted_at) values
    ('58310000-0000-4000-8000-0000000000d1', '58310000-0000-4000-8000-0000000000a1', 'named',
     '[{"path":"58310000-0000-4000-8000-0000000000a1/58310000-0000-4000-8000-0000000000d1/named.png","type":"image"}]',
     null),
    ('58310000-0000-4000-8000-0000000000d1', '58310000-0000-4000-8000-0000000000a1', 'gone',
     '[{"path":"58310000-0000-4000-8000-0000000000a1/58310000-0000-4000-8000-0000000000d1/gone.png","type":"image"}]',
     now()),
    ('58310000-0000-4000-8000-0000000000d2', '58310000-0000-4000-8000-0000000000a1', 'direct',
     '[{"path":"58310000-0000-4000-8000-0000000000a1/58310000-0000-4000-8000-0000000000d2/direct.png","type":"image"}]',
     null);

-- The member.
set local role authenticated;
set local request.jwt.claims to '{"sub":"58310000-0000-4000-8000-0000000000a1","role":"authenticated"}';

select is(
    (select count(*)::int from storage.objects
      where bucket_id = 'media'
        and name like '%/58310000-0000-4000-8000-0000000000d1/%'),
    4,
    'a member reads every object in the channel, named or not'
);

-- The upload reads the row back through SELECT, the path that 63641764e broke.
select results_eq(
    $$insert into storage.objects (bucket_id, name)
      values ('media', '58310000-0000-4000-8000-0000000000a1/58310000-0000-4000-8000-0000000000d1/upload.png')
      returning name$$,
    $$values ('58310000-0000-4000-8000-0000000000a1/58310000-0000-4000-8000-0000000000d1/upload.png'::text)$$,
    'a member uploads under their own uid folder and reads it back'
);

select throws_ok(
    $$insert into storage.objects (bucket_id, name)
      values ('media', '58310000-0000-4000-8000-0000000000b1/58310000-0000-4000-8000-0000000000d1/forged.png')$$,
    '42501', 'new row violates row-level security policy for table "objects"',
    'an upload under another uid folder is refused'
);

-- The non-member. The PUBLIC channel is readable, so the live message decides (#432).
set local request.jwt.claims to '{"sub":"58310000-0000-4000-8000-0000000000b1","role":"authenticated"}';

select is(
    (select count(*)::int from storage.objects
      where bucket_id = 'media'
        and name = '58310000-0000-4000-8000-0000000000a1/58310000-0000-4000-8000-0000000000d1/named.png'),
    1,
    'a non-member reads an object that a live message names'
);

select is(
    (select count(*)::int from storage.objects
      where bucket_id = 'media'
        and name = '58310000-0000-4000-8000-0000000000a1/58310000-0000-4000-8000-0000000000d1/gone.png'),
    0,
    'a non-member cannot read an object whose message has deleted_at set'
);

select is(
    (select count(*)::int from storage.objects
      where bucket_id = 'media'
        and name = '58310000-0000-4000-8000-0000000000a1/58310000-0000-4000-8000-0000000000d1/unnamed.png'),
    0,
    'a non-member cannot read an object that no message names'
);

select throws_ok(
    $$insert into storage.objects (bucket_id, name)
      values ('media', '58310000-0000-4000-8000-0000000000b1/58310000-0000-4000-8000-0000000000d1/upload.png')$$,
    '42501', 'new row violates row-level security policy for table "objects"',
    'a non-member upload is refused'
);

-- Anon. The ordinary channel name is load-bearing: with bare `name` in the channels
-- EXISTS (ed92aaad9), it binds to channels.name and the named read below returns 0.
set local role anon;
set local request.jwt.claims to '{"role":"anon"}';

select is(
    (select count(*)::int from storage.objects
      where bucket_id = 'media'
        and name = '58310000-0000-4000-8000-0000000000a1/58310000-0000-4000-8000-0000000000d1/named.png'),
    1,
    'anon reads a named object on a PUBLIC channel'
);

-- The storage PUBLIC term, channels_public_anon_select and messages_public_anon_select
-- each need a PUBLIC channel. This case proves the three together, so a sabotage
-- must loosen all three to fail it.
select is(
    (select count(*)::int from storage.objects
      where bucket_id = 'media'
        and name = '58310000-0000-4000-8000-0000000000a1/58310000-0000-4000-8000-0000000000d2/direct.png'),
    0,
    'anon cannot read a named object on a DIRECT channel'
);

select throws_ok(
    $$insert into storage.objects (bucket_id, name)
      values ('media', '58310000-0000-4000-8000-0000000000a1/58310000-0000-4000-8000-0000000000d1/anon.png')$$,
    '42501', null,
    'an anon upload is refused'
);

-- storage.protect_delete refuses a direct DELETE unless this flag is set.
reset role;
set local storage.allow_delete_query to 'true';

set local role authenticated;
set local request.jwt.claims to '{"sub":"58310000-0000-4000-8000-0000000000a1","role":"authenticated"}';
delete from storage.objects
 where bucket_id = 'media'
   and name = '58310000-0000-4000-8000-0000000000a1/58310000-0000-4000-8000-0000000000d1/unnamed.png';
delete from storage.objects
 where bucket_id = 'media'
   and name = '58310000-0000-4000-8000-0000000000b1/58310000-0000-4000-8000-0000000000d1/other.png';

-- b1 can read named.png through the live message, so only the folder term stops this delete.
set local request.jwt.claims to '{"sub":"58310000-0000-4000-8000-0000000000b1","role":"authenticated"}';
delete from storage.objects
 where bucket_id = 'media'
   and name = '58310000-0000-4000-8000-0000000000a1/58310000-0000-4000-8000-0000000000d1/named.png';

reset role;
select is(
    (select count(*)::int from storage.objects
      where bucket_id = 'media'
        and name = '58310000-0000-4000-8000-0000000000a1/58310000-0000-4000-8000-0000000000d1/named.png'),
    1,
    'a non-member cannot delete another user''s object'
);

-- A missing anon grant is also a refusal, so it must not abort the file.
set local role anon;
set local request.jwt.claims to '{"role":"anon"}';
do $$
begin
    delete from storage.objects
     where bucket_id = 'media'
       and name = '58310000-0000-4000-8000-0000000000a1/58310000-0000-4000-8000-0000000000d1/named.png';
exception when insufficient_privilege then
    null;
end
$$;

reset role;
select is(
    (select count(*)::int from storage.objects
      where bucket_id = 'media'
        and name = '58310000-0000-4000-8000-0000000000a1/58310000-0000-4000-8000-0000000000d1/unnamed.png'),
    0,
    'the owner deletes an object in their own uid folder'
);

select is(
    (select count(*)::int from storage.objects
      where bucket_id = 'media'
        and name = '58310000-0000-4000-8000-0000000000b1/58310000-0000-4000-8000-0000000000d1/other.png'),
    1,
    'a member cannot delete an object in another user''s folder'
);

select is(
    (select count(*)::int from storage.objects
      where bucket_id = 'media'
        and name = '58310000-0000-4000-8000-0000000000a1/58310000-0000-4000-8000-0000000000d1/named.png'),
    1,
    'anon cannot delete an object'
);

select * from finish();
rollback;
