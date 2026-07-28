-- Maps a Yjs clientID to the Supabase sub that authored under it, so a version
-- diff can name who wrote each block. Forward-only, no backfill possible: the
-- clientID->user link exists only in the live onChange payload and is destroyed
-- once the update is merged, so every clientID in every pre-existing document row
-- resolves to nothing and those ranges render as unattributed.
-- clientId is BIGINT, not INTEGER: Yjs clientIDs are uint32 and half exceed int4.
-- No secondary index. The composite primary key's leading column serves both the
-- only read (documentId = $1 AND clientId = ANY($2)) and the FK cascade delete,
-- which Postgres does not index automatically.
CREATE TABLE "DocumentClientAuthor" (
    "documentId" TEXT NOT NULL,
    "clientId" BIGINT NOT NULL,
    "userId" TEXT NOT NULL,
    "isAnonymous" BOOLEAN NOT NULL DEFAULT false,
    "firstSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DocumentClientAuthor_pkey" PRIMARY KEY ("documentId","clientId")
);

ALTER TABLE "DocumentClientAuthor"
    ADD CONSTRAINT "DocumentClientAuthor_documentId_fkey"
    FOREIGN KEY ("documentId") REFERENCES "DocumentMetadata"("documentId")
    ON DELETE CASCADE ON UPDATE CASCADE;
