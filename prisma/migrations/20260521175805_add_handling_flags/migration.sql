-- AlterTable
ALTER TABLE "gifts" ADD COLUMN     "handling_flags" JSONB NOT NULL DEFAULT '[]';
