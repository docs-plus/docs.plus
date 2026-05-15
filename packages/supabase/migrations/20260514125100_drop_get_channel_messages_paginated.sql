-- =====================================================================
-- 20260514125100_drop_get_channel_messages_paginated.sql
-- =====================================================================
-- `get_channel_messages_paginated` was the v1 cursor-based pagination
-- RPC for chat history. It is fully replaced by `fetch_message_window`
-- (added in 20260513140500, extended in 20260513150000 / 20260513160000
-- to inline user_details). The FE helper
-- `api/rpc/fetchMessagesPaginated.ts` was deleted alongside this
-- cleanup; there are zero callers left in the webapp.
--
-- Mirrors `scripts/10-functions.sql` (function body + ALTER line removed)
-- and `scripts/29-lint-hardening.sql` (removed from the user-facing
-- names array and the dynamic anon-GRANT loop).
-- =====================================================================

drop function if exists public.get_channel_messages_paginated(
  varchar, int, timestamp with time zone, varchar
);
