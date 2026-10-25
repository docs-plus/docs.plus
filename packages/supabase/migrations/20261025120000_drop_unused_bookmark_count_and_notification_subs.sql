-- #605, maintainer ruling on #327 (2026-10-24). Drops two functions that nothing calls.
-- #318 left both service_role only. Pairs with scripts/07-bookmark-functions.sql and
-- 07-4-push-notifications-pgmq.sql, which no longer create them.
-- No CASCADE: a dependent object must stop this, not vanish with it.

set local lock_timeout = '5s';

drop function if exists public.get_bookmark_count(character varying, boolean);
drop function if exists public.admin_get_user_notification_subs();
