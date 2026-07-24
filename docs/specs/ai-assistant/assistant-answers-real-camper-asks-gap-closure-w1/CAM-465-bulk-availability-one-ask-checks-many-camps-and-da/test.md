---
linear: CAM-465
feature: ai-assistant
epic: assistant-answers-real-camper-asks-gap-closure-w1 (CAM-456)
persona: Camper
artifact: test
owner: qa
status: Done (independent QA verify complete)
version: v1
updated: 2026-07-24
---
# Test — bulkAvailability (live-batch, hard-capped) (CAM-465)

> Independent QA verify (fresh-context, correctness-scoped) of `lib/ai/tools/bulk-availability.ts`
> + `lib/ai/tools/index.ts` registration, against `story.md` (v2, AC-5 reworded, G2-ratified)
> and `tech.md` (v1, 6 G2 decisions). Test files: `__tests__/cam-465-bulk-availability.test.ts`
> (mocks `getRemainingCapacityForCamps` fully — call-count/call-shape precision) +
> `__tests__/cam-465-bulk-availability-real-guard.test.ts` (keeps the real batched core, only
> Prisma mocked — proves the 366-night guard + ADR-009 numeric parity).

## AC → test matrix

| AC/EC | Test file | Test name | Layer | Risk | Pass/Fail |
|---|---|---|---|---|---|
| AC-1 | cam-465-bulk-availability.test.ts | `a camp free for range A, full for range B -> per-range cells preserved` | unit | H | pass |
| AC-2 / EC-1 | cam-465-bulk-availability.test.ts | `a camp full for EVERY requested range stays PRESENT in the matrix` | unit | H | pass |
| AC-3 | cam-465-bulk-availability.test.ts | (same test as AC-1 — per-range cells not collapsed) | unit | H | pass |
| AC-4 / EC-2 | cam-465-bulk-availability.test.ts | `filter matches no published camp -> no_match, NO availability call made at all` | unit | H | pass |
| AC-5 / EC-3 (ranges) | cam-465-bulk-availability.test.ts | `RANGES over the cap (13) -> over_cap refused, ZERO Prisma calls of any kind` | unit | H | pass |
| AC-5 boundary (ranges=12) | cam-465-bulk-availability.test.ts | `RANGES exactly AT the cap (12) -> NOT refused, proceeds to the candidate query` | unit | H | pass |
| AC-5 / EC-3 (camps) | cam-465-bulk-availability.test.ts | `CAMPS over 10 (a broad filter) -> take-bound top-10 page, NEVER refused` | unit | H | pass |
| AC-6 / EC-5 | cam-465-bulk-availability.test.ts | `the candidate query where-clause carries the visibility gate (via buildCampSiteWhere)` | unit | H | pass |
| AC-6 / EC-5 (schema surface) | cam-465-bulk-availability.test.ts | `the args schema exposes NO campId/campSiteId/userId field` | unit | H | pass |
| BR-5 (remaining<guests) | cam-465-bulk-availability.test.ts | `remaining < requested guests -> full (BR-5 numericallyFull projection)` | unit | M | pass |
| BR-5 (remaining===null) | cam-465-bulk-availability.test.ts | `remaining === null (unbounded WHOLE-CAMP, not blocked) -> unknown` | unit | M | pass |
| EC-6 | cam-465-bulk-availability.test.ts | `a range that fail-opens (mocked {}) -> unknown for every camp on THAT range only, matrix continues` | unit | H | pass |
| EC-6 (real guard) | cam-465-bulk-availability-real-guard.test.ts | `a single range wider than MAX_STATUS_RANGE_NIGHTS fails open to an unknown cell` | integration | H | pass |
| EC-6 (multi-range) | cam-465-bulk-availability-real-guard.test.ts | `a second, normal-width range in the SAME request still computes live status` | integration | M | pass |
| ADR-009 parity | cam-465-bulk-availability-real-guard.test.ts | `a normal range computes real remaining via the SAME batched core` | integration | H | pass |
| ADR-009 parity (blocked) | cam-465-bulk-availability-real-guard.test.ts | `a whole-camp BlockedDate forces the cell to full regardless of numeric headroom` | integration | H | pass |
| Decision 5 (echo/order) | cam-465-bulk-availability.test.ts | `ranges are echoed back verbatim, defining the column order` | unit | M | pass |
| Decision 4 (N+1) | cam-465-bulk-availability.test.ts | `getRemainingCapacityForCamps is called exactly ONCE PER RANGE ... never per camp` | unit | H | pass |
| EC-4 / BR-6 | cam-465-bulk-availability.test.ts | `a thrown live read -> { ok:false, reason:error }, never a fabricated free/partial result` | unit | H | pass |
| EC-4 / BR-6 (gap-fill) | cam-465-bulk-availability.test.ts | `a throw on the SECOND of two ranges fails the WHOLE call — never leaks a partial matrix` | unit | H | pass |
| Decision 3 (gap-fill) | cam-465-bulk-availability.test.ts | `province WINS over region when both are given` | unit | M | pass |
| Decision 3 (gap-fill) | cam-465-bulk-availability.test.ts | `region ALONE (no province given) expands to its province set via resolveRegionForSearch` | unit | L | pass |
| BR-1 | cam-465-bulk-availability.test.ts | `guest-tier, read-only, no identity required` | unit | L | pass |
| Wiring (gap-fill) | cam-465-bulk-availability.test.ts | `the registered execute() wrapper actually dispatches to executeBulkAvailability` | unit | M | pass |

