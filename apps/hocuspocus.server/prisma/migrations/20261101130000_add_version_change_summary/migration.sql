-- What a version changed against the previous one, for the Version card (#669).
-- Its own worker job sets this column only; it must not bump updatedAt.
ALTER TABLE "Documents" ADD COLUMN "changeSummary" JSONB;
