-- The app serves every path from one catch-all and has no /settings route, so
-- '/settings/notifications' opened a blank pad named "settings". Point the
-- footer link at the hash the settings panel reads instead.
-- Body only. The signature is unchanged, so no second overload is created.

create or replace function public.get_email_footer_links(
    p_user_id uuid,
    p_base_url text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
    base_url text;
begin
    base_url := coalesce(
        p_base_url,
        current_setting('app.base_url', true),
        'https://docs.plus'
    );

    return jsonb_build_object(
        'unsubscribe_mentions', public.get_unsubscribe_url(p_user_id, 'mentions', base_url),
        'unsubscribe_replies', public.get_unsubscribe_url(p_user_id, 'replies', base_url),
        'unsubscribe_reactions', public.get_unsubscribe_url(p_user_id, 'reactions', base_url),
        'unsubscribe_digest', public.get_unsubscribe_url(p_user_id, 'digest', base_url),
        'unsubscribe_all', public.get_unsubscribe_url(p_user_id, 'all', base_url),
        -- The app serves every path from one catch-all and has no /settings route,
        -- so a path here opens a blank pad. The hash is read by the page that mounts
        -- the settings panel.
        'preferences', base_url || '/#settings?tab=notifications'
    );
end;
$$;
