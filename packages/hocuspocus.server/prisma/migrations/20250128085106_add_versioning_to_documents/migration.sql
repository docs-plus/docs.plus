-- AlterTable
ALTER TABLE "Documents" ADD COLUMN     "commitMessage" TEXT,
ADD COLUMN     "version" INTEGER NOT NULL DEFAULT 1;

-- CreateIndex
CREATE INDEX "Documents_documentId_version_idx" ON "Documents"("documentId", "version");
