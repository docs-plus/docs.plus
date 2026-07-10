-- Soft-delete tombstone for DocumentMetadata. Nullable, no backfill: existing rows
-- default to NULL (not deleted). The reaper purges the footprint after retention.
ALTER TABLE "DocumentMetadata" ADD COLUMN "deletedAt" TIMESTAMP(3);

-- CreateIndex
CREATE INDEX "DocumentMetadata_deletedAt_idx" ON "DocumentMetadata"("deletedAt");
