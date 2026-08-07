---
artifact: story
feature: ai-assistant
epic: in-chat-booking-completion (CAM-695)
story: spot-step (CAM-700)
status: In Progress
version: v1
updated: 2026-08-06
---

## Story
As a **Camper** booking a per-pitch camp, I want to pick which pitch I'm taking inside the chat, so that the chat never offers a booking the camp page itself would refuse (a `useSpotView` camp requires a pitch).
Why: ADR-018 D7 — the chat is spot-blind today while the camp page **requires** a pitch on a `useSpotView` camp and the write API merely accepts a pitch-less booking (`spotId` optional). That is a product divergence the chat must not carry into a real write.
Scope: add a conditional `spot` step to the booking flow's state machine (`booking-flow.ts`), inserted between `guests` and `summary` for `useSpotView` camps only; the per-camp step registry + caption `{total}` fix this unblocks (design brief CAM-697 §2's own Critical note — was hardcoded to 4 since CAM-633); the step's async orchestration (`booking-turn.ts`: fetch candidates on entry, check occupancy on selection); its render (`AiChatBookingStep.tsx`: chips, empty state, occupied re-offer); the `spot.*` copy (TH/EN); and `get-camp-detail.ts`'s `useSpotView` field the whole story depends on. The real confirm/write, submitting/success/failure states are CAM-701/CAM-702 (out of scope, see below).
Depends on: CAM-697 (design brief v2, §4) · ADR-018 D7 · CAM-699 (nights step, merged) · epic CAM-695

## AC
| # | Given | When | Then (user sees, Thai verbatim) | System effect | Neg/edge |
|---|---|---|---|---|---|
| AC-1 | The camper answers `guests` on a `useSpotView` camp | The flow derives the next step | `ขั้นที่ 4 จาก 5 · เลือกจุดกางเต็นท์` then `เลือกจุดกางเต็นท์ที่ชอบได้เลย` once pitches load | The flow enters `spot`; the caption's `{total}` reads 5, not the old static 4 | EC-1 |
| AC-2 | The camper answers `guests` on a whole-camp (non-`useSpotView`) camp | The flow derives the next step | Goes straight to `summary`, `ขั้นที่ 4 จาก 4` | `spot` never appears in this camp's step list at all | AC-1 (contrast) |
| AC-3 | The camper is at `spot`, pitches are offered | They tap a pitch chip (e.g. `ริมน้ำ A · คืนละ ฿500`) | Advances to `summary`, showing `จุดกางเต็นท์` `ริมน้ำ A` | `slots.spotId`/`spotName` set only AFTER an occupancy check confirms the pitch is free for the whole span | EC-2 |
| AC-4 | The camper taps a pitch chip that a race/write proves occupied | The occupancy check reports taken | `{name} เพิ่งถูกจองไปเมื่อกี้ เลือกจุดอื่นได้เลย`, a fresh chip row excluding that pitch | `slots.spotId` NEVER committed; the flow stays on `spot` | EC-3 |
| AC-5 | The camper types a pitch name instead of tapping | The typed text matches an offered pitch by PREFIX | Same as AC-3 (advances, occupancy-checked first) | Identical commit path to the chip case | EC-4 |
| AC-6 | The camper types a name matching no offered pitch | — | A one-tap re-ask, reusing the 2-strike escape hatch every other step uses | `consecutiveMisses` increments; no network call made for a miss | EC-5 |
| AC-7 | Every live pitch is taken for the span, or none fits the party size | The `spot` step renders | `ช่วงวันนั้นยังไม่มีจุดที่ว่างและรับได้ทั้งกลุ่ม ลองแก้วันหรือจำนวนคนดูไหม`, no chip row | The step stays current; `แก้วัน`/`แก้จำนวนคืน`/`แก้จำนวนคน`/`ยกเลิกการจอง` are the way out | EC-6 |
| AC-8 | `GET /spots` fails, or the camp reports zero live pitches at all | The step-entry fetch resolves | The flow renders `summary` directly (the existing handoff CTA), never a pitch-less confirm | This session's camp is downgraded to whole-camp for the rest of the flow; `spot` is never revisited | EC-7 (load-bearing) |
| AC-9 | The camper reaches `summary` with a pitch chosen | They tap `แก้จุดกางเต็นท์` | Returns to `spot`, chips rebuilt from the already-cached candidate list (no re-fetch) | `slots.spotId`/`spotName` cleared; `checkIn`/`nights`/`guests` kept | EC-8 |
| AC-10 | The camper edits an earlier field (`แก้วัน`/`แก้จำนวนคืน`/`แก้จำนวนคน`) after picking a pitch | The control fires | Returns to that step, freshly asked | `spotId`/`spotName` AND the cached candidate list are BOTH cleared — a stale pitch/price is never carried across a span/party change | EC-9 |

