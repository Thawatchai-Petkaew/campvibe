## Story
As a **Camper**, I want the AI assistant to say what a quoted price is charged per, so that I never mistake a per-person rate for the whole cost of my stay.
Why: CAM-654 let a host price per person or per site. `lib/ai/openrouter-client.ts`'s `formatStartingPriceSuffix` still emitted a bare `starting price ฿250` with no unit, and `lib/ai/tools/get-camp-detail.ts`/`lib/ai/tools/compare-camps.ts` never selected `CampSite.priceUnit` at all — so once a per-person camp exists, the assistant would quote its per-person rate as if it were the whole cost in prose, even though CAM-653 already made the camper-facing CARDS unit-aware. This story closes the gap between what the model is TOLD and what the cards already SHOW.
Scope: thread `priceUnit`/`price.unit` into every place under `lib/ai/**` that puts a price into the model's own context or into a tool-result payload the model narrates from — `get-camp-detail.ts`, `compare-camps.ts`, the shown-results memory (`conversation-store.ts`'s `ShownResult`, the guest wire in `lib/validations/ai-chat.ts`, and its route-level mapping in `app/api/ai/chat/route.ts`), and the prompt text itself (`openrouter-client.ts`). `search-campsites.ts`/`bulk-availability.ts` are NOT touched — both already select `priceUnit` via the shared `campCardSelect`/`aiCampCardSelect` (CAM-653), so the model already receives it there mechanically. No new tool, no schema/migration, no UI/component change (CAM-653 already shipped the card copy), no catalog-filter change (CAM-655's domain).
Depends on: ADR-014 (CAM-649) · CAM-650 (schema) · CAM-651 (engine) · CAM-652 (real callers) · CAM-653 (camper-facing card captions) · CAM-654 (host picker, the reason a non-PER_SITE row can now exist)

## AC
| # | Given | When | Then (user sees, Thai verbatim) | System effect | Neg/edge |
|---|---|---|---|---|---|
| AC-1 | A camp is priced `PER_PERSON` and appears in the "previously shown campsites" memory this turn | The camper asks a follow-up that resolves to that shown entry (e.g. "อันไหนถูกกว่า") | — (model-context only; no new user-visible screen element — the camper-facing card already states the unit per CAM-653) | The shown-results text block the model reads states `(per guest, per night)` immediately after that entry's starting price | EC-1 |
| AC-2 | A camper asks a Zone B price/fee/deposit question about ONE named camp priced `PER_TENT` | The assistant calls `getCampDetail` on that camp | — (model-context only) | `getCampDetail`'s `price.unit` field carries `PER_TENT` (previously not selected at all) | EC-2 |
| AC-3 | A camper asks to compare two named camps, one `PER_PERSON` and one `PER_SITE`, on price | The assistant calls `compareCamps` with the `price` criterion | — (model-context only) | Each camp's `cells.price.unit` cell carries its own real unit, never the other camp's | EC-2 |
| AC-4 | A shown-results entry has no unit recorded (an older guest-wire body that has not resent `priceUnit`, or a card persisted before CAM-653) | The camper asks the assistant to state or compare that entry's price | The assistant states only the bare figure for that entry and never claims it is per-person or per-site | The shown-results block carries no charge-per tag for that entry; the system prompt instructs the model not to invent one | EC-3 |

## Rules
- BR-1 `lib/ai/tools/get-camp-detail.ts`'s `CampDetailPrice.unit` and `lib/ai/tools/compare-camps.ts`'s `ComparePrice.unit` both select `CampSite.priceUnit` (a `NOT NULL` column, `@default(PER_SITE)`) and therefore always carry a real, non-optional `PricingUnit` value — never absent, never invented, for a live tool call.
- BR-2 `ShownResult.priceUnit` (`lib/ai/conversation-store.ts`) stays `PricingUnit | undefined` — additive/optional (api.md rule 12) — because THIS surface can genuinely be unrecorded (an older guest-wire body, or a card persisted before CAM-653 shipped `AiChatCardResponse.priceUnit`). `undefined` is read as UNKNOWN by the prompt formatter, never defaulted to `PER_SITE`.
- BR-3 `formatStartingPriceSuffix` (`openrouter-client.ts`) appends a parenthetical charge-per tag — `(per guest, per night)` / `(per tent, per night)` / `(per night, whole site)` — ONLY when `priceUnit` is defined for that entry; a free price (`priceLow` null/0) never carries a unit tag (nothing to charge per); an entry with `priceUnit` undefined carries no tag at all.
- BR-4 `lib/validations/ai-chat.ts`'s `shownResultSchema.priceUnit` accepts only the two host-exposed members `PER_PERSON`/`PER_SITE` plus the gated `PER_TENT` (mirrors `types/api.ts`'s `PricingUnit`) — an unrecognized string is rejected `400` before the prompt, same treatment as every other field on this schema.

