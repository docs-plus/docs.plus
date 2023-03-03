-- CreateTable
CREATE TABLE "Documents" (
    "id" SERIAL NOT NULL,
    "data" BYTEA NOT NULL,
    "documentId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Documents_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DocumentMetadata" (
    "id" SERIAL NOT NULL,
    "slug" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "isPrivate" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "documentId" TEXT,

    CONSTRAINT "DocumentMetadata_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "DocumentMetadata_slug_key" ON "DocumentMetadata"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "DocumentMetadata_documentId_key" ON "DocumentMetadata"("documentId");
