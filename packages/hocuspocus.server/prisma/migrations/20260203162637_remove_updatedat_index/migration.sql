-- DropIndex
DROP INDEX "DocumentMetadata_updatedAt_idx";

-- AlterTable
ALTER TABLE "EmailSentLog" ALTER COLUMN "expiresAt" SET DEFAULT NOW() + INTERVAL '7 days';

-- AlterTable
ALTER TABLE "PushSentLog" ALTER COLUMN "expiresAt" SET DEFAULT NOW() + INTERVAL '7 days';
