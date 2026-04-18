-- AlterTable
ALTER TABLE "Receipt" ADD COLUMN "aeatSummary" TEXT;
ALTER TABLE "Receipt" ADD COLUMN "aeatSources" TEXT;
ALTER TABLE "Receipt" ADD COLUMN "reviewRequired" BOOLEAN NOT NULL DEFAULT false;
