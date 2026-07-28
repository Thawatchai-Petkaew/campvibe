---
linear: CAM-643
feature: ai-assistant
epic: in-chat-guided-booking-camper-sets-dates-and-party (CAM-630)
persona: camper
artifact: story
owner: product-owner
status: In Progress
version: v1
updated: 2026-07-29
---
# The chat states the price per night, the same as every other surface (CAM-643)

## Story
As a **Camper**, I want the chat's price to say "per night" like every other price display in the app, so that I don't infer a per-guest total that doesn't match what I'm actually charged.
Why: the AI chat was the only surface quoting price per-guest ("per guest / night"); every other surface (camp card, camp detail page, host price input) and `computeBookingPrice` itself are strictly per-night with no guest multiplier — a camper reading the chat for a ฿500 camp with 2 people could infer ฿1,000 when the real charge is ฿500.
Scope: copy-only fix in `components/ai-chat/AiChatDetailCard.tsx` + `locales/translations.json` (TH/EN). No schema, no API, no price-calculation change.
Depends on: —

## AC
| # | Given | When | Then (user sees, Thai verbatim) | System effect | Neg/edge |
|---|---|---|---|---|---|
| AC-1 | Camper opens a camp's detail card in the chat, price is not free | Card renders the quick-glance price stat tile | Stat tile shows the price with the caption `/คืน` (EN: `/night`) under it, not `ต่อคน/คืน` | No data change; `label` reads `t.aiChat.card.perNight` instead of the retired `t.aiChat.detail.statPriceLabel` | EC-1 |
| AC-2 | Camper scrolls to the Price section of the same detail card, price is not free | Section renders the price value | Value shows `฿{price}` followed by `/คืน` (EN: `/night`), not `/คน/คืน` | No data change; the span reads `t.aiChat.card.perNight` instead of the retired `t.aiChat.detail.perGuestNight` | EC-2 |

## Rules
- BR-1 Price shown anywhere in the AI chat is per-night, matching `Spot.pricePerNight` and `computeBookingPrice` (`lib/booking-pricing.ts`), which has no guest parameter and computes `subtotal = unitPrice * nights`.
- BR-2 The chat's price-unit copy must be the SAME translation key already used by the chat's own card carousel (`aiChat.card.perNight`), not a private duplicate — a private duplicate key is exactly how AC-1/AC-2 drifted to "per guest" in the first place.

## Edge cases
- EC-1 IF the camp is free THEN the stat tile shows the free-price copy (`t.aiChat.card.free`) with no per-night caption at all (unchanged behavior, not part of this fix).
- EC-2 IF the camp is free THEN the Price section shows only the free-price copy (`t.aiChat.card.free`), no per-night suffix (unchanged behavior, not part of this fix).

## Data
- No entities/fields touched. `locales/translations.json`: removed `aiChat.detail.statPriceLabel` and `aiChat.detail.perGuestNight` (en + th, both were the wrong per-guest phrasing) — no reader is left pointing at them. Migration: none.

## Seams & refs
- Reuse: `aiChat.card.perNight` (`locales/translations.json`), the same key `components/ai-chat/AiChatCampCard.tsx` and this same file's own CTA price (line ~706, pre-existing) already use — no parallel per-night string introduced. Refs: —

## Out of scope
- Any change to `lib/ai/**` (routes through the paid real-model CI gate) → not touched, not needed for a copy fix.
- Any booking-flow or price-calculation change → `computeBookingPrice` is read-only evidence here, not modified.

## Self-verify
- AC-1, AC-2 → unit (source-inspection + i18n value assertions, `__tests__/cam-643-chat-price-per-night.test.ts`); existing `cam-450-detail-drawer.test.ts` / `cam-452-detail-aa-contrast.test.ts` updated to match.
- Story-specific: grep-verified zero remaining "per guest / night" / "/guest/night" / "ต่อคน/คืน" / "/คน/คืน" across `locales/ components/ app/ lib/`; `git diff origin/dev --name-only` carries zero `lib/ai/` files.
- Gate = /quality-gate · Done = every AC verified on the real Staging URL (localhost dev DB before merge)

## Changelog
- v1 (2026-07-29) — created
