-- CreateEnum
CREATE TYPE "UserRole" AS ENUM ('couple', 'guest', 'admin');

-- CreateEnum
CREATE TYPE "GiftStatus" AS ENUM ('pending', 'funding', 'funded', 'paid_out');

-- CreateEnum
CREATE TYPE "ContributionStatus" AS ENUM ('pending', 'completed', 'failed', 'refunded');

-- CreateEnum
CREATE TYPE "Currency" AS ENUM ('KZT', 'EUR', 'USD');

-- CreateTable
CREATE TABLE "users" (
    "id" SERIAL NOT NULL,
    "phone" TEXT NOT NULL,
    "role" "UserRole" NOT NULL DEFAULT 'guest',
    "password_hash" TEXT NOT NULL,
    "full_name" TEXT,
    "is_verified" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "couples" (
    "couple_id" INTEGER NOT NULL,
    "partner2_name" TEXT NOT NULL,
    "wedding_date" TIMESTAMP(3) NOT NULL,
    "venue" TEXT,
    "story" TEXT,
    "cover_photo_url" TEXT,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "couples_pkey" PRIMARY KEY ("couple_id")
);

-- CreateTable
CREATE TABLE "family_tree" (
    "id" SERIAL NOT NULL,
    "couple_id" INTEGER NOT NULL,
    "guest_id" INTEGER NOT NULL,
    "kinship_tier" TEXT NOT NULL,
    "parent_id" INTEGER,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "family_tree_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "gifts" (
    "id" SERIAL NOT NULL,
    "couple_id" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "target_amount" INTEGER NOT NULL,
    "funded_amount" INTEGER NOT NULL DEFAULT 0,
    "currency" "Currency" NOT NULL DEFAULT 'KZT',
    "status" "GiftStatus" NOT NULL DEFAULT 'pending',
    "allowed_tiers" JSONB NOT NULL DEFAULT '[]',
    "image_urls" JSONB NOT NULL DEFAULT '[]',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "gifts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "contributions" (
    "id" SERIAL NOT NULL,
    "gift_id" INTEGER NOT NULL,
    "guest_id" INTEGER NOT NULL,
    "amount" INTEGER NOT NULL,
    "exchange_rate_used" DOUBLE PRECISION NOT NULL DEFAULT 1.0,
    "currency_used" "Currency" NOT NULL,
    "original_amount" INTEGER NOT NULL,
    "status" "ContributionStatus" NOT NULL DEFAULT 'pending',
    "kaspi_payment_id" TEXT,
    "is_anonymous" BOOLEAN NOT NULL DEFAULT false,
    "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "contributions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "refresh_tokens" (
    "id" SERIAL NOT NULL,
    "token" TEXT NOT NULL,
    "user_id" INTEGER NOT NULL,
    "expires_at" TIMESTAMP(3) NOT NULL,
    "is_revoked" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "refresh_tokens_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_phone_key" ON "users"("phone");

-- CreateIndex
CREATE INDEX "family_tree_guest_id_couple_id_idx" ON "family_tree"("guest_id", "couple_id");

-- CreateIndex
CREATE UNIQUE INDEX "family_tree_couple_id_guest_id_key" ON "family_tree"("couple_id", "guest_id");

-- CreateIndex
CREATE INDEX "gifts_couple_id_status_idx" ON "gifts"("couple_id", "status");

-- CreateIndex
CREATE UNIQUE INDEX "contributions_kaspi_payment_id_key" ON "contributions"("kaspi_payment_id");

-- CreateIndex
CREATE INDEX "contributions_gift_id_status_idx" ON "contributions"("gift_id", "status");

-- CreateIndex
CREATE UNIQUE INDEX "refresh_tokens_token_key" ON "refresh_tokens"("token");

-- AddForeignKey
ALTER TABLE "couples" ADD CONSTRAINT "couples_couple_id_fkey" FOREIGN KEY ("couple_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "family_tree" ADD CONSTRAINT "family_tree_couple_id_fkey" FOREIGN KEY ("couple_id") REFERENCES "couples"("couple_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "family_tree" ADD CONSTRAINT "family_tree_guest_id_fkey" FOREIGN KEY ("guest_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "family_tree" ADD CONSTRAINT "family_tree_parent_id_fkey" FOREIGN KEY ("parent_id") REFERENCES "family_tree"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "gifts" ADD CONSTRAINT "gifts_couple_id_fkey" FOREIGN KEY ("couple_id") REFERENCES "couples"("couple_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "contributions" ADD CONSTRAINT "contributions_gift_id_fkey" FOREIGN KEY ("gift_id") REFERENCES "gifts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "contributions" ADD CONSTRAINT "contributions_guest_id_fkey" FOREIGN KEY ("guest_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "refresh_tokens" ADD CONSTRAINT "refresh_tokens_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
