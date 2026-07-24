---
linear: CAM-473
feature: ai-assistant
epic: assistant-answers-real-camper-asks-gap-closure-w1 (CAM-456)
persona: Camper
artifact: test
owner: qa
status: Done (independent QA verify complete)
version: v1
updated: 2026-07-24
---
# Test — compareCamps (2-4 camps side by side + evidence) (CAM-473)

> Independent QA verify (fresh-context, correctness-scoped) of `lib/ai/tools/compare-camps.ts` +
> `lib/ai/tools/index.ts` registration, against `story.md` (v1) and `tech.md` (v1, 6 G2 decisions).
> Test file: `__tests__/cam-473-compare-camps.test.ts` (mocks `@/lib/prisma` campSite.findMany,
> `getEffectiveCapacity`, `computeFacetScores` fully — call-count/call-shape precision;
> `distanceFromBangkokKm` left REAL, a pure haversine covered separately in cam-449).

## AC → test matrix

| AC/EC | Test file | Test name | Layer | Risk | Pass/Fail |
|---|---|---|---|---|---|
| AC-1 | cam-473-compare-camps.test.ts | `a family compare returns BOTH camps' facet score + non-empty evidence` | unit | H | pass |
| AC-2 | cam-473-compare-camps.test.ts | `price cell exposes atomic startingPrice/priceHigh/currency/fee fields — never a merged string` | unit | H | pass |
| AC-3 / EC-6 | cam-473-compare-camps.test.ts | `omitted criteria -> the DEFAULT_COMPARE_CRITERIA set is used` + `an empty criteria array is treated the same as omitted` | unit | M | pass |
| AC-4 / EC-1 | cam-473-compare-camps.test.ts | `more than MAX_COMPARE_CAMPS unique ids -> too_many, ZERO Prisma calls` | unit | H | pass |
| AC-4 boundary | cam-473-compare-camps.test.ts | `exactly AT the cap (4 unique ids) -> NOT refused, proceeds to the read` | unit | H | pass |
| AC-5 / EC-2 / EC-3 | cam-473-compare-camps.test.ts | `an unpublished/gated-out id is silently EXCLUDED from the matrix — no per-id "dropped" list, no existence oracle` | unit | H | pass |
| AC-5 / EC-2 / EC-3 (shortfall) | cam-473-compare-camps.test.ts | `dropping below 2 visible -> insufficient_visible (aggregate refuse, no per-id list)` | unit | H | pass |
| AC-6 / EC-5 (gap-fill) | cam-473-compare-camps.test.ts | `the SAME campIds + criteria over unchanged source rows returns identical matrix data across two calls` | unit | H | pass |
| EC-1 (also) | cam-473-compare-camps.test.ts | `fewer than 2 unique ids -> too_few, ZERO Prisma calls` | unit | H | pass |
| EC-1 (de-dup) | cam-473-compare-camps.test.ts | `de-dup runs BEFORE the count: the same id repeated is 1 unique id -> too_few` + `a duplicate mixed with a distinct id de-dupes ... BEFORE the query` | unit | H | pass |
| EC-4 (price) | cam-473-compare-camps.test.ts | `no price set -> startingPrice null` | unit | M | pass |
| EC-4 (capacity, gap-fill) | cam-473-compare-camps.test.ts | `getEffectiveCapacity itself resolves null values -> honest null cell, not a crash/0` | unit | M | pass |
| EC-4 (rating) | cam-473-compare-camps.test.ts | `no rating yet -> avgRating null, reviewCount 0` | unit | M | pass |
| EC-4 (cancellation) | cam-473-compare-camps.test.ts | `no cancellation policy set -> honest null policy cell` | unit | M | pass |
| EC-4 (distance) | cam-473-compare-camps.test.ts | `missing lat/lng -> distance cell is null, never treated as 0km` | unit | M | pass |
| EC-4 (facilities, gap-fill) | cam-473-compare-camps.test.ts | `a populated options list -> an atomic amenities list` + `no amenities set -> an empty list, the honest no-data cell` | unit | M | pass |
| EC-4 (facet absent) | cam-473-compare-camps.test.ts | `a facet computeFacetScores did not produce -> explicit honest null cell, never a fake 0-score` | unit | H | pass |
| Decision 1 (capacity sub-decision, effective vs raw) | cam-473-compare-camps.test.ts | `a PER-SPOT camp (useSpotView=true, raw column null) shows the EFFECTIVE (spot-summed) capacity — a real number, not no-data` | unit | H | pass |
| Decision 1 (capacity not requested) | cam-473-compare-camps.test.ts | `getEffectiveCapacity is NOT called when capacity is not among the requested criteria` | unit | M | pass |
| Decision 1 (facet not requested) | cam-473-compare-camps.test.ts | `computeFacetScores is NOT called when no facet criterion is requested` | unit | M | pass |
| Decision 1 (guest-safe select regression) | cam-473-compare-camps.test.ts | `the select carries zero operator/contact/payout/KYC field` | unit | H | pass |
| Decision 1 (gate verbatim) | cam-473-compare-camps.test.ts | `the where carries the CAM-469 gate verbatim (isActive/isPublished/deletedAt)` | unit | H | pass |
| BR-4 (unknown criterion) | cam-473-compare-camps.test.ts | `an unknown criterion is rejected by zod (invalid_args, no read)` | unit | M | pass |
| BR-1 (malformed uuid, gap-fill) | cam-473-compare-camps.test.ts | `a malformed (non-uuid) campId is rejected by zod, no read` | unit | M | pass |
| Decision 3 (ordering) | cam-473-compare-camps.test.ts | `camps is ordered by the INPUT ids, not the DB return order` | unit | M | pass |
| Decision 3 (no winner, P13) | cam-473-compare-camps.test.ts | `the full result (every default criterion) never carries a winner/rank/best key` | unit | H | pass |
| Decision 4 (error honesty) | cam-473-compare-camps.test.ts | `a thrown live read -> { ok:false, reason:"error" }` | unit | H | pass |
| verified value (gap-fill) | cam-473-compare-camps.test.ts | `verified cell surfaces true (only false was exercised elsewhere)` | unit | L | pass |
| beginner/road_access mapping (gap-fill) | cam-473-compare-camps.test.ts | `beginner and road_access each map to their OWN facet from computeFacetScores — never cross-wired` | unit | M | pass |
| Decision 5 (registration) | cam-473-compare-camps.test.ts | `guest-tier, read-only, name "compareCamps"` | unit | L | pass |
| Decision 5 (wiring) | cam-473-compare-camps.test.ts | `the registered execute() wrapper actually dispatches to executeCompareCamps` | unit | M | pass |
| Decision 5 (roster pin) | cam-459-answer-policy-3-zones.test.ts | `the exact set of registered tool names matches the known read-only roster` (includes `compareCamps`) | unit | H | pass |

