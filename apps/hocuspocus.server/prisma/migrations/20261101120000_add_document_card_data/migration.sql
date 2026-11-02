-- The social preview card's first blocks and outline (#665, #666).
-- Writers set this column only; they must not bump updatedAt.
ALTER TABLE "DocumentMetadata" ADD COLUMN "cardData" JSONB;
