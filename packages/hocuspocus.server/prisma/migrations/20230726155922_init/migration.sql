-- CreateEnum
CREATE TYPE "Role" AS ENUM ('owner', 'collaborator');

-- CreateTable
CREATE TABLE "Documents" (
    "id" SERIAL NOT NULL,
    "documentId" TEXT NOT NULL,
    "data" BYTEA NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,
    CONSTRAINT "Documents_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DocumentMetadata" (
    "id" SERIAL NOT NULL,
    "slug" TEXT NOT NULL,
    "title" TEXT,
    "description" TEXT,
    "keywords" TEXT,
    "isPrivate" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "documentId" TEXT NOT NULL,
    "readOnly" BOOLEAN NOT NULL DEFAULT false,
    "ownerId" TEXT,
    "email" TEXT,

    CONSTRAINT "DocumentMetadata_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DocumentUsers" (
    "documentId" INTEGER NOT NULL,
    "userId" TEXT NOT NULL,
    "role" "Role" DEFAULT 'collaborator',
    "email" TEXT,

    CONSTRAINT "DocumentUsers_pkey" PRIMARY KEY ("documentId","userId")
);

-- CreateIndex
CREATE UNIQUE INDEX "DocumentMetadata_slug_key" ON "DocumentMetadata"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "DocumentMetadata_documentId_key" ON "DocumentMetadata"("documentId");

-- CreateIndex
CREATE INDEX "Documents_documentId_version_idx" ON "Documents"("documentId", "version");

-- AddForeignKey
ALTER TABLE "Documents" ADD CONSTRAINT "Documents_documentId_fkey" FOREIGN KEY ("documentId") REFERENCES "DocumentMetadata"("documentId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DocumentUsers" ADD CONSTRAINT "DocumentUsers_documentId_fkey" FOREIGN KEY ("documentId") REFERENCES "Documents"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
