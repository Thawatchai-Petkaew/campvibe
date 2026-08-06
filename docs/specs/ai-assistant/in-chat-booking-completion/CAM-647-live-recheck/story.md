---
artifact: story
feature: ai-assistant
epic: in-chat-booking-completion (CAM-695)
story: live-recheck (CAM-647)
status: In Progress
version: v1
updated: 2026-08-06
---

## Story
As a **Camper** who has just answered the last question before the in-chat booking summary, I want the chat to double-check that my dates are still bookable before it shows me a total, so that I am never shown a confident summary for a stay that has already filled up.
Why: CAM-640 deferred this on purpose — round 1 shipped the E1 (`justFilled`)/E3 (`checkFailed`) shapes (CAM-639) but wired the summary from the `weekendAvailability` snapshot captured when the detail card opened, so a date that filled mid-conversation still rendered as bookable. `POST /api/bookings` re-checks inside its own Serializable transaction, so nothing can be overbooked either way, but showing a summary for a date we could have known was gone is a confident wrong answer — and it is the last point this flow controls before handing the camper to `ยืนยันการจอง` (CAM-702).
Scope: ONE new GET fetch facade (`campSiteAvailabilityAPI.getRemainingCapacity`, `lib/api-client.ts`) · a new pure async orchestrator `resolveSummaryCheck` + a `withChecking` view helper in `booking-turn.ts`/`booking-view.ts` · the `guests`→`summary` (whole-camp) and `spot`→`summary` (per-pitch) transitions in `booking-turn.ts` now render an interim checking block instead of building `summary` directly · `use-ai-chat.ts`'s `settleBookingTurn` runs the live check the moment the flow reaches `summary` · step-transition focus management (new, previously unbuilt) added entirely inside `AiChatBookingStep.tsx`.
Depends on: CAM-639 (the E1/checkFailed shapes this story wires) · CAM-640 (the flow this story extends, sequenced strictly after CAM-702 since both touch `use-ai-chat.ts`/`booking-turn.ts`) · CAM-702 (merged first, per the routing note) · `GET /api/campsites/[id]/remaining-capacity` (CAM-267 PREP-1, unchanged, reused verbatim).

## AC
| # | Given | When | Then (user sees, Thai verbatim) | System effect | Neg/edge |
|---|---|---|---|---|---|
| AC-1 | A whole-camp flow's `guests` step just completed (or a per-pitch flow's `spot` selection just committed) | The flow would derive to `summary` | The block briefly shows checking (chips disabled, `กำลังตรวจสอบที่ว่าง…`), then the real summary renders | ONE `GET /api/campsites/{id}/remaining-capacity` fires for the chosen span; no `Booking` write | AC-2 |
| AC-2 | The live check returns `remaining:0` or `blockedByHost:true` | The check resolves | `ขอโทษที {date} เพิ่งเต็มไปเมื่อกี้ ลองวันอื่นดูไหม`, a fresh `date` step (the full day excluded from the re-offered chips) | No summary block renders for the gone date; `checkIn`/`checkOut`/`spotId`/`spotName` cleared, `nights`/`guests` kept | AC-1 |
| AC-3 | The live check returns `remaining: null` (no per-day cap set on the camp) | The check resolves | The real summary renders normally, exactly as a real `remaining > 0` would | `null` is never read as full — the summary's total/CTA compute exactly as today | AC-2 |
| AC-4 | The live check request itself fails (network drop, non-2xx, or an off-contract body) | The fetch settles | `ตรวจสอบที่ว่างไม่สำเร็จ ลองอีกทีได้เลย` + `ลองใหม่` | No summary renders; the flow's slots are untouched — `ลองใหม่` re-runs the identical check | AC-1 |
| AC-5 | Any booking-step transition that replaces the interactive row (a chip tap, `ย้อนกลับ`/`แก้…`, the checking→summary/E1 resolution, submit→booked/failed) | The new block mounts | Focus lands on the new block's own caption/heading/button/banner — never lost to the page body | The newest booking entry's designated target element receives DOM focus exactly once, on mount | AC-6 |
| AC-6 | The SAME transition is instead caused by a typed answer in the composer | The new block mounts | The composer keeps the caret; nothing is focus-moved | `focusCaption:false` on that entry suppresses the mount-time focus | AC-5 |
| AC-7 | A booking write is in progress at any point in this story's flow | The camper types in the composer | The composer accepts the input and sends it as an ordinary question | The composer is never disabled by the live re-check | EC-3 |

