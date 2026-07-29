-- CAM-670 (ADR-012 §4): the database-level guarantee that a booking's spotId
-- can only ever name a pitch that belongs to that SAME booking's campSiteId.
-- CAM-668 closed this hole at the application layer (the booking route
-- rejects a foreign spotId inside its Serializable transaction); this
-- migration adds the DB constraint so a future code path that skips that
-- check still cannot write a mismatched row.
--
-- Verified against staging on 2026-07-29 (orchestrator, not re-derived here):
-- bookings total 2,618 · non-null spotId 2,529 · rows whose spotId points at
-- a DIFFERENT camp: 0 · rows whose spotId points at a soft-deleted pitch: 0.
-- The constraint applies cleanly — no backfill, no data rewrite needed.
--
-- Mechanism: Postgres requires a UNIQUE constraint on EXACTLY the referenced
-- column set before a composite FK can point at it. Spot.id is already
-- unique (PK) alone, so this adds (id, campSiteId) as a second unique
-- constraint, then repoints Booking's existing spotId FK at that composite
-- key instead of Spot.id alone. The old single-column
-- "Booking_spotId_fkey" is dropped and replaced — the new composite FK is a
-- strict superset of what it guaranteed (spotId still must reference a real
-- Spot row; it additionally must share campSiteId with the booking).
--
-- spotId stays NULLABLE. Postgres FK MATCH SIMPLE (the default, and what
-- this migration uses — no MATCH FULL/PARTIAL specified) skips the
-- constraint check entirely when ANY referencing column is NULL. Booking's
-- campSiteId is NOT NULL, but spotId is nullable, so every ordinary
-- spotId=NULL booking (the overwhelming majority) is completely unaffected —
-- confirmed behaviorally by this story's DB-level test (a NULL spotId insert
-- succeeds unchanged).
--
-- onDelete changes from the old FK's SET NULL to RESTRICT (Prisma's default
-- for a relation with a required column, and the semantically correct
-- choice): SET NULL on this composite FK would require setting BOTH
-- referencing columns to NULL on a referenced-row delete, but campSiteId is
-- NOT NULL on Booking — a SET NULL constraint here could only ever fail at
-- delete-time with a NOT NULL violation. RESTRICT reports the same
-- protection cleanly and up front instead. No behavioral risk today: no
-- reader in app/lib/scripts hard-deletes a Spot row (Spot uses soft-delete
-- via deletedAt only, grep-verified: no `prisma.spot.delete(` call exists in
-- app/, lib/, or scripts/).

-- DropForeignKey (the old single-column FK this composite one supersedes)
ALTER TABLE "Booking" DROP CONSTRAINT "Booking_spotId_fkey";

-- CreateIndex (composite unique — the referenced side the composite FK needs)
CREATE UNIQUE INDEX "Spot_id_campSiteId_key" ON "Spot"("id", "campSiteId");

-- AddForeignKey (the composite FK itself)
ALTER TABLE "Booking" ADD CONSTRAINT "Booking_spotId_campSiteId_fkey" FOREIGN KEY ("spotId", "campSiteId") REFERENCES "Spot"("id", "campSiteId") ON DELETE RESTRICT ON UPDATE CASCADE;
