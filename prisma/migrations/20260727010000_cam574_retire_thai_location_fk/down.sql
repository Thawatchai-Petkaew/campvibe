-- CAM-574 — reversible down migration. Re-adds the `Location.thaiLocationId`
-- FK + index this story's up migration dropped. The column comes back NULL
-- for every row (data loss is accepted: CAM-545 measured only 12/652 rows
-- had this FK populated at all, and every one of those is superseded by
-- `Location.adminAreaId`, which this migration does not touch in either
-- direction). Proven up -> down -> up on the local dev DB before this PR.
ALTER TABLE "Location" ADD COLUMN "thaiLocationId" TEXT;

ALTER TABLE "Location" ADD CONSTRAINT "Location_thaiLocationId_fkey"
  FOREIGN KEY ("thaiLocationId") REFERENCES "ThailandLocation"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

CREATE INDEX "Location_thaiLocationId_idx" ON "Location"("thaiLocationId");
