---
linear: CAM-608
feature: platform-hardening
epic: taxonomy-ui-foundation
persona: Host
artifact: design
owner: frontend-engineer
status: done
version: v1
updated: 2026-07-28
---
# Design — stop a slow response overwriting fresher availability data (CAM-608)

## Flow
No new flow/screen — this is a data-integrity hardening fix on the existing availability screen (CAM-55/CAM-56/CAM-343). No visible UI, copy, or interaction changes; the fix is entirely in how each of the three async loads decides whether its own response is still allowed to commit state.

## Why extract a shared hook (not a fourth inline copy)
CAM-359's mechanism already exists inline in `components/spot-management-section.tsx` (a `useRequestSequence`-shaped `useRef(0)` + `++requestIdRef.current` + `if (requestIdRef.current !== requestId) return;`). This ticket needed the identical mechanism on THREE more call sites in one PR. Copy-pasting it a second, third, and fourth time is exactly the shape `.claude/rules/api.md` names for CAM-341/360 ("a fix re-derived per surface is how that bug class shipped twice") — the risk isn't hypothetical here, it's the ticket's own explicit instruction not to repeat. `lib/hooks/use-request-sequence.ts` packages the same two lines of logic (`next()` / `isCurrent()`) behind one import, so all three (and `spot-management-section.tsx`'s future refactors, not touched in this PR) can share one definition instead of four independently-maintained copies. This is not a new mechanism — the extracted hook's body is line-for-line the same counter-and-compare CAM-359 already proved.

## Where the guard is placed
Mirrors CAM-359's own placement exactly (not a new convention): `next()` is called once, before the first `await`; `isCurrent(requestId)` is checked once, immediately after the network round-trip resolves, before any state commit; the `catch` block re-checks it before setting `loadError`; the `finally` block re-checks it before clearing `loading`. This placement (one check per branch, not one after every `await`) is the existing codebase convention — `spot-management-section.tsx`'s `loadData` does not re-check after its own subsequent `.json()` awaits either.

## Constructing the crossing (not just adding the guard)
Two independent proofs, both asserting a DELIBERATELY-ordered crossing (slow call issued first, fast call issued second, slow resolves last) rather than the guard's own source string:

1. **Unit** (`__tests__/cam-608-request-sequencing.test.ts`): renders the real `useRequestSequence` hook via `@testing-library/react`'s `renderHook` (jsdom), issues a held (manually-resolvable) "slow" call first, a resolved "fast" call second, asserts `fresh` wins, then resolves the held call with `stale` data and asserts `fresh` is STILL the committed value. A second test removes the guard entirely (a naive committer with no id check) and documents the identical race losing the fresher data — proving the scenario is a real race, not a tautology of the fixture.
2. **E2E** (`e2e/regression/cam-608-calendar-month-race.spec.ts`): against the real running app, `page.route` holds every request for the calendar's INITIAL month open, fulfills the request for the month the host navigates to immediately with a distinguishable `remainingGuests: 7` marker on a specific day, asserts that cell renders, THEN releases the held (stale) request with an empty payload, and re-asserts the marked cell is still showing — i.e. the late-arriving, earlier-issued response did not overwrite the state a later call already committed.

## Teeth proof (both levels, done manually, not left as a toggle — same practice as CAM-604's tech.md)
`lib/hooks/use-request-sequence.ts`'s `isCurrent` was temporarily replaced with `(requestId: number) => true` (guard disabled):
- Unit: `npx vitest run __tests__/cam-608-request-sequencing.test.ts` → the constructed-crossing test and 2 structural tests went RED (3/11 failing); the crossing test's failure showed the committed value as `["stale"]` instead of `["fresh"]`.
- E2E: `PW_REGRESSION=1 npx playwright test --project=regression e2e/regression/cam-608-calendar-month-race.spec.ts` → RED, real failure: `Expected substring: "เหลือ 7 ที่"` / `Received string: "1จองแล้ว 0 คน"` — the stale, empty response had genuinely overwritten the fresh month's data in the real running app.

Restoring the real `ref.current === requestId` comparison turned both back GREEN (11/11 unit; 2/2 e2e).

## Non-goals
Does not touch `lib/safe-fetch.ts` / `fetchJsonSafe` (CAM-555's fetch-ISOLATION fix — a sibling source's network failure not blanking data that loaded fine — a different concern from request SEQUENCING; already solved where it applies, nothing to extend here). Does not change what any of the three loads fetches, how it's rendered, or any copy/token. Does not touch `proxy.ts` or `app/dashboard/loading.tsx` (another agent's surface).

