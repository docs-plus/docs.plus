-- A draft's documentId is derived from its slug, so two people opening the same
-- new slug land in the same Yjs room instead of forking into two documents. The
-- epoch is what keeps that safe across a purge: freeing a slug would otherwise let
-- the next visitor derive the purged document's id, and a stale IndexedDB mirror
-- on that key could sync erased content back up. Bumped inside the purge
-- transaction, so the slug is never free at an epoch a client already holds.
-- No backfill: rows created before this keep their random ids, and a slug with no
-- row here derives at epoch 1.
-- No DEFAULT on epoch: an absent row already means INITIAL_EPOCH, so a writer that
-- omits the column would silently mint that same state instead of failing.
CREATE TABLE "DocumentSlugEpoch" (
    "slug" TEXT NOT NULL,
    "epoch" INTEGER NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DocumentSlugEpoch_pkey" PRIMARY KEY ("slug")
);
