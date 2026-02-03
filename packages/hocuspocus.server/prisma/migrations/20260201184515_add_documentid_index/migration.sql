-- AlterTable
ALTER TABLE "EmailSentLog" ALTER COLUMN "expiresAt" SET DEFAULT NOW() + INTERVAL '7 days';

-- AlterTable
ALTER TABLE "PushSentLog" ALTER COLUMN "expiresAt" SET DEFAULT NOW() + INTERVAL '7 days';

-- CreateIndex
CREATE INDEX "Documents_documentId_idx" ON "Documents"("documentId");