## Rules
- BR-1 `BookingSlots` gains `spotId?: string` and `spotName?: string` (flat, optional, serialisable — the module's own rule unbroken). `spotName` rides alongside `spotId` so the summary row never needs a second lookup against a candidate list that may have moved on (proves AC-3/AC-9).
- BR-2 The step registry is now resolved PER CAMP (`resolveBookingSteps(useSpotView)`): `[date, nights, guests, summary]` whole-camp, `[date, nights, guests, spot, summary]` per-pitch. `spot`'s `isSatisfied` checks `slots.spotId !== undefined` (proves AC-1/AC-2).
- BR-3 `spot`'s `accept` confines to `spotId`/`spotName` and only accepts a pair that matches a REAL entry in the caller-injected live candidate list (`ctx.spotCandidates`) — it deliberately does NOT check occupancy (static-only, sync); occupancy is a SEPARATE async check that must pass before the candidate is ever committed to state (proves AC-3/AC-4 — the load-bearing ordering).
- BR-4 Offered candidates are filtered by `Spot.maxCampers === null || maxCampers >= guests` (client-side, from the raw `GET /spots` list), sorted cheapest-first, capped at 4 chips (design brief §4's own layout constant) — a typed name may still reach any eligible pitch, shown or not.
- BR-5 The occupancy check queries `GET /spots-availability?spotId=` across every night of the chosen span (`checkIn` through the LAST night, `checkIn + nights - 1` — that route's own inclusive-of-endDate convention, distinct from this flow's exclusive-checkout `checkOut`). `true` only when every queried night is free; `null`/off-contract never counts as free (proves AC-4).
- BR-6 A `GET /spots` failure OR a genuinely empty raw list (the camp has zero live pitches) downgrades THIS session's camp copy to `useSpotView:false` for the rest of the flow — `spot` is skipped permanently, the existing whole-camp `summary` (with its handoff CTA) takes over unchanged. This is distinct from "pitches exist but none fit" (BR-4's filter producing zero), which is the REAL `spot.empty` state and stays on the step (proves AC-7 vs AC-8).
- BR-7 Editing `date`/`nights`/`guests` clears `spotId`/`spotName` AND the cached candidate list (forces a fresh fetch next time `spot` is reached, since the span/party changed); editing FROM `spot` itself (`แก้จุดกางเต็นท์`) clears only `spotId`/`spotName`, keeping the cached list (no re-fetch needed — proves AC-9/AC-10).

## Edge cases
- EC-1 IF a whole-camp flow's slots somehow carry `spotId` (never produced by this flow) THEN `buildSummaryView` still renders correctly — it is driven by `slots.spotId` presence, not `camp.useSpotView`, so a stray value degrades gracefully rather than crashing (defensive; not reachable via the real UI).
- EC-2 IF the occupancy check succeeds (free) THEN the summary renders with the SAME `buildSummaryView` every other step transition already uses — no parallel "spot summary" code path (BR-1).
- EC-3 IF a pitch turns out occupied THEN it is excluded from BOTH the immediate re-offer AND any subsequent typed/chip match this attempt, until a fresh fetch (BR-6/BR-7).
- EC-4 IF a typed pitch name is a PREFIX of an offered pitch (not shown in the visible 4 chips) THEN it still resolves — the eligible list, not just the visible chips, is the match universe (BR-4).
- EC-5 IF two consecutive typed pitch names are unreadable THEN the 2-strike escape hatch fires identically to every other step (unchanged mechanism, `booking-flow.ts`'s own `MAX_CONSECUTIVE_MISSES`).
- EC-6 IF the party size exceeds every live pitch's `maxCampers` THEN `spot.empty` renders with `แก้จำนวนคน` in the control row (BR-4/BR-6).
- EC-7 IF `GET /spots` throws, times out, or returns a non-2xx status THEN it is treated identically to "the camp has zero live pitches" — never surfaced as a distinct error state, never a stall (BR-6, the load-bearing safety property pinned by test).
- EC-8 IF the flow is cancelled or moves to a different camp while an async spot fetch/check is still in flight THEN the async result is discarded on arrival (never resurrects a stale/cancelled flow — `code.md` CAM-359 guard, checked by camp id).
- EC-9 IF `แก้วัน`/`แก้จำนวนคืน`/`แก้จำนวนคน` fires from `summary` on a per-pitch camp with a chosen pitch THEN the pitch is cleared even though the control targets an earlier field (BR-7).

## Data
- No schema/DB change. `useSpotView` on `GetCampDetailResult` is an ADDITIVE return-only field from an ALREADY-selected `CampSite.useSpotView` column (`get-camp-detail.ts`'s existing Prisma `select`) — no new query. `BookingSlots`/`BookingSession` gains flat, client-side-only fields (spotId/spotName/spotCandidates). Migration: none.

## Seams & refs
- Reuse: `GET /api/campsites/[id]/spots` (existing, CAM-352) · `GET /api/campsites/[id]/availability?spotId=` (existing, CAM-665) · `buildSummaryView`/`buildBookingPriceArgs` (unchanged pricing math — this story does NOT thread the chosen pitch's own price into the summary total, a deliberate lean scope decision, see Out of scope) · the EXISTING `checkFailed`/`isChecking` presentation patterns (round-1, previously dormant, now given real callers) · the EXISTING generic `onBookingBack` handler (reused for `editNights`/`editSpot` — no new prop was added to the hook's public surface, keeping `AiChatPanel.tsx`/`AiChatMessageList.tsx` untouched).
- Refs: ADR-018 D7 (why a pitch is required) · CAM-697 design brief v2 §4 (the spot step's exact copy/chip/empty/occupied contract) · epic CAM-695.
- **Architecture note (Info, not a blocker):** the step-entry fetch and the per-selection occupancy check are implemented as ASYNC exported functions in `booking-turn.ts` (`resolveSpotStep`/`resolveSpotSelection`) that take the network call as an INJECTED parameter — `booking-turn.ts` still imports zero of `lib/api-client.ts` at runtime, and both functions are unit-tested with a fake fetcher (no jsdom/RTL harness needed for the async orchestration itself). This is a deliberate extension of the file's existing "pure orchestration, hook applies results" pattern to cover injected async I/O, not a departure from it.
- **Deviation, disclosed:** the design brief's step-entry fetch timing ("on entering the step, use-ai-chat fetches /spots") is implemented exactly as written (lazy, on entry) — no prefetch-at-flow-start was attempted (would have added complexity for marginal UX benefit, given the async gap is typically sub-second and shown via the existing `isChecking` pattern).

## Out of scope
- The real confirm/write, `submitting`/`booked`/`bookingFailed` states → CAM-701/CAM-702 (ADR-018, design brief CAM-697 §5-§8).
- Threading the CHOSEN pitch's own price into the summary total (`buildSummaryView` still prices off `camp.unitPrice`, unchanged) — the round-1 summary is a non-binding preview handed off to the camp page, which prices the pitch correctly at write time; adding this now would be scope creep ahead of CAM-701/702's real confirm. Follow-up: fold in alongside CAM-701/702 if the preview's accuracy matters before then.
- Prefetching `/spots` at flow start instead of on `spot`-step entry (see Seams & refs).
- A per-candidate pre-render availability filter (design brief §4's ideal "offered = free for every night") — this story checks occupancy ONLY on selection (one call), per the dispatch's own explicit permission to simplify here; pre-filtering every candidate by span before display would cost one `/availability` call per candidate.

## Self-verify
- AC-1/AC-2 → unit + jsdom render: `__tests__/cam-700-spot-step.test.ts` (registry/currentStep per camp) + `__tests__/cam-700-ai-chat-booking-step-spot.test.ts` (caption "Step 4 of 5" / "Step N of 4").
- AC-3/AC-5/AC-6 → unit: `__tests__/cam-700-spot-step.test.ts` (parse/accept) + `__tests__/cam-700-spot-turn.test.ts` (the full async commit path, injected fetcher).
- AC-4 (load-bearing: occupied never commits) → unit: `__tests__/cam-700-spot-turn.test.ts`'s dedicated `[LOAD-BEARING]` case, mocked availability response.
- AC-7 → unit + jsdom: `__tests__/cam-700-spot-view.test.ts` (`buildSpotQuestionView` reason:'empty') + `__tests__/cam-700-ai-chat-booking-step-spot.test.ts` (the `empty--ai-chat-booking-no-spots` testid).
- AC-8 (load-bearing: fetch failure/empty fails toward handoff) → unit: `__tests__/cam-700-spot-turn.test.ts`'s two dedicated `[LOAD-BEARING]` cases (fetch fails · camp reports zero pitches).
- AC-9/AC-10 → unit: `__tests__/cam-700-spot-view.test.ts` (buildSummaryView spotValue/editSpot) + `booking-turn.ts`'s `processBookingControl` coverage in `cam-700-spot-step.test.ts`.
- Story-specific: existing `cam-446`/`cam-449`/`cam-640`/`cam-698`/`cam-699` suites updated minimally for the additive `useSpotView` field and the new `NightsQuestionParams.useSpotView` param — every changed fixture carries a dated `CAM-700` comment, none silently deleted. `cam-640-use-ai-chat-wiring.test.ts`'s two whole-file `indexOf` assertions were rescoped to `sendMessage`'s own body (the new `settleBookingTurn`/`handleSpotSelection` helpers legitimately precede it in source order — a TDZ constraint, documented inline).
- Gate = `/quality-gate` · Done = merged into `dev` with the full suite green (12200+ tests) + lint 0 errors + typecheck clean + `npm run build` green + AC verified on localhost (dev DB — no schema in this story, nothing to seed).

## Changelog
- v1 (2026-08-06) — created.
