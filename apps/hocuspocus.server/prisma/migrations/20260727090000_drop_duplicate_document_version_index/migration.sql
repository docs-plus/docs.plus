-- Byte-identical in columns and order to "Documents_documentId_version_key", so it
-- covered no read that index does not: pure write-path cost inside the FOR UPDATE
-- save. CONCURRENTLY holds only SHARE UPDATE EXCLUSIVE, so saves keep running — but
-- it cannot run inside a transaction block, and Prisma's runner wraps the file in one
-- the moment it holds a second statement. Keep this file at exactly one statement.
DROP INDEX CONCURRENTLY IF EXISTS "Documents_documentId_version_idx";
