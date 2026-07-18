# Retro — CAM-396 Guest booking dead-end (the first instrumented workflow test run)

- **Trigger:** owner request (workflow-test debrief) + G4 findings on staging (a regression of this story's own fix — replayed below, not paraphrased).
- **Story / outcome:** Guest press จอง now opens the LoginModal instead of a raw 401 toast; localized failure copy. Done 2026-07-18, PR #447 → dev, promoted #448 → staging. First story to run the full Build→QA→Security→DevOps rotation under the new envelope/JSON conventions (roleHistory: frontend-engineer → qa-engineer → security-reviewer → devops-release; the Verify-coverage guard passed live for the first time).
- **Evidence read:** PR #447 diff + 2 commits · `ticket-sync show CAM-396` (events + the metrics comment) · story.md/test.md artifacts · live staging probes (unauthenticated POST → 401) · `components/LoginModal.tsx:52-67` + `app/campgrounds/[slug]/page.tsx:111`.

## The replayed failure (anti-rubber-stamp — the real sequence, from the real code)

The G4-found regression: the fix gates on the **server-rendered prop** `isLoggedIn={!!session?.user}` (page.tsx:111). After a modal login, `LoginModal.handleSubmit` runs `signIn → update() → close → router.refresh()` — but `router.refresh()` is fire-and-forget, so the mounted component's prop is STILL `false` when the user presses จอง again → the gate re-opens the modal ("first press fails"); only after the RSC payload lands does the prop flip and the next press book ("second press works"). The owner also perceived "booked without login" — that was this same sequence's tail (the modal login felt like a no-op, then a later press booked with the now-valid session); a live probe confirmed unauthenticated POST → 401 always, so no auth bypass. The wishlist gate carries the identical staleness (`lib/wishlist-toggle.ts:102`). The repo's own CAM-241/242 lessons in `code.md` warned about exactly this class — the builder, QA, and security all read the static states and none tested the login→retry TRANSITION.

## What we learned

| # | Role(s) | Type | Mistake → better rule | Generality | Destination |
|---|---|---|---|---|---|
| 1 | frontend, backend | process | Gated a client action on a server-rendered `isLoggedIn` prop → stale after modal login (router.refresh race) → first press fails. → An auth/permission GATE in a client component reads the LIVE client session (`useSession()` status), never a server-snapshot prop. | reusable | `.claude/rules/code.md` (strengthen the CAM-241/242 row) |
| 2 | qa, product-owner | process | Verified both STATIC states of a state-dependent gate (guest→modal, logged-in→POST) but never the TRANSITION (login-then-first-retry) — where it actually broke. → A state-dependent gate needs its transition path tested; browser-only transitions become explicit owner-verify AC rows at spec time. | reusable | `.claude/rules/qa.md` (new row) |
| 3 | all roles, orchestrator | process | New JSON return discipline only partially followed on its first run (frontend prose · qa prose+JSON · security near-shape). → The orchestrator bounces a non-conforming return ONCE (re-ask for the single JSON object) before accepting; compliance is checked at acceptance, not assumed. | process-gap | `.claude/rules/efficiency.md` §3 (one line) |

One-off (memory, not rules): first full-rotation metrics — build 189,116 / qa 153,557 / security 54,860 = 397,533 subagent tokens, ~17 min to Done; baseline 129k-166k with solo-Fable build (unmeasured main loop); security's tight-scope read-only dispatch was the efficiency star.

## Gate feedback (highest-value source)

- **G4 (staging, owner in chat):** 4 findings — (1) "booked without login" → misperception of the stale-gate sequence (probe: 401 holds, no bypass); (2) first-press-after-login fails → the real regression (lesson 1) → **CAM-397**; (3) booking detail unreachable from the list (pre-existing since first commit — no link, `/campgrounds/undefined`) → **CAM-398**; (4) list image bottom gap (pre-existing regression from CAM-194 dropping `md:h-auto`) → **CAM-398**. No formal reject verb (story already Done); per the terminal-gate rule the findings landed as new tickets.

## Routed this run

- **Promoted to rules:** pending owner approval — 3 diffs proposed (code.md strengthen · qa.md new row · efficiency.md acceptance line).
- **To orchestrator memory:** the metrics baseline + the "security tight-scope dispatch" pattern.
- **Ledger:** 3 rows appended to `docs/specs/LESSONS.md` (`proposed`).

## Action items

| # | Action | Owner | Tracker entry |
|---|---|---|---|
| 1 | Live-session gate (reserve + wishlist) | frontend-engineer | CAM-397 |
| 2 | Bookings list → detail link + image frame | frontend-engineer | CAM-398 |
| 3 | Per-spot 0-capacity calendar/write-gate divergence (latent) | backend-engineer | CAM-399 (backlog) |

## Self-verify

- [x] Lessons mined from durable sources (PR #447, ticket events, artifacts, live probes)
- [x] Each lesson has role · type · mistake→rule · CAM provenance · generality
- [x] Deduped: lesson 1 STRENGTHENS the existing CAM-241/242 row (no twin)
- [x] Rule promotions raised to the owner as diffs; ledger rows `proposed`
- [x] Every action item is a tracker entry (CAM-397/398/399)
