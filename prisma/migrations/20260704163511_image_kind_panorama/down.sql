-- CAM-352 groundwork — reverse of image-kind-panorama (up: migration.sql).
-- Prisma Migrate does not auto-generate a down script; this file is the
-- reviewed, tested rollback per .claude/rules/api.md rule 6 / ops.md.
--
-- Drop the column first, then the enum type (a type cannot be dropped while
-- a column still references it). No data-loss beyond the `kind` marker itself
-- (the intent of a rollback) — zero data loss on url/alt/sortOrder/relations.

-- DropTable column
ALTER TABLE "Image" DROP COLUMN "kind";

-- DropEnum
DROP TYPE "ImageKind";
