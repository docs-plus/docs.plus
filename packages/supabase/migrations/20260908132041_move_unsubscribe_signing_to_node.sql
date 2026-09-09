-- Move unsubscribe token signing from Postgres to the Node worker.
--
-- A hosted Supabase project's `postgres` role cannot set a custom parameter
-- with ALTER DATABASE or ALTER ROLE — both raise 42501 — so
-- `app.unsubscribe_secret` could never be provisioned. `get_email_footer_links`
-- therefore raised on every send, the sender swallowed the error, and every
-- footer shipped a tokenless /unsubscribe link that the route then rejected.
--
-- Signing and verification now live in
-- `apps/hocuspocus.server/src/lib/unsubscribeToken.ts`, keyed on
-- EMAIL_UNSUBSCRIBE_SECRET. Postgres keeps only the write.
--
-- Paired with packages/supabase/scripts/07-5-email-notifications-pgmq.sql.

create or replace function public.apply_unsubscribe(
    p_user_id uuid,
    p_action text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
    v_user_email text;
    prefs jsonb;
    new_prefs jsonb;
    action_description text;
begin
    select email, coalesce(profile_data->'notification_preferences', '{}'::jsonb)
    into v_user_email, prefs
    from public.users
    where id = p_user_id;

    if v_user_email is null then
        return jsonb_build_object(
            'success', false,
            'error', 'user_not_found',
            'message', 'User account not found.'
        );
    end if;

    case p_action
        when 'mentions' then
            new_prefs := jsonb_set(prefs, '{email_mentions}', 'false'::jsonb);
            action_description := 'mention emails';
        when 'replies' then
            new_prefs := jsonb_set(prefs, '{email_replies}', 'false'::jsonb);
            action_description := 'reply emails';
        when 'reactions' then
            new_prefs := jsonb_set(prefs, '{email_reactions}', 'false'::jsonb);
            action_description := 'reaction emails';
        when 'digest' then
            new_prefs := jsonb_set(prefs, '{email_frequency}', '"never"'::jsonb);
            action_description := 'digest emails';
        when 'all' then
            new_prefs := jsonb_set(prefs, '{email_enabled}', 'false'::jsonb);
            action_description := 'all email notifications';
        else
            return jsonb_build_object(
                'success', false,
                'error', 'invalid_action',
                'message', 'Invalid unsubscribe action.'
            );
    end case;

    update public.users
    set profile_data = jsonb_set(
        coalesce(profile_data, '{}'::jsonb),
        '{notification_preferences}',
        new_prefs
    )
    where id = p_user_id;

    return jsonb_build_object(
        'success', true,
        'action', p_action,
        'action_description', action_description,
        'email', v_user_email,
        'message', 'You have been unsubscribed from ' || action_description || '.',
        'user_id', p_user_id
    );
end;
$$;

drop function if exists public.process_unsubscribe(text) cascade;
drop function if exists public.get_email_footer_links(uuid, text) cascade;
drop function if exists public.get_unsubscribe_url(uuid, text, text) cascade;
drop function if exists public.generate_unsubscribe_token(uuid, text) cascade;
drop function if exists internal.verify_unsubscribe_token(text) cascade;
drop function if exists internal.get_unsubscribe_secret() cascade;

-- This function needs the lock more than the one it replaces. That one took a
-- signed token and checked it, so the token was the credential. This one takes
-- a user id and turns email off for whoever it names, with no proof of
-- identity. The proof happens in Node, before the call.
revoke execute on function public.apply_unsubscribe(uuid, text) from public, anon, authenticated;
grant  execute on function public.apply_unsubscribe(uuid, text) to service_role;
comment on function public.apply_unsubscribe(uuid, text) is
    'Turns off one email preference for the named user. Performs NO identity check: '
    'the caller must verify the signed token first (see unsubscribeToken.ts). '
    'Granted to service_role only.';


