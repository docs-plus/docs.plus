-- Add unique constraint on (documentId, version) to prevent duplicate versions
-- This is a safety net - the application should never create duplicates,
-- but this catches any race conditions that slip through

-- First, check if there are any existing duplicates and fix them
-- (This should already be done by the previous migration, but just in case)
DO $$
DECLARE
    dup_count INTEGER;
BEGIN
    SELECT COUNT(*) INTO dup_count
    FROM (
        SELECT "documentId", version
        FROM "Documents"
        GROUP BY "documentId", version
        HAVING COUNT(*) > 1
    ) AS duplicates;

    IF dup_count > 0 THEN
        RAISE NOTICE 'Found % duplicate (documentId, version) pairs. Fixing...', dup_count;

        -- Re-number versions to eliminate duplicates
        WITH ranked AS (
            SELECT id,
                   ROW_NUMBER() OVER (
                       PARTITION BY "documentId"
                       ORDER BY "createdAt" ASC
                   )::int as correct_version
            FROM "Documents"
        )
        UPDATE "Documents" d
        SET version = r.correct_version
        FROM ranked r
        WHERE d.id = r.id;

        RAISE NOTICE 'Duplicates fixed.';
    END IF;
END $$;

-- Now add the unique constraint
ALTER TABLE "Documents"
ADD CONSTRAINT "Documents_documentId_version_unique"
UNIQUE ("documentId", version);

-- Add index for faster lookups (if not already exists from constraint)
CREATE INDEX IF NOT EXISTS "Documents_documentId_version_idx"
ON "Documents" ("documentId", version DESC);

