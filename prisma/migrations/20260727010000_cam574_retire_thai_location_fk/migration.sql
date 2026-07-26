-- CAM-574 (phase B of the ThailandLocation retirement the owner approved).
-- Retires the `Location.thaiLocationId` FK into `ThailandLocation` — every
-- write/read moved onto `Location.adminAreaId` (the AdminArea tree; already
-- populated for ~650/652 Location rows per CAM-573's measurement). Verified
-- (before writing this migration): no in-surface reader/writer of this FK
-- remains — see this story's tech.md reader/writer inventory.
--
-- The `ThailandLocation` TABLE itself is NOT dropped here — two direct
-- (non-FK) readers outside this story's file surface still legitimately
-- query it (app/api/geocode/_shared.ts's reverse-geocode resolution;
-- lib/read-models/camp-card.ts's province Thai-name fallback map) — see
-- tech.md "Known gap". Only the column/constraint/index on `Location` are
-- removed.
--
-- Down (proven up->down->up on the local dev DB before this PR, see the PR
-- body for the real command output):
--   ALTER TABLE "Location" ADD COLUMN "thaiLocationId" TEXT;
--   ALTER TABLE "Location" ADD CONSTRAINT "Location_thaiLocationId_fkey"
--     FOREIGN KEY ("thaiLocationId") REFERENCES "ThailandLocation"("id")
--     ON DELETE SET NULL ON UPDATE CASCADE;
--   CREATE INDEX "Location_thaiLocationId_idx" ON "Location"("thaiLocationId");
-- (the column comes back NULL for every row — accepted: CAM-545 measured
-- only 12/652 rows had this FK populated, all fully superseded by
-- `adminAreaId`, which is untouched by this migration either direction.)

-- DropForeignKey
ALTER TABLE "Location" DROP CONSTRAINT "Location_thaiLocationId_fkey";

-- DropIndex
DROP INDEX "Location_thaiLocationId_idx";

-- AlterTable
ALTER TABLE "Location" DROP COLUMN "thaiLocationId";

