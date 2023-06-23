-- CreateEnum
CREATE TYPE "Role" AS ENUM ('owner', 'collaborator');

-- AlterTable
ALTER TABLE "DocumentMetadata" ALTER COLUMN "title" DROP NOT NULL,
ALTER COLUMN "description" DROP NOT NULL,
ALTER COLUMN "keywords" DROP NOT NULL;

-- AlterTable
ALTER TABLE "Documents" ADD COLUMN     "ownerId" TEXT;

-- CreateTable
CREATE TABLE "DocumentUsers" (
    "documentId" INTEGER NOT NULL,
    "userId" TEXT NOT NULL,
    "role" "Role" NOT NULL,
    "email" TEXT NOT NULL,

    CONSTRAINT "DocumentUsers_pkey" PRIMARY KEY ("documentId","userId")
);

-- AddForeignKey
ALTER TABLE "DocumentUsers" ADD CONSTRAINT "DocumentUsers_documentId_fkey" FOREIGN KEY ("documentId") REFERENCES "Documents"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
