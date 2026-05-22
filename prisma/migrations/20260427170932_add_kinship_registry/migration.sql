-- CreateEnum
CREATE TYPE "KinshipCategory" AS ENUM ('ATA_ANA', 'ZHIEN_ZhARAN', 'KUDA_ZHEKZhEN');

-- AlterTable: add category column to family_tree
ALTER TABLE "family_tree" ADD COLUMN "category" "KinshipCategory" NOT NULL DEFAULT 'ATA_ANA';

-- CreateIndex
CREATE INDEX "family_tree_category_idx" ON "family_tree"("category");

-- CreateTable: kinship_registry
CREATE TABLE "kinship_registry" (
    "id" SERIAL NOT NULL,
    "couple_id" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "category" "KinshipCategory" NOT NULL,
    "parent_id" INTEGER,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "kinship_registry_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "kinship_registry_couple_id_name_key" ON "kinship_registry"("couple_id", "name");

-- CreateIndex
CREATE INDEX "kinship_registry_couple_id_category_idx" ON "kinship_registry"("couple_id", "category");

-- AddForeignKey
ALTER TABLE "kinship_registry" ADD CONSTRAINT "kinship_registry_couple_id_fkey" FOREIGN KEY ("couple_id") REFERENCES "couples"("couple_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "kinship_registry" ADD CONSTRAINT "kinship_registry_parent_id_fkey" FOREIGN KEY ("parent_id") REFERENCES "kinship_registry"("id") ON DELETE SET NULL ON UPDATE CASCADE;
