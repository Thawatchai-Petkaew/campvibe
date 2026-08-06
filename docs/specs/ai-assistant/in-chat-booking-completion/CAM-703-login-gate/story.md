---
artifact: story
feature: ai-assistant
epic: in-chat-booking-completion (CAM-695)
story: login-gate (CAM-703)
status: In Progress
version: v1
updated: 2026-08-06
---

## Story
As a **Camper** browsing the chat as a guest who has reached the booking summary for a whole-camp listing, I want to sign in without leaving the chat and then confirm myself, so that I never lose my collected dates/nights/guests just because I wasn't logged in yet.
Why: CAM-702 wired the real write for an authed member but left the guest tap on `loginToConfirm` a safe no-op (design brief §5, out of scope there). This story is the login gate ADR-018 D2 names: the guest never auto-books, always taps confirm themselves after signing in.
Scope: `buildSummaryView`'s cta branch (guest whole-camp now gets `kind:'confirm'`, never `handoff`) — `booking-view.ts`; the confirm control's LIVE label/`data-auth` (never the build-time-baked value) — `AiChatBookingStep.tsx`; `onBookingConfirm`'s guest branch (serialize + signal `onNeedsLogin`) + the Google-redirect resume (`writeBookingResume`/`readAndClearBookingResume`/`clearBookingResume`, restored after conversation history settles) — `use-ai-chat.ts`; `LoginModal` mounted + the manual body-inert lock suspended while it is open — `AiChatPanel.tsx`; `liveAuthed` threaded through — `AiChatMessageList.tsx` (mechanical pass-through, see the file-surface note below); one safety fix in `resolveSpotStep` (`booking-turn.ts`) — see BR-8.
Depends on: ADR-018 (LAW) · CAM-697 (design brief v2, §5 "The login gate") · CAM-701 (the confirm button this story only re-labels) · CAM-702 (the write path + the F3 sessionExpired branch this story wires a real modal onto) · CAM-396 (the live-session-gate lesson this story applies to a NEW surface)

