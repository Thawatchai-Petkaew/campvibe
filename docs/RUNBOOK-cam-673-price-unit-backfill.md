# Runbook — price-unit backfill (CAM-673)

Most Thai camps charge **per person per night**, not a flat per-site rate.
`CampSite.priceUnit` / `Spot.priceUnit` (ADR-014, CAM-650) both default every
existing row to `PER_SITE` — that default was deliberate so the CAM-650
migration itself moved no money. `scripts/backfill-cam-673-price-unit.mjs`
is the follow-up the owner asked for on 2026-07-30: move the population to
roughly **95% `PER_PERSON`**, roughly **5% `PER_SITE`** (a flat nightly price
regardless of party size), applied to a camp whether or not it is divided
into pitches. Read `docs/adr/ADR-014-pricing-unit.md` first — it is the
decision record for this field.

Existing bookings are unaffected: a booking snapshots
`Booking.snapshotPricingUnit` / `snapshotQuantity` at creation time (ADR-005
crystallization) and this script never writes to `Booking`.

## Usage

```bash
# 1. Dry run first — prints the plan + split percentages, writes nothing:
DATABASE_URL="<local-dev-or-staging>" npm run backfill:cam-673-price-unit -- --dry-run

# 2. Apply for real:
DATABASE_URL="<local-dev-or-staging>" npm run backfill:cam-673-price-unit -- --apply

# Undo — reverts every row this script changed back to PER_SITE:
DATABASE_URL="<local-dev-or-staging>" npm run backfill:cam-673-price-unit -- --undo
```

Refuses a `DATABASE_URL` that is unset or looks like production (same
`looksProd` heuristic as `scripts/db-reset.mjs` / other backfills in this
repo). **Local dev and staging are both allowed** — this is not the seed-
demo-spots.mjs shape (which refuses localhost); a single `DATABASE_URL` here
must be allowed to be either. Logs only scheme+hostname via
`describeUrlShape`, never the full connection string (CAM-359/CAM-369).

## Which rows are candidates — deliberately conservative

A `CampSite` (or `Spot`) is only reassigned if its **current value is still
exactly `PER_SITE`** — the untouched CAM-650 migration default.
`components/CampgroundForm.tsx` and `components/spot-form-dialog.tsx`
already ship a live host-facing `priceUnit` picker (a new camp defaults to
`PER_PERSON` there), so by the time this runs a real host may have already
told the platform what they meant. This script never reverses that: a row
that is not `PER_SITE` today is left exactly as it is and reported
separately from the CAM-663 demo-camp skip (see `campsAlreadyNonDefault` /
`spotsAlreadyNonDefault` in `summarizePlan`'s output).

**A pitch follows its own camp's *effective* unit**, not an independent
hash of the pitch's own id — a camp quoting per person whose pitches quote
per site would read as a bug to a camper. "Effective" = the camp's hash
target if the camp itself is a candidate, otherwise the camp's own current
(already-diverged) value. A pitch is only rewritten when it is itself still
at the untouched `PER_SITE` default AND that disagrees with the camp's
effective unit — a host's deliberate per-spot override
(`Spot.priceUnit` "overrides `CampSite.priceUnit` when this spot is
booked") is never clobbered.

## Deterministic selection

`selectPriceUnitForId(id)` hashes the row's own id with sha256, reads the
first 4 bytes as an unsigned 32-bit big-endian integer, and normalizes to
`[0, 1)`. Below `PER_SITE_FRACTION` (0.05) → `PER_SITE`, otherwise
`PER_PERSON`. sha256 output is uniformly distributed, so the same id always
produces the same verdict (a dry-run and the later `--apply` pick the
identical set; a re-run never reshuffles), and the fraction landing on
`PER_SITE` approaches 5% as the population grows — proven directly in
`__tests__/cam-673-price-unit-backfill.test.ts` against a 5,000-id synthetic
population, no database round trip.

## The CAM-663 demo camp is never touched

`koh-tao-under-stars-31-th` (`scripts/seed-demo-spots.mjs`,
`docs/RUNBOOK-demo-spot-seed.md`) carries a deliberately **mixed**
`PER_SITE`/`PER_PERSON` set on its demo pitches so the pitch-detail UI
(CAM-664) has every branch to render. This script excludes the camp by
`nameThSlug` before computing anything else, and the dry-run report states
explicitly whether it was found and skipped.

## Idempotency

`buildPlan` is read-only and its target is a pure function of ids already in
the database, so calling it twice with no write in between returns an
identical plan. `applyPlan` only writes a row whose transformed value
actually differs from what is stored, so a second `--apply` updates zero
additional rows.

## Undo

Unlike `scripts/seed-demo-spots.mjs`'s undo (which must recover a per-camp
origin value that varied row to row), every row this script can possibly
touch started at the identical value `PER_SITE` — so `--undo` simply
restores every row whose current value is not `PER_SITE` back to `PER_SITE`.
`--undo` is an explicit flag, never inferred or combined with `--apply`.
