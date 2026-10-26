-- Author-only message writes and the notification block (scripts/13-RLS.sql §2f, #583).
-- Fixtures are made as postgres. The rollback leaves the shared local stack unchanged.
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

select plan(9);

-- handle_new_user creates the public.users rows.
insert into auth.users (id, email) values
    ('58300000-0000-4000-8000-0000000000a1', 'msg-author-583@example.test'),
    ('58300000-0000-4000-8000-0000000000b1', 'msg-other-583@example.test');

-- No workspace_members rows: the unread trigger would enrol them into the channel.
insert into public.workspaces (id, name, slug)
values ('58300000-0000-4000-8000-0000000000c1', 'Test 583 messages', 'test-583-messages');

-- channel_creator_as_admin makes the author the only channel member.
insert into public.channels (id, workspace_id, heading_id, slug, name, created_by, type)
values (
    '58300000-0000-4000-8000-0000000000d1', '58300000-0000-4000-8000-0000000000c1',
    '58300000-0000-4000-8000-0000000000d1', 'test-583-public', 'Test 583 public',
    '58300000-0000-4000-8000-0000000000a1', 'PUBLIC'
);

insert into public.messages (id, channel_id, user_id, content, type) values
    ('58300000-0000-4000-8000-0000000000e1', '58300000-0000-4000-8000-0000000000d1',
     '58300000-0000-4000-8000-0000000000a1', 'original', 'text'),
    ('58300000-0000-4000-8000-0000000000e2', '58300000-0000-4000-8000-0000000000d1',
     '58300000-0000-4000-8000-0000000000a1', 'notice', 'notification');

-- The author.
set local role authenticated;
set local request.jwt.claims to '{"sub":"58300000-0000-4000-8000-0000000000a1","role":"authenticated"}';

select lives_ok(
    $$insert into public.messages (channel_id, user_id, content)
      values ('58300000-0000-4000-8000-0000000000d1', '58300000-0000-4000-8000-0000000000a1', 'own insert')$$,
    'the author inserts their own message'
);

select throws_ok(
    $$insert into public.messages (channel_id, user_id, content)
      values ('58300000-0000-4000-8000-0000000000d1', '58300000-0000-4000-8000-0000000000b1', 'forged author')$$,
    '42501', 'new row violates row-level security policy for table "messages"',
    'an insert with another user_id is refused'
);

-- user_id is not in the UPDATE grant, so the grant refuses this before the policy does.
select throws_ok(
    $$update public.messages set user_id = '58300000-0000-4000-8000-0000000000b1'
      where id = '58300000-0000-4000-8000-0000000000e1'$$,
    '42501', null,
    'an update to another user_id is refused'
);

select throws_ok(
    $$insert into public.messages (channel_id, user_id, content, type)
      values ('58300000-0000-4000-8000-0000000000d1', '58300000-0000-4000-8000-0000000000a1', 'fake notice', 'notification')$$,
    '42501', 'new row violates row-level security policy for table "messages"',
    'a client insert with type notification is refused'
);

select throws_ok(
    $$update public.messages set type = 'notification'
      where id = '58300000-0000-4000-8000-0000000000e1'$$,
    '42501', 'new row violates row-level security policy for table "messages"',
    'a client update to type notification is refused'
);

update public.messages set content = 'edited' where id = '58300000-0000-4000-8000-0000000000e1';
update public.messages set content = 'edited notice' where id = '58300000-0000-4000-8000-0000000000e2';

reset role;
select is(
    (select content from public.messages where id = '58300000-0000-4000-8000-0000000000e1'),
    'edited',
    'the author updates their own message'
);
select is(
    (select content from public.messages where id = '58300000-0000-4000-8000-0000000000e2'),
    'notice',
    'an update of an existing notification row changes 0 rows'
);

-- Another signed-in user. The PUBLIC channel is readable, so only user_id stops the write.
set local role authenticated;
set local request.jwt.claims to '{"sub":"58300000-0000-4000-8000-0000000000b1","role":"authenticated"}';
update public.messages set content = 'hijacked' where id = '58300000-0000-4000-8000-0000000000e1';

reset role;
select is(
    (select content from public.messages where id = '58300000-0000-4000-8000-0000000000e1'),
    'edited',
    'an update of another user''s message changes 0 rows'
);

-- Anon has no INSERT grant and no INSERT policy on messages.
set local role anon;
set local request.jwt.claims to '{"role":"anon"}';
select throws_ok(
    $$insert into public.messages (channel_id, user_id, content)
      values ('58300000-0000-4000-8000-0000000000d1', '58300000-0000-4000-8000-0000000000a1', 'anon insert')$$,
    '42501', null,
    'anon cannot insert a message'
);

reset role;
select * from finish();
rollback;