## File-surface note (disclosed, not silent)
The dispatch named `AiChatPanel.tsx` · `use-ai-chat.ts` · `booking-view.ts` (cta branch) · `AiChatBookingStep.tsx` (label wiring) · `locales/translations.json` (already had every key) · tests. Two additions, both disclosed:
1. **`AiChatMessageList.tsx`** — `liveAuthed` has to cross this file on its way from `AiChatPanel.tsx` (which reads the live session) to `AiChatBookingStep.tsx` (which renders the label). One prop added to `AiChatMessageListProps`/`AiChatEntryRowProps`, passed straight through — the exact same shape CAM-702's own file-surface note already used for `onBookingConfirm`/`onBookingCheckAndRetry`.
2. **`booking-turn.ts`** (`resolveSpotStep`'s data-failure downgrade, one call site) — see BR-8: making `buildSummaryView` offer `confirm` for every `!useSpotView` camp would otherwise ALSO offer it for a per-pitch camp whose `/spots` fetch failed and was downgraded to `useSpotView:false` for routing only — reintroducing the exact "chat writes a pitch-less booking the camp page forbids" bug ADR-018 §4 / CAM-700 closed. `forceHandoff` (new, optional, defaults `false`) is the one-line fix; every other caller is unaffected.

## AC
| # | Given | When | Then (user sees, Thai verbatim) | System effect | Neg/edge |
|---|---|---|---|---|---|
| AC-1 | A GUEST reaches `summary` on a whole-camp listing | The block renders | The primary button reads `เข้าสู่ระบบเพื่อยืนยันการจอง` | `buildSummaryView` returns `kind:'confirm', authState:'guest'` (never `handoff`) | AC-5 |
| AC-2 | Same guest, summary on screen | Taps the button | `LoginModal` opens over the panel, subtitle `เข้าสู่ระบบก่อน จะได้จองให้เสร็จในแชทนี้เลย` | No network call; `bookingRef`/collected slots untouched; the resume payload is serialized to `sessionStorage` | — |
| AC-3 | The modal is open, camper signs in with email/password | Sign-in succeeds | The modal closes; the SAME button now reads `ยืนยันการจอง` | Session updates in place (`update()` + `router.refresh()`, no navigation); the collected slots are unchanged; nothing is submitted automatically | AC-4 |
| AC-4 | The button now reads `ยืนยันการจอง` (post-login) | The camper taps it themselves | `กำลังยืนยันการจอง…` then `จองสำเร็จแล้ว` (CAM-702's own flow, unchanged) | `POST /api/bookings` fires — the camper's OWN tap, never an automatic one (ADR-018 D2) | — |
| AC-5 | Same guest, summary on screen, chooses Google instead | Taps the button, then `เข้าสู่ระบบด้วย Google` inside the modal | The browser navigates to Google, then back | `{camp, slots}` was serialized to `sessionStorage` (`ai-chat-booking-resume`) before the redirect fired | AC-6 |
| AC-6 | The camper is back on the site, now authenticated, opens the chat panel again | The panel mounts | A fresh summary block appears (re-checked against live availability, CAM-647), confirm labelled `ยืนยันการจอง` | `bookingRef` restored from the serialized payload; the resume key is deleted (single-use); a stale (>15 min) or already-used key restores nothing | AC-7 |
| AC-7 | A camper's session expires between tapping confirm and the server processing it | The `401` outcome lands (CAM-702's F3) | `คุณออกจากระบบไปแล้ว เข้าสู่ระบบอีกครั้งแล้วกดยืนยันได้เลย`, tapping the reverted button | `LoginModal` opens with subtitle `คุณออกจากระบบไปแล้ว เข้าสู่ระบบอีกครั้งแล้วกดยืนยันได้เลย`; `bookingRef` stays intact at `summary` (never nulled) | — |
| AC-8 | The panel is `expanded` (full-screen) AND `LoginModal` is open | The camper interacts with the modal | The modal is fully interactive (fields typeable, buttons tappable) | The manual body-inert lock is suspended while `loginModalOpen`; LoginModal's own `modal:true` focus-trap/hideOthers owns the page instead | — |
| AC-9 | A camper types a question while a write is `submitting`, or while the guest login gate is showing | Message sent | The assistant answers normally | The composer is never disabled by any part of this story (no `setSending` anywhere in the new code) | — |

## Rules
- BR-1 The confirm control's DISPLAYED label/`data-auth` is computed from the LIVE `liveAuthed` prop (sourced from `useSession()` inside `use-ai-chat.ts`, threaded through `AiChatPanel.tsx` → `AiChatMessageList.tsx` → `AiChatBookingStep.tsx`) — **never** from `view.cta.label`/`authState`, which is a build-time snapshot that can go stale the moment a login completes (CAM-396). `liveAuthed` defaults `false` so no pre-CAM-703 fixture breaks.
- BR-2 The tap handler is unchanged from CAM-701/702: `onConfirm` is the ONE prop, called regardless of guest/member. The guest-vs-submit decision lives entirely inside `use-ai-chat.ts`'s `onBookingConfirm` (reads the LIVE `authed`, not the stale cta), never as two different handlers wired at the render layer.
- BR-3 Nothing auto-submits after a login or a re-login (ADR-018 D2). The camper's own tap is the only path to `startBookingSubmit`.
- BR-4 The resume key (`ai-chat-booking-resume`) is single-use — deleted on every read attempt, valid or not — and TTL-bounded at 15 minutes. A real submit (the authed branch of `onBookingConfirm`/`onBookingCheckAndRetry`) and an explicit cancel (`onBookingCancel`) both clear it defensively, so a stale key from an earlier abandoned attempt can never resurrect an unrelated flow later.
- BR-5 The Google-redirect restore (`restoreBookingFromStorage`) only ever runs AFTER the existing CAM-423 conversation-history resume has fully settled (all three of its exit points), so a later `setEntries` from that history load can never stomp the freshly-restored booking summary.
- BR-6 The restore re-runs the LIVE pre-summary availability check (CAM-647's `runSummaryCheck`), never blindly re-appends the stale serialized summary — stale availability is acceptable (the write transaction is authoritative), a stale RENDER is not.
- BR-7 The manual body-inert lock (`AiChatPanel.tsx`, CAM-454) is suspended while `loginModalOpen` — `LoginModal`'s own Radix `modal:true` (default, unchanged) already owns hiding the rest of the page correctly; stacking the manual lock on top would inert `LoginModal` itself (it carries no `data-ai-chat-node` marker, rightly so).
- BR-8 `buildSummaryView`'s `forceHandoff` param (new, optional, default `false`) keeps `resolveSpotStep`'s data-failure downgrade path on `handoff` unconditionally — a genuinely per-pitch camp whose `/spots` fetch failed must never pick up the whole-camp confirm rule (ADR-018 §4: `spotId` is optional server-side, so a pitch-less write is otherwise possible).

## Edge cases
- EC-1 IF the guest taps confirm twice in a row before the modal opens THEN the SAME serialize-and-signal path runs each time (idempotent — `writeBookingResume` just overwrites); no double network call, since the guest branch never reaches `bookingAPI.create`.
- EC-2 IF `sessionStorage` throws (privacy mode / quota) on write or read THEN both `writeBookingResume` and `readAndClearBookingResume` fail silently (caught, no crash) — the camper simply re-answers after a Google redirect instead of resuming.
- EC-3 IF the stored resume payload is malformed JSON, missing a field, or older than 15 minutes THEN `readAndClearBookingResume` returns `null` (and still deletes the key) — no restore, no crash.
- EC-4 IF the camper cancels the flow (`ยกเลิกการจอง`) after tapping login-to-confirm but before logging in THEN `clearBookingResume` runs, so a later, unrelated authenticated session never resurrects the cancelled flow.
- EC-5 IF the panel is closed and reopened before authentication completes THEN `AiChatPanel` fully unmounts/remounts (`{open && <AiChatPanel/>}` in `AiChatLauncher.tsx`) and `bookingRef` is lost in memory — the resume key (if any) is what the NEXT open restores from, exactly the Google-redirect case.

## Data
No schema/DB change. `sessionStorage` only (browser-local, never sent to the server); the eventual write still goes through the unchanged `POST /api/bookings` (CAM-702).

## Seams & refs
- Reuse: `components/LoginModal.tsx` (unchanged — lazily imported exactly as `InfiniteScrollGrid.tsx:37-41` does for the guest wishlist prompt) · `runSummaryCheck`/`resolveSummaryCheck` (CAM-647, reused verbatim for the restore) · the existing `onBookingConfirm`/F3 `sessionExpired` wiring (CAM-702).
- Refs: ADR-018 D2 (the login gate) · design brief CAM-697 §5 "The login gate" · CAM-396 (live-session-gate lesson, `code.md`'s own rationalizations table) · CAM-454/455 (the manual body-inert lock this story extends).

## Out of scope
- Per-pitch camp confirm (still `handoff` unconditionally) → a later story.
- A server-side idempotency key (CAM-706, unrelated to this story's surface).
- E2E browser proof of the full guest→Google-redirect→resume round-trip (needs a real OAuth provider or a mocked one) → flagged for QA/staging verification; this story's own verify is unit/integration (27 new tests, `cam-703-login-gate.test.ts`) plus the full regression suite green.

## Self-verify
- Pure logic: `__tests__/cam-703-login-gate.test.ts` §1 — `buildSummaryView`'s whole-camp guest/member cta shapes + the `forceHandoff` override; §3 — `writeBookingResume`/`readAndClearBookingResume`/`clearBookingResume` real behavioral round-trip against jsdom's `sessionStorage` (write→read, single-use second-read-null, TTL expiry via `vi.useFakeTimers`, malformed-JSON never throws, empty-key null).
- Real jsdom render (no `useSession()` dependency in this component — `liveAuthed` is a plain prop): §2 — a STALE guest-baked `cta` renders `ยืนยันการจอง`/`data-auth=member` the instant `liveAuthed:true` (and the reverse), for both `summary` and the F3 `sessionExpired` `bookingFailed` shape; `onConfirm` fires identically regardless (proves the tap handler is never restructured, per BR-2).
- Source-inspection Prove-It (this repo's established no-jsdom-harness precedent for a `useSession()`-gated hook — cam-640/cam-702's own files): §4-§6 — the guest branch calls `writeBookingResume` before `onNeedsLogin`, never `bookingAPI.create`; the authed branch clears the resume key before `startBookingSubmit`; `onBookingCancel` also clears it; `LoginModal` is lazily imported + wired to `onNeedsLogin` with the reason-to-subtitle ternary; `isAuthenticated` is threaded to `AiChatMessageList` as `liveAuthed`; the inert-effect's guard includes `loginModalOpen`.
- Dated-supersede updates (old assertions this story legitimately changes, not weakens): `cam-701-ai-chat-booking-step-confirm.test.ts` (label now comes from `liveAuthed`), `cam-702-use-ai-chat-confirm.test.ts` (the `!authed` guard's new shape + `LoginModal` now present), `cam-425/429/431/436-*.test.ts` (the `useAiChat()` call now takes an options object), `cam-454/455-*.test.ts` (the inert-effect guard's extra `|| loginModalOpen` clause), `cam-640/699/700/702-booking-*.test.ts` (a whole-camp guest summary now gets `confirm`, not `handoff`; the `resolveSpotStep` downgrade fixture updated to pass `forceHandoff:true`, matching the real call site).
- Gate = `/quality-gate` · full suite: 483 test files passed | 5 skipped, 12367 tests passed | 25 skipped (the pre-existing `__tests__/delivery-client.test.ts` env-dependent skip among them) + lint 0 errors (360 pre-existing warnings only, none in touched files) + typecheck clean + `npm run build` green + `check:ds`/`check:palette` 0 violations + `npm audit --omit=dev` 0 vulnerabilities.
- **Browser-only, owner/QA-verify on Staging** (per `qa.md`'s own rule — interactive multi-step transitions across a real OAuth redirect are not curl/headless-verifiable): AC-2/3 (credentials login → label flip → camper's own second tap, no auto-submit) · AC-5/6 (the real Google-redirect round-trip) · AC-7 (a genuine mid-flight 401) · AC-8 (LoginModal tap-through while the panel is expanded). This worktree had no local `.env`/dev DB wired to verify these live; unit/integration coverage above is the proof shipped in this PR.

## Changelog
- v1 (2026-08-06) — created.
