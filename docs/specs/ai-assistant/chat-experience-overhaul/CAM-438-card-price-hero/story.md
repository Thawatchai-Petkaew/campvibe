---
linear: CAM-438
feature: ai-assistant
epic: chat-experience-overhaul
persona: camper
artifact: story
owner: frontend-engineer
status: In Progress
version: v1
updated: 2026-07-19
---
# In-chat camp cards show their full border and lead with price (CAM-438)

<!-- Gate class: G2 = standard class (reuses existing tokens/components, no new screen/flow/token) — reviewed via the designer's R2 readability brief, no separate G2 tap. -->

## Story
As a **Camper**, I want the recommended-camp card in chat to show its whole border (not cropped) and to show the price as the most obvious thing on the card, so that I can scan several cards quickly and compare them by price at a glance.
Why: R2 owner staging feedback — the carousel track clips the card's border/glow/hover-lift top and bottom, and price today reads at the same visual weight as rating, so it doesn't stand out.
Scope: `components/ai-chat/AiChatCardCarousel.tsx` (track className only) + `components/ai-chat/AiChatCampCard.tsx` (card body reflow only). No change to card data, navigation (`onSelect`), or the single-card branch (already un-clipped).
Depends on: CAM-409 (carousel track) · CAM-428 (dedicated card component).

## AC
| # | Given | When | Then (user sees, Thai verbatim) | System effect | Neg/edge |
|---|---|---|---|---|---|
| AC-1 | the assistant returns 2+ campsite cards | the camper views the in-chat carousel | every card's full border, glow, and hover-lift are visible top and bottom, not clipped | no data change; track gains vertical padding so its scrollbox no longer clips card edges | EC-1 |
| AC-2 | a card has a real nightly price (`priceLow > 0`) | the camper looks at a card | price renders on its own line right under the camp name, larger and bolder than every other line on the card, formatted `฿{amount}` + `{t.aiChat.card.perNight}` (`/คืน`) | display-only reorder; `priceLow`/currency values unchanged | EC-2 |
| AC-3 | a card is free (`priceLow` null or 0) | the camper looks at a card | the same hero line shows `{t.aiChat.card.free}` (`ฟรี`) at the same size/weight as the priced case | display-only; no data change | — (boundary of AC-2, same code path) |

## Rules
- BR-1 Carousel track (`AiChatCardCarousel.tsx`) gets `py-4` added to its scroll-container className, alongside the existing `-mx-4/px-4` horizontal peek (unchanged). Fixes the CSS fact that `overflow-x-auto` on a flex track computes `overflow-y: auto` too, clipping child glow/lift at the box edge. (proves AC-1)
- BR-2 Card body (`AiChatCampCard.tsx`) renders price as its own `<p data-testid="text--ai-chat-card-price">` directly after the name and before the province row, styled `text-lg font-semibold text-primary` for the amount (+ `text-xs font-normal text-muted-foreground` suffix) — strictly larger/bolder than the `text-sm` name and `text-xs` meta row. (proves AC-2/AC-3)
- BR-3 The old inline price `<span>` is removed from the shared meta row (rating/price/remaining) so price appears exactly once per card, in the hero position only. (proves AC-2, regression guard against a duplicate price)
- BR-4 New reading order top-to-bottom: name → price (hero) → province → rating/remaining → tag → view-detail link. (proves AC-2)

## Edge cases
- EC-1 IF exactly 1 card is returned THEN the single-card branch (no carousel chrome) renders unchanged — it was never clipped, so `py-4` does not apply there
- EC-2 IF `priceLow` is `null` or `0` THEN the hero line shows the free copy, never `฿0` or an empty line

## Data
— n/a (display-only; no schema/API change; reuses the existing `AiChatCardResponse.priceLow` field, CAM-427).

## Seams & refs
- Reuse: `THB_FORMAT` (`Intl.NumberFormat("th-TH")`, hoisted in `AiChatCampCard.tsx`) · existing i18n keys `t.aiChat.card.perNight`/`t.aiChat.card.free` (already present in both `th`/`en` in `locales/translations.json`, CAM-272) · `text-primary`/`text-muted-foreground` tokens (`DESIGN.md`).
- Refs: `docs/specs/ai-assistant/chat-experience-overhaul/CAM-409-.../story.md` (carousel track) · `CAM-428-framed-chat-card/story.md` (card component) · owner's R2 readability design brief (designer, read-only pass, scratchpad).

## Out of scope
- Any change to card data, `onSelect` navigation, or which cards are returned — display/layout only.
- Bumping price to `text-xl` (brief allows it, `text-lg` chosen — fits the 256px card without crowding the name; a follow-up ticket if the owner wants it louder after staging review).

## Self-verify
- AC-1 → unit (`__tests__/cam-409-ai-chat-card-carousel.test.ts` extended or existing): track className contains `py-4` alongside `overflow-x-auto`/`px-4`; single-card branch className unchanged.
- AC-2/AC-3/BR-2/BR-3/BR-4 → unit (`__tests__/cam-428-framed-chat-card.test.ts`, existing assertions re-verified): `text--ai-chat-card-price` testid still present exactly once; `text-lg`/`text-primary` present on the price line; old inline price line (duplicate testid in the meta row) removed.
- Manual: axe run on `text-primary` price over `bg-card` (contrast, not measured by unit test — see checks).
- Gate = `/quality-gate` · Done = merge to `dev` + AC verified on localhost before merge.

## Changelog
- v1 (2026-07-19) — created (spec-first, template v2, terse per the spec-lite class).
