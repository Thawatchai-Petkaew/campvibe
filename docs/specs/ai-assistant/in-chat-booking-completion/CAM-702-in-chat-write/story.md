---
artifact: story
feature: ai-assistant
epic: in-chat-booking-completion (CAM-695)
story: in-chat-write (CAM-702)
status: In Progress
version: v1
updated: 2026-08-06
---

## Story
As a **Camper** who has reached the summary step of an in-chat booking, I want my tap on ยืนยันการจอง to actually create the booking, so that I never have to leave the chat to finish reserving a whole-camp stay.
Why: this is the load-bearing story of the round (ADR-018) — everything before it (CAM-698/699/700/701) built the pieces; this wires the summary's confirm button to the real `POST /api/bookings` write path and handles every outcome the ADR names (success, `409` rewind, `429`, `401`, and the network/`500` reconcile-before-retry).
Scope: `bookingAPI.create` in `lib/api-client.ts` (replaces the pre-CAM-702 shape, which had zero callers); five new pure/DI functions in `booking-turn.ts` (`startBookingSubmit`/`resolveBookingSubmitSuccess`/`resolveBookingSubmitConflict`/`resolveBookingSubmitFailure`/`findJustCreatedBooking`) plus the DI'd orchestrator `submitBookingWrite`; `buildSummaryView`'s new `authed` param (`booking-view.ts`); `onBookingConfirm`/`onBookingCheckAndRetry` in `use-ai-chat.ts`; the prop wiring through `AiChatMessageList.tsx` (and, mechanically, `AiChatPanel.tsx` — see the file-surface note below).
Depends on: ADR-018 (LAW, not reopened) · CAM-697 (design brief v2) · CAM-698/699/700 (real nights/price-unit/spot data) · CAM-701 (the presentation this story wires, merged)

## File-surface note (disclosed, not silent)
The dispatch named `lib/api-client.ts` · `booking-turn.ts` · `booking-view.ts` · `use-ai-chat.ts` · `AiChatMessageList.tsx` as the surface, and named `AiChatPanel.tsx` as CAM-703's (grouped with `LoginModal`). Reaching the confirm button's `onClick` structurally requires `useAiChat()`'s two new handlers to cross `AiChatPanel.tsx` on their way to `AiChatMessageList.tsx` — there is no other path, and `AiChatPanel.tsx` already destructures/passes every other `onBooking*` handler the identical way. The change made is two mechanical lines (destructure + prop pass-through, no new state, no login/modal logic) — anything less would ship a confirm button that renders correctly (CAM-701) but does nothing when tapped, which would fail this story's whole point. Flagged here for the record; `git diff -- components/ai-chat/AiChatPanel.tsx` is the exact, minimal delta.

## AC
| # | Given | When | Then (user sees, Thai verbatim) | System effect | Neg/edge |
|---|---|---|---|---|---|
| AC-1 | A whole-camp, authed camper reaches `summary` | Taps `ยืนยันการจอง` | The block becomes `submitting` (`กำลังยืนยันการจอง…`), then `จองสำเร็จแล้ว` with `ยอดรวม` = the server's recorded total | A `Booking` row is created (`status:PENDING`, `source:CHAT`); a `Notification` row is created for the camp's operator (CAM-681, free) | EC-1 |
| AC-2 | Same, but the write returns `409` (dates taken between summary and tap) | The outcome lands | `ขอโทษที {date} เพิ่งเต็มไปเมื่อกี้ ลองวันอื่นดูไหม`, a fresh `date` step | No `Booking` row created; `checkIn`/`checkOut`/`spotId` cleared, `nights`/`guests` kept; the failed date excluded from the re-offered chips | AC-1 |
| AC-3 | Same, but the write returns `429` (rate limit) | The outcome lands | `กดจองถี่เกินไป รอสักครู่แล้วกดยืนยันอีกที` above the intact summary, `ยืนยันการจอง` re-enabled | No `Booking` row created; the session is kept (tapping confirm again re-attempts) | AC-1 |
| AC-4 | Same, but the write returns `401` mid-flight (session expired) | The outcome lands | `คุณออกจากระบบไปแล้ว เข้าสู่ระบบอีกครั้งแล้วกดยืนยันได้เลย`, the CTA reverts to `เข้าสู่ระบบเพื่อยืนยันการจอง` | No crash, no `Booking` row; the session is kept for CAM-703's login gate to act on next | AC-1 |
| AC-5 | Same, but the write throws (network drop) or returns a non-specific error (`5xx`/unparseable body) | The outcome lands | If a matching `PENDING` row is found (reconcile): the SAME success card as AC-1. If none: `เรายังไม่แน่ใจว่าการจองบันทึกไปหรือยัง กดตรวจสอบก่อนได้เลย จะได้ไม่จองซ้ำ` + `ตรวจสอบแล้วลองใหม่` | `GET /api/bookings` is read BEFORE any re-POST; a genuine retry only fires when no match is found | AC-1 |
| AC-6 | The camper double-taps `ยืนยันการจอง` (or taps it twice within one event loop tick) | Either tap | Exactly one `submitting` → one outcome | At most ONE `POST /api/bookings` fires — never two | EC-2 |
| AC-7 | A write is in flight (`submitting`) | The camper types in the composer | The composer accepts the input and sends it as an ordinary question | The composer is never disabled by the booking write | EC-3 |
| AC-8 | A per-pitch camp OR a guest camper reaches `summary` | It renders | `ไปกรอกต่อที่หน้าจอง` (unchanged handoff) | No confirm control is offered at all — never a dead button, never a pitch-less write | — |