23 tests total in `cam-465-bulk-availability.test.ts` (19 original + 4 gap-fill: mid-loop-throw honesty,
province-wins-over-region, region-alone branch, tool.execute() wiring) + 4 in
`cam-465-bulk-availability-real-guard.test.ts` = **23 CAM-465 tests** (dispatch note said 19;
4 gap-fill tests added during independent verify, see below).

Re-derived AC/BR/EC coverage from `story.md` BEFORE reading the test files: **6/6 AC rows covered,
7/7 BR rows covered, 6/6 EC rows covered** — no gap in the AC table itself. All gaps found were in
supplementary risk areas (error-honesty ordering, Decision-3 branch coverage, tool wiring), not in
uncovered AC rows.

## Prove-It — cap enforcement (CAM-344, load-bearing)

Mutated the source three ways, confirmed RED, then restored + confirmed GREEN:

1. **Cap-after-query mutation** — moved the `args.dates.length > MAX_DATE_SET_RANGES` check to
   AFTER the candidate `findMany` call. Result: `[boundary] RANGES over the cap (13) -> over_cap
   refused, ZERO Prisma calls of any kind` went RED (`mockFindMany` was called once, expected zero).
   Confirms the test genuinely proves "cap checked BEFORE any DB call," not just "cap eventually
   enforced" — the CAM-344 DoS-class requirement this ticket is built to close.
2. **N+1 mutation** — changed the per-range batched call into a per-camp-per-range loop
   (`getRemainingCapacityForCamps([id], start, end)` inside a nested camp loop). Result: `[perf]
   getRemainingCapacityForCamps is called exactly ONCE PER RANGE ... never per camp` went RED
   (9 calls observed for 3 camps × 3 ranges, expected 3). Confirms Decision 4's O(rangeCount)
   invariant is actually enforced by the test, not just documented.
3. **Visibility-gate bypass mutation** — replaced the `buildCampSiteWhere(...)` call with a
   hand-built `where` carrying only `location.province` (no `isActive`/`isPublished`/`deletedAt`).
   Result: `[security] the candidate query where-clause carries the visibility gate` went RED.
   Confirms the test would catch a real CAM-469 authz regression (an unpublished/inactive/deleted
   camp's numbers leaking into the matrix), not just check an unrelated shape.
4. **Silent-degrade mutation** (added to Prove-It the new gap-fill test) — moved the `try/catch`
   inside the per-range loop so a mid-loop throw silently continues with an `unknown` cell instead
   of failing the whole call. Result: the new `a throw on the SECOND of two ranges fails the WHOLE
   call` test went RED (`{ ok:true, camps:[...] }` returned instead of `{ ok:false, reason:'error' }`).
   Confirms BR-6 ("never a silent partial") is actually enforced end-to-end, not just for a
   single-range request.

All four mutations were reverted; `diff` against the pre-mutation copy confirmed byte-identical
restoration before the final run.

## Risk-area verification (per dispatch)

1. **Cap enforcement** — see Prove-It #1 above. Also verified: exactly-12-ranges proceeds (boundary
   test); a >10-camp filter is NOT refused, returns the top-10 page (`take: SEARCH_CAMPSITES_MAX_RESULTS`
   asserted in the `findMany` call). Asymmetric-cap design (AC-5 reworded) is correctly implemented.
2. **No N+1** — see Prove-It #2. Real-numbers query count for a multi-camp × multi-range request is
   `O(rangeCount)`, confirmed both by the call-count assertion and by `tech.md` Decision 4's math
   (≤ 1 + 5×12 = 61 queries total, never multiplied by camp count).
