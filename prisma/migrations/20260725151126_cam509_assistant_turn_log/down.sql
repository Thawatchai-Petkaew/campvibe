-- CAM-509 — reversible down migration (additive-only up: new table only, no
-- change to any existing table). Drops exactly what up migration.sql created.
DROP TABLE IF EXISTS "AssistantTurnLog";
