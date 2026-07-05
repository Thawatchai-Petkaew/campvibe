-- CAM-362 — reverse of the Zone entity migration (up: migration.sql).
-- Prisma Migrate does not auto-generate a down script; this file is the
-- reviewed, tested rollback per .claude/rules/api.md rule 6 / ops.md.
--
-- Reversibility guarantee (tech.md §2.3): the UP migration never modifies
-- Spot.zone — it only ADDS zoneId, backfills it, and creates the Zone table.
-- So DOWN restores the exact prior state: every original Spot.zone string is
-- still present. The ONLY thing lost on rollback is the extracted entity
-- (Zone rows + the zoneId links) — the accepted "backfill loss" (tech.md
-- §0.3-A). No data-destroying rollback.
--
-- Drop order: index -> FK -> index -> column -> table (children before the
-- parent Zone table; a column can't be dropped while a FK still references
-- the table it points to).

-- DropIndex (the hand-written partial unique index)
DROP INDEX IF EXISTS "Zone_campSiteId_name_active_key";

-- DropForeignKey
ALTER TABLE "Spot" DROP CONSTRAINT IF EXISTS "Spot_zoneId_fkey";

-- DropIndex
DROP INDEX IF EXISTS "Spot_zoneId_idx";

-- AlterTable
ALTER TABLE "Spot" DROP COLUMN IF EXISTS "zoneId";

-- DropForeignKey
ALTER TABLE "Zone" DROP CONSTRAINT IF EXISTS "Zone_campSiteId_fkey";

-- DropTable
DROP TABLE IF EXISTS "Zone";
