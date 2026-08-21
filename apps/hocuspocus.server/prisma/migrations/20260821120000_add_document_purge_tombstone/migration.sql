-- Records that a documentId was purged. The seal that stops a purged room from being
-- re-opened is a per-process WeakSet, and Hocuspocus unloads a document as soon as its
-- last connection closes, so nothing durable said "purged" before this. onAuthenticate
-- reads DocumentMetadata, and a purged document has no row, so it looked identical to a
-- document that never existed and the handshake was allowed. A tab that was disconnected
-- at purge time came back on the old id and synced the erased content up. The
-- DocumentSlugEpoch bump does not cover that: it stops a new derivation from the slug
-- reaching the erased id, not a client already holding the id.
-- No foreign key: a relation to DocumentMetadata would cascade the tombstone away with
-- the very row the purge deletes. No backfill, so documents purged before this stay
-- resurrectable.
CREATE TABLE "DocumentPurgeTombstone" (
    "documentId" TEXT NOT NULL,
    "purgedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DocumentPurgeTombstone_pkey" PRIMARY KEY ("documentId")
);
