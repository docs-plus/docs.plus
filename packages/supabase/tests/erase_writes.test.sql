-- An erased account cannot write back its profile, preferences or push devices
-- (#579, migration 20261024120000). The rollback leaves the shared local stack unchanged.
begin;
create extension if not exists pgtap with schema extensions;

-- 29-lint-hardening.sql §9 takes PUBLIC EXECUTE from new functions that postgres owns.
-- The checks below call pgTAP as authenticated, so grant what it lacks.
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
           and not has_function_privilege('authenticated', d.objid, 'execute')
    loop
        execute format('grant execute on function %s to authenticated', fn::regprocedure);
    end loop;
end
$$;

select plan(9);

-- a1 is the erased account, b1 the live one. handle_new_user creates public.users rows.
insert into auth.users (id, email) values
    ('58320000-0000-4000-8000-0000000000a1', 'erase-gone-583@example.test'),
    ('58320000-0000-4000-8000-0000000000b1', 'erase-live-583@example.test');

-- valid_deletion needs deleted_at > created_at, and now() does not move inside a transaction.
update public.users
   set full_name = 'Before',
       created_at = now() - interval '1 day',
       deleted_at = case when id = '58320000-0000-4000-8000-0000000000a1' then now() end
 where id in ('58320000-0000-4000-8000-0000000000a1', '58320000-0000-4000-8000-0000000000b1');

-- Prod never ran 29-lint-hardening.sql §4, so authenticated may write this table there
-- and the policy is the guard. Grant it here so the policy decides.
grant insert on public.push_subscriptions to authenticated;

-- The erased account.
set local role authenticated;
set local request.jwt.claims to '{"sub":"58320000-0000-4000-8000-0000000000a1","role":"authenticated"}';

update public.users set full_name = 'After' where id = '58320000-0000-4000-8000-0000000000a1';

select throws_ok(
    $$insert into public.push_subscriptions (user_id, device_id, push_credentials)
      values ('58320000-0000-4000-8000-0000000000a1', 'test-583-erased', '{}')$$,
    '42501', 'new row violates row-level security policy for table "push_subscriptions"',
    'an erased account cannot insert a push subscription'
);

select is(
    public.update_notification_preferences('{"push_enabled": false}'),
    null::jsonb,
    'update_notification_preferences returns null for an erased account'
);

select is(
    public.register_push_subscription('test-583-erased-rpc', 'Test 583', 'web', '{}'),
    null::uuid,
    'register_push_subscription returns null for an erased account'
);

-- The live account.
set local request.jwt.claims to '{"sub":"58320000-0000-4000-8000-0000000000b1","role":"authenticated"}';

update public.users set full_name = 'After' where id = '58320000-0000-4000-8000-0000000000b1';

select lives_ok(
    $$insert into public.push_subscriptions (user_id, device_id, push_credentials)
      values ('58320000-0000-4000-8000-0000000000b1', 'test-583-live', '{}')$$,
    'a live account inserts a push subscription'
);

select is(
    (public.update_notification_preferences('{"push_enabled": false}')) ->> 'push_enabled',
    'false',
    'a live account saves its preferences'
);

select isnt(
    public.register_push_subscription('test-583-live-rpc', 'Test 583', 'web', '{}'),
    null::uuid,
    'a live account registers a push subscription'
);

reset role;
select is(
    (select full_name from public.users where id = '58320000-0000-4000-8000-0000000000a1'),
    'Before',
    'an UPDATE by an erased account changes 0 rows'
);

select is(
    (select full_name from public.users where id = '58320000-0000-4000-8000-0000000000b1'),
    'After',
    'a live account updates its profile'
);

select is(
    (select notification_preferences from public.users where id = '58320000-0000-4000-8000-0000000000a1'),
    '{}'::jsonb,
    'update_notification_preferences writes nothing for an erased account'
);

select * from finish();
rollback;
