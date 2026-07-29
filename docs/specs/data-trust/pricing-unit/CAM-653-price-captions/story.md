## Story
As a **Camper**, I want every price I see to say what it is charged per, so that I never have to guess whether ฿250 means per night for the whole site or per person.
Why: CAM-651/652 taught the engine to charge `PER_PERSON`/`PER_TENT`/`PER_SITE` correctly, but every rendered price caption still says `/คืน` unconditionally — a host who later sets `PER_PERSON` (CAM-654) would have a screen that shows the right TOTAL next to a caption that quietly still claims "per night," which is worse than the original bug because it now looks confirmed.
Scope: every price CAPTION only (`/คืน`, `ต่อคน/คืน` on the catalog card, the camp detail headline + per-spot list, and the two AI-chat cards) — never the booking-breakdown itemized line (CAM-652 owns that), never the host-facing unit picker (CAM-654), never `lib/ai/**` (a paid CI gate; CAM-656 owns the assistant's own price wording). No camp can be anything but `PER_SITE` yet, so every caption must render byte-identical to today while becoming unit-aware in code.
Depends on: ADR-014 (CAM-649) · CAM-650 (schema) · CAM-651 (engine) · CAM-652 (booking breakdown, sibling scope)

## AC
| # | Given | When | Then (user sees, Thai verbatim) | System effect | Neg/edge |
|---|---|---|---|---|---|
| AC-1 | A camp with `CampSite.priceUnit = PER_SITE` (every real camp today) | The camper views the catalog card, the camp detail headline, the per-spot list, or either AI-chat card | Caption renders exactly as it did before this story (`/คืน` on the card/chat surfaces, `คืน` on the detail headline/per-spot list) | No change to any rendered byte for a PER_SITE row | AC-3 |
| AC-2 | A camp fixture with `CampSite.priceUnit = PER_PERSON` (not reachable with real data yet — CAM-654 ships the picker) | The catalog card / camp detail headline / AI-chat cards render that fixture | Caption reads `฿250 /คน/คืน` (card/chat style) or `฿250 ต่อคน/คืน` (detail-headline style) | The caption's unit-lookup key changes from the fixed `common.perNight`/`common.night` to the row's real `priceUnit`, defaulting to `PER_SITE` only when absent | EC-1 |
| AC-3 | A per-spot camp where the camp's own unit is `PER_SITE` but one spot's own `priceUnit` is `PER_PERSON` (fixture — no host form writes a non-default spot unit yet) | The camper views that spot's row in the per-spot list, on the same screen as the camp-level headline | The per-spot row's caption reflects **that spot's** unit (`ต่อคน/คืน`), while the headline above it still reads the camp's own unit (`คืน`) — the two differ on one screen | Per-spot caption reads `spot.priceUnit`; the headline reads the camp-level resolved unit; neither is re-paired with the other's value (`resolveUnitPrice`'s "never re-pair a row's price with another row's unit" contract, unchanged) | — (a mismatch here is exactly the bug `resolveUnitPrice` was designed to prevent; nothing else to fail against) |
| AC-4 | Any of the 6 price-caption call sites (catalog card, detail headline, per-spot list, AI-chat card, AI-chat detail's 3 sites) | The translations file is inspected | The caption's copy comes from ONE shared, unit-keyed group (`common.priceUnitSuffix`/`common.priceUnitLabel`) — no call site owns a private duplicate key | `aiChat.card.perNight` (the CAM-643 private key) no longer exists in either locale; every call site reads through `lib/price-unit-display.ts` | AC-1 |

## Rules
- BR-1 `common.priceUnitSuffix.{PER_PERSON,PER_TENT,PER_SITE}` and `common.priceUnitLabel.{PER_PERSON,PER_TENT,PER_SITE}` are the ONLY i18n keys a price caption may read (via `lib/price-unit-display.ts`'s `priceUnitSuffix`/`priceUnitWord`) — a new per-surface duplicate key is not added.
- BR-2 `common.priceUnitSuffix.PER_SITE` (`/คืน` / `/night`) is byte-identical to `common.perNight`, and a test asserts the two can never drift apart (`common.perNight === common.priceUnitSuffix.PER_SITE`, both locales).
- BR-3 A missing/undefined `priceUnit` (an older cached payload, or an AI-chat surface `lib/ai/**` has not threaded the column through yet) defaults to `PER_SITE` — matching the column default (ADR-014 §2) and `resolveUnitPrice`'s existing `normalizeUnit` fallback.
- BR-4 The per-spot list reads `spot.priceUnit`; the camp detail headline reads the camp-level resolved unit (`bookingPricingUnit`, already computed for the booking-preview total) — never the other's value.
- BR-5 `PER_TENT` copy exists in the shared table (both groups, both locales) even though no writer sets a non-default `PER_TENT` row today — the enum has three values (ADR-014 §1) and a missing key would be a runtime hole the moment a fixture or future data uses it.

## Edge cases
- EC-1 IF `card.priceUnit` is `undefined` (every AI-chat card today — `lib/ai/**` does not select `CampSite.priceUnit` yet, out of this story's surface) THEN the caption renders the `PER_SITE` default, never a crash or a blank suffix.
- EC-2 IF a caller passes `null` for `priceUnit` (a DB row from before CAM-650's default, theoretically only in a stale fixture) THEN `priceUnitSuffix`/`priceUnitWord` both normalize to `PER_SITE`, matching `resolveUnitPrice`'s existing null-handling.
- EC-3 IF every row in the current dataset is `PER_SITE` (true today) THEN the rendered byte content of every one of the 6 call sites is identical to before this story (AC-1's safety property, asserted by test, not claimed).

## Data
- No schema change. `CampSite.priceUnit`/`Spot.priceUnit` already exist (CAM-650) and are already read by the booking engine (CAM-651/652); this story is a read-path wiring for DISPLAY only: `lib/read-models/camp-card.ts`'s `campCardSelect` now also selects `priceUnit` (was previously unselected on this read model), and `app/wishlist/page.tsx`'s own inline `select` gets the same additive field so its shared `CampSiteCardData` type stays satisfied.
- Migration: none.

## Seams & refs
- Reuse: `lib/price-unit-display.ts` (new, this story) is the ONE place every price caption turns a `PricingUnit` into copy — `priceUnitSuffix` (the `/night`-glued style: catalog card, both AI-chat cards) and `priceUnitWord` (the standalone-word style: detail headline + per-spot list, which pre-date this story reading the bare `common.night` word rather than a slash suffix). Never re-implemented per call site.
- Reader/writer sweep (architecture.md §15b — this story changes how the caption's UNIT is read, not just where it renders): grepped every price-caption call site before touching it. `components/CampgroundCard.tsx` (NOW), `components/CampgroundDetailClient.tsx` headline + per-spot list (NOW — reuses `bookingPricingUnit`, already resolved above for the booking-preview total; no second resolution), `components/ai-chat/AiChatCampCard.tsx` (NOW), `components/ai-chat/AiChatDetailCard.tsx` 3 sites — stat tile, body price, sticky CTA (NOW, all read `card.priceUnit`, the camp-level instant payload), `components/MapComponent.tsx`'s own inline `/ {t.common.night}` caption (NO-CHANGE — out of this story's named surface; still PER_SITE-style today, a separate follow-up if it needs unit-awareness). `lib/read-models/ai-camp-card.ts` needed no edit — it spreads `campCardSelect`, so `priceUnit` flows through automatically. `lib/ai/tools/search-campsites.ts`/`get-camp-detail.ts` (LATER, `lib/ai/**` is a paid CI gate out of this story's surface — CAM-656 owns threading `priceUnit` through there; until then `AiChatCardResponse.priceUnit` is always `undefined` and every AI-chat caption defaults to `PER_SITE`, per EC-1).
- Refs: ADR-014 (CAM-649) · CAM-650 (schema) · CAM-651 (engine) · CAM-652 (booking-breakdown sibling, explicitly out of scope here) · `.claude/rules/architecture.md` §15b.

## Out of scope
- The booking-breakdown itemized line (`฿unit x quantity x nights`) → CAM-652 (already shipped).
- The host-facing unit picker → CAM-654.
- `PER_TENT` exposure at any zod/UI boundary, or a tent-count capture → a future story (ADR-014 §1, unchanged).
- Threading `priceUnit` through `lib/ai/tools/get-camp-detail.ts`/`search-campsites.ts` (`lib/ai/**`, paid CI gate) → CAM-656.
- `components/MapComponent.tsx`'s own price caption → not named in this story's surface; a separate follow-up if needed.

## Self-verify
- AC-1 → unit (`cam-653-price-captions-state-the-unit.test.ts` — `priceUnitSuffix`/`priceUnitWord` return the exact pre-existing string for `PER_SITE`, both locales) + source-inspection (every call site reads through the shared helper, never a hardcoded literal).
- AC-2 → unit (the same file — `priceUnitSuffix`/`priceUnitWord` return the right string for `PER_PERSON`/`PER_TENT` from a fixture, all three units, both locales).
- AC-3 → structural + behavioral (source-inspection proves the headline reads `bookingPricingUnit` and the per-spot row reads `spot.priceUnit` — two different expressions, never the same one; a behavioral case proves the two captions genuinely differ for a PER_SITE camp / PER_PERSON spot pair).
- AC-4 → guard (source-inspection: the retired `aiChat.card.perNight` key is gone from both locales; no component file hardcodes a per-guest/per-tent phrase or re-declares a private perNight-shaped key).
- Story-specific: `common.perNight === common.priceUnitSuffix.PER_SITE` (both locales) · `grep -rn "ต่อคน/คืน\|/คน/คืน" locales/` finds the new table (the old repo-wide ban is gone) · full `npm test` green (11500+ tests, 0 regressions, the old `cam-643-*` test file deleted and superseded) · `npm run typecheck`/`npm run lint`/`check:ds`/`check:palette` clean.
- Gate = /quality-gate · Done = every AC verified on localhost (dev DB) before merge into `dev`.

## Changelog
- v1 (2026-07-29) — created
