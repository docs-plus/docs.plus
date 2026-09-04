-- Owner pad-open time for the Documents list Last opened sort.
-- Writers set this column only; they must not bump updatedAt.
ALTER TABLE "DocumentMetadata" ADD COLUMN "lastOpenedAt" TIMESTAMP(3);

CREATE INDEX "DocumentMetadata_ownerId_lastOpenedAt_idx" ON "DocumentMetadata"("ownerId", "lastOpenedAt");
