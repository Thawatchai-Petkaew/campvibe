## Story
As the **Host**, I want every async load on the availability screen (`/dashboard/campsites/[id]/availability`) to keep the freshest data even when an older, slower request lands last, so that changing month, toggling a spot, and saving never silently erases something I just created or navigated to.
Why: reported by CAM-604 while it was fixing an unrelated hydration mismatch on this same route, and correctly not fixed there (out of that story's file surface). Not yet observed in production — this ticket exists because the precondition (three uncoordinated fetch effects on one route) is present and the failure mode is silent: by the time a user notices, the wrong value is already saved and reads as their own mistake.
Scope: apply CAM-359's existing monotonic-requestId guard to every concurrent async load on this route (`page.tsx`'s `loadData`, `AvailabilityCalendar`'s `loadMonth`, `HostHoldsSection`'s `loadHolds`) — reusing the SAME mechanism, not a re-derived one per component (the exact drift `.claude/rules/api.md` names for CAM-341/360: a fix re-derived per surface is how that bug class shipped twice).
Depends on: CAM-359 (the requestId-gate mechanism this reuses) · CAM-604 (found and reported this, left the hydration fix on the same file untouched here)

## AC
<!-- This route has no new end-user-visible AC of its own (a stale-response race is a defect precondition, not a feature) — the "Then" column is what a developer/QA/CI observes, matching the CAM-604 precedent for this kind of hardening ticket. -->
| # | Given | When | Then (developer/CI observes) | System effect | Neg/edge |
|---|---|---|---|---|---|
| AC-1 | The host is on the calendar and a `loadMonth()` call for the CURRENTLY-displayed month is still in flight | The host clicks to a different month, issuing a second `loadMonth()` call that resolves first | The second (fresher) month's data renders; when the first (stale) call's response later resolves, the fresher data is still showing — the stale response is dropped | `dailyMap` is set only from the request that is still `isCurrent()` at the moment its response lands | EC-1 |
| AC-2 | Same shape as AC-1, but on `page.tsx`'s `loadData()` (blocked-dates + spots) | A slow, earlier-issued `loadData()` call resolves after a faster, later-issued one (e.g. React Strict Mode's double-invoked mount effect racing a post-create/post-delete refetch) | The fresher call's `blocks`/`spots` state stays committed; the stale call's response is dropped | Same requestId guard applied to `loadData` | EC-1 |
| AC-3 | Same shape as AC-1, but on `HostHoldsSection`'s `loadHolds()` | A slow, earlier-issued `loadHolds()` call resolves after a faster, later-issued one (e.g. a post-release refetch racing the mount effect) | The fresher call's `holds` state stays committed; the stale call's response is dropped | Same requestId guard applied to `loadHolds` | EC-1 |
| AC-4 | Any of the three loads above | The guard is removed (teeth-proof only, not shipped) | The identical race loses the fresher data — proving the test asserts a real mechanism, not the guard's own source | — | — |

