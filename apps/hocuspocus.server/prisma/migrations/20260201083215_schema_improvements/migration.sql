/*
  Warnings:

  - The primary key for the `DocumentUsers` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - You are about to drop the column `documentId` on the `DocumentUsers` table. All the data in the column will be lost.
  - Added the required column `documentPk` to the `DocumentUsers` table without a default value. This is not possible if the table is not empty.

*/
-- DropForeignKey
ALTER TABLE "DocumentUsers" DROP CONSTRAINT "DocumentUsers_documentId_fkey";

-- DropForeignKey
ALTER TABLE "Documents" DROP CONSTRAINT "Documents_documentId_fkey";

-- AlterTable
ALTER TABLE "DocumentUsers" DROP CONSTRAINT "DocumentUsers_pkey",
DROP COLUMN "documentId",
ADD COLUMN     "documentPk" INTEGER NOT NULL,
ADD CONSTRAINT "DocumentUsers_pkey" PRIMARY KEY ("documentPk", "userId");

-- CreateTable
CREATE TABLE "EmailSentLog" (
    "id" TEXT NOT NULL,
    "idempotencyKey" TEXT NOT NULL,
    "messageId" TEXT,
    "recipient" TEXT NOT NULL,
    "emailType" TEXT,
    "sentAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3) NOT NULL DEFAULT NOW() + INTERVAL '7 days',

    CONSTRAINT "EmailSentLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PushSentLog" (
    "id" TEXT NOT NULL,
    "idempotencyKey" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "subscriptionCount" INTEGER NOT NULL DEFAULT 0,
    "sentAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3) NOT NULL DEFAULT NOW() + INTERVAL '7 days',

    CONSTRAINT "PushSentLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "EmailSentLog_idempotencyKey_key" ON "EmailSentLog"("idempotencyKey");

-- CreateIndex
CREATE INDEX "EmailSentLog_expiresAt_idx" ON "EmailSentLog"("expiresAt");

-- CreateIndex
CREATE INDEX "EmailSentLog_recipient_sentAt_idx" ON "EmailSentLog"("recipient", "sentAt");

-- CreateIndex
CREATE UNIQUE INDEX "PushSentLog_idempotencyKey_key" ON "PushSentLog"("idempotencyKey");

-- CreateIndex
CREATE INDEX "PushSentLog_expiresAt_idx" ON "PushSentLog"("expiresAt");

-- CreateIndex
CREATE INDEX "PushSentLog_userId_sentAt_idx" ON "PushSentLog"("userId", "sentAt");

-- CreateIndex
CREATE INDEX "DocumentMetadata_ownerId_idx" ON "DocumentMetadata"("ownerId");

-- CreateIndex
CREATE INDEX "DocumentMetadata_updatedAt_idx" ON "DocumentMetadata"("updatedAt");

-- CreateIndex
CREATE INDEX "DocumentUsers_userId_idx" ON "DocumentUsers"("userId");

-- CreateIndex
CREATE INDEX "Documents_createdAt_idx" ON "Documents"("createdAt");

-- AddForeignKey
ALTER TABLE "Documents" ADD CONSTRAINT "Documents_documentId_fkey" FOREIGN KEY ("documentId") REFERENCES "DocumentMetadata"("documentId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DocumentUsers" ADD CONSTRAINT "DocumentUsers_documentPk_fkey" FOREIGN KEY ("documentPk") REFERENCES "Documents"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- RenameIndex
ALTER INDEX "Documents_documentId_version_unique" RENAME TO "Documents_documentId_version_key";
