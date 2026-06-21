-- S3: money Float -> Decimal(12,2) + ISO 4217 currency (docs/adr/ADR-002).
-- Forward-compatible: numeric widening cast (no data loss) + currency columns with default.

-- AlterTable
ALTER TABLE "Booking" ADD COLUMN     "currency" TEXT NOT NULL DEFAULT 'THB',
ALTER COLUMN "totalPrice" SET DATA TYPE DECIMAL(12,2);

-- AlterTable
ALTER TABLE "CampSite" ADD COLUMN     "priceCurrency" TEXT NOT NULL DEFAULT 'THB',
ALTER COLUMN "priceLow" SET DATA TYPE DECIMAL(12,2),
ALTER COLUMN "priceHigh" SET DATA TYPE DECIMAL(12,2);

-- AlterTable
ALTER TABLE "Spot" ADD COLUMN     "priceCurrency" TEXT NOT NULL DEFAULT 'THB',
ALTER COLUMN "pricePerNight" SET DATA TYPE DECIMAL(12,2),
ALTER COLUMN "pricePerSite" SET DATA TYPE DECIMAL(12,2);
