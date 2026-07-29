# Runbook — demo spot-data seed (CAM-663)

Staging has 3,006 pitches across 783 camps, but only 2 images attached to
pitches in the whole database and only 2 camps have per-pitch mode
(`useSpotView`) on. `scripts/seed-demo-spots.mjs` picks ONE real, published
camp and **creates 9 brand-new demo pitches on it — it never mutates an
existing pitch** — so every branch a spot-detail screen (CAM-664) must handle
has a real example: a wide panorama, several photos, exactly one photo, no
image at all (the dominant real state), PER_SITE vs PER_PERSON pricing, a
free pitch, mixed capacities (2/4/8), 3+ zones, a host-blocked date, an
existing non-cancelled booking, and a very long name.

## Usage (STAGING only — the script refuses a localhost `DATABASE_URL`)

```bash
# 1. Dry run first — prints the chosen camp + a per-branch count table, writes nothing:
DATABASE_URL="<staging-connection-string>" npm run seed:demo-spots -- --dry-run

# 2. Apply for real:
DATABASE_URL="<staging-connection-string>" npm run seed:demo-spots -- --apply

# Optional: override camp selection instead of the rule (published, useSpotView=false,
# >=10 live pitches, >=20 camp images, >=3 zones, highest completeness):
npm run seed:demo-spots -- --dry-run --camp <nameThSlug>

# Undo — removes exactly the pitches (+ their images/booking/blockedDate) this
# script created, always requires --camp:
npm run seed:demo-spots -- --undo --camp <nameThSlug>
```

## Reversible by construction (design)

An earlier draft of this script mutated 9 of the camp's REAL existing
pitches (`priceUnit`/`maxCampers`/`zoneId`/name/price) instead of creating
new ones. That was caught before it ran: mutating real host data with no
recorded "before" value cannot be undone, no matter how `--undo` is written.

The current design **only ever `prisma.spot.create()`s new pitches** —
never `spot.update()` on a real row. Every demo pitch's `Spot.name` starts
with `DEMO_NAME_PREFIX` (`"CAM-663 Demo — "`), a durable, exact-match
identity marker (the same idea as the fixed image-URL pool and fixed
booking/blockedDate date range this script already used) — no real host
names a pitch that way. `--undo` finds every row carrying that marker and
removes it; nothing about a real pitch is ever read, written, or deleted.

`viewType`/`environment`/`nearFacilities` are copied from one real sibling
pitch on the same camp (read-only) so the new rows look native instead of
carrying nulls in columns every real pitch already has populated.

### Cleanup order (verified against `prisma/migrations`, not assumed)

Deleting a `Spot` does **not** uniformly cascade its children — the three
child FKs behave differently:

| Child | `spotId` FK | Migration |
|---|---|---|
| `Image` | `ON DELETE CASCADE` | `20260621121000_s4b_image_table` |
| `Booking` | `ON DELETE SET NULL` | `20260620112306_init` |
| `BlockedDate` | `ON DELETE SET NULL` | `20260621113624_s7_roadmap_entities` |

Only `Image` would actually disappear on a bare `Spot` delete; `Booking` and
`BlockedDate` would survive as orphaned NULL-`spotId` rows. `undoPlan`
therefore deletes `Booking`, then `BlockedDate`, then `Image`, then the
`Spot` row itself, explicitly, in that order — never relying on cascade.

### Soft vs hard delete on undo

`--undo` **hard-deletes** the demo `Spot` rows (not soft-delete via
`deletedAt`), deliberately: these rows have no real booking/host history
worth preserving — this script is their entire lifecycle, create to
delete — and a soft-deleted phantom row left behind forever would be
exactly the residue undo is supposed to remove. Either choice leaves
`getEffectiveCapacity`/`calculateSpotCapacity` computing the identical
number (both filter `deletedAt: null` — `lib/spot-aggregation.ts:46`); hard
delete additionally leaves the `Spot` table itself clean.

## Capacity note — this seed moves a real number

With `useSpotView = true`, a camp's effective capacity becomes the **SUM of
its live spots' capacities** (`lib/campsite-availability.ts:44`,
`getEffectiveCapacity` → `calculateSpotCapacity`). Creating 9 demo pitches on
a camp and flipping `useSpotView` on therefore **raises that camp's real
displayed/enforced capacity** for as long as the demo pitches exist;
`--undo` deletes them and resets the flag, which lowers it back to exactly
what it was. Rule-based camp selection only picks a camp whose
`useSpotView` is currently `false`, so this round-trip is always
unambiguous. `--camp` can still target a camp already in per-spot mode
deliberately — in that case `--undo` will still turn `useSpotView` off even
though this script did not turn it on (the script prints a warning when the
chosen camp already has it on).

## Idempotency

Re-running (dry-run or apply) always resolves the same 9 roles to the same
rows: `buildPlan` looks up already-created demo pitches by their exact
`DEMO_NAME_PREFIX + role label` name before deciding what to create. Every
write beyond the initial create is a top-up-to-target-state check (does this
pitch already have a panorama / >=3 photos / >=1 photo / a live
BlockedDate / a live non-cancelled Booking?), so a second `--apply` creates
zero additional rows.

## Guard

Refuses unless `DATABASE_URL` is set and does **not** resolve to
`localhost`/`127.0.0.1`/`::1` — the mirror image of
`scripts/db-sync-from-staging.mjs`'s guard. Logs only scheme+hostname via
`describeUrlShape` (`scripts/db-reset.mjs`), never the full connection
string (CAM-359/CAM-369).

## Test-harness note (apply→undo round-trip)

The repo's real DB-touching harness (`scripts/setup-e2e-db.ts`) requires a
reachable **local** Postgres to migrate + seed against — and this ticket's
hard prohibition ("never seed against a localhost URL / never touch the
local dev database") blocks using it here, so the apply→undo round-trip is
proven at the **plan/fake-Prisma level only** (see
`__tests__/cam-663-seed-demo-spots.test.ts`, section (i)) — it is not a
real-database proof. The owner will observe the real round-trip directly
when running `--dry-run` → `--apply` → (optionally) `--undo` against
staging.
