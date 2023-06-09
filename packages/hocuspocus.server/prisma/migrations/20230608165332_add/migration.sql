-- CreateTable
CREATE TABLE "Keywords" (
    "id" SERIAL NOT NULL,
    "keyword" TEXT NOT NULL,
    "documentMetadataId" INTEGER NOT NULL,

    CONSTRAINT "Keywords_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "Keywords" ADD CONSTRAINT "Keywords_documentMetadataId_fkey" FOREIGN KEY ("documentMetadataId") REFERENCES "DocumentMetadata"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
