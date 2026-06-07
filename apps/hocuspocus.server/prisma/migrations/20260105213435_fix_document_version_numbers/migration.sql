-- Fix document version numbers
--
-- Problem: A bug in the queue worker caused all documents to be saved with
-- version 2 (or other incorrect versions) because findFirst was called without
-- orderBy, returning an arbitrary row instead of the latest version.
--
-- Solution: Re-number all versions sequentially per document, ordered by createdAt.

-- Step 1: Create a temporary table with correct version numbers
CREATE TEMP TABLE version_corrections AS
SELECT
    id,
    "documentId",
    ROW_NUMBER() OVER (
        PARTITION BY "documentId"
        ORDER BY "createdAt" ASC
    )::int as correct_version
FROM "Documents";

-- Step 2: Update all documents with their correct version numbers
UPDATE "Documents" d
SET version = vc.correct_version
FROM version_corrections vc
WHERE d.id = vc.id
  AND d.version != vc.correct_version;

-- Step 3: Clean up
DROP TABLE version_corrections;

-- Log the fix (this will show in migration output)
DO $$
DECLARE
    fixed_count INTEGER;
BEGIN
    GET DIAGNOSTICS fixed_count = ROW_COUNT;
    RAISE NOTICE 'Fixed % document version numbers', fixed_count;
END $$;

