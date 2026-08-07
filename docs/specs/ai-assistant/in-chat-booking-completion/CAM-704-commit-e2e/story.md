---
artifact: story
feature: ai-assistant
epic: in-chat-booking-completion (CAM-695)
story: commit-e2e (CAM-704)
status: In Progress
version: v2
updated: 2026-08-07
---

## Story
As a **Camper** who taps ยืนยันการจอง in the chat, I want a real browser test to prove my tap actually creates a Booking row I can find again, so that CAM-702/CAM-703's write path ships with real, red-then-green evidence instead of a mocked-POST claim.
Why: `cam-640-chat-booking-round-trip.spec.ts` deliberately stops at the confirm button (CAM-702's own file header) — a boundary-mocked flow test can prove the CLIENT reaches the button, never that the SERVER actually wrote and can be read back. This story is the round's own KPI (epic.md: "the Booking row's recorded total equals the total shown on the success card exactly ... CAM-704's e2e proves it in a real browser against the CI seeded DB").
Scope: one new Playwright spec, `e2e/regression/cam-704-chat-booking-commit.spec.ts` — no production code. QA does not fix/redesign; a repo-reality-vs-spec gap found while building this spec is reported below (per-spot case), not improvised around. v2 (2026-08-07) added one Vitest integration test, `__tests__/cam-704-guest-gate-integration.test.ts`, when the browser e2e's own modal-open assertion was root-caused to a harness limitation (see `## Self-verify`) — still no production code changed by this story.
Depends on: CAM-700 (spot step) · CAM-702 (the real write path this proves) · CAM-703 (the guest login gate this proves)

## AC
| # | Given | When | Then (user sees, Thai verbatim) | System effect | Neg/edge |
|---|---|---|---|---|---|
| AC-1 | An authed camper reaches the whole-camp summary and taps `ยืนยันการจอง` | The real `POST /api/bookings` write completes | `จองสำเร็จแล้ว` + the success card's `ยอดรวม`, and `ดูรายละเอียดการจอง` links to `/bookings/{id}/confirmation` | A real `Booking` row exists (`GET /api/bookings` finds it): `campSiteId`/`checkInDate`/`checkOutDate`/`guests`/`source:'CHAT'` match the chosen flow, and its `totalPrice` equals the success card's shown total exactly | EC-1 |
| AC-2 | A guest reaches the whole-camp summary and taps `เข้าสู่ระบบเพื่อยืนยันการจอง` | The tap fires | `LoginModal` opens with subtitle `เข้าสู่ระบบก่อน จะได้จองให้เสร็จในแชทนี้เลย` | No network write; `GET /api/bookings` finds no row for this camp/date pair | EC-2 (split proof — see `## Self-verify` v2 note) |
| AC-3 | A per-pitch camp's summary is reached in-chat after picking a pitch | The camper taps confirm | — (unreachable — see `## Out of scope`) | — | — |

## Rules
- BR-1 (proves AC-1) The success card's total is asserted against the SAME row `GET /api/bookings` reads back — never a re-read of the same POST response alone (CAM-672's own "shown === recorded, cross-checked against the DB, not just re-read" lesson).
- BR-2 (proves AC-1) `source:'CHAT'` is asserted directly off the raw `GET /api/bookings` row (ADR-018 D1's attribution constant; the route's `findMany` carries no `select`, so the field is genuinely observable, not assumed).
- BR-3 (proves AC-2) The guest case never mocks `/api/bookings` — the assertion that no row exists is a real `GET`, not an inference from "the modal opened."

## Edge cases
- EC-1 IF the confirm tap fires while `/api/bookings` is real (unmocked) THEN the success card must show the SERVER's recorded total, not the client's pre-write estimate (client hardcodes `vatRate:0`; the server prices with the seeded Thailand `vatRate:0.07` — the two numbers legitimately differ, which is why this spec cross-checks success-card-total === DB-row-total, never summary-estimate === DB-row-total).
- EC-2 IF a guest taps confirm THEN the tap must be provably inert on the server (a `GET /api/bookings` scoped to the exact camp+date finds nothing) — not just "the modal looks open."

## Data
No schema/DB change. Reads/writes the already-shipped `Booking` row via `POST`/`GET /api/bookings` (CAM-702, unchanged).

## Seams & refs
- Reuse: `e2e/regression/helpers.ts`'s `findCampBySlug` · `e2e/regression/global.setup.ts`'s authed `storageState` (`hoster@campvibe.com`) · `e2e/regression/cam-664-seed.ts`'s `seedCam664Camp` fixture (referenced, not driven — see Out of scope) · the guest-context idiom from `cam-664-spot-viewer.spec.ts` (`browser.newContext({storageState:{cookies:[],origins:[]}})` + the `campvibe_lang` cookie).
- Refs: ADR-018 (D1 write contract, D2 the login gate) · CAM-702/story.md · CAM-703/story.md.
- v2: `__tests__/cam-704-guest-gate-integration.test.ts` — the modal-open proof's new home (real `AiChatPanel` + real `LoginModal` render, jsdom + RTL, mocking only `useSession` and `next/navigation`).

