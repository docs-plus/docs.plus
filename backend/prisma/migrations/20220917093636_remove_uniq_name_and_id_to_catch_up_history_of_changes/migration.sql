-- DropIndex
DROP INDEX "Documents_id_name_key";

-- DropIndex
DROP INDEX "Documents_name_key";

-- AlterTable
ALTER TABLE "Documents" ADD COLUMN     "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;
