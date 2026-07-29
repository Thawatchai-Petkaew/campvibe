---
linear: CAM-649
feature: data-trust
epic: pricing-unit (CAM-648)
persona: platform
artifact: story
owner: architect
status: In Progress
version: v1
updated: 2026-07-29
---
# ADR-014 records what a campsite price is charged per (CAM-649)

## Story
As a **Platform** architect, I want the pricing-unit decision written as ADR-014, so that the build story implements one ratified design instead of re-deriving the unit from `unitPrice × nights` a fourth time.
Why: `unitPrice × nights` is a code lineage, not a decision — pre-existing → frozen by CAM-58 (whose subject was fee rows) → inherited by CAM-268 → cited as authority by CAM-643. No document in the repo has ever stated the unit of `CampSite.priceLow`.
Scope: documentation only — `docs/adr/ADR-014-pricing-unit.md` + the `docs/adr/ADR-000-index.md` row + this spec. No schema, no migration, no code.
Depends on: ADR-002 · ADR-003 · ADR-005 · owner decision 2026-07-29 ("the host chooses the unit")

## AC
| # | Given | When | Then (user sees, Thai verbatim) | System effect | Neg/edge |
|---|---|---|---|---|---|
| AC-1 | The ADR-014 slot is free (`ADR-000-index.md` jumps 013→015) | A reader opens `docs/adr/ADR-014-pricing-unit.md` | Context · Decision · Alternatives · Consequences, status `PROPOSED` (no user-facing screen copy — docs-only story) | The pricing-unit decision exists as a reviewable artifact | EC-1 |
| AC-2 | A future engineer asks why the enum has three values | They read §1 / Alternatives (a) | The no-`DROP VALUE` reasoning, with the `image_kind_panorama` migration cited as the repo's own precedent | The three-values-in-one-migration rule is defensible without re-research | EC-2 |
| AC-3 | A reader opens the ADR index | They scan the table | ADR-014 appears in number order with a one-line decision summary and status `Proposed (G2)` | The index no longer skips 014 | EC-3 |

## Rules
- BR-1 Status is `PROPOSED` (never `Accepted`) until the owner ratifies at G2 — `.claude/rules/architecture.md` §16 lifecycle (proves AC-1)
- BR-2 Every load-bearing fact in the ADR is grepped in this repo and cited by `path:line`; anything not verified is written as "not measured" rather than asserted (proves AC-2)
- BR-3 The diff touches zero files under `app/ lib/ components/ prisma/ scripts/` — this story designs, it does not build (proves AC-1)
- BR-4 The ADR records the owner's decision, not the agent's: the host chooses the unit; the ADR chooses only the shape that carries it (proves AC-1)

## Edge cases
- EC-1 IF a reader takes the ADR as shipped behaviour THEN Consequences states plainly that until a host opts in nothing changes for anyone — including the owner's own reported ฿250 case (BR-4)
- EC-2 IF someone later "cleans up" the unused `PER_TENT` value THEN §1 + Consequences name where it is gated (zod, not the DB) and why removing it is not a supported Postgres operation (BR-2)
- EC-3 IF someone reads `Spot.pricePerSite`'s 481 populated rows as hosts having already declared a unit THEN §5 + Alternatives (b) record that the rows are machine-generated (`gen-mock-data.mjs:458-459`) and the field is a buyout rate plan (`mock-data-generation-spec.md:252`), not a unit (BR-2)

## Data
- No schema change in this story. The ADR *designs*: `enum PricingUnit { PER_PERSON PER_TENT PER_SITE }` · `CampSite.pricingUnit` + `Spot.pricingUnit` `[Financial]`, column default `PER_SITE` (form default `PER_PERSON`) · `Booking.snapshotPricingUnit` + `snapshotQuantity`, nullable, never backfilled (ADR-005) · `Spot.pricePerSite` marked DEPRECATED per `.claude/rules/api.md` §12 · migration: **none in this story**; the designed migration is additive + reversible (all three enum values created alongside the columns so `down.sql` can `DROP TYPE`).

## Seams & refs
- Reuse: `lib/booking-pricing.ts` (`resolveUnitPrice`/`computeBookingPrice` — the one module that owns price math; the ADR extends its signature, never forks it) · `lib/campsite-filters.ts` (price band + the `guests` param it already parses) · `lib/catalog-cursor.ts` (`orderByFor`, sort key unchanged) · Refs: ADR-002 · ADR-003 · ADR-005 · ADR-012 · ADR-014
- Reader/writer sweep (`.claude/rules/architecture.md` §15b) is **deferred to the build story**, and the ADR says so: this story changes no derivation. Search terms recorded for that sweep: `resolveUnitPrice` · `computeBookingPrice` · `priceLow` · `pricePerNight` · `pricePerSite`.

## Out of scope
- The Prisma migration + zod + form + display work → CAM-648 build story (follow-up)
- Whole-pitch buyout (`เหมาโซน`) as a `SpotRate` child model → not ticketed; gap logged at `campvibe-schema-gap-analysis.md:59`
- Exposing `PER_TENT` at the boundary (needs a tent count in the booking flow) → follow-up
- Child pricing (`ราคาเด็ก`, logged twice at `campvibe-schema-gap-analysis.md:38,44`) → not ticketed

## Self-verify
- AC-1..3 → owner-verify (docs read at G2); AC-3 additionally `grep -c "ADR-014" docs/adr/ADR-000-index.md` ≥ 1
- Story-specific: `git diff origin/dev --name-only` shows zero paths under `app/ lib/ components/ prisma/ scripts/`; every `path:line` citation in the ADR resolves on this branch
- Gate = G2 (owner ratifies the ADR + the three Open trade-offs) · Done = ADR merged into `dev` at status `PROPOSED`

## Changelog
- v1 (2026-07-29) — created
