-- AlterTable: add locked_at_timestamp and locked_exchange_rate to contributions
-- These fields capture the exchange rate at the moment of transaction and are IMMUTABLE after creation.
ALTER TABLE "contributions" ADD COLUMN "locked_at_timestamp" TIMESTAMP(3);
ALTER TABLE "contributions" ADD COLUMN "locked_exchange_rate" DOUBLE PRECISION;
