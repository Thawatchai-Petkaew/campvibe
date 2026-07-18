---
linear: CAM-409
feature: ai-assistant
epic: ai-camping-assistant-a1-a4-b1-b3-c-inquiry (CAM-266)
persona: camper
artifact: story
owner: product-owner
status: In Progress
version: v1
updated: 2026-07-18
---
# In-chat camp cards become a swipe carousel with peek (CAM-409)

## Story
As a **Camper**, I want the campsite cards inside the AI chat answer to sit in a
horizontal swipe strip where I see about one and a half cards at a time (the next
one peeking), so that I can glance across and compare the recommended camps
without one giant card filling the panel and pushing the answer out of view.
Why: the shipped build stacks cards full-width and vertically — "cards too big,
one at a time" (owner, 2026-07-18, Wave1-S1).
Scope: layout of the in-chat cards only (`components/ai-chat/*`) — reuse
`CampgroundCard` compact unchanged; no data/API change; Discover-only stands.
Depends on: CAM-272 (in-chat cards, shipped) · design.md (novel UI, G2 first)

## AC
| # | Given | When | Then (user sees, Thai verbatim) | System effect | Neg/edge |
|---|---|---|---|---|---|
| AC-1 | an assistant answer carries ≥2 campsite cards | the turn renders | cards sit in a horizontal row showing ~1.5 cards with the next card peeking at the edge, replacing the full-width vertical stack (no fixed UI string — the cards show camp names from data) | none (presentational; `cards[]` unchanged) | EC-1 |
| AC-2 | the carousel has >1 card and is not at the end | user swipes/drags or taps the next control (`ดูลานถัดไป`) | the strip snaps to the next card | none | EC-2 |
| AC-3 | the carousel has >1 card | a screen-reader user reaches it | it is announced as a group `ลานกางเต็นท์ที่แนะนำ {count} แห่ง` and each card is a reachable link | none | — (a11y, non-visual — verified with axe/keyboard, no failure twin) |
| AC-4 | any card in the carousel | user taps it | the camp detail page opens (`/campgrounds/{slug}`, unchanged from CAM-272) | none | — (reuse of CAM-272 AC-2, covered there) |

## Rules
- BR-1 Carousel chrome (chevrons + indicator) renders only when `cards.length > 1`. Exactly 1 card → the single card with no chrome; 0 cards → CAM-272 zero-result notice (no carousel). (proves AC-1, EC-1)
- BR-2 Card width `w-64 sm:w-60` (~256px mobile sheet / 240px desktop panel), `snap-start shrink-0`, track `snap-x snap-mandatory` → ~1.5 cards visible with peek. Card reused = `CampgroundCard` compact, image `aspect-square` unchanged (no 4:3 fork — reuse-not-reimplement CAM-249 / CAM-272 AC-1). (proves AC-1)
- BR-3 Prev disabled at scroll-start, Next disabled at scroll-end (`disabled:opacity-50`). Programmatic scroll uses `motion-safe:scroll-smooth` → reduced-motion disables it. (proves AC-2, EC-2, EC-3)
- BR-4 Copy (`locales/` `aiChat` namespace, TH+EN): `cardsLabel`=`ลานกางเต็นท์ที่แนะนำ {count} แห่ง` · `cardsPrev`=`ดูลานก่อนหน้า` · `cardsNext`=`ดูลานถัดไป`. Counter `{cur}/{N}` is a `tabular-nums` numeral pair, `aria-hidden`. (proves AC-2, AC-3)

## Edge cases
- EC-1 IF `cards.length === 1` THEN render the single card with NO chevrons/indicator/scroll-snap chrome (BR-1)
- EC-2 IF the strip is scrolled to the last card THEN the next chevron is disabled (`disabled:pointer-events-none`) and swiping past the end no-ops (native) (BR-3)
- EC-3 IF `prefers-reduced-motion` is set THEN chevron/arrow scrolling is instant, no smooth animation (via `motion-safe:scroll-smooth`) (BR-3)

## Data
- No entities/fields touched · presentational layout only · `cards[]` (CAM-271) unchanged · migration: none

## Seams & refs
- Reuse: `components/CampgroundCard.tsx` (compact, unchanged) · `components/ai-chat/AiChatCampCard.tsx` (unchanged) · recommend a new `components/ai-chat/AiChatCardCarousel.tsx` replacing the `space-y-3` cards block in `AiChatMessageList.tsx`. Refs: CAM-272 design.md §"In-chat campsite card" (this SUPERSEDES its single-column layout rule) · `.claude/rules/loading.md` (cards arrive with the answer → no loader)

## Out of scope
- 4:3 card image / any change to `CampgroundCard`'s shared visual → separate owner decision (flagged in design.md §"Image aspect"; not built here, to preserve the one-shared-card rule)
- Autoplay / auto-advance · clickable dots · a full `/assistant` page → not in this story

## Self-verify
- AC-1..2 → owner-verify (browser: swipe + peek visible, chevrons snap) + a component test on the carousel-chrome gating (BR-1)
- AC-3 → keyboard + axe (group label, card links reachable, chevrons named, tap ≥44px)
- AC-4 → covered by CAM-272 (card link unchanged)
- Story-specific: 1-card no-chrome (EC-1) · Next disabled at end (EC-2) · reduced-motion instant scroll (EC-3) · design gate (token-only + a11y + anti-slop, no new token)
- Gate = /quality-gate · Done = every AC verified on localhost (dev DB) before merge, re-verified on the real Staging URL

## Changelog
- v1 (2026-07-18) — created (carousel-with-peek redesign of the CAM-272 in-chat cards)
