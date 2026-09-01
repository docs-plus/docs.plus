-- Soft-delete keeps the join so restore stays favorited. Purge cascade drops it.
-- documentId leads the primary key so the metadata FK cascade is indexed.
CREATE TABLE "DocumentFavorite" (
    "userId" TEXT NOT NULL,
    "documentId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DocumentFavorite_pkey" PRIMARY KEY ("documentId","userId")
);

CREATE INDEX "DocumentFavorite_userId_idx" ON "DocumentFavorite"("userId");

ALTER TABLE "DocumentFavorite"
    ADD CONSTRAINT "DocumentFavorite_documentId_fkey"
    FOREIGN KEY ("documentId") REFERENCES "DocumentMetadata"("documentId")
    ON DELETE CASCADE ON UPDATE CASCADE;
