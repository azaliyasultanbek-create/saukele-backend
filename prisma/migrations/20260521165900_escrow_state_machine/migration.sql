/*
  Warnings:

  - The values [paid_out] on the enum `GiftStatus` will be removed. If these variants are still used in the database, this will fail.

*/
-- AlterEnum
BEGIN;
CREATE TYPE "GiftStatus_new" AS ENUM ('pending', 'funding', 'funded', 'purchased', 'delivered');
ALTER TABLE "gifts" ALTER COLUMN "status" DROP DEFAULT;
ALTER TABLE "gifts" ALTER COLUMN "status" TYPE "GiftStatus_new" USING ("status"::text::"GiftStatus_new");
ALTER TYPE "GiftStatus" RENAME TO "GiftStatus_old";
ALTER TYPE "GiftStatus_new" RENAME TO "GiftStatus";
DROP TYPE "GiftStatus_old";
ALTER TABLE "gifts" ALTER COLUMN "status" SET DEFAULT 'pending';
COMMIT;

-- AlterTable
ALTER TABLE "contributions" ADD COLUMN     "escrow_approved_at" TIMESTAMP(3),
ADD COLUMN     "escrow_approved_by" INTEGER;

-- AlterTable
ALTER TABLE "family_tree" ALTER COLUMN "category" DROP DEFAULT;

-- AlterTable
ALTER TABLE "gifts" ADD COLUMN     "version" INTEGER NOT NULL DEFAULT 1;