3. **Visibility-gate inheritance** — see Prove-It #3. `buildCampSiteWhere` (`lib/campsite-filters.ts`)
   hard-codes `isActive: true, isPublished: true, deletedAt: null` as the FIRST three fields of the
   returned `where` object, unconditionally, with no code path anywhere in the function that can
   clear or override them (read in full — confirmed by direct source read, not just the test). Since
   `bulkAvailability` calls this REAL function (unmocked in the test file) and passes its result
   straight to `findMany`, an unpublished/inactive/deleted camp structurally cannot appear in the
   candidate set. No ungated `campId[]` surface exists in v1 (schema exposes no such field, asserted).
4. **Matrix honesty** — a mixed camp (free range A / full range B) shows both cells correctly, not
   collapsed (AC-3 test); a full-everywhere camp stays present, not omitted (AC-2 test); an empty
   candidate set is an honest `{ ok:false, reason:'no_match' }`, never `{ ok:true, camps:[] }`
   (AC-4 test); a genuine read error fails the WHOLE call honestly (`{ ok:false, reason:'error' }`),
   confirmed both for a single-range throw and — new gap-fill coverage — a throw on the SECOND of
   two ranges (proves no partial matrix leaks from the successfully-computed first range). A
   degenerate/absurd single range (EC-6, real 366-night guard) fails OPEN to `unknown` for that one
   column only, never throws and never blocks sibling ranges (both the fully-mocked and the
   real-guard test files cover this from two angles).

## Gaps found + closed (independent QA verify)

No functional defect found — the implementation matches `story.md`/`tech.md` exactly, all 6 G2
decisions hold under adversarial mutation. Four gap-fill tests were added to close coverage/risk
gaps (not code defects):

1. **Error-honesty ordering** — the original suite only threw on a SINGLE-range request; a throw on
   the second of a MULTI-range request was untested (a plausible bug shape: catching only around
   the first iteration, or silently returning partial data). Added + Prove-It'd (see mutation #4).
2. **Decision-3 branch coverage** — `province wins over region` and the region-ALONE branch
   (`resolveRegionForSearch` actually invoked) were implementation detail per tech.md but had zero
   direct test; coverage report showed line 200 (region branch) uncovered. Closed with two tests.
3. **Tool-registration wiring** — `bulkAvailabilityTool.execute()` (the actual entrypoint the model
   layer calls) was never invoked in any test; every test called `executeBulkAvailability` directly.
   Coverage report showed line 279 uncovered. Closed with a wiring test through the real
   `ToolDefinition.execute`.

No sub-ticket opened — no defect, only test-suite hardening.

## Coverage (real run, `npx vitest run --coverage`)

Scoped to `lib/ai/tools/bulk-availability.ts` (the story's only new-code file):

```
Statements  : 100%   (43/43)
Branches    : 88.88% (24/27)
Functions   : 100%   (7/7)
Lines       : 100%   (40/40)
```

Remaining uncovered branches (lines 209-210: `priceMin`/`priceMax` → `String(...)` ternary
conversion; line 265: a defensive `cellsByCampId.get(card.id) ?? []` fallback that cannot actually
be reached given the Map is pre-populated for every `campId` earlier in `execute`) are low-risk,
mechanical pass-through/defensive code — not gated per `qa.md`'s "coverage is a floor, not a
target" guidance; 88.88% is already well above the 80% floor and the story's real risk surface
(cap enforcement, N+1, visibility gate, matrix honesty) is at 100%.

Full designated regression set (`cam-465-*`, `cam-459-*`, `cam-427-*`): **88/88 pass**. Full repo
suite (`npx vitest run`, no filter): **8330/8330 pass**, 276 test files, no skips.

## Self-verify

- `npm run lint` — 0 errors on touched files (1 pre-existing warning: `_ctx` unused param in
  `bulkAvailabilityTool.execute`, matches the convention every sibling guest-tier tool uses).
- `npx tsc --noEmit` — clean.
- `npx vitest run` (full repo) — 8330/8330 pass, no regressions introduced.

## Changelog

- v1 (2026-07-24) — independent QA verify complete. Re-derived AC/BR/EC matrix from story.md before
  reading tests (6/6 AC, 7/7 BR, 6/6 EC covered, 0 gaps in the AC table). Prove-It'd all 3
  load-bearing guards (cap-before-DB, no-N+1, visibility-gate-inheritance) via real source mutation
  + restore. Added 4 gap-fill tests (error-honesty ordering, Decision-3 branch coverage ×2, tool
  wiring) — all Prove-It'd where a plausible defect shape exists. No defect found; no sub-ticket.
  Coverage 100% stmts/lines/funcs, 88.88% branches on the new file. Pushed to `feature/cam-465-bulk-availability` (PR #549).
