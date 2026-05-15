-- =====================================================================
-- 20260513130500_fix_channel_members_join_insert.sql
-- =====================================================================
-- Narrows channel_members_join_insert so DIRECT/GROUP/BROADCAST stop
-- accepting self-join via PostgREST. Those types route membership
-- creation through SECURITY DEFINER RPCs. Mirrors scripts/13-RLS.sql.
-- =====================================================================

DROP POLICY IF EXISTS channel_members_join_insert ON public.channel_members;

CREATE POLICY channel_members_join_insert ON public.channel_members
  FOR INSERT TO authenticated
  WITH CHECK (
    member_id = (SELECT auth.uid())
    AND EXISTS (
      SELECT 1 FROM public.channels c
      WHERE c.id = channel_id
        AND c.deleted_at IS NULL
        AND c.type IN ('PUBLIC', 'PRIVATE')
        AND internal.is_workspace_member(c.workspace_id)
    )
  );