## Out of scope
- **Per-pitch camp real-POST confirm (AC-3).** Investigated, not built: `cam-664-e2e-verify-th` (seeded by `global.setup.ts`, `useSpotView` flipped `true`) is a genuine, live per-pitch fixture — the FIXTURE is not the gap. `buildSummaryView` (`components/ai-chat/booking-view.ts`) unconditionally returns `cta:{kind:'handoff'}` whenever `camp.useSpotView` is `true`, so `btn--ai-chat-booking-confirm` never renders on that path — the FEATURE does not exist yet. Both CAM-702/story.md and CAM-703/story.md already list "Per-pitch camp confirm (still `handoff` unconditionally) → a later story" under their own `## Out of scope`. This story records a `test.skip` naming the exact file/line reasoning rather than asserting a different, unrequested behavior (the handoff button) in its place → the not-yet-created "a later story" from CAM-702/703.
- Real Google-OAuth round-trip for the guest gate (needs a real provider or a mock) → CAM-703's own story.md already flags this for owner/QA staging verification; this story proves the reachable half (the modal opens with the right copy), per the dispatch's own instruction not to drive real OAuth in e2e.

## Self-verify
- AC-1 → e2e (`e2e/regression/cam-704-chat-booking-commit.spec.ts`, describe block 1) — real `POST`, real `GET` readback, cross-checked total.
- AC-2 → **split proof, v2 (2026-08-07), root-caused across two diagnostic CI rounds, both read via `gh run view --log`, never guessed:**
  - **Live in the browser e2e** (describe block 3, first test): the button's full CAM-703 AC-1 state (visible/enabled/`data-auth="guest"`/label verbatim) + the tap serializing the flow (`sessionStorage["ai-chat-booking-resume"]` written — the same real signal that proves `onBookingConfirm`'s guest branch ran to completion) + the system result (`GET /api/bookings` finds no row for this camp/date pair).
  - **The modal-open half moved to `__tests__/cam-704-guest-gate-integration.test.ts`** (a real React render, not source-inspection — mocks only `useSession=guest` + `next/navigation` for the App Router context a real browser always provides): drives the identical card→detail→start→date→nights→guests→summary→confirm-tap flow and asserts a real second `role="dialog"` opens with the `loginPrompt` subtitle verbatim + a real Google button from `LoginModal` itself. This is the standing proof the guest gate genuinely opens the modal.
  - **Root cause of the browser e2e's own modal-visible assertion being unreliable:** `LoginModal` is a `next/dynamic(() => import(...))` component; under Playwright driving the `regression` project's `next dev` server (on-demand Turbopack chunk compilation, not a production build — `playwright.config.ts:131`), that lazy chunk does not reliably settle inside the wait window. Two red herrings were raised and ruled out with real evidence: three console 429s at the tap turned out to be `/api/vitals` web-vitals telemetry (`navigator.sendBeacon`, fire-and-forget, never surfaces a status to app code — cannot break anything downstream), unrelated background noise from the CI job's cumulative regression-suite traffic sharing one rate-limit bucket; zero `pageerror`s were ever captured, ruling out a client-side crash. This is a **harness artifact, not a product defect** — the browser click-through itself is re-verified by a human at **G4 on the real Staging URL** (browser-only ACs are always deferred to G4 owner verification, `qa.md`'s own rule); the e2e spec documents this in a `test.skip` reason string naming the exact cause, so the skip is never mistaken for a hidden failure.
- AC-3 → documented `test.skip` (describe block 2) naming the exact production-code reason (not a fixture gap).
- Gate = `/quality-gate`; this spec cannot run locally (Turbopack cross-fs symlink under the worktree setup) — CI's `e2e-regression` job is the real run. `npm run lint` / `npm run typecheck` scoped to the touched files: both clean.

## Changelog
- v1 (2026-08-07) — created.
- v2 (2026-08-07) — AC-2's modal-open assertion root-caused (LoginModal's `next/dynamic` chunk unreliable under Playwright + `next dev`) and split: the button-state + no-network-write proof stays live in the browser e2e; the modal-open proof moved to a new real-render component-integration test (`__tests__/cam-704-guest-gate-integration.test.ts`); the browser-level modal-visible case is now a documented `test.skip` naming the root cause, deferring the click-through to G4 human verification on Staging.
