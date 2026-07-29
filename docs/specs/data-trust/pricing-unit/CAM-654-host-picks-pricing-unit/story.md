## Story
As a **Host**, I want to choose whether my camp's price is charged per person or per site, so that when I price a camp at ฿250 expecting 3 guests to total ฿750, my choice actually reaches the booking engine instead of silently staying `PER_SITE` forever.
Why: CAM-650 recorded the unit, CAM-651 taught the engine to multiply by it, CAM-652 wired the real callers, and CAM-653 made every caption state it — but no write path ever accepted `priceUnit` from a host, so every camp is permanently `PER_SITE` regardless of what a host believes they set. This story is what makes the owner's own reported gap (฿250 stayed ฿250 for 3 guests) actually fixable by a host.
Scope: a camp-level picker (`CampgroundForm.tsx`, the one that changes real totals — no client sends `spotId` to `POST /api/bookings` today) + a spot-level picker (`spot-form-dialog.tsx`, inert until spot selection ships) + the `PER_PERSON`/`PER_SITE`-only zod boundary (`lib/validations/campsite.ts`, `lib/validations/spot.ts`) + the four write routes (camp POST/PUT, spot POST/PUT). No price-caption changes (CAM-653 owns those), no `PER_TENT` exposure, no booking-flow tent-count capture.
Depends on: ADR-014 (CAM-649) · CAM-650 (schema) · CAM-651 (engine) · CAM-652 (real callers) · CAM-653 (captions)

## AC
| # | Given | When | Then (user sees, Thai verbatim) | System effect | Neg/edge |
|---|---|---|---|---|---|
| AC-1 | A host is editing an existing camp's Pricing card | The host opens the edit form | Two options are shown under `ราคานี้คิดแบบไหน`: `คิดต่อคน (คูณจำนวนผู้เข้าพัก)` and `คิดต่อจุด (ราคาเดียว ไม่ว่าจะมากี่คน)`, with the camp's real stored choice already selected | The form's `priceUnit` state is initialised from `initialData.priceUnit` (falling back to `PER_SITE`, the column default, never `PER_PERSON`) | EC-1 |
| AC-2 | A host is creating a brand-new camp | The host opens the create form (before touching the picker) | `คิดต่อคน (คูณจำนวนผู้เข้าพัก)` is pre-selected | The form's `priceUnit` state initialises to `PER_PERSON` (ADR-014 §2 — deliberately different from the DB column default `PER_SITE`) | — (a create's default is a UI decision, not a failure mode; see BR-1) |
| AC-3 | A host has just picked `คิดต่อคน (คูณจำนวนผู้เข้าพัก)` on an existing camp and saved | The host re-opens that camp's edit form | `คิดต่อคน (คูณจำนวนผู้เข้าพัก)` is still selected | `PUT /api/campsites/{id}` persisted `priceUnit: 'PER_PERSON'`; the next `GET` returns it unchanged | EC-2 |
| AC-4 | A camp priced ฿250, host sets it to `PER_PERSON` and saves | A camper books it for 3 guests, 1 night | The detail page's price preview shows `฿750` before the camper submits, and the booking confirmation also shows `฿750` | `POST /api/bookings` records `totalPrice = 750`, `snapshotPricingUnit = 'PER_PERSON'`, `snapshotQuantity = 3` (engine already proven, CAM-652 — this AC proves the SETTING reaches it) | EC-3 |
| AC-5 | A PUT request carries `priceUnit: "PER_TENT"` | The request reaches `PUT /api/campsites/{id}` (or the spot PUT) | — (no user-visible surface; a direct API caller only) | Request is rejected `400`; `prisma.campSite.update`/`prisma.spot.update` is never called | EC-4 |
| AC-6 | A camp already saved at `PER_SITE`, never touched again | The host edits an unrelated field (e.g. the description) and saves | The camp's price behaves exactly as before | `priceUnit` is absent from the PUT body → absent from the Prisma write entirely (no key at all) → the stored column is untouched (CAM-651 I2 golden numbers hold) | — (this IS the negative case for AC-3/AC-5) |

## Rules
- BR-1 The CampgroundForm **state initializer** defaults `priceUnit` to `"PER_PERSON"` (used only on create); the **initialData effect** overwrites it with `initialData.priceUnit ?? "PER_SITE"` on edit — these two defaults are deliberately different (ADR-014 §2) and both carry a code comment saying so.
- BR-2 `campSiteSchema.priceUnit` / `spotSchema.priceUnit` expose **only** `PriceUnitEnum = z.enum(["PER_PERSON", "PER_SITE"])`, shared between both schemas from one definition (`campsite.ts`) so the two forms can never drift on which values are selectable. `PER_TENT` remains a real Prisma enum member (CAM-650) but fails zod validation with a `400` — ADR-014 §1's gate is the zod boundary, not the database.
- BR-3 `priceUnit` is `.optional()` **only** (no `.nullable()`) on both schemas — the Prisma column is `NOT NULL` with `@default(PER_SITE)` and there is no reachable host action that clears it back to "unset" (same shape as `campSiteType`/`ownershipType`). Absent on the wire = unchanged on PUT (partial-update semantics) / DB column default on POST create.
- BR-4 All four write routes (`POST /api/campsites`, `PUT /api/campsites/[id]`, `POST /api/campsites/[id]/spots`, `PUT /api/campsites/[id]/spots/[spotId]`) write `priceUnit` **verbatim** when the key is present in the parsed body and omit it entirely otherwise — no `clearableWrite` (there is nothing to clear), no coercion.
- BR-5 The picker shows which option is selected via a **filled/unfilled radio-dot shape** (not colour alone) — reuses the exact pattern the pre-existing Ownership Type picker already uses in the same form (a11y, no new component invented).

