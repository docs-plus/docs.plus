-- Per-version attribution for the history surface. All three are nullable or
-- constant-defaulted, so no backfill: legacy rows read NULL/'{}' and render as
-- unattributed. Constant defaults on ADD COLUMN are metadata-only here — no table
-- rewrite. No index: attribution is projected, never filtered on; version reads
-- stay on the existing [documentId, version] unique.
ALTER TABLE "Documents" ADD COLUMN "trigger" TEXT;
ALTER TABLE "Documents" ADD COLUMN "triggeredBy" TEXT;
ALTER TABLE "Documents" ADD COLUMN "contributors" TEXT[] NOT NULL DEFAULT '{}';
