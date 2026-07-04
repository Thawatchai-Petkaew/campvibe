-- CAM-269 (PREP-3): verified-stay gate for reviews.
--
-- Adds Review.bookingId (nullable, unique — one review per Booking) and
-- Review.verified (default false). Reversible via the paired down.sql
-- (DROP COLUMN, no other table affected).
--
-- Backfill / pre-launch reset policy: existing Review rows predate the
-- verified-stay gate and have no reliable, deterministic Booking to bind to
-- (a legacy review may correspond to zero, one, or several historical
-- bookings for the same user+campSite — there is no way to recover which
-- one, if any, it was written about). Per the pre-launch data policy
-- (production is still gated behind COMING_SOON, no real end-user reviews
-- exist yet), those rows are intentionally left bookingId=NULL and
-- verified=false (the column DEFAULT already covers this — no separate
-- UPDATE needed) so they are excluded from any `verified: true`-filtered
-- read going forward, rather than fabricating a booking link that isn't true.
-- A Postgres unique index permits multiple NULLs, so this coexists safely
-- with the new @unique constraint on bookingId.

-- AlterTable
ALTER TABLE "Review" ADD COLUMN     "bookingId" TEXT,
ADD COLUMN     "verified" BOOLEAN NOT NULL DEFAULT false;

-- CreateIndex
CREATE UNIQUE INDEX "Review_bookingId_key" ON "Review"("bookingId");

-- CreateIndex
CREATE INDEX "Review_campSiteId_verified_idx" ON "Review"("campSiteId", "verified");

-- AddForeignKey
ALTER TABLE "Review" ADD CONSTRAINT "Review_bookingId_fkey" FOREIGN KEY ("bookingId") REFERENCES "Booking"("id") ON DELETE SET NULL ON UPDATE CASCADE;
