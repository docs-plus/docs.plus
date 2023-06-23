-- AlterTable
ALTER TABLE "DocumentUsers" ALTER COLUMN "role" DROP NOT NULL,
ALTER COLUMN "role" SET DEFAULT 'collaborator',
ALTER COLUMN "email" DROP NOT NULL;
