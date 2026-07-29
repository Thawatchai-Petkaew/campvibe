-- CAM-650 — reversible down migration.
-- Reverses exactly what migration.sql did: drops the three additive
-- "priceUnit"/"snapshotPricingUnit"/"snapshotQuantity" columns, then the
-- "PricingUnit" enum type. All three changes are additive-with-a-default (or
-- nullable), so this down is safe to run against real rows — no existing
-- column is altered, renamed, or dropped, and no [Financial] value on any
-- other column is rewritten.
--
-- Drop the columns first, then the enum type (a type cannot be dropped while
-- a column still references it) — same order as
-- prisma/migrations/20260704163511_image_kind_panorama/down.sql.
ALTER TABLE "CampSite" DROP COLUMN "priceUnit";
ALTER TABLE "Spot" DROP COLUMN "priceUnit";
ALTER TABLE "Booking" DROP COLUMN "snapshotPricingUnit";
ALTER TABLE "Booking" DROP COLUMN "snapshotQuantity";

DROP TYPE "PricingUnit";
