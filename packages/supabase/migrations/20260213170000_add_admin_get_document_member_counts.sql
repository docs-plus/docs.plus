-- Admin RPC: returns workspace member counts for a list of document slugs.
-- Joins workspaces (by slug) → workspace_members (active only).
-- SECURITY DEFINER so it bypasses RLS; guarded by is_admin() for authenticated
-- callers and allows service_role (backend) direct access.

create or replace function public.admin_get_document_member_counts(p_slugs text[])
returns table (
    slug text,
    member_count bigint
)
language plpgsql
security definer
set search_path = public
as $$
declare
    v_jwt_role text;
begin
    -- Allow: service_role (backend API) or authenticated admin
    v_jwt_role := coalesce(current_setting('request.jwt.claim.role', true), '');

    if v_jwt_role not in ('service_role') then
        if auth.uid() is not null and not public.is_admin(auth.uid()) then
            raise exception 'Access denied: user is not an admin.';
        end if;
    end if;

    return query
    select
        w.slug,
        count(wm.id) as member_count
    from public.workspaces w
    left join public.workspace_members wm
        on wm.workspace_id = w.id
        and wm.left_at is null
    where w.slug = any(p_slugs)
    group by w.slug;
end;
$$;

comment on function public.admin_get_document_member_counts(text[]) is
'Returns workspace member counts per document slug. Admin-only or service_role, bypasses RLS.';

revoke execute on function public.admin_get_document_member_counts(text[]) from anon;
grant execute on function public.admin_get_document_member_counts(text[]) to authenticated;
grant execute on function public.admin_get_document_member_counts(text[]) to service_role;

