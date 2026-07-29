-- CreateEnum
CREATE TYPE "PricingUnit" AS ENUM ('PER_PERSON', 'PER_TENT', 'PER_SITE');

-- AlterTable
ALTER TABLE "Booking" ADD COLUMN     "snapshotPricingUnit" "PricingUnit",
ADD COLUMN     "snapshotQuantity" INTEGER;

-- AlterTable
ALTER TABLE "CampSite" ADD COLUMN     "priceUnit" "PricingUnit" NOT NULL DEFAULT 'PER_SITE';

-- AlterTable
ALTER TABLE "Spot" ADD COLUMN     "priceUnit" "PricingUnit" NOT NULL DEFAULT 'PER_SITE';