## Edge cases
- EC-1 IF a camp's stored `priceUnit` is somehow absent from an older API payload THEN the edit form falls back to `PER_SITE` (the DB column default), never to the create-only `PER_PERSON` default (BR-1).
- EC-2 IF a host sets `PER_PERSON`, saves, then reloads WITHOUT re-editing THEN the picker still shows `PER_PERSON` — proves the round-trip holds (the "clear intent silently lost on save" bug class, CAM-341/CAM-360/CAM-615, does not recur here because there is no clear path to lose in the first place, BR-3).
- EC-3 IF a camp is left at the `PER_SITE` column default THEN a booking for any number of guests totals identically to before this story (no guest multiplier applies) — CAM-651's I2 golden numbers stay byte-identical.
- EC-4 IF a request (direct API or a future compromised client) sends `priceUnit: "PER_TENT"` THEN it is rejected `400` before any Prisma write — never silently coerced to a valid value, never written to the database.

## Data
- No schema change — `CampSite.priceUnit` / `Spot.priceUnit` already exist (CAM-650, `@default(PER_SITE)`, `NOT NULL`). This story is write-path-only: the zod boundary now accepts the field, and the four routes forward it.
- Migration: none.

## Seams & refs
- Reuse: `lib/validations/campsite.ts`'s new `PriceUnitEnum` is the ONE definition; `lib/validations/spot.ts` imports it rather than re-declaring the value set. `lib/api-utils.ts`'s `clearableWrite` is NOT used here (BR-3 — no clear path for a NOT NULL column with no reachable "unset" host action; the existing presence-guarded write shape used by `campSiteType`/`ownershipType` is reused instead).
- Reader/writer sweep (architecture.md §15b — this story changes how `priceUnit` is WRITTEN, not just where it renders; the READ side — GET routes, `CampgroundDetailClient.tsx`, `lib/booking-pricing.ts` — was already wired by CAM-652/653 and is untouched here): grepped `priceUnit` across `app/`, `lib/`, `components/`. Writers touched NOW: `app/api/campsites/route.ts` (POST create), `app/api/campsites/[id]/route.ts` (PUT update), `app/api/campsites/[id]/spots/route.ts` (POST create), `app/api/campsites/[id]/spots/[spotId]/route.ts` (PUT update), `components/CampgroundForm.tsx`, `components/spot-form-dialog.tsx`. Readers NO-CHANGE (already correct from CAM-652/653): `app/api/bookings/route.ts`, `components/CampgroundDetailClient.tsx`, `lib/booking-pricing.ts`, `lib/price-unit-display.ts`. `docs/mock-data-generation-spec.md` updated (under-described the field per this story's constraint, not a code reader/writer).
- Refs: ADR-014 (CAM-649) · CAM-650 (schema) · CAM-651 (engine) · CAM-652 (real callers — proves the engine math this story's AC-4 depends on) · CAM-653 (captions) · `.claude/rules/api.md` §12 (additive — `priceUnit` optional on the wire) · `.claude/rules/architecture.md` §15b.

## Out of scope
- Exposing `PER_TENT` at any boundary, or capturing a tent count in the booking flow → a future "per tent" story (ADR-014 §1, unchanged since CAM-650/651).
- Any price caption/label wording → CAM-653 already shipped these; this story does not touch a single caption string.
- Spot-level booking actually charging by the spot's own `priceUnit` → depends on spot selection shipping in `POST /api/bookings` first (ADR-014 Context fact 1); this story only makes the spot field settable so it is ready when that lands.
- Migrating an existing host's mis-set `PER_SITE` camp to what they actually meant → a product/outreach decision, not a data-model one (ADR-014 §"Open trade-offs" #3).

## Self-verify
- AC-1/AC-2/BR-1 → source-inspection (`__tests__/cam-654-price-unit-picker-ui.test.ts` — state initializer + initialData effect asserted verbatim).
- AC-3/AC-6/BR-3/BR-4 → integration (`__tests__/cam-654-price-unit-write-path.test.ts` — PUT round-trip reaches `prisma.campSite.update`/`prisma.spot.update` with the exact value; an omitted `priceUnit` never appears as a key in the write at all).
- AC-4 → engine already proven by `__tests__/cam-652-charge-the-chosen-unit.test.ts` (PER_PERSON x 3 guests = 750, snapshot fields asserted); this story's contribution (the setting reaching the row) is proven by the AC-3 round-trip test — the two together close the loop end to end. Client-preview-before-submit is owner-verify on localhost (browser-only rendering, not curl-able).
- AC-5/BR-2 → zod-boundary unit tests (`campSiteSchema`/`spotSchema` reject `PER_TENT`) + route-level teeth tests (`prisma.campSite.update`/`prisma.spot.update` never called on a `PER_TENT` PUT/POST).
- BR-5 → source-inspection (`aria-pressed` + filled-dot-on-select pattern asserted, matching the pre-existing Ownership Type picker).
- Story-specific: full `npm test` green (11550+ tests, 0 regressions) · `npm run typecheck`/`npm run lint`/`check:ds`/`check:palette` clean · `node scripts/check-clearable-fields.mjs` reports 0 violations (priceUnit correctly excluded — NOT NULL column, not a `.nullable()` candidate).
- Gate = /quality-gate · Done = every AC verified on localhost (dev DB) before merge into `dev`.

## Changelog
- v1 (2026-07-29) — created
