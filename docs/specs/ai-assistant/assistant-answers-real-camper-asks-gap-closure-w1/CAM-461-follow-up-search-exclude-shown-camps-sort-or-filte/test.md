---
linear: CAM-461
feature: ai-assistant
epic: assistant-answers-real-camper-asks-gap-closure-w1
persona: Camper
artifact: test
owner: qa-engineer
status: Done — independent verify complete, no defect found
version: v1
updated: 2026-07-24
---
# Test — Follow-up search refines instead of restarts (excludeIds + sort + OR-within-facet-group) (CAM-461)

## Test strategy note (read first)

**GAP FOUND — `story.md` does not exist for this ticket** (STOP RULE 1 — repo reality vs. the
dispatch instruction to "re-derive AC/BR/EC → matrix from `story.md`"). Confirmed by directory
listing (only `tech.md` present) and by `gh pr diff 545 --name-only` (no `story.md` in the diff);
sibling stories in the same epic (CAM-459, CAM-460) both carry a `story.md`. This is a genuine
process gap — the story appears to have skipped straight to G2 (`tech.md`, "In Design" status) —
reported here rather than improvised around. I proceeded using `tech.md`'s 6 decisions (each
carries its own BR-n/EC-n/AC-n references and a "Confirmation:" line naming the exact test
assertion expected) as the best-available spec artifact, plus `epic.md`'s one-line story-arc
summary ("Follow-ups refine instead of restart — exclude seen, sort, OR-facets, compare in one
turn"). **Recommend**: orchestrator/architect back-fill `story.md` for CAM-461 before G3 sign-off
so the spec/ticket trail is complete (does not block this verify — tech.md's decisions are
concrete and testable).

Independent verify of a shipped diff (PR #545, branch `feature/cam-461-followup-search`, commit
`4f9bd36`) authored before this dispatch. Re-derived the decision→test-case list from `tech.md`
BEFORE reading the 26 pinned tests, then diffed — matched on every mechanism-level row (below).
Then: (1) proved the non-breaking claim directly via `git diff origin/dev -- lib/campsite-filters.ts`
(not just re-running the existing pin), (2) asserted the exact OR-within-group / AND-across-group
where-shapes, (3) verified the excludeIds cap-before-query behavior, (4) checked the eval/golden-
case dependency against the real `cam-457` ceiling test, (5) closed 2 real coverage-matrix gaps
(boundary cases), Prove-It'd by hand. **No defect found.**

## Re-derivation diff (before reading the pinned suite)

My independent decision→test-case list (from `tech.md`'s 6 decisions) matched the pinned suite's
intent on every row — **n/n, 0 gaps in intent, 2 gaps in boundary depth** (closed below):

| tech.md decision | Expected test | Found in pinned suite? |
|---|---|---|
| D1 — array in ONE group → ONE `{code:{in:[...]}}` AND element | yes | yes |
| D1 — two groups (array+string, or 4 arrays) → separate AND elements, AND-across | yes | yes |
| D1 — string branch stays byte-identical (pins cam-408:61) | yes | yes |
| D1/EC-3 — empty array `[]` → no filter (not zero-match) | yes | yes |
| D1 — **boundary: single-element array (size 1)** | yes | **missing — gap-filled** |
| D1 — **boundary: falsy entry inside an array filtered out** | yes | **missing — gap-filled** |
| D2/BR-1 — non-empty excludeIds → `where.id={notIn:[...]}` | yes | yes |
| D2/EC-1 — >50 ids sliced to 50 BEFORE the query | yes | yes |
| D2 — absent/`[]` excludeIds → `where.id` untouched | yes | yes |
| D2 — garbage/non-UUID id accepted by zod (graceful, no `.uuid()`) | yes | yes |
| D2 — coexists with OR-group + petFriendly, no clobber | yes | yes |
| D3/BR-2 — absent `sort` → `orderByFor('related')` default | yes | yes |
| D3 — `sort` maps to `orderByFor(sort)` for price_asc/price_desc/rating | yes | yes |
| D3/EC-2 — unrecognized sort → zod fail, `findMany` never runs | yes | yes |
| D4/BR-4 — today-shaped call (strings only) still validates | yes | yes |
| D4/EC-3 — unknown code inside an array fails zod | yes | yes |
| D4 — excludeIds+sort+array combine on one call | yes | yes |
| D5 — eval P4/P5 golden cases | soft dependency (see below) | not added — correctly deferred |
| D6 — no schema/migration | n/a | n/a |

## Non-breaking proof (the real risk — CAM-355 lesson)

`buildCampSiteWhere` is shared by the 5 non-AI catalog callers (`app/api/campsites/route.ts`,
`app/api/campgrounds/route.ts`, `app/actions/getCampSiteCount.ts`, `app/actions/getCampgroundCount.ts`,
`lib/catalog-cursor.ts`'s separate `buildKeysetWhere`). Proved directly, not just re-run:

1. **`git diff origin/dev -- lib/campsite-filters.ts`** — read the full hunk. The pre-existing
   string-handling code inside `addOptionFilter` (`if (!param) return; const codes =
   param.split(",").filter(Boolean); ...andArray.push({ options: { some: { code } } })...`) is
   **verbatim unchanged** — it now sits after two new early-returns (`undefined` guard, then the
   new `Array.isArray` branch which itself `return`s before reaching the string logic). The type
   widening (`string` → `string | string[]`) and the new `excludeIds` step are pure additions at
   the end of the function. This is character-for-character proof the string path cannot have
   drifted, independent of any test.
2. **The 5 callers' real call sites** (`grep`-confirmed): `app/api/campsites/route.ts` and
   `app/api/campgrounds/route.ts` destructure `searchParams.get('terrain') || undefined` (always
   `string | undefined`); `getCampSiteCount`/`getCampgroundCount` forward `CampSiteFilterParams`
   as received from UI callers (strings). None can reach the array branch.
3. **Existing pin re-confirmed green**: `__tests__/cam-408-search-campsites-taxonomy-dates.test.ts:61`
   (`expect(call.where.AND).toContainEqual({ options: { some: { code: 'RIVE' } } })`) — still
   passes. `cam-461`'s own suite re-pins the identical shape independently.
4. **Full regression run** of every test file that imports `buildCampSiteWhere` (5 catalog callers
   + shared helpers): `cam-344-availability-badge`, `cam-195-cache-catalog`,
   `cam-267-prep1-availability`, `campsite-capacity-filter`, `cam-270-search-campsites`,
   `cam-197-loading-skeletons`, `cam-196-infinite-scroll`, `cam-192-list-buffet`, `sort-utils`,
   `cam-196-keyset-cursor`, `security-hotfix`, `cam-270-campsite-filters-petfriendly` → **558/558
   pass**, zero regressions.
5. `npx tsc --noEmit` clean — the input-type widening does not break any existing string caller.

**Verdict: non-breaking claim holds — proven, not assumed.**

## OR-within-group / AND-across-group shape (exact assertions)

Directly asserted (not "it runs"): `terrain:['RIVE','BEAC']` → exactly
`{ options: { some: { code: { in: ['RIVE','BEAC'] } } } }` as ONE `where.AND` element, and NEVER
the per-code equality shape. Two named groups present (one array + one string, or 4 arrays) → each
produces its OWN separate `where.AND` element (`and.length` asserted exactly), proving AND stays
across groups while OR applies only within one. Empty array `[]` → confirmed no `options`-shaped
element is added (EC-3, "not specified" semantics, never a zero-match filter).

**Gap-filled this dispatch** (real coverage-matrix gaps, not present in the pinned suite):
- `terrain:['RIVE']` (array size **1**, the boundary of "non-empty array") → must still take the
  array/OR branch (`{code:{in:['RIVE']}}`), not silently collapse to the plain-string equality
  shape (`{code:'RIVE'}`) — asserted both ways (positive + negative).
- `terrain:['RIVE','']` (a falsy entry inside an otherwise-valid array) → `buildCampSiteWhere` is
  callable below the AI tool's zod gate by any future caller, so its own `.filter(Boolean)` guard
  needs a direct test independent of zod ever having screened the array.

**Prove-It'd by hand**: temporarily removed `.filter(Boolean)` from the array branch (`const codes
= param;`) → the falsy-entry test went **red** (`AND` contained `{in:['RIVE','']}` instead of
`{in:['RIVE']}`); reverted → both new tests green again; `git diff lib/campsite-filters.ts` = empty
after revert (confirmed no stray production change left behind).

## excludeIds (cap-before-query, CAM-344 lesson)

Confirmed at the `executeSearchCampsites` level (`lib/ai/tools/search-campsites.ts`): the slice to
`MAX_EXCLUDE_IDS=50` happens on `args.excludeIds` **before** `buildCampSiteWhere`/`findMany` is
ever called (75 ids in → `findMany`'s `where.id.notIn` has exactly 50, `.slice(0,50)` semantics
asserted via `toEqual(manyIds.slice(0, MAX_EXCLUDE_IDS))`, never throws). `buildCampSiteWhere`
itself carries no cap logic (correctly — the cap is the caller's responsibility per tech.md D2,
and `buildCampSiteWhere`'s own tests confirm `where.id` is set from whatever array it receives,
already-bounded by the time it arrives). A garbage/non-existent id is accepted by zod (no
`.uuid()`) — confirmed at the schema level (`safeParse` succeeds); the DB-level "excludes nothing"
consequence is Prisma's own `notIn` semantics (a value with no matching row simply matches
everything else), not new logic this story adds, so no additional DB-level test was needed beyond
the schema-acceptance proof. Empty array and absent both leave `where.id` untouched (same code
path, `params.excludeIds.length > 0` guard) — both asserted.

## sort (BR-2 default + reuse of `orderByFor`)

Absent `sort` → `findMany`'s `orderBy` equals `orderByFor('related')` (the new deterministic
default; previously the tool called `findMany` with no `orderBy` at all — confirmed via
`git diff` that this is the one intentional behavior change, and per tech.md's own note, no
existing test pinned the OLD unspecified order, so this is safely additive). `sort:'price_asc'`/
`'price_desc'`/`'rating'` each map to `orderByFor(sort)` exactly (asserted via `toEqual`, not a
smoke check). Unrecognized `sort` value fails zod before any query (EC-2, `findMany` call count
asserted at 0).

## Schema signal — KNOWN LIMITATION (documented, not a test gap)

`jsonSchema.properties.<taxonomy>` keeps `type: 'string', enum: CODES` (preserves the CAM-408
`jsonSchema` pin, `__tests__/cam-408-*.test.ts` "jsonSchema advertises real MasterData codes" —
confirmed that pin asserts only `.enum`, never `.type`, so it does not constrain this decision
either way). The *description* text tells the model it may "pass an ARRAY... when the camper names
two-or-more options in one group," but the formal JSON-schema `type` remains `string` — there is no
`oneOf`. The real validation gate is zod (`z.enum(...).or(z.array(...))`), which DOES accept an
array regardless of what the advisory `jsonSchema` says. **This is a soft-contract gap**: whether
the model actually emits an array in practice (rather than always falling back to a single code, or
emitting a malformed shape) is a real-world LLM-behavior question, not something a unit test can
resolve — it can only be measured by the CAM-457 eval harness against real model calls.

**Golden cases NOT added this dispatch** — checked the actual constraint before attempting:
`__tests__/cam-457-eval-harness.test.ts` (lines ~101-102) pins
`expect(cases.length).toBeGreaterThanOrEqual(6); expect(cases.length).toBeLessThanOrEqual(8)`
against the shipped `golden-cases.json` (currently exactly 8 cases). Adding even one P4/P5 case
would push the count to 9 and break this pinned ceiling test — confirmed by reading the fixture
(`golden-cases.json` has exactly 8 entries) and the test's exact bounds. This is the dependency
tech.md D5 flags ("soft dependency... flag to the orchestrator ONLY if a later corpus-freeze story
lands first") — **not** the `DEFAULT_MAX_EVAL_CASES=500` runtime cap (which has full headroom and
is unrelated to this pinned test's fixed-count assertion). Recommend: a future corpus-freeze/eval-
expansion story either raises the `cam-457` ceiling test's upper bound intentionally alongside
adding P4/P5 cases, or the cases land in a separate fixture file. **Flagging, not blocking** — no
code/behavior regression rides on this; it is a measurement-coverage gap for the eval harness only.

## AC→test matrix

<!-- risk = H/M/L. Derived from tech.md decisions since story.md is absent (see gap above). -->
| Decision (tech.md) | risk | type | test file | status |
|---|---|---|---|---|
| D1 — OR-within-group union shape | H | unit | `cam-461-campsite-filters-or-exclude.test.ts` | pass |
| D1 — AND-across-groups (array+string, 4-array combo) | H | unit | `cam-461-campsite-filters-or-exclude.test.ts` | pass |
| D1 — string branch byte-identical (non-breaking, 5 callers) | H | unit + git-diff proof | `cam-461-campsite-filters-or-exclude.test.ts` + `cam-408-search-campsites-taxonomy-dates.test.ts:61` | pass |
| D1/EC-3 — empty array = not-specified | M | unit | `cam-461-campsite-filters-or-exclude.test.ts` | pass |
| D1 — boundary: single-element array | M | unit (gap-filled) | `cam-461-campsite-filters-or-exclude.test.ts` | pass (Prove-It'd) |
| D1 — boundary: falsy entry filtered from array | L | unit (gap-filled) | `cam-461-campsite-filters-or-exclude.test.ts` | pass (Prove-It'd) |
| D2/BR-1 — excludeIds → where.id.notIn | H | unit | `cam-461-campsite-filters-or-exclude.test.ts` + `cam-461-search-campsites-sort-exclude.test.ts` (unmocked where-builder confirm) | pass |
| D2/EC-1 — >50 ids sliced before query | H | unit | `cam-461-search-campsites-sort-exclude.test.ts` | pass |
| D2 — absent/[] excludeIds no-op | M | unit | both cam-461 files | pass |
| D2 — garbage id graceful (no `.uuid()`) | M | unit | `cam-461-search-campsites-sort-exclude.test.ts` | pass |
| D2 — coexists with OR-group + petFriendly | M | unit | `cam-461-campsite-filters-or-exclude.test.ts` | pass |
| D3/BR-2 — sort default `related` | H | unit | `cam-461-search-campsites-sort-exclude.test.ts` | pass |
| D3 — sort→orderByFor mapping (3 values) | H | unit | `cam-461-search-campsites-sort-exclude.test.ts` | pass |
| D3/EC-2 — unrecognized sort rejected | H | unit | `cam-461-search-campsites-sort-exclude.test.ts` | pass |
| D4/BR-4 — backward-compatible by addition | H | unit | `cam-461-search-campsites-sort-exclude.test.ts` | pass |
| D4/EC-3 — unknown code in array rejected | H | unit | `cam-461-search-campsites-sort-exclude.test.ts` | pass |
| D4 — combination (excludeIds+sort+array, one call) | M | unit | `cam-461-search-campsites-sort-exclude.test.ts` | pass |
| D5 — eval P4/P5 golden cases | L | eval (deferred) | `scripts/ai-eval/golden-cases.json` | **not added — cam-457 8-case ceiling test blocks it; flagged** |
| Schema signal (`type:'string'` vs description-only array hint) | L | documented limitation, not testable headless | — | acknowledged above |

Type mix: 100% unit (0% integration/e2e) — appropriate for this story's scope (pure query-shape
logic, no new route/UI); matches tech.md's "no API contract change" framing.

## Coverage

Real run, `npx vitest run --coverage --coverage.include='lib/campsite-filters.ts'
--coverage.include='lib/ai/tools/search-campsites.ts'` against the FULL suite (not just the cam-461
files, since both are shared files with substantial pre-existing coverage from cam-270/cam-344/
cam-408/cam-427/etc.):

- **`lib/campsite-filters.ts`**: 95.31% stmts / 82.25% branch / 100% func / 100% lines.
- **`lib/ai/tools/search-campsites.ts`**: 97.14% stmts / 100% branch / 83.33% func / 96.96% lines.
- Combined: 95.95% stmts / 87.35% branch / 88.88% func / 98.82% lines — comfortably over the ≥80%
  gate. Remaining uncovered lines are pre-existing (date-resolution, remaining-capacity batching,
  province-alias resolution) — out of this diff's touched hunks.

Full suite (real run, last act before push): `npm test` → **264/264 files, 8164/8164 pass**
(8162 pre-existing + 2 new gap-fill tests), 0 failures/skipped/flaky. `npx tsc --noEmit`: clean.
`npm run lint`: 0 errors, 261 warnings (all pre-existing tech-debt, unchanged count — confirmed
against the PR's own stated baseline).

## Defects found

**None.** All 6 tech.md decisions verified against the real code and real test runs; the
non-breaking claim for the 5 shared-fn callers is proven by direct diff inspection + a 558-test
regression run, not assumed from the pinned suite alone.

## Process gap (not a code defect — reported per STOP RULE 1)

`story.md` is missing for CAM-461 (see Test strategy note above). This does not block Done (the
AC-equivalent content is fully present and testable in `tech.md`), but the ticket's spec trail is
incomplete relative to every sibling story in this epic. Recommend back-filling `story.md` before
closing the epic rollup.

## Links

`docs/specs/ai-assistant/assistant-answers-real-camper-asks-gap-closure-w1/CAM-461-follow-up-search-exclude-shown-camps-sort-or-filte/tech.md` ·
`docs/specs/ai-assistant/assistant-answers-real-camper-asks-gap-closure-w1/epic.md` ·
`.claude/rules/qa.md` · `__tests__/cam-461-campsite-filters-or-exclude.test.ts` ·
`__tests__/cam-461-search-campsites-sort-exclude.test.ts` ·
`__tests__/cam-408-search-campsites-taxonomy-dates.test.ts` ·
`__tests__/cam-457-eval-harness.test.ts` · `lib/campsite-filters.ts` ·
`lib/ai/tools/search-campsites.ts`

## Changelog
- v1 (2026-07-24) — Independent QA verify of PR #545 (commit `4f9bd36`). Found and reported a
  process gap (`story.md` missing for this ticket, all siblings have one); derived the test matrix
  from `tech.md`'s 6 decisions instead. Proved the non-breaking claim for the 5 shared-fn callers
  directly via `git diff origin/dev` (not just re-running the existing pin) + a 558-test regression
  run across every file importing `buildCampSiteWhere`. Verified exact OR-within-group/AND-across-
  group where-shapes, excludeIds cap-before-query behavior, sort→orderByFor mapping, and zod
  backward-compatibility. Closed 2 real boundary gaps (single-element array, falsy-entry filtering)
  with Prove-It'd (red-then-green, hand-verified) gap-fill tests. Checked the eval/golden-case
  dependency against the real `cam-457` 8-case ceiling test — confirmed adding P4/P5 cases would
  break it, so deferred and flagged rather than added. No defects found. Full suite 264/264 files,
  8164/8164 tests pass; typecheck clean; lint 0 errors/261 pre-existing warnings (unchanged).
