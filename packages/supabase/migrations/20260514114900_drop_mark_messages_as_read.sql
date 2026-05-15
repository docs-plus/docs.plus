-- =====================================================================
-- 20260514114900_drop_mark_messages_as_read.sql
-- =====================================================================
-- `mark_messages_as_read` was the v1 bulk-UPDATE read-cursor RPC. It is
-- fully replaced by `advance_read_cursor` (added in 20260513141500,
-- extended in 20260513215200 to recompute `unread_message_count`). The
-- FE helper `api/rpc/markReadMessages.ts` was deleted alongside this
-- cleanup; there are zero callers left in the webapp.
--
-- Mirrors `scripts/10-functions.sql` (function + ALTER lines removed) and
-- `scripts/29-lint-hardening.sql` (removed from the user-facing names
-- array used by the lint sweep).
-- =====================================================================

drop function if exists public.mark_messages_as_read(varchar, uuid);
