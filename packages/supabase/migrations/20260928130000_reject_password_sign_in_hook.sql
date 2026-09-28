-- Refuse a token for a password sign-in (Custom Access Token hook).
-- Paired with scripts/32-password-sign-in-hook.sql; same body. Idempotent.
-- Turn the hook on in the dashboard after this runs.

-- docs.plus does not use passwords. As the Custom Access Token hook, this refuses
-- a token for a password sign-in and passes every other event through unchanged.
-- Invoker on purpose: 29-lint-hardening.sql §5 sweeps definer functions only.
-- Docs: https://supabase.com/docs/guides/auth/auth-hooks/custom-access-token-hook
create or replace function public.hook_block_password_tokens(event jsonb)
returns jsonb
language sql
immutable
security invoker
set search_path = ''
as $$
  select case
    when event->>'authentication_method' = 'password' then jsonb_build_object(
      'error', jsonb_build_object('http_code', 400, 'message', 'Invalid login credentials')
    )
    else event
  end;
$$;

comment on function public.hook_block_password_tokens(jsonb) is
'Auth Custom Access Token hook. Refuses a token for a password sign-in.';

grant usage on schema public to supabase_auth_admin;
grant execute on function public.hook_block_password_tokens(jsonb) to supabase_auth_admin;
revoke execute on function public.hook_block_password_tokens(jsonb) from authenticated, anon, public;
