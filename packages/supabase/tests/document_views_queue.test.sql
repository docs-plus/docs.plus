-- A visit that closes before the view queue drains keeps its duration
-- (#603, migration 20261025150000). The rollback leaves the shared local stack unchanged.
begin;
create extension if not exists pgtap with schema extensions;

select plan(4);

select ok(
    set_config(
        'test.view_id',
        public.enqueue_document_view('test-583-queue-doc', 'test-583-queue-session') ->> 'view_id',
        true
    ) <> '',
    'a view is enqueued'
);

select ok(
    public.update_view_duration(current_setting('test.view_id')::uuid, 5000),
    'update_view_duration finds the queued view'
);

do $$
begin
    perform public.process_document_views_queue();
end
$$;

select is(
    (select duration_ms from public.document_views where id = current_setting('test.view_id')::uuid),
    5000,
    'the drained row keeps duration_ms'
);

select is(
    (select is_bounce from public.document_views where id = current_setting('test.view_id')::uuid),
    false,
    'the drained row is not a bounce'
);

select * from finish();
rollback;