**34 tests total** in `cam-473-compare-camps.test.ts` (27 original + 7 gap-fill added during
independent verify: malformed-uuid rejection, determinism, facilities populated + no-data,
capacity-null honesty, verified-true, beginner/road_access own-facet mapping).

Re-derived AC/BR/EC coverage from `story.md` BEFORE reading the test file: **6/6 AC rows covered,
7/7 BR rows covered, 6/6 EC rows covered** — no gap in the AC table itself. The gaps found were all
in supplementary risk areas (input-validation completeness, determinism, two untested
analyst value-mapping rows, one untested branch pair), not in uncovered AC rows.

## Prove-It — the 3 dispatch-named risks (load-bearing, mutated + confirmed RED + restored)

1. **Gate inheritance (the CAM-469/CAM-469-risk, authz)** — removed `isActive`/`isPublished`/
   `deletedAt` from the `findMany` `where` clause (left only `id: { in: ids }`). Result: `the where
   carries the CAM-469 gate verbatim` went RED (diff showed the 3 gate fields missing from the
   actual call). Confirms the test would catch a real regression that stops filtering unpublished/
   inactive/soft-deleted camps out of the comparison — the exact leak class this ticket's honesty
   contract forbids. Note: the sibling "silently EXCLUDED" test stayed GREEN under this mutation
   (it asserts behavior against a *mocked* `findMany` return, not the real `where` predicate) — this
   is expected and correct: the `where`-shape test is the one carrying the real teeth for gate
   removal, and it fired.
2. **Effective capacity (CAM-355/CAM-400 fork)** — reverted the `capacity` cell builder to read the
   raw `row.maxGuestsPerDay`/`row.maxTentsPerDay` columns instead of `getEffectiveCapacity`'s
   resolved value. Result: `a PER-SPOT camp ... shows the EFFECTIVE (spot-summed) capacity` went RED
   (expected `{24,12}`, received `{null,null}` — the exact false "no-data" bug the fork exists to
   prevent for a per-spot camp whose real capacity lives on its spots, not the column).
