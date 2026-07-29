## Story
As a **Host**, I want the schema to record what my camp's price is charged per, so that a future engine change can start multiplying the right thing without any existing booking or listing changing cost today.
Why: the booking engine has always charged `unitPrice x nights` with no guest multiplier, and no document ever stated what the price is charged per — the owner entered ฿250 expecting a 3-guest, 1-night booking to total ฿750, and it totalled ฿250 instead.
Scope: schema only — a new `PricingUnit` enum + `CampSite.priceUnit` + `Spot.priceUnit` (both defaulted so today's math is unchanged) + `Booking.snapshotPricingUnit`/`snapshotQuantity` (nullable, not backfilled). No endpoint, validation, UI, or pricing-math change. The engine change that reads these fields is a separate, follow-up story.
Depends on: ADR-014 (CAM-649, in flight) · epic CAM-648

## AC
| # | Given | When | Then (user sees, Thai verbatim) | System effect | Neg/edge |
|---|---|---|---|---|---|
| AC-1 | Any existing `CampSite` row (created before this migration) | The migration runs | No visible change — no screen in the product reads `priceUnit` yet | Row gains `priceUnit = PER_SITE`; `priceLow`/`priceHigh`/every other column unchanged | EC-1 |
| AC-2 | Any existing `Spot` row (created before this migration) | The migration runs | No visible change — no screen in the product reads `priceUnit` yet | Row gains `priceUnit = PER_SITE`; `pricePerNight`/`pricePerSite`/every other column unchanged | EC-1 |
| AC-3 | Any existing `Booking` row (created before this migration) | The migration runs | No visible change — booking history/receipts are unaffected | Row gains `snapshotPricingUnit = NULL`, `snapshotQuantity = NULL`; `totalPrice`/every snapshot column unchanged | EC-2 |
| AC-4 | A new `Booking` is created by the current (unmodified) booking route | The insert runs with no explicit unit supplied | No visible change — the confirmation total is identical to before this story | New row stores `snapshotPricingUnit = NULL`, `snapshotQuantity = NULL` (not `PER_SITE` — no host was ever asked) | EC-2 |
| AC-5 | The full local migration history, including this migration | `prisma migrate reset --force` runs and reseeds | No visible change — the seed script's own fixed prices appear exactly as coded | Every reseeded `CampSite` row's `priceLow`/`priceHigh` match the seed source values byte-for-byte; every row's `priceUnit = PER_SITE` | — (regression-only check, no user-facing failure mode) |

## Rules
- BR-1 `CampSite.priceUnit` and `Spot.priceUnit` both default to `PER_SITE` on every row that does not set them explicitly — this default is load-bearing because today's booking math (`lib/booking-pricing.ts`, untouched by this story) is per-site with no multiplier; any other default would silently change what an existing listing costs.
- BR-2 `Booking.snapshotPricingUnit` and `Booking.snapshotQuantity` are nullable and are **never backfilled** onto rows that predate this migration — `NULL` means "booked before this change" (`unitPrice x nights`, no guest/tent multiplier); writing `PER_SITE` onto an old row would assert a host choice that was never made.
- BR-3 The `PricingUnit` enum carries three values (`PER_PERSON`, `PER_TENT`, `PER_SITE`) but only `PER_PERSON`/`PER_SITE` may be referenced anywhere outside the enum declaration in this story — `PER_TENT` exists in the type only, because Postgres has `ALTER TYPE ... ADD VALUE` but no `DROP VALUE`, and `Booking.snapshotPricingUnit` is a crystallized `[Financial]` column (ADR-005) of this exact type once it carries real rows.
- BR-4 No existing column is altered, renamed, or dropped, and no `[Financial]` value on any other column is rewritten by this migration.

## Edge cases
- EC-1 IF the migration runs against a `CampSite`/`Spot` row that already has a `priceLow`/`priceHigh`/`pricePerNight`/`pricePerSite` value THEN that value is left byte-identical; only the new `priceUnit` column is added, defaulted to `PER_SITE` (BR-1).
- EC-2 IF a `Booking` is read that predates this migration (or is created by the still-unmodified booking route) THEN `snapshotPricingUnit`/`snapshotQuantity` read as `NULL`, never `PER_SITE`/`0`/`1` (BR-2).
- EC-3 IF a future story needs a fourth pricing unit value THEN it must be added as a new enum value in its own migration (Postgres `ALTER TYPE ... ADD VALUE`), never by repurposing `PER_TENT`'s reserved-but-unexposed slot without a new spec (BR-3).

## Data
- `PricingUnit` enum (`PER_PERSON`, `PER_TENT`, `PER_SITE`) · `CampSite.priceUnit PricingUnit @default(PER_SITE)` [Financial] · `Spot.priceUnit PricingUnit @default(PER_SITE)` [Financial] · `Booking.snapshotPricingUnit PricingUnit?` [Financial] · `Booking.snapshotQuantity Int?` [Financial] · `Spot.pricePerSite` gets a DEPRECATED comment only (no schema change) clarifying it is a whole-pitch buyout offer, not a pricing unit, per `docs/mock-data-generation-spec.md:252`.
- Migration: reversible. `prisma/migrations/20260729044547_cam650_pricing_unit/migration.sql` (additive: 1 `CREATE TYPE` + 4 `ADD COLUMN`, all with a default or nullable) + hand-written `down.sql` (drops the 4 columns then the type, same order/precedent as `prisma/migrations/20260704163511_image_kind_panorama/down.sql`). Proven `up → down → up` against the local dev DB (see Self-verify).

## Seams & refs
- Reuse: `lib/booking-pricing.ts` (`computeBookingPrice`/`resolveUnitPrice`) is the ONE place that will read `priceUnit`/`snapshotPricingUnit` in the follow-up engine story — this story does not touch it. `app/api/bookings/route.ts` is the one writer of `Booking` rows and does not set the two new columns in this story (BR-2's NULL behavior is exactly the current writer's unmodified behavior, not new code).
- Refs: ADR-005 (booking snapshot / crystallization) · ADR-014 (CAM-649, in flight — records why the host chooses the unit and why three enum values are created now) · `.claude/rules/api.md` §12 (backward-compatible by addition) for the `Spot.pricePerSite` deprecation treatment.

## Out of scope
- Reading `priceUnit`/`snapshotPricingUnit` anywhere (booking creation, detail-page price preview, AI assistant, host form) → follow-up engine story (epic CAM-648, not yet ticketed).
- Exposing `PER_TENT` in any validation, UI, or AI tool schema → a future "per tent" story, once scoped.
- Migrating/backfilling `Spot.pricePerSite`'s 481 populated staging values into a `SpotRate` child → a future story once that model is designed.

## Self-verify
- AC-1..3 → integration (real-DB test, `__tests__/cam-650-pricing-unit-schema.test.ts`): existing/fresh rows default `priceUnit = PER_SITE`; a fresh `Booking` row's snapshot columns are `NULL`.
- AC-4 → integration (same file): `prisma.booking.create` with no explicit unit stores `NULL`, not `PER_SITE`.
- AC-5 → manual, recorded in the PR body: `prisma migrate reset --force` run locally; reseeded `CampSite` prices compared byte-for-byte against `prisma/seed.ts`'s hardcoded values.
- Story-specific: migration `up → down → up` proven locally (`prisma db execute --file down.sql` then re-apply `migration.sql`, columns/type confirmed absent then present via `$queryRawUnsafe` probes); a before/after price snapshot of every `CampSite`/`Spot` row across the whole local dev DB (795 camps / 3006 spots at the time of verification) diffed byte-identical before vs after applying the migration.
- Gate = /quality-gate · Done = every AC verified on the real Staging URL

## Changelog
- v1 (2026-07-29) — created
