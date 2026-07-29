## Story
As a **Camper**, I want the catalog's price filter to mean "what I'd pay for my whole trip", so that filtering "under ฿500" with 3 guests selected does not hide a ฿150-per-person camp (฿450 for my trip) or wrongly include a ฿200-per-person camp (฿600 for my trip, over my budget).
Why: hosts can now set `CampSite.priceUnit` to `PER_PERSON` or `PER_SITE` (CAM-654), but the catalog's price band still compared raw `priceLow` — so a ฿250-per-person camp and a ฿250-per-site camp landed in the same band even though a party of three pays ฿750 at one and ฿250 at the other.
Scope: translate the price band (`min`/`max`) per pricing unit in `buildCampSiteWhere` ONLY when the camper's party size is known (`guests` > 1); the sort key stays on raw `priceLow` (ADR-014 §6 — "cheapest first" has no definition without a party size, and a normalized comparable-price column is refused, `.claude/rules/architecture.md` §12); the sort dropdown's price labels are corrected to say "starting price"; the active-filter chip for a price band names the party size it was interpreted against when one is known. No price-caption change (CAM-653 owns those), no `lib/ai/**` change (the AI search tool never passes `guests`), no cursor/keyset change.
Depends on: ADR-014 (CAM-649) §6 · CAM-654 (host picks the unit — this story's data source)

## AC
| # | Given | When | Then (user sees, Thai verbatim) | System effect | Neg/edge |
|---|---|---|---|---|---|
| AC-1 | Camper has selected 3 guests and set a max price of ฿500 | The camper views the catalog | A camp billed ฿400 "ต่อจุด" (per site) appears in the results | `buildCampSiteWhere` compares that camp's `priceLow` (400) directly against the max threshold (500) on the `PER_SITE` branch | EC-1 |
| AC-2 | Camper has selected 3 guests and set a max price of ฿500 | The camper views the catalog | A camp billed ฿150 "ต่อคน" (per person) appears in the results, even though 150 alone looks under budget by a wide margin | `buildCampSiteWhere` compares that camp's `priceLow` (150) against the max threshold divided by party size (500 ÷ 3 ≈ 166.67) on the `PER_PERSON` branch — 150 ≤ 166.67 | EC-2 |
| AC-3 | Camper has NOT set a party size (no guests selected) | The camper sets the same max price of ฿500 and views the catalog | The result set is identical to what this camper saw before this story shipped | `buildCampSiteWhere` falls back to the exact pre-existing `where.priceLow = { lte: 500 }` shape — no per-unit translation engages | — (this row documents the unchanged default path, not a failure; its failure twin is AC-1/AC-2 engaging only when a party size IS known) |
| AC-4 | Camper opens the catalog's sort dropdown | The camper looks at the "cheapest first" option | The label reads `ราคาเริ่มต้น: ต่ำไปสูง` (was `ราคา: ต่ำไปสูง`) | No change to sort order or query (still ORDER BY raw `priceLow`) — copy only | — (pure copy correction; nothing to fail) |
| AC-5 | Camper has set a max price of ฿500 and selected 3 guests | The camper looks at the active-filter chips row | The price chip reads `ราคาสูงสุด: 500 (สำหรับ 3 คน)` | Chip label composed client-side from the existing `min`/`max`/`guests` URL params — no new query param, no server round-trip | EC-3 |

## Rules
- BR-1 The price band is translated per pricing unit **only** when a valid party size is known (`guests` parses to an integer `> 1`): the `PER_SITE` branch compares the raw threshold directly; the `PER_PERSON` branch compares the threshold **divided by party size** (`Prisma.Decimal.div`, never JS float — ADR-002). Applies symmetrically to both `min` (→ `gte`) and `max` (→ `lte`).
- BR-2 `guests` absent, `"0"`, `"1"`, or a non-numeric string never engages the per-unit translation — the band applies exactly as it did before this story: a bare `where.priceLow = { gte?, lte? }`, byte-identical to the pre-CAM-655 shape (division by 1 is a no-op, so this is also the correct behavior for a solo camper, not just a fallback).
- BR-3 The sort key and its composite index (`@@index([isPublished, deletedAt, priceLow, id])`) stay on the raw `priceLow` column, unchanged (ADR-014 §6) — "cheapest first" has no definition without a party size, and a normalized comparable-price column is refused per `.claude/rules/architecture.md` §12 (no derivation from source Pixels; the missing input — party size — lives with the camper, not the camp).
- BR-4 The sort dropdown's price options read `ราคาเริ่มต้น: ...` ("starting price: ...") in both directions (low-to-high AND high-to-low), not `ราคา: ...` ("price: ..."), since the number sorted is a starting price whose real-world meaning (per-trip vs per-site) varies by camp.
- BR-5 The active-filter chip for a price band names the party size the threshold was interpreted against whenever `guests > 1` (the same threshold BR-1 uses); `guests` absent/`0`/`1`/non-numeric leaves the chip exactly as it was before this story (no qualifier) — the chip never claims a specific camp's pricing unit (that caption stays CAM-653's job, per-card).