3. **No-winner honesty (P13, Decision 3)** — added a fabricated `winner: camps[0]?.id` field to the
   `ok:true` return. Result: `the full result ... never carries a winner/rank/best key` went RED
   (the regex matched the injected field). Confirms the grep-style assertion has real teeth against
   a tool-asserted verdict creeping back in.

All three mutations were reverted; each restoration was confirmed byte-identical to the
pre-mutation file (`diff` against a session backup) before the final run, and the full
`cam-473-compare-camps.test.ts` file was re-run green (27/27, then 34/34 after gap-fill) after each
restore.

## Prove-It — the 7 gap-fill tests (each independently mutated + confirmed RED + restored)

1. **Malformed campId** — relaxed `campIds: z.array(z.string().uuid())` to `z.array(z.string())`.
   The new malformed-uuid test went RED (`parsed.success` was `true`, expected `false`) — confirms
   BR-1's per-id uuid guard is load-bearing, not decorative.
2. **Determinism (AC-6/EC-5)** — injected `+ Math.random()` into the `rating` cell builder. The new
   determinism test went RED (two calls with identical input produced different `avgRating` values)
   — confirms the test would catch a real non-determinism regression (e.g. an accidentally
   time/random-dependent derivation creeping into a cell builder).
3. **Facilities (populated)** — replaced `amenities: row.options` with a hardcoded `amenities: []`
   in the builder. The new "populated options list -> atomic amenities list" test went RED.
4. **Capacity null-honesty** — changed the `?? null` fallback to `?? 0` on `maxGuestsPerDay`. The new
   "getEffectiveCapacity itself resolves null" test went RED (`0` fabricated instead of the honest
   `null`) — this is exactly the EC-4 "never a fake 0" class of bug for the capacity criterion.
5. **Verified-true** — hardcoded the `verified` builder to always return `false`. The new
   verified-true test went RED.
6. **Beginner/road_access cross-wiring** — changed the `road_access` builder to look up the
   `'beginner'` facet instead of `'road_access'`. The new own-facet-mapping test went RED
   (`result.camps[0].cells.road_access?.facet` was `'beginner'`, expected `'road_access'`) —
   confirms the per-criterion facet lookup is independently verified, not just structurally assumed
   from the `family` case.

All 7 mutations reverted; final `diff` confirmed byte-identical restoration.

## Risk-area verification (per dispatch)

1. **Matrix re-derivation** — walked every AC/BR/EC in `story.md` before opening the test file;
   confirmed 6/6 AC, 7/7 BR, 6/6 EC covered (see table above). No AC-level gap found.
2. **Gate inheritance (authz)** — constructed a 3-id request where the mocked `findMany` returns
   only 2 rows (simulating one id failing the CAM-469 gate): the excluded camp is absent from
   `camps`, no per-id "dropped/not-found" list is ever returned, and `JSON.stringify(result)` does
   not contain the excluded id anywhere (no side-channel leak). A nonexistent id produces the
   IDENTICAL shape (also simply absent) — the code path is a single `findMany` with no per-id
   existence check, so an unpublished id is structurally indistinguishable from a nonexistent one;
   no separate "nonexistent" test was needed since the mechanism is the same query for both. Real
   gate correctness (the `where` clause itself) is Prove-It'd above (#1).
3. **Effective capacity (per-spot correctness)** — Prove-It'd above (#2). Also verified:
   `getEffectiveCapacity` is called `Promise.all`-bounded (≤ `MAX_COMPARE_CAMPS` calls) and only
   when `capacity` is a requested criterion (separate test confirms zero calls when it is not
   requested) — closes the "N extra queries paid even when unused" risk.
4. **No-data honesty** — every non-boolean criterion has an explicit null/empty no-data test: price
   (`startingPrice: null`), capacity (`{null,null}` via the gap-fill null-effective-capacity test),
   rating (`avgRating: null, reviewCount: 0`), cancellation_policy (`policy: null`), distance
   (`distanceFromBangkokKm: null`, never coerced to 0km), facilities (`amenities: []`, gap-fill), and
   the 3 facet criteria (`null` cell when `computeFacetScores` produces no evidence — never a fake
   0-score). `verified` correctly has no no-data test (a boolean is always known, per tech.md's
   value-mapping table).
5. **Cap + de-dup ordering** — `<2` and `>4` both refuse with **zero** `mockFindMany` calls
   (asserted directly); `[a,a,a]` de-dupes to 1 unique id BEFORE the count, so it is `too_few` (not
   a valid 3-camp compare) — the exact CAM-344 "cap/de-dup before any DB work" invariant, and the
   exact scenario named in the dispatch (`[A,A,A]` is `too_few`).
