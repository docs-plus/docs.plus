/*
  Warnings:

  - You are about to drop the `Document` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropForeignKey
ALTER TABLE "DocumentMetadata" DROP CONSTRAINT "DocumentMetadata_documentId_fkey";

-- DropTable
DROP TABLE "Document";

-- CreateTable
CREATE TABLE "Documents" (
    "id" SERIAL NOT NULL,
    "documentId" TEXT NOT NULL,
    "data" BYTEA NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Documents_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "Documents" ADD CONSTRAINT "Documents_documentId_fkey" FOREIGN KEY ("documentId") REFERENCES "DocumentMetadata"("documentId") ON DELETE RESTRICT ON UPDATE CASCADE;
