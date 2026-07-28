-- CAM-642 — reversible down migration.
-- Reverses exactly what migration.sql did: drops the additive "source"
-- column (+ its enum), and restores Booking.status's prior default.
-- Both changes are additive/metadata-only (no data-destroying drop of an
-- existing populated column), so this down is safe to run against real rows.
ALTER TABLE "Booking" ALTER COLUMN "status" SET DEFAULT 'CONFIRMED';
ALTER TABLE "Booking" DROP COLUMN "source";
DROP TYPE IF EXISTS "BookingSource";