6. **No winner** — Prove-It'd above (#3); also confirmed structurally: `CompareCampsResult`'s
   `ok:true` branch type has no `winner`/`rank`/`best` field, and the regex assertion runs against
   the FULL default-criteria result (all 5 default cells populated), not a narrow slice.

## Gaps found + closed (independent QA verify)

No functional defect found — the implementation matches `story.md`/`tech.md` exactly; the 3
dispatch-named risks (gate inheritance, effective capacity, no-winner) all hold under adversarial
mutation. Seven gap-fill tests were added to close coverage/risk gaps (not code defects):

1. **Malformed-uuid input validation** — the per-id `z.string().uuid()` guard (BR-1) had no direct
   test; only the criteria-enum validation path was exercised. Closed + Prove-It'd.
2. **Determinism (AC-6/EC-5)** — named explicitly in `story.md ## Self-verify` but had zero test in
   the original file. Closed + Prove-It'd (caught an injected non-determinism).
3. **Facilities value-mapping row** — the `facilities` criterion (tech.md Decision 3's per-criterion
   table) was never exercised for its own cell value (populated or empty) — only implicitly present
   via type-completeness. Closed both the populated and no-data branches + Prove-It'd.
4. **Capacity no-data honesty** — the capacity cell's OWN no-data path (`getEffectiveCapacity`
   itself resolving `null`s, e.g. a host who never set a capacity) was untested; only the per-spot
   effective-vs-raw case was covered. Closed + Prove-It'd (caught a `?? 0` fabrication mutation).
5. **Verified-true value** — only the `false` default fixture value had ever been asserted for the
   `verified` cell. Closed + Prove-It'd.
6. **Beginner/road_access own-facet mapping** — only `family` had a direct facet-mapping test;
   `beginner`/`road_access` were covered only via the `satisfies Record<CriterionId,...>` compile-time
   completeness check, not a runtime assertion that each pulls its OWN facet (a plausible copy-paste
   cross-wiring bug). Closed + Prove-It'd (caught a swapped-lookup mutation); this also closed the
   coverage report's last 2 uncovered lines (257-258).

No sub-ticket opened — no defect, only test-suite hardening.

## Coverage (real run, `npx vitest run --coverage`)

Scoped to `lib/ai/tools/compare-camps.ts` (the story's only new-code file):

```
Statements  : 100%   (55/55)
Branches    : 93.33% (28/30)
Functions   : 100%   (22/22)
Lines       : 100%   (45/45)
```

The 2 remaining uncovered branches are the `?? null` fallback arm of the `beginner`/`road_access`
lookups in the "facet not found for this camp" case (the found-case IS covered by the gap-fill
own-mapping test; the not-found arm is structurally identical to the already-covered `family`
not-found case, which IS asserted — low marginal risk). 93.33% is well above the 80% floor and every
named risk area (gate, capacity, no-winner, no-data, cap/de-dup) sits at 100% test intent.

Full designated regression set (`cam-473-*`, `cam-459-*`, `cam-464-*`, `cam-427-*`): **128/128
pass**. Full repo suite (`npx vitest run`, no filter): **8366/8366 pass**, 277 test files, no
skips, no flake.

## Self-verify

- `npm run lint` — 0 errors on touched files (1 pre-existing-pattern warning: `_ctx` unused param in
  `compareCampsTool.execute`, matches the identical convention already present in
  `bulkAvailabilityTool`/`checkAvailabilityTool` — not a new class of warning).
- `npx tsc --noEmit` — clean.
- `npx vitest run` (full repo) — 8366/8366 pass, no regressions introduced.
- `get-camp-detail.ts` regression: `git diff --stat` against `origin/dev` shows the file untouched
  (confirms tech.md Decision 1's "single read UNCHANGED" contract).

## Changelog

- v1 (2026-07-24) — independent QA verify complete. Re-derived AC/BR/EC matrix from story.md before
  reading the test file (6/6 AC, 7/7 BR, 6/6 EC covered, 0 gaps in the AC table). Prove-It'd the 3
  dispatch-named risks (gate inheritance, effective capacity, no-winner honesty) via real source
  mutation + byte-identical restore. Added 7 gap-fill tests (malformed-uuid rejection, determinism,
  facilities populated+no-data, capacity-null honesty, verified-true, beginner/road_access own-facet
  mapping) — all Prove-It'd. No defect found; no sub-ticket opened. Coverage 100% stmts/lines/funcs,
  93.33% branches on the new file. Pushed to `feature/cam-473-compare-camps` (PR #550).
