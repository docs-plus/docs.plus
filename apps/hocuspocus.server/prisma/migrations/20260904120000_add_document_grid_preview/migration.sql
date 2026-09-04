-- Cached first-page extract for the owner Documents grid. NULL = never extracted.
-- Writers set this column only; they must not bump updatedAt.
ALTER TABLE "DocumentMetadata" ADD COLUMN "preview" JSONB;
