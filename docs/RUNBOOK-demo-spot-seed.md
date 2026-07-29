# Runbook — demo spot-data seed (CAM-663)

Staging has 3,006 pitches across 783 camps, but only 2 images attached to
pitches in the whole database and only 2 camps have per-pitch mode
(`useSpotView`) on. `scripts/seed-demo-spots.mjs` picks ONE real, published
camp and curates 9 of its existing live pitches so every branch a spot-detail
screen (CAM-664) must handle has a real example: a wide panorama, several
photos, exactly one photo, no image at all (the dominant real state),
PER_SITE vs PER_PERSON pricing, a free pitch, mixed capacities (2/4/8), 3+
zones, a host-blocked date, an existing non-cancelled booking, and a very
long name.

## Usage (STAGING only — the script refuses a localhost `DATABASE_URL`)

```bash
# 1. Dry run first — prints the chosen camp + a per-branch count table, writes nothing:
DATABASE_URL="<staging-connection-string>" npm run seed:demo-spots -- --dry-run

# 2. Apply for real:
DATABASE_URL="<staging-connection-string>" npm run seed:demo-spots -- --apply

# Optional: override camp selection instead of the rule (published, >=10 live
# pitches, >=20 camp images, >=3 zones, highest completeness):
npm run seed:demo-spots -- --dry-run --camp <nameThSlug>

# Undo — removes exactly the rows this script created, always requires --camp:
npm run seed:demo-spots -- --undo --camp <nameThSlug>
```

## Idempotency + undo scope

Re-running (dry-run or apply) always resolves the same 9 pitches (the first
`DEMO_SPOT_COUNT` live spots of the chosen camp ordered by `id asc` — an
ordering this script's own writes never change), and every write is a
top-up-to-target-state check, so a second `--apply` creates zero additional
rows.

`--undo` removes exactly the Image/BlockedDate/Booking rows this script would
create (matched by exact URL / fixed demo date range) and resets
`useSpotView` back to `false`. It does **not** revert the
`priceUnit`/`maxCampers`/`zoneId`/`name`/`pricePerNight` overwrites made on
the 9 demo `Spot` rows — those are edits to pre-existing rows, and this
script does not persist their prior values anywhere. This is a deliberate,
documented scope limit (no schema/migration was in this story's surface).

## Guard

Refuses unless `DATABASE_URL` is set and does **not** resolve to
`localhost`/`127.0.0.1`/`::1` — the mirror image of
`scripts/db-sync-from-staging.mjs`'s guard. Logs only scheme+hostname via
`describeUrlShape` (`scripts/db-reset.mjs`), never the full connection
string (CAM-359/CAM-369).
