---
linear: CAM-450
feature: ai-assistant
epic: chat-experience-overhaul
persona: camper
artifact: story
owner: frontend-engineer
status: In Progress
version: v1
updated: 2026-07-20
---
# The in-chat camp-detail drawer reorders by booking-decision weight and reads as a floating glass card (CAM-450)

<!-- Gate class: G2 = standard class (reuses existing tokens/components only: bg-ai-surface, shadow-ai-glow, border-ai-tint, backdrop-blur-xl, rounded-3xl, Badge success/destructive variants, tw-animate-css slide-in-from-* utilities already used by AiChatPanel.tsx/AiChatDetailCard.tsx — no new screen/flow/token) — no separate G2 tap. -->

## Story
As a **Camper**, I want the in-chat camp-detail drawer to show the fields I need to decide (ว่างวันไหน → รับได้/ราคา → สิ่งอำนวยความสะดวก → ความเชื่อถือ → การเดินทาง → เกี่ยวกับลาน → นโยบายยกเลิก) in that order, using only real data CampVibe has, and to visually read as one big floating card, so that I can decide whether to book without wading through generic or fabricated details.
Why: owner-approved wireframe review (R6) — CAM-448's drawer geometry read "too plain" (a flush side panel, not floating), and CAM-449 just added several decision-relevant fields (`weekendAvailability`, price/fee breakdown, capacity, cancellation policy, verified badge, check-in/out, directions, distance) that CAM-447/448 never wired in.
Scope: `components/ai-chat/AiChatDetailCard.tsx` (full section-order rewrite + floating-card geometry) + new `lib/facility-icon-map.ts` (shared code→icon lookup, extracted so this drawer can reuse the camp-detail page's icon-per-amenity treatment without re-guessing icons) + `locales/translations.json` (new `aiChat.detail.*` keys) — no schema/API change (CAM-449 already shipped the fields), no change to `AiChatPanel.tsx`'s mount call site/props, no booking CTA (Slice 3, out of scope).
Depends on: CAM-449 (`GetCampDetailResult` fields this wires) · CAM-448 (the drawer geometry this refines) · CAM-446 (`getCampDetail`, unchanged contract).

## AC
| # | Given | When | Then (user sees, Thai verbatim) | System effect | Neg/edge |
|---|---|---|---|---|---|
| AC-1 | the camper opens a camp's detail drawer on any viewport | the drawer renders | a rounded glass card inset from every screen edge (never flush), with a dimmed backdrop behind it | geometry-only; no data change | EC-1 |
| AC-2 | the camp has live per-weekend capacity data | the async fetch resolves | date chips read the date plus either `เหลือ {N} ที่` or `เต็มแล้ว`, ordered before every other section | renders `weekendAvailability[]`; a `null` `remaining` (no cap set) shows no number | EC-2 |
| AC-3 | the camp has `isVerified = true` | the async fetch resolves | a `ยืนยันแล้ว` badge appears next to the camp name | reads `detail.isVerified`; absent when `false` | EC-3 |
| AC-4 | the camp has an `extraFeeAmount` set | the price section renders | the base price plus the extra fee amount and label show as separate lines, never merged into one string | reads `detail.price.low`/`extraFeeAmount`/`extraFeeLabel`/`feeInfo` atomically | EC-4 |
| AC-5 | the camp has zero verified reviews | the reviews section renders | `ยังไม่มีรีวิว` shows in place of a review list | reads `detail.reviewSummary.hasReviews === false`; no fabricated 0.0-star row | — |
| AC-6 | the camp's `description` is empty/`null` | the drawer renders | the "เกี่ยวกับลานนี้" section does not appear at all | the whole section is omitted, not a blank paragraph | — |
| AC-7 | the camp has no `cancellationPolicy` set | the drawer renders | the bottom-most section shows the existing "ยังไม่ระบุนโยบายการยกเลิก" copy | `resolveCancellationPolicyCopy(null, ...)` — never inferred from price | — |

## Rules
- BR-1 Section order is fixed: stat row (ราคา/รับได้/ว่างวันไหน) → availability → price → amenities+activities → reviews → travel/good-to-know → about → cancellation (bottom-most). (proves AC-1..AC-7 ordering)
- BR-2 A stat tile / row / section renders ONLY when its underlying field has a real, non-null value — an empty field hides its row, never a blank or a fabricated placeholder. (proves AC-4/AC-6)
- BR-3 `weekendAvailability[n].remaining`: `null` → no number shown (cap not set); `0` or `blockedByHost` → `เต็มแล้ว`; otherwise the live guest count via the existing `t.aiChat.card.remaining` copy. Never shows a tent count as the remaining guest figure. (proves AC-2)
- BR-4 The verified badge and the hero's terrain/access/distance enrichment read from the async `GetCampDetailResult` (they do not exist on the instant card payload) and fill in progressively without gating the instant name/image/rating/province paint. (proves AC-3)
- BR-5 Amenities split by MasterData `group`: `Terrain`/`Access type` enrich the hero location line; `Activity` gets its own labeled sub-group; everything else renders as the "สิ่งอำนวยความสะดวก" icon grid (icon via the shared `getFacilityIcon` lookup, `ShieldCheck` fallback for an unmapped code).
- BR-6 Cancellation policy copy is resolved only through `resolveCancellationPolicyCopy` + the existing `campground.cancellationPolicy` catalog — never a new/duplicated translation, never inferred. (proves AC-7)

## Edge cases
- EC-1 IF `prefers-reduced-motion: reduce` is set THEN the card appears in place with no slide-in transform (unchanged from CAM-448).
- EC-2 IF `weekendAvailability` is an empty array THEN the existing `t.aiChat.detail.noAvailability` empty copy shows.
- EC-3 IF the async fetch fails THEN the existing compact `ErrorState` + retry shows (unchanged from CAM-447/448); the verified badge/stat row/sections simply never appear (no stale flash).
- EC-4 IF `extraFeeAmount` is `0` or `null` THEN the extra-fee line is omitted entirely (BR-2).

## Data
— n/a. Every field this story renders was already added to `GetCampDetailResult`/the wire contract by CAM-449; no schema/API/migration change here.

## Seams & refs
- Reuse: `resolveCancellationPolicyCopy` (`lib/cancellation-policy.ts`) · `bg-ai-surface`/`shadow-ai-glow`/`border-ai-tint`/`backdrop-blur-xl`/`text-ai-price` (CAM-426/444 token set) · `Badge` `success`/`destructive` variants (status-label rule, DESIGN.md §3) · `useMinimumLoading` (unchanged) · `t.booking.checkIn`/`checkOut`/`fullyBooked`, `t.campground.minimumAge`/`aboutPlace`/`cancellationPolicy.*` (cross-namespace reuse, no copy duplication).
- New (this story): `lib/facility-icon-map.ts` — a code→icon lookup extracted from `components/CampgroundDetailClient.tsx`'s own `facilityIconMap` (that file is left untouched, out of surface; a follow-up can point it at the shared map too).
- Refs: `docs/specs/ai-assistant/chat-experience-overhaul/CAM-449-camp-detail-fields/story.md` (the fields wired here) · `docs/specs/ai-assistant/chat-experience-overhaul/CAM-448-detail-drawer/story.md` (the geometry this refines).

## Out of scope
- A booking CTA/button in the drawer — Slice 3, follow-up ticket.
- Pointing `components/CampgroundDetailClient.tsx` at the new shared `lib/facility-icon-map.ts` — follow-up cleanup, not required for this story.
- Real driving-time/weather — explicitly cut per the wireframe (maps/weather APIs cost money); only the already-shipped straight-line `distanceFromBangkokKm` is shown, subtly, and only when present.

## Self-verify
`__tests__/cam-450-detail-drawer.test.ts` (source-inspection, same convention as CAM-447/448 — this repo's Vitest runs `environment: 'node'`, no jsdom) + surgical updates to `__tests__/cam-447-ai-chat-detail-card.test.ts` (2 geometry class strings + skeleton `<Skeleton>` count, both changed by this story's legitimate redesign; kept the rest intact):
- AC-1/BR-1 → structural: all 8 section testids present exactly once, in ascending source order, cancellation last.
- AC-2/BR-3 → structural + real behavioral: `getFacilityIcon` (new pure lookup) unit-tested directly (normal/fallback/empty); weekend-chip three-way branch asserted verbatim.
- AC-3/BR-4 → structural: `detail?.isVerified &&` gate + `t.aiChat.detail.verifiedBadge` present.
- AC-4 → structural: `detail.price.low`/`extraFeeAmount`/`extraFeeLabel`/`feeInfo` all wired; whole price section hidden when neither free nor a real low price.
- AC-5/AC-6/AC-7 → structural: `noReviews`/empty-about-section guard/`resolveCancellationPolicyCopy` reuse all asserted; Thai copy asserted verbatim from `locales/translations.json`.
- i18n → every new `aiChat.detail.*` key present in both locales, non-empty EN, no em-dash (extends CAM-447's existing EN/TH parity test, which already re-passed on the new keys).
- Gate = `/quality-gate` (`npm run lint` 0 errors · `npm run typecheck` clean · `npx vitest run` 247/247 files green · `check:ds`/`check:palette` 0 violations). `npm run build` skipped locally (Turbopack fails on this worktree's symlinked `node_modules`; CI verifies the real build). AC-1 (visual floating-card geometry) and the reduced-motion path are owner-verify on localhost (browser-only).

## Changelog
- v1 (2026-07-20) — created (spec-lite, filled in the same PR as the code per Gate policy v2; owner R6 wireframe review).
