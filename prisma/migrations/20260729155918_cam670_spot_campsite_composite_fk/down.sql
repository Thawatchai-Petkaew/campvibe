-- CAM-670 — reversible down migration.
-- Reverses exactly what migration.sql did, in reverse order (drop the new
-- FK before the unique index it depends on). This migration was PURELY
-- ADDITIVE — it never touched Booking's existing "Booking_spotId_fkey" — so
-- the rollback is a clean subtraction: no column dropped, no row rewritten,
-- no [Financial] value changes, and the original single-column FK (and its
-- SET NULL delete behaviour) was never altered in the first place.

-- DropForeignKey (the composite FK this migration added)
ALTER TABLE "Booking" DROP CONSTRAINT IF EXISTS "Booking_spotId_campSiteId_fkey";

-- DropIndex (the composite unique this migration added on Spot)
DROP INDEX IF EXISTS "Spot_id_campSiteId_key";