## Rules
- BR-1 The live check fires exactly once per `guests`→`summary` (whole-camp) or `spot`→`summary` (per-pitch, after a free-pitch commit) transition — never on every render, never polled.
- BR-2 `remaining === null` is NEVER treated as full (BR-3 style "never fabricate a number", carried from CAM-639/CAM-640) — pinned by a dedicated test (`cam-647-summary-check.test.ts`).
- BR-3 `outcome.blockedByHost || outcome.remaining === 0` is the ONLY full/E1 trigger — matches `isDateFull`'s existing semantics (`booking-view.ts`) so this check agrees with every sibling reader of the SAME two fields.
- BR-4 The E1 rewind reuses `resolveBookingSubmitConflict` (CAM-702) verbatim rather than a second implementation — clear `checkIn`/`checkOut`/`spotId`/`spotName`, keep `nights`/`guests`, mark the failed date `remaining:0` in a session-local copy of `weekendAvailability` so the re-offered chips exclude it.
- BR-5 `booking-turn.ts` gains pure apply/rewind helpers only — `resolveSummaryCheck` is the one function in this story that is `async`/reaches the network, and only through an INJECTED `checkCapacity` parameter (the same dependency-injection pattern `resolveSpotStep`/`resolveSpotSelection`/`submitBookingWrite` already establish). No `setSending` anywhere in this file — pinned by source-inspection.
- BR-6 Step-transition focus is driven by ONE shared ref + one mount-only `useEffect` inside `AiChatBookingStep.tsx` — every distinct booking entry mounts its own component instance exactly once (a superseded entry re-renders in place via the SAME `entry.id`, never remounts), so "runs on mount" already means "this block just became the newest one"; no `isCurrent` branch is needed to gate it.
- BR-7 `focusCaption` (new, optional field on `BookingQuestionView`) defaults to focus-on-mount when absent; it is explicitly set `false` only when the triggering input was `{kind:'text'}` (`applyFocusTag` in `booking-turn.ts`) — every chip/back/edit/cancel/automatic-resolution transition keeps the default.
- BR-8 `resolveSpotStep`'s pre-existing fail-toward-handoff branch (the `/spots` fetch itself failing, ADR-018 §4) is UNCHANGED — it never offers a live confirm CTA (`authed` is never passed there), so there is nothing for this story's live check to protect on that path.