## Rules
- BR-1 `source: 'CHAT'` is a code constant inside `bookingAPI.create`'s own request-body literal — never read from a parameter, a prop, or a model/chat payload (ADR-018 D1/R2). `BookingCreateInput` carries no `source` field at all, so a caller cannot even attempt to pass one. Pinned by a source-inspection test.
- BR-2 `bookingAPI.create` parses BOTH the `apiError` JSON shape (`{error,details?}`, every 4xx/5xx except `429`) AND the raw `429` body (`{error:'rate_limited'}` + a `Retry-After` header) — never assumes one shape for both (ADR-018 D1's contract table).
- BR-3 The classification rule (ADR-018 D6) is followed exactly: `429`/`401`/`409` are provably-rejected-before-write outcomes with their own named handling; everything else (network throw, `5xx`, an off-contract 201 body) is `uncertain` and MUST reconcile before ever reporting failure — never a blind retry.
- BR-4 The reconcile match tuple is `{campSiteId, checkInDate, checkOutDate, guests, spotId}` with `status:'PENDING'` and a ≤2-minute age window (ADR-018 D6, not reopened) — `spotId` compares `null`-to-`null` for a whole-camp booking.
- BR-5 Three independent guards stop a double-POST (ADR-018 D2): (1) a synchronous `bookingSubmitInFlightRef` check before the first `await`; (2) `startBookingSubmit` supersedes the prior summary's `isCurrent` (via the existing `appendBookingEntry` mechanism), rendering its confirm control `disabled`; (3) the rendered `submitting` view's own confirm button carries no `onClick` (CAM-701).
- BR-6 `onBookingConfirm`/`onBookingCheckAndRetry` never call `setSending` — the composer stays live for the whole write, exactly as every other booking-turn handler already does (design brief §6, the cam-640 no-`setSending` pin survives unchanged in `booking-turn.ts`; the async work lives in the hook, not the pure reducer).
- BR-7 `buildSummaryView`'s new `authed` param is optional, defaults `false` — every pre-CAM-702 caller (and test) keeps producing byte-identical `handoff` output. Only `authed && !camp.useSpotView` ever produces `kind:'confirm'`.
- BR-8 On success, the rendered total is the SERVER-recorded amount (`data.snapshotTotalAmount`, or a reconciled row's own `totalPrice`) — never the client estimate `buildSummaryView` showed. Verified byte-for-byte against the dev DB row (see Self-verify).

## Edge cases
- EC-1 IF the write's outcome cannot be classified into one of `created`/`conflict`/`unauthorized`/`rateLimited`/`error`/`network` THEN there is no such state — the facade's return type is an exhaustive discriminated union.
- EC-2 IF the flow is cancelled (`ยกเลิกการจอง`) while a reconcile/retry is still in flight THEN the orphaned result is discarded on return (`bookingRef.current` is checked again after every `await`) — never resurrects a cancelled flow into a fresh write.
- EC-3 IF the composer is used mid-write THEN it behaves as an ordinary send — this story never reads or writes `sending`.
- EC-4 IF `bookingAPI.create` receives a 201 with an off-contract body (network I/O is an input boundary) THEN it resolves `{kind:'error'}`, never a crash, and the caller's `error`/`network` branch (reconcile-first) applies.

## Data
No schema/DB change. `Booking`/`Notification` writes go through the already-shipped `POST /api/bookings` transaction (ADR-006/ADR-005) and the already-shipped `notifyBookingCreated` post-commit hook (CAM-681) — both entirely unchanged by this story.

## Seams & refs
- Reuse: `POST /api/bookings` (`app/api/bookings/route.ts`, unchanged) · `GET /api/bookings` (reconcile source) · `appendBookingEntry` (`conversation.ts`, the existing supersede-on-append mechanism) · the CAM-700 dependency-injection pattern (`resolveSpotStep`/`resolveSpotSelection`) that `submitBookingWrite` follows for the same "network call as an injected param, unit-testable with a fake fetcher" reason.
- Refs: ADR-018 (D1 contract table, D2 guards, D3 the 409 rewind + `justFilled` reuse, D6 the reconcile heuristic) · CAM-697 design brief §5-§9 · CAM-701's `AiChatBookingStep.tsx` (owns the render, untouched here).
- `buildDateQuestionView` gained a fourth `reason:'justFilled'` (reuses the dormant `aiChat.booking.justFilled` copy round 1 shipped for exactly this) — `reason:'full'`'s `date.full` copy is untouched (a different trigger, §1's synchronous same-snapshot check).
- `buildSubmittingView`/`buildBookedView`/`buildBookingFailedView` (CAM-701) now set `isCurrent: true` — the field `AiChatMessageList` needs to gate `onConfirm`/`onCheckAndRetry` per entry, and the field `appendBookingEntry` already flips to `false` on supersession for every other view kind. `cam-701-booking-view.test.ts`'s three `toEqual` pins were updated (dated note) to include it.

## Out of scope
- The guest login gate / `LoginModal` wiring (design brief §5's `loginToConfirm` → modal flow) → CAM-703. This story's `onBookingConfirm` guards `!authed` as a safe no-op so the F3 `sessionExpired` CTA (which this story DOES render, with the `loginToConfirm` label) is never a dead crash — CAM-703 replaces that no-op with the real modal trigger.
- Per-pitch camp confirm (still `handoff` unconditionally, per task instruction) — a later story.
- A server-side idempotency key (removes R1, the reconcile heuristic's residual risk) → CAM-706, its own schema change and G2.
- The hidden/soft-deleted-camp visibility hole (`route.ts:131`) → CAM-705, independent per ADR-018 R5.
- E2E browser proof of the full click-through flow → CAM-704.

## Self-verify
- Pure logic (no jsdom): `__tests__/cam-702-booking-turn-submit.test.ts` — `buildSummaryView`'s `authed` cta flip, `startBookingSubmit`'s supersede guard, `resolveBookingSubmitSuccess`/`resolveBookingSubmitConflict`/`resolveBookingSubmitFailure`'s exact output shapes, `findJustCreatedBooking`'s window/PENDING/spotId matching, and `submitBookingWrite`'s full DI'd orchestration (created/conflict/401/429/network-reconcile-found/network-reconcile-not-found/generic-error-also-reconciles) — asserts `createBooking` is called exactly once even when a network failure reconciles to success (AC-5's "no second POST").
- `bookingAPI.create`: `__tests__/cam-702-booking-api-create.test.ts` — every ADR-018 D1 outcome (201/401/409/429-with-header/429-without-header/generic-4xx-5xx/thrown-exception), the `source:'CHAT'` hardcode pin (source-inspection: the literal is never derived from `input`), and `spotId` only sent when present.
- Wiring guards (source-inspection, this repo's established no-jsdom precedent for this hook — cam-640/cam-700's own files): `__tests__/cam-702-use-ai-chat-confirm.test.ts` — `onBookingConfirm`/`onBookingCheckAndRetry` never call `setSending`; the synchronous in-flight guard sits before the first `await`; the orchestration is imported from `booking-turn.ts` (no inline reimplementation); `!authed` guards before any network call; `authed` is threaded into all 4 `processBookingTurn(` call sites; `AiChatMessageList`/`AiChatPanel` actually wire the two new handlers through, gated on `isCurrent`.
- AC-1/AC-8 (whole-camp authed success + source hardcode + total equivalence + host notification) verified LIVE on localhost against the dev DB (own worktree dev server, port 3025; camper `camper@campvibe.com` signed in via NextAuth credentials; whole-camp `PER_PERSON` camp `แคมป์เกาะพะงันทะเลใส`, 2027-03-10→11, 2 guests):
  - `POST /api/bookings` → `201`, body `{id:"07e03a9c-bd72-4b35-921f-8e2c03dec03a", status:"PENDING", source:"CHAT", snapshotTotalAmount:1200, ...}`.
  - DB row read back: `source:'CHAT'`, `status:'PENDING'`, `snapshotTotalAmount:'1200'`, `totalPrice:'1200'` — byte-for-byte equal to the API response (CAM-672 lesson: read the DB, don't trust the response alone).
  - Operator `Notification` row created: `type:BOOKING`, `title:'มีการจองใหม่'`, `link:'/dashboard/bookings?highlight=07e03a9c-bd72-4b35-921f-8e2c03dec03a'` — CAM-681's post-commit hook fires for free, proven live, not mocked.
  - A follow-up unauthenticated POST to the same route returned `401` (sanity-checks `bookingAPI.create`'s `unauthorized` classification against the real server, not just a mock).
- Gate = `/quality-gate` · Done = merged into `dev` with the full suite green (12317 passed, 25 skipped — the pre-existing `__tests__/delivery-client.test.ts` env-dependent skip among them) + lint 0 errors (pre-existing warnings only, none in touched files) + typecheck clean + `npm run build` green + `check:ds`/`check:palette` green (0 violations — no new token/component) + `npm audit --omit=dev` 0 vulnerabilities + AC verified live on localhost (dev DB) as above.

## Changelog
- v1 (2026-08-06) — created.