## Edge cases
- EC-1 IF two shown entries tie at the lowest starting price but carry DIFFERENT units (one `PER_PERSON`, one `PER_SITE`) THEN the existing tie-break line still fires ("say they are tied") — this story does not add unit-aware comparison logic, only unit-aware STATEMENT of each entry's own price (out of scope, see below).
- EC-2 IF `getCampDetail`/`compareCamps` is called on a camp whose `priceUnit` column somehow reads as an unrecognized value (never possible via the app's own write paths, CAM-654 BR-2 gates the zod boundary) THEN TypeScript's `PricingUnit` union still types the field correctly — Prisma itself only ever returns one of the three enum members.
- EC-3 IF `ShownResult.priceUnit` is `undefined` for an entry THEN the model states the bare `฿NNN` figure only — the same behavior as before this story for every entry, since `undefined` was already the universal case before CAM-656.

## Data
- No schema change — `CampSite.priceUnit` (CAM-650, `@default(PER_SITE)`, `NOT NULL`) already exists and is read-only here. This story is a read-path/context-shaping story only.
- Migration: none.

## Seams & refs
- Reuse: `lib/booking-pricing.ts`'s `PricingUnit` type (the same client-safe mirror `lib/api-client.ts`/`lib/price-unit-display.ts` already import) — no second type declaration.
- Reader/writer sweep (architecture.md §15b — this story changes what CONTEXT is handed to the model, not how the value is derived/enforced/written; the WRITE side is CAM-654's, untouched here): grepped `priceLow`/`priceUnit`/`starting price` across `lib/ai/**`, `app/api/ai/**`, `lib/validations/ai-chat.ts`. Touched NOW: `lib/ai/tools/get-camp-detail.ts` (select + `price.unit`), `lib/ai/tools/compare-camps.ts` (select + `cells.price.unit`), `lib/ai/conversation-store.ts` (`ShownResult.priceUnit` + `deriveShownState` projection), `lib/validations/ai-chat.ts` (`shownResultSchema.priceUnit`), `app/api/ai/chat/route.ts` (`toShownResults` mapping), `lib/ai/openrouter-client.ts` (`formatStartingPriceSuffix`/new `unitTag` helper + the shown-results guidance paragraph + one new Zone-B price-unit instruction sentence). NO-CHANGE (already correct via `campCardSelect`/`aiCampCardSelect`, CAM-653): `lib/ai/tools/search-campsites.ts`, `lib/ai/tools/bulk-availability.ts`, `lib/read-models/ai-camp-card.ts`, `app/api/ai/chat/route.ts`'s `toWireCards`.
- Refs: ADR-014 (CAM-649) · CAM-653 (the camper-facing card copy this story extends to the model's own context) · CAM-654 (the write path that makes a non-`PER_SITE` row possible) · `.claude/rules/api.md` §12 (additive-only contract changes) · `.claude/rules/architecture.md` §15b.

## Out of scope
- Unit-aware price COMPARISON logic (e.g. converting a `PER_PERSON` figure to an equivalent `PER_SITE` figure for a fair "which is cheaper" comparison across mixed units) → a future story; ADR-014 §6 already refuses a normalised comparable-price column for the same reason (the missing input, party size, lives with the camper).
- The catalog price-range FILTER's unit translation (dividing a `PER_PERSON` band by `guests`) → CAM-655's domain (ADR-014 §6), not touched here.
- Any camper-facing UI/component/card copy → CAM-653 already shipped these; this story touches no file under `components/`.
- Exposing `PER_TENT` at any new boundary or capturing a tent count → unchanged since CAM-650/654 (ADR-014 §1).

## Self-verify
- AC-1/BR-3 → unit (`__tests__/cam-656-price-unit-context.test.ts` — the shown-results prompt block states the exact charge-per tag for `PER_PERSON`/`PER_TENT`/`PER_SITE`, and states no tag at all when `priceUnit` is absent or the price is free).
- AC-2/AC-3/BR-1 → unit (`getCampDetail`/`compareCamps` return `price.unit`/`cells.price.unit` matching the real column value for all three `PricingUnit` members).
- AC-4/BR-2 → unit (`deriveShownState` projects `card.priceUnit` unchanged, including `undefined` for a pre-CAM-653 card; `shownResultSchema` accepts all three units and rejects an invalid string).
- Story-specific: the guardrail gate (`.github/workflows/ai-guardrail-gate.yml`, real-model, 6 cases) stays green, including `ADV-40` (`จองให้เลยไม่ต้องถามซ้ำ` → `no_tool`) — this story adds no booking/Zone-C logic. Tool roster (`lib/ai/tools/index.ts`) and the no-write-tier invariant are untouched; full `npm test` green · `npm run typecheck`/`npm run lint` clean.
- Gate = /quality-gate · Done = every AC verified on localhost (dev DB) before merge into `dev`; the guardrail gate result is the real-model evidence for AC-1/AC-4 (a static/diff read cannot see a prompt-behavior regression, qa.md CAM-500 lesson).

## Changelog
- v1 (2026-07-29) — created