## Edge cases
- EC-1 IF the camp has no per-day cap (`remaining === null`) AND `blockedByHost` is also `false` THEN the flow proceeds exactly as a real `remaining > 0` would (BR-2).
- EC-2 IF the camper cancels (`ยกเลิกการจอง`) or starts a different flow while the live check is still in flight THEN the orphaned result is discarded on return (`bookingRef.current` re-checked after the `await`, the same `code.md` CAM-359 guard `settleBookingTurn`'s spot-fetch branch already uses) — never resurrects a stale/cancelled flow.
- EC-3 IF a booking write (CAM-702) is simultaneously possible on this same session THEN this story never interacts with `bookingSubmitInFlightRef` — the two async surfaces (pre-summary check, post-confirm write) are sequential in the flow, never concurrent on the same session.
- EC-4 IF `checkFailed`'s `ลองใหม่` is tapped THEN it re-runs the identical `resolveSummaryCheck` call against the SAME entries/session (no re-derivation, no lost slots).

## Data
No schema/DB change. Reuses `GET /api/campsites/[id]/remaining-capacity` (CAM-267 PREP-1) verbatim — the same route the camp page's own booking widget (`CampgroundDetailClient.tsx`) already calls, unmodified by this story.

## Seams & refs
- Reuse: `GET /api/campsites/[id]/remaining-capacity` (route unchanged) · `resolveBookingSubmitConflict` (CAM-702, reused for E1's rewind) · `appendBookingEntry`'s supersede-on-append mechanism (`conversation.ts`) · the CAM-700/CAM-702 dependency-injection pattern (network call as an injected function parameter, unit-testable with a fake fetcher).
- Refs: ADR-016 decision point 5 · design brief CAM-637 §2 ("completing this step is the one asynchronous moment in the flow"), §4 (the checking/disabled/status-line loading treatment), §5 (E1/E2/E3 shapes), §7 (the focus table, the load-bearing rule this story finally wires) · design brief CAM-697 §10 (the extended round-2 focus table — submitting/booked/bookingFailed/checkFailed targets).
- `AiChatBookingStep.tsx`'s render structure (CAM-701) is UNCHANGED — this story only adds a shared ref + one mount effect and a `ref` prop on `StepCaption`; no JSX branch was restructured.
- `use-ai-chat.ts`'s `handleSpotSelection` now routes its "Free" success path through `settleBookingTurn` (previously a bare `bookingRef.current =`/`setEntries` pair) — removes duplicated apply logic and gets the new summary-check integrated for free.

## Out of scope
- The actual booking write (`POST /api/bookings`, the 409-at-confirm handling, the `submitting`/`booked`/`bookingFailed` states themselves) — CAM-702, already shipped and unmodified here. This story only protects the summary that PRECEDES that write.
- The guest login gate / `LoginModal` — CAM-703.
- A server-side idempotency key — CAM-706.
- Rebuilding `resolveSpotStep`'s own fail-toward-handoff branch to also live-check — BR-8; that branch already never offers a confirm CTA, so there is nothing to protect.
- Composer-focus on `ยกเลิกการจอง`/the flow's exit notices — those render as a plain `answer` entry (`AiChatMessageList.tsx`), outside this story's file surface (not touched).

## Self-verify
- Pure logic (no jsdom): `__tests__/cam-647-summary-check.test.ts` — enough capacity and `remaining===null` both reach the real summary (the load-bearing null-never-full rule, pinned); `remaining===0` and `blockedByHost:true` both rewind to `date` via the reused `resolveBookingSubmitConflict` shape, excluding the summary block entirely; a failed fetch returns `retryNeeded` with entries/booking byte-identical to the input (nothing mutated); `authed` threads into the resulting summary's confirm CTA; source-inspection confirms zero `setSending(` in `booking-turn.ts`.
- Wiring guards (source-inspection, this repo's established no-jsdom precedent — cam-640/cam-700/cam-702's own files): `__tests__/cam-647-use-ai-chat-wiring.test.ts` — `settleBookingTurn` runs `runSummaryCheck` on `step.id === "summary"`; neither `settleBookingTurn` nor `runSummaryCheck` ever call `setSending`; `handleSpotSelection`'s Free path routes through `settleBookingTurn` (no duplicated logic); the remaining-capacity fetch goes through `lib/api-client.ts`, never a raw `fetch(`; the wiring layer forwards `remaining` unchanged (no `??` coercion that would fabricate a value).
- Focus render coverage (jsdom + @testing-library/react, same pattern as `cam-701-ai-chat-booking-step-confirm.test.ts`): `__tests__/cam-647-focus.test.ts` — every view kind's designated target (`question`/`summary` caption, `submitting`/`checkFailed` button, `booked` heading, `bookingFailed` banner) is `document.activeElement` on mount; a `focusCaption:false` question view is explicitly proven to NOT steal focus; the `isChecking` interim state respects the same rule as any other question view.
- Superseded pinned tests (dated, same-PR): `cam-640-booking-turn.test.ts` (1), `cam-699-nights-step.test.ts` (3), `cam-700-spot-turn.test.ts` (2), `cam-702-use-ai-chat-confirm.test.ts` (1, a coincidental regex collision with the new `resolveSummaryCheck` call, rescoped to stay precise) — every one reaches the SAME final assertions as before, via `resolveSummaryCheck`/the interim checking state instead of a synchronous `summary` build.
- `remaining-capacity` facade: `lib/api-client.ts`'s `campSiteAvailabilityAPI.getRemainingCapacity` reuses the shared `fetchAPI<T>` helper (no new fetch pattern) against the UNCHANGED, already-shipped route — no new endpoint, no new zod schema, no new authz surface.
- Gate = `/quality-gate` · full suite green (12340 passed, 25 skipped — the pre-existing `__tests__/delivery-client.test.ts` env-dependent skip among them) + lint 0 errors (pre-existing warnings only, none in touched files) + typecheck clean + `npm run build` green + `check:ds`/`check:palette` green (0 violations — no new token/component) + `npm audit --omit=dev` 0 vulnerabilities.
- **Not performed in this worktree:** live AC verification against a running dev server (no `.env`/`DATABASE_URL` configured in this isolated worktree) and the `e2e/regression/cam-640-chat-booking-round-trip.spec.ts` Playwright run (requires `e2e:db:setup` + a local Postgres + `PW_REGRESSION=1`, out of this dispatch's environment). Reasoned-not-fabricated: that spec's `GET /api/campsites/[id]/remaining-capacity` call is real and unmocked, hits a 90+-day-future, uncontested seeded date, and both `remaining>0`/`remaining===null` outcomes proceed to the real summary well inside its existing 10s timeout — but this has not been run and is flagged for the orchestrator/QA to confirm on the real dev DB before G3/G4.

## Changelog
- v1 (2026-08-06) — created.
