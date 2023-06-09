/*
  Warnings:

  - The primary key for the `Document` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - You are about to drop the column `id` on the `Document` table. All the data in the column will be lost.

*/
-- DropForeignKey
ALTER TABLE "DocumentMetadata" DROP CONSTRAINT "DocumentMetadata_documentId_fkey";

-- AlterTable
ALTER TABLE "Document" DROP CONSTRAINT "Document_pkey",
DROP COLUMN "id",
ADD CONSTRAINT "Document_pkey" PRIMARY KEY ("documentId");

-- AddForeignKey
ALTER TABLE "DocumentMetadata" ADD CONSTRAINT "DocumentMetadata_documentId_fkey" FOREIGN KEY ("documentId") REFERENCES "Document"("documentId") ON DELETE RESTRICT ON UPDATE CASCADE;
