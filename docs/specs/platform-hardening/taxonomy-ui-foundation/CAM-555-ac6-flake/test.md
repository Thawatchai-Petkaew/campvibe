---
feature: platform-hardening
epic: taxonomy-ui-foundation
persona: platform
artifact: test
owner: qa-engineer
status: in-progress
version: v1
updated: 2026-07-27
---
# Test — root-cause the ac6-spot-lifecycle flake (CAM-555)

## Reproduction log (evidence the race is in the PRODUCT, not the test)

**Attempted first (could not reproduce this way — reported honestly):**
- Plain repeated runs of the unmodified `ac6-spot-lifecycle.spec.ts` against a local dev server + isolated local Postgres (`campvibe_e2e_cam555`): 1 baseline pass, then a further 11 runs under CDP CPU throttling (`rate: 4`) + network latency (`latency: 250ms`, ~750kbps) across 5 parallel workers: 11/11 passed. Timing/load alone did not reproduce it locally in the time available — stated honestly, not claimed as "proof of no race."

**Reproduced deterministically via targeted fault injection (this is the actual mechanism):**
- Hypothesis from reading `loadData()`: it fetches 4 sources (spots, camp, session, zones) in ONE `Promise.all` with ONE shared `catch`. The CAM-362 G3 fix already isolated zones; camp and session were still plain `fetch()` calls. `Promise.all` rejects on the FIRST rejection regardless of the other entries — so ANY transient network-level hiccup on camp OR session (unrelated to spot data) blanks the whole list.
- Test: `page.route("**/api/auth/session", ...)` aborting (`route.abort("failed")`) exactly the SECOND `/api/auth/session` request (the one issued by the post-create refetch, not the initial page-load fetch) — simulating one transient, unrelated network hiccup.
- **Result before the fix: 1/1 reproduction** — `getByTestId('row--spot-{id}').toContainText(...)` timed out with "element(s) not found", the EXACT symptom reported on PR #631 and PR #645. A direct API call (`GET /api/campsites/{id}/spots`) in the same test proved the spot really existed — this is a display bug, not a creation failure.
- Repeated the same technique aborting `/api/campsites/{id}` (the camp-detail fetch) instead of session: **1/1 reproduction**, identical symptom.
- **After the fix: 5/5 pass** on the session-abort scenario, **5/5 pass** on the camp-detail-abort scenario (10/10 total) — same fault injection, same abort timing, now green.
- Confirmed red-before-green directly (not just "fix looks right"): reverted the fix (`git stash` on `components/spot-management-section.tsx` + moved `lib/safe-fetch.ts` aside), re-ran the session-abort fault injection: **failed again** (consistent with the original 1/1), then restored the fix and re-confirmed green.
- Unmodified `ac6-spot-lifecycle.spec.ts` (no fault injection), sequential (`--workers=1`, matching the CI job's `workers: 1`), post-fix: **6/6** then **6/6** again across two separate runs on a freshly-reseeded DB = 12/12 clean passes, no artifacts.
- Full `e2e-regression` project (all 6 specs, 38 tests), post-fix, sequential: **38/38 passed**.

**Verdict: the race is in the PRODUCT** (`components/spot-management-section.tsx`'s `loadData()`), not the harness. The spec's existing `toContainText`-only assertion (documented in its own header comment, the CAM-359 harness-race lesson) is correct and unchanged — this fix does not touch the assertion at all.

**Noted but explicitly out of this story's scope:** one local run hit an UNRELATED `GET /api/operator/dashboard` 500 (`Unknown field 'thaiLocation' for include statement on model 'Location'`) — this happened because this worktree's `node_modules` is symlinked from the shared main tree, and a concurrent worktree actively working CAM-574 ("retiring a table") regenerated the shared Prisma Client mid-session. Confirmed via the dev-server log stack trace; confirmed unrelated to this diff (touches `app/api/operator/dashboard/route.ts` / `lib/spot-aggregation.ts`, both explicitly OUT OF BOUNDS for this ticket and pre-existing on `origin/dev` regardless of this fix). Not filed as a sub-ticket here since it is environmental/transient (shared-node_modules race between two concurrent agents), not a reproducible product defect in this story's surface — flagged to the orchestrator directly instead.

## AC→test matrix
| AC | risk (H/M/L) | type (unit/integ/e2e) | test file | status |
|---|---|---|---|---|
| AC-1 (camp/session hiccup doesn't blank a loaded list) | H | unit + e2e (fault-injected, see repro log above) | `__tests__/cam-555-safe-fetch.test.ts`, `__tests__/cam-555-spot-load-isolation.test.ts` | ✅ |
| AC-2 (normal path unchanged: row + canManage both render) | H | e2e (unmodified spec, repeated) + unit (existing suites unedited) | `e2e/regression/ac6-spot-lifecycle.spec.ts` (unmodified) · `__tests__/cam-361-spot-management-section.test.ts`, `__tests__/cam-362-zone-manager.test.ts` (one line renamed, see below) | ✅ 12/12 e2e, unit suites green |
| AC-3 (a genuine spots-fetch failure still shows the error banner) | M | unit (structural) | `__tests__/cam-555-spot-load-isolation.test.ts` "[structural] ... spotsRes itself is still a hard-required plain fetch()" | ✅ |

## Validation cases (per BR-n)
- BR-1 (`fetchJsonSafe` never throws/rejects): normal (200 + object body, 200 + nested/session-shaped body) · null/empty (200 + `{}`, 200 + `null`) · boundary (200 status but `res.json()` itself throws malformed JSON) · error (404, 500) · concurrent (sits inside a `Promise.all` alongside a rejecting sibling fetch without the batch rejecting — the exact real bug shape) — all in `__tests__/cam-555-safe-fetch.test.ts`.
- BR-1 (component wiring): structural assertions that `loadData` imports and calls `fetchJsonSafe` for camp + session (not raw `fetch`), and that `canManage` derives from `campResult.ok`/`sessionResult.ok` + `.data`, in `__tests__/cam-555-spot-load-isolation.test.ts`.
- BR-2 (fail-closed on hiccup): the Prove-It pair (pre-fix loses the list / post-fix keeps it) explicitly asserts `canManage`'s upstream `sessionResult` resolves to `{ ok: false }` on the hiccup — the client gate degrades, never opens; BR-4 (server-side `requireCampSitePermission`) is unaffected and untouched.
- EC-2 (spots-fetch failure still blanks correctly): structural assertion that `spotsRes` is still `fetch(...)` (not wrapped) and still `throw`s on `!spotsRes.ok`.

## Coverage
- `lib/safe-fetch.ts` (new file, all new code): **100% statements (7/7), 100% branches (2/2), 100% functions (1/1), 100% lines (6/6)** — measured via `npx vitest run __tests__/cam-555-safe-fetch.test.ts --coverage`.
- `components/spot-management-section.tsx` diff (the `loadData` rewiring): **not measured by the coverage tool** — this repo's vitest config runs `environment: 'node'` (no jsdom; see `vitest.config.ts`), so this component (like every other client component in this codebase) cannot be rendered under a coverage instrumentation pass. Coverage for this file's diff is structural (source-string assertions tying the fix to the exact expected call shape) + a Prove-It behavioral mirror of the exact `Promise.all`/`catch` logic with controllable Promises — the SAME established pattern this file's own CAM-359/CAM-361/CAM-362 test suites already use for this reason (see their file-header comments). Real, running-app behavioral proof for this file's change comes from the e2e fault-injection repro above (1/1 red before, 5/5 + 5/5 green after), not from the vitest coverage tool.
- `__tests__/cam-362-zone-manager.test.ts`: one line updated (old destructured variable names `campRes`/`sessionRes` → `campResult`/`sessionResult`, matching the CAM-555 rename) — pre-existing test, not new code, excluded from the coverage target.
- Full repo suite: `npx vitest run` → **346 test files passed, 1 skipped; 10197 tests passed, 6 skipped** (0 failed), after `npm run delivery:generate` (clears the pre-existing, env-dependent `lib/delivery` generated-client gap per the dispatch note — unrelated to this diff).

## Links
`story.md` (AC/BR/EC) · `.claude/rules/qa.md` · `e2e/regression/ac6-spot-lifecycle.spec.ts` (unmodified) · `e2e/regression/README.md` (local regression-harness setup this repro reused)

## Changelog
- v1 (2026-07-27) — created.
