-- S4a (ADR-003): CSV taxonomies -> options MasterData relation.
-- Pre-launch clean breaking migration: drop the 6 multi-value CSV columns;
-- their data is reseeded as `options` connections (no backfill).

-- AlterTable
ALTER TABLE "CampSite" DROP COLUMN "accessTypes",
DROP COLUMN "activities",
DROP COLUMN "equipment",
DROP COLUMN "externalFacilities",
DROP COLUMN "facilities",
DROP COLUMN "terrain";

