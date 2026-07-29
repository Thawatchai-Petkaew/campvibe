-- CAM-670 — reversible down migration.
-- Reverses exactly what migration.sql did, in reverse order (drop the new
-- constraint before the index it depends on, then restore the original
-- single-column FK it replaced). This is additive/structural-only — no row
-- is rewritten, no column is dropped, no [Financial] value changes — so the
-- rollback is safe to run against real data.

-- DropForeignKey (the composite FK)
ALTER TABLE "Booking" DROP CONSTRAINT IF EXISTS "Booking_spotId_campSiteId_fkey";

-- DropIndex (the composite unique this migration added on Spot)
DROP INDEX IF EXISTS "Spot_id_campSiteId_key";

-- AddForeignKey (restore the original single-column FK exactly as it was:
-- Spot(id) only, ON DELETE SET NULL ON UPDATE CASCADE)
ALTER TABLE "Booking" ADD CONSTRAINT "Booking_spotId_fkey" FOREIGN KEY ("spotId") REFERENCES "Spot"("id") ON DELETE SET NULL ON UPDATE CASCADE;
