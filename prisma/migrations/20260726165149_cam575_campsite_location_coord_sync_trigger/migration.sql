-- CAM-575 — CampSite.latitude/longitude is the canonical source of a camp's
-- coordinates; Location.lat/lon is derived. Enforced with a database trigger
-- (not a comment / not "every writer remembers to sync it") so that ANY
-- write path that touches CampSite.latitude/longitude — this app's API
-- routes, every backfill/seed script, any future one nobody has written
-- yet — can never leave Location.lat/lon out of sync, because Postgres runs
-- this trigger synchronously inside the SAME transaction as the write that
-- fired it.
--
-- Direction is one-way ONLY: CampSite -> Location. Location.lat/lon is never
-- read back to change CampSite (that would put CampSite's canonical status
-- at the mercy of whatever touches Location last, which is exactly the bug
-- this story closes).
--
-- Fires on INSERT (a new camp's coordinates immediately populate its linked
-- Location row, even though Location must be created first for the FK) and
-- on UPDATE of latitude/longitude/locationId (an edited pin, or a camp
-- re-homed to a different Location row, both stay in sync). A Location with
-- zero linked CampSites — e.g. the 2 orphaned placeholder rows already in
-- the dev DB (province:'x', lat/lon null, no camp attached) — is never
-- touched by this trigger; nothing about them is canonical from a CampSite
-- because no CampSite references them.
--
-- Reversible: DROP TRIGGER + DROP FUNCTION (both IF EXISTS) fully undo this
-- migration with no data loss — see tech.md's up/down/up proof.

CREATE OR REPLACE FUNCTION sync_location_coords_from_campsite()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE "Location"
  SET "lat" = NEW."latitude", "lon" = NEW."longitude"
  WHERE "id" = NEW."locationId"
    AND ("lat" IS DISTINCT FROM NEW."latitude" OR "lon" IS DISTINCT FROM NEW."longitude");
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER campsite_coords_sync
AFTER INSERT OR UPDATE OF "latitude", "longitude", "locationId" ON "CampSite"
FOR EACH ROW
EXECUTE FUNCTION sync_location_coords_from_campsite();
