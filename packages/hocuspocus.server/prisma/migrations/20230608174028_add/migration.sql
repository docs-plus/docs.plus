/*
  Warnings:

  - You are about to drop the `Keywords` table. If the table is not empty, all the data it contains will be lost.
  - Added the required column `keywords` to the `DocumentMetadata` table without a default value. This is not possible if the table is not empty.

*/
-- DropForeignKey
ALTER TABLE "Keywords" DROP CONSTRAINT "Keywords_documentMetadataId_fkey";

-- AlterTable
ALTER TABLE "DocumentMetadata" ADD COLUMN     "keywords" TEXT NOT NULL;

-- DropTable
DROP TABLE "Keywords";
