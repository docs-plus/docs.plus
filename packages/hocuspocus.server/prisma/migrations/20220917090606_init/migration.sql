-- CreateTable
CREATE TABLE "Documents" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "data" BYTEA NOT NULL,

    CONSTRAINT "Documents_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Documents_name_key" ON "Documents"("name");