## A known, pre-existing, out-of-scope flake observed during this story's own verification
While running the local e2e regression suite (`PW_REGRESSION=1 npx playwright test --project=regression`) to confirm this change didn't break anything, `ac6-spot-lifecycle.spec.ts` intermittently failed with `getByTestId('btn--availability-add') resolved to 2 elements` — the CAM-604 AC-3 finding (a duplicate DOM subtree left behind under CPU pressure). Investigated whether this story caused it before accepting it as pre-existing:

1. Reproduced it against a clean checkout of this ticket's parent commit (this story's 3 files reverted via `git stash`) — intermittent there too, so not introduced by this diff.
2. This branch was then rebased onto `origin/dev`, which by then included **CAM-607** ("let Next's streaming scripts run under our CSP", merged the same day) — the actual root-cause fix for CAM-604 AC-3 (`proxy.ts` was silently never propagating the CSP nonce onto the request headers Next.js's own render pipeline reads, so its Flight-streaming relocation script always ran unnonced and the browser correctly blocked it).
3. Even after rebasing onto the CAM-607 fix, the same symptom still surfaces occasionally under the heavy concurrent load of a full local suite run (5 parallel browser contexts). This matches CAM-607's own tech.md: its author measured the fixed build under 7x CPU-oversubscription fault injection and honestly reported the fix is not a clean binary discriminator at a short poll window — a JS thread competing against extreme CPU oversubscription can still take a variable, occasionally-longer time to get scheduled — i.e. the fix closes the always-blocked case (the root cause) but a genuinely-unnonced-free render can still occasionally lose the scheduling race under contention.

Conclusion: not caused by this story's diff (reproduces on both the parent commit and post-CAM-607 `dev`), not this story's file surface (`proxy.ts`), and already tracked + explained by CAM-604/CAM-607. No further action taken here, per the ticket's own instruction ("if a shared component is at fault, STOP and report rather than changing it"). `ac6-spot-lifecycle.spec.ts` (this residual, load-dependent tail) and `ac3-logo-roundtrip.spec.ts` (a separate, already-documented open defect, DEFECT-1 in CAM-359's `test.md`) are the suite's only two non-green specs across repeated full-suite runs; every other spec, including this story's own two new ones, is consistently green.

## Components & tokens
No new component/token. `lib/hooks/use-request-sequence.ts` is a plain client hook (`"use client"`), not a UI primitive.

## a11y
Unchanged — no DOM/markup/interaction change; the fix is purely which async response is allowed to commit state.

## Links
`../../feature.md` · `story.md` (BR-1..3, EC-1) · CAM-359 (`docs/specs/platform-core/e2e-regression-harness/CAM-359-e2e-regression-suite/test.md`) · CAM-555 (`docs/specs/platform-hardening/taxonomy-ui-foundation/CAM-555-ac6-flake/story.md`) · CAM-604 (`docs/specs/platform-hardening/taxonomy-ui-foundation/CAM-604-availability-hydration-mismatch/tech.md`, the AC-3 finding this design references) · `.claude/rules/api.md` (CAM-341/360) · `.claude/rules/qa.md` (Prove-It + teeth-proof practice)

## Changelog
- v1 (2026-07-28) — created; documents the shared-hook extraction rationale, the deliberately-constructed race (unit + e2e), the manual teeth-proof at both levels, and the pre-existing CAM-604 AC-3 flake observed (not caused, not fixed) during this story's own verification.