## Rules
- BR-1 All three call sites reuse the SAME extracted hook (`lib/hooks/use-request-sequence.ts`), not three independent `useRef(0)` counters — mirrors CAM-359's exact mechanism (a monotonic counter bumped once per issued call; a state commit is accepted only if the counter still matches the id that call was issued with).
- BR-2 The guard is checked once, immediately after the network round-trip resolves and before any state commit from that response (matching CAM-359's own placement in `components/spot-management-section.tsx`) — never after a later `await` inside the same branch (json parsing is treated as part of the same atomic commit, consistent with the existing precedent).
- BR-3 CAM-604's hydration fix on `components/availability-calendar.tsx` (`suppressHydrationWarning`, scoped to the `today`/`month`-derived elements) is left untouched.

## Edge cases
- EC-1 IF a THIRD call is issued while a second is still in flight (rapid double-click on month-nav, or a hold create immediately followed by a release) THEN only the response matching the CURRENT (latest) requestId ever commits state — proven generally by the hook-level test asserting `next()` is monotonic and `isCurrent()` is true only for the most recent id.

## Data
No schema/migration. New: `lib/hooks/use-request-sequence.ts` (extracted hook, reused by all three call sites). Touches `app/dashboard/campsites/[id]/availability/page.tsx`, `components/availability-calendar.tsx`, `components/host-holds-section.tsx` (import + guard only, no behavior change to what each load fetches or renders on success).

## Seams & refs
- Reuse: CAM-359's monotonic-requestId mechanism (`components/spot-management-section.tsx`'s `loadData`) — extracted into `lib/hooks/use-request-sequence.ts` rather than re-derived a third/fourth time; see `design.md` for why extraction (not a fourth inline copy) is the honest move here.
- Refs: CAM-359 (`docs/specs/platform-core/e2e-regression-harness/CAM-359-e2e-regression-suite/test.md`, the original mechanism) · CAM-555 (`docs/specs/platform-hardening/taxonomy-ui-foundation/CAM-555-ac6-flake/story.md`, the same mechanism's precedent citation: "Depends on: CAM-359... this fix is additive to it, not a replacement") · CAM-604 (`docs/specs/platform-hardening/taxonomy-ui-foundation/CAM-604-availability-hydration-mismatch/`, found + reported this) · `.claude/rules/api.md` (CAM-341/360 — a fix re-derived per surface ships the same bug twice) · `.claude/rules/code.md` (the CAM-359 rationalization row).

## Out of scope
- `lib/safe-fetch.ts`'s `fetchJsonSafe` fetch-ISOLATION concern (CAM-555 — one source's network failure not blanking a sibling's data that loaded fine) — a different concern from request-SEQUENCING; not touched here, no follow-up needed (already solved where it applies).
- The CAM-604 AC-3 finding (a duplicate DOM subtree under CPU pressure, root-caused to `proxy.ts`'s CSP blocking Next's streaming-relocation script) — shared infra, explicitly out of this ticket's file surface; observed recurring intermittently in this story's own local e2e runs (pre-existing on `dev`, reproduced against both the fixed and the unmodified code) — not fixed here, see `design.md`.

## Self-verify
- AC-1/AC-4 → unit (Prove-It, `__tests__/cam-608-request-sequencing.test.ts`): constructs the crossing on the real `useRequestSequence` hook via `renderHook` (slow call issued first, fast call issued second, slow resolves last) and asserts the slow response does not win; a second test documents the identical race losing data with no guard at all. Teeth proven manually (guard temporarily replaced with `() => true`, the crossing test went RED, restored → GREEN) — see `design.md`.
- AC-1 also → e2e (`e2e/regression/cam-608-calendar-month-race.spec.ts`): deterministically holds the initial month's request open, fulfills the navigated-to month's request first with distinguishable data, then releases the stale response — asserts the fresh data still renders. Teeth proven the same way against the REAL running app (guard disabled → red with the stale value overwriting the fresh one; restored → green).
- AC-2/AC-3 → structural (same test file): each of the three call sites is asserted to import `useRequestSequence`, call `next()` before the fetch, and guard with `isCurrent()` — and asserted to NOT reintroduce a private `requestIdRef` alongside the shared hook.
- Gate = `/quality-gate` — `npm run lint` (0 errors) · `npm run typecheck` (clean) · `npm run check:ds`/`check:palette` (0 violations) · targeted vitest green · full local regression e2e run (`PW_REGRESSION=1 npx playwright test --project=regression`) · full `npx vitest run` green. `npm run build` skipped per dispatch instruction.

## Changelog
- v1 (2026-07-28) — created; applied CAM-359's requestId guard (extracted as `lib/hooks/use-request-sequence.ts`) to all three concurrent async loads on the availability route, with a deliberately-constructed race proven both at the unit and e2e level, teeth proven at both levels.
