-- Pair of scripts/29-lint-hardening.sql §6: the admin dashboard calls these
-- two RPCs from the browser; their bodies self-gate on is_admin(auth.uid()).
-- Idempotent — remote already grants these via 20260213163344 and the parity
-- migration; this keeps the grant stable if the hardening sweep re-runs.

grant execute on function public.admin_get_failed_push_subs(int) to authenticated;
grant execute on function public.admin_get_recent_push_activity(int) to authenticated;
