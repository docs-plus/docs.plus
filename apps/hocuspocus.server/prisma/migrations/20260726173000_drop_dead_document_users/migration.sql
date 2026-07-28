-- `DocumentUsers` never carried a row and nothing in src/ referenced it: the
-- 2026-02-01 migration added `documentPk INTEGER NOT NULL` with no default, which
-- only succeeds on an empty table and would have failed on any live data.
--
-- The DROP takes ACCESS EXCLUSIVE on `Documents` to remove the inbound foreign
-- key, so it waits behind every in-flight save. `lock_timeout` makes that a fast
-- failed migration the deploy can retry instead of a stalled writer queue.
SET lock_timeout = '3s';

DROP TABLE IF EXISTS "DocumentUsers";

-- Only `DocumentUsers.role` used it.
DROP TYPE IF EXISTS "Role";