## Edge cases
- EC-1 IF a `PER_SITE` camp's stored `priceLow` is above the max threshold THEN it is excluded, regardless of party size (the `PER_SITE` branch is never divided).
- EC-2 IF a `PER_PERSON` camp's per-trip total (`priceLow × guests`) would exceed the max threshold THEN it is excluded, even though its stored `priceLow` alone looks affordable (e.g. ฿200/person × 3 guests = ฿600, excluded from a ฿500 max).
- EC-3 IF `guests` is absent, `"0"`, `"1"`, or non-numeric THEN the price chip shows no party-size qualifier — matches the WHERE-clause fallback exactly (BR-2/BR-5 share the same guard).
- EC-4 IF `guests` is `"0"` or a non-numeric string (or negative) THEN the filter never divides by zero and never produces a `NaN` threshold — it falls back to the plain, untranslated band (BR-2).
- EC-5 IF `min`/`max` themselves are non-numeric while a valid party size IS known THEN the per-unit branch simply carries no bound for that side (`undefined`, no filter applied on that edge) rather than throwing a `DecimalError` that would 500 the whole public, unauthenticated catalog request.

## Data
- No schema change — `CampSite.priceUnit` already exists (`@default(PER_SITE)`, CAM-650). This story is query-logic-only.
- Migration: none.

## Seams & refs
- Reuse: `lib/campsite-filters.ts`'s `buildCampSiteWhere` is the ONE place the price band is built (both `app/api/campsites/route.ts` and the SSR first page go through it) — no parallel band-building logic introduced. `lib/catalog-cursor.ts` (sort key + keyset cursor encoding) is explicitly UNTOUCHED per ADR-014 §6 — grepped and confirmed no `priceLow`-shape edit in that file.
- Reader/writer sweep (architecture.md §15b — this story changes HOW the price band is evaluated for a subset of requests, not just where it renders): grepped `min`/`max`/`priceLow` band-building across `app/`, `lib/`, `components/`. Touched NOW: `lib/campsite-filters.ts` (`buildCampSiteWhere`), `components/ActiveFilters.tsx` (chip label), `locales/translations.json` (`sort.priceLow`/`sort.priceHigh`/`filter.priceForGuests`). NO-CHANGE (confirmed by grep, not assumed): `lib/catalog-cursor.ts` (sort/cursor — ADR-014 §6 explicit refusal), `lib/ai/tools/search-campsites.ts` (never passes `guests` to `buildCampSiteWhere` — this story's translation cannot engage there), `lib/price-unit-display.ts` and every per-card price caption (CAM-653's surface, unchanged).
- Refs: ADR-014 (CAM-649) §6 (the exact decision this story implements) · ADR-002 (Decimal arithmetic, never JS float) · `.claude/rules/architecture.md` §12 (why no normalized comparable-price column).

## Out of scope
- Any price CAPTION on a camp card/detail page (what unit THIS camp charges) → CAM-653 already ships this; this story does not touch it.
- Sorting "cheapest for my trip" (a true per-trip sort) → refused per ADR-014 §6 (undefined without a party size; would require a normalized column architecture.md §12 forbids). If the owner wants this, it is a new ADR-level decision, not a follow-up ticket.
- The AI `searchCampsites` tool gaining party-size-aware price filtering → out of scope; it never threads `guests` through today, and `lib/ai/**` is excluded from this story's surface (paid CI gate).
- Migrating the keyset cursor to encode anything other than raw `priceLow` → explicitly forbidden by this ticket; would break pagination.

## Self-verify
- AC-1/AC-2/EC-1/EC-2 → unit, `__tests__/cam-655-price-filter-per-unit.test.ts` (behavioral evaluator proving inclusion/exclusion, not just shape).
- AC-3/BR-2 → unit, same file (`where.priceLow` asserted byte-identical to the pre-CAM-655 shape when `guests` absent/`1`).
- AC-4/BR-4 → unit, same file (`t.sort.priceLow`/`priceHigh` asserted verbatim, EN + TH).
- AC-5/BR-5/EC-3 → unit, same file (`getActiveFilterChips` asserted verbatim, EN + TH, with and without the qualifier).
- EC-4/EC-5 → unit, same file (`guests="0"`/`"-5"`/`"abc"` and garbage `min`/`max` never throw, never divide by zero, never leave a `NaN`).
- Story-specific: `grep -n "priceLow" lib/catalog-cursor.ts` diff-empty (sort key untouched) · full `npm test` green (no regression in `cam-463-qa-partition-audit-and-boundary.test.ts` / `campsite-capacity-filter.test.ts`, both updated to reflect the new party-size-aware shape where they exercised `guests > 1`) · `npm run lint`/`typecheck`/`check:ds`/`check:palette` clean.
- Gate = /quality-gate · Done = every AC verified on localhost (dev DB) before merge into `dev`.

## Changelog
- v1 (2026-07-29) — created
