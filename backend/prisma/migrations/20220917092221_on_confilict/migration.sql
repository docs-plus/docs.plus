/*
  Warnings:

  - A unique constraint covering the columns `[id,name]` on the table `Documents` will be added. If there are existing duplicate values, this will fail.

*/
-- CreateIndex
CREATE UNIQUE INDEX "Documents_id_name_key" ON "Documents"("id", "name");
