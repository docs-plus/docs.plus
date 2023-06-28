/*
  Warnings:

  - You are about to drop the column `read_only` on the `DocumentMetadata` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "DocumentMetadata" DROP COLUMN "read_only",
ADD COLUMN     "readOnly" BOOLEAN NOT NULL DEFAULT false;
