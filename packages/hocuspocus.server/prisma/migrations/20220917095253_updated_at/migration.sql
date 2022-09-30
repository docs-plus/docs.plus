/*
  Warnings:

  - Added the required column `updatedAt` to the `Documents` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "Documents" ADD COLUMN     "updatedAt" TIMESTAMP(3) NOT NULL;
