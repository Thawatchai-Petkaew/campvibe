---
linear: CAM-462
feature: ai-assistant
epic: assistant-answers-real-camper-asks-gap-closure-w1 (CAM-456)
persona: Camper
artifact: test
owner: qa-engineer
status: In Progress (G2 design; independent QA verify pass complete)
version: v1
updated: 2026-07-24
---
# Test — Thai dates: resolveDates tool + ThaiHoliday table (CAM-462)

## Independent verify — re-derivation result

Re-derived the AC/BR/EC → test matrix from `story.md` BEFORE reading the
shipped `__tests__/cam-462-*.test.ts` (3 files), then diffed. **6/6 AC rows +
8/8 BR + 6/6 EC** the pinned test files already covered at a structural level.
**5 real gaps found and closed in this pass** — all were coverage gaps in the
test suite (branch/edge holes revealed by a real `--coverage` run), not code
defects: (1) BR-2's "empty date-set is never `ok:true`" invariant untested for
the multi-weekend path, (2) the holiday-run forward weekend-expansion branch
(a holiday landing on a Friday) never exercised, (3) two separate
non-contiguous flagged holiday runs never exercised (`groupContiguousRuns`'
split branch), (4) the "year" scope's *successful* (not-over-cap) path never
exercised, (5) an unqualified multi-weekend phrase (no `เดือนนี้`/`ปีนี้`)
never exercised. Every gap-fill test was Prove-It'd red-then-green (mutation
testing against the real source) before being kept — see below. Zero defects
found in the shipped implementation.

## AC→test matrix

| AC | risk (H/M/L) | type (unit/integ/e2e) | test file | status |
|---|---|---|---|---|
| AC-1 (พรุ่งนี้ → tomorrow, 1 night, exclusive checkout) | H | unit | `cam-462-resolve-dates.test.ts` "AC-1" + มะรืนนี้ sibling | ✅ |
| AC-2 (เสาร์อาทิตย์นี้ from a Wed → this Sat→Mon) | H | unit | `cam-462-resolve-dates.test.ts` "AC-2" | ✅ |
| AC-3 (วันหยุดยาวหน้า → next long-weekend span from ThaiHoliday) | H | unit + integration (mocked Prisma) | `cam-462-resolve-dates.test.ts` "AC-3, BR-4" (core, 5 cases incl. 2 gap-fill) + tool-execute integration test | ✅ |
| AC-4 (date-SET phrase → N ranges, capped) | H | unit | `cam-462-resolve-dates.test.ts` "AC-4 + MAX cap" (7 cases incl. 3 gap-fill) | ✅ |
| AC-5 (vague phrase → `ok:false`, ask camper) | H | unit | `cam-462-resolve-dates.test.ts` "never fabricates a date" | ✅ |
| AC-6 (server clock ≠ Asia/Bangkok → Bangkok-calendar result) | H | unit (Prove-It mutation-tested) | `cam-462-resolve-dates.test.ts` "Asia/Bangkok tz correctness" | ✅ |

## Rules / Edge cases (BR-n / EC-n)

| BR/EC | Covered by | status |
|---|---|---|
| BR-1 (pure, deterministic, guest tier) | injected `now`+`holidays` throughout; `resolveDatesTool.tier === 'guest'` test | ✅ |
| BR-2 (empty set never `ok:true`) | holiday no-match case (pre-existing) + **new**: multi-weekend "0 remaining Saturdays this month" case | ✅ |
| BR-3 (endDate EXCLUSIVE) | every AC-1..AC-4 assertion; Prove-It mutation (off-by-one) → 5 tests went red | ✅ |
| BR-4 (ThaiHoliday source + isLongWeekend) | `cam-462-thai-holidays-data.test.ts` re-derivation guard + `cam-462-resolve-dates.test.ts` holiday describe block | ✅ |
| BR-5 (no silent guess) | vague/past/unparseable describe block + **new**: unqualified multi-weekend phrase | ✅ |
| BR-6 (prompt swap) | `cam-462-prompt-date-tool.test.ts` (new instruction present + old CAM-408 instruction gone) | ✅ |
| BR-7 (Asia/Bangkok tz) | AC-6 test; Prove-It mutation (naive-UTC) → test went red exactly as designed | ✅ |
| BR-8 (MAX cap pre-build) | too_many test + `MAX_DATE_SET_RANGES===12`; Prove-It mutation (cap raised to 9999) → both went red | ✅ |
| EC-1 (past phrase → unsupported) | "เมื่อวาน" test | ✅ |
| EC-2 (month/year boundary, no clamping) | month-boundary + year-boundary tests | ✅ |
| EC-3 (no long weekend found → no_match) | non-flagged-row test | ✅ |
| EC-4 (cap enforced pre-build) | same as BR-8 | ✅ |
| EC-5 (invalid/missing `now` → fallback, never throws) | NaN-`now` + default-`now` tests | ✅ |
| EC-6 (empty ThaiHoliday → graceful; relative-day still resolves) | empty-table describe block + tool-execute empty-query test | ✅ |

## Independent-verify findings (dispatch items 1-8)

1. **Re-derivation diff**: matrix above re-derived from `story.md` independently before reading the test files; all rows were already structurally covered. No AC/BR/EC was silently skipped.
2. **TIMEZONE Prove-It**: mutated `bangkokTodayISO` to `safe.toISOString().slice(0,10)` (naive UTC, no Bangkok tz). Result: exactly the AC-6 test ("a late-night UTC moment already next-day in Bangkok...") went RED (expected `2026-07-26`/`2026-07-27`, got `2026-07-25`/`2026-07-26`) — proves the tz handling is real, not incidental, and the test has teeth on the exact defect class this dispatch worried about. Reverted; re-ran green.
3. **EXCLUSIVE-endDate Prove-It**: mutated `weekendRange` to `addDaysISO(saturdayISO, 1)` (inclusive off-by-one). Result: 5 tests went RED across AC-2/EC-2 (month+year boundary). Confirms `เสาร์อาทิตย์` = Sat check-in → Mon exclusive checkout is real and byte-compatible with checkAvailability's contract (verified by reading `check-availability.ts`'s `isoDate` schema — identical `YYYY-MM-DD` shape, no transform needed). Reverted; re-ran green.
4. **MAX_DATE_SET_RANGES=12 pre-build Prove-It**: mutated the const to `9999`. Result: both the `too_many` test AND the `MAX_DATE_SET_RANGES===12` test went RED, and the disabled-cap run visibly returned a full 52-range array for `ทุกวันเสาร์ปีนี้` — proving (a) the cap genuinely gates the code path, and (b) the count is computed via O(1) arithmetic (`countWeekendsInRange`) BEFORE `buildWeekendSet` is ever called (confirmed by code read: the `count > MAX` check precedes the only call site of `buildWeekendSet`), not a build-then-truncate pattern. Reverted; re-ran green.
5. **ANTI-SPOOF Prove-It**: mutated `resolveDatesArgsSchema` to add an optional `today` field. Result: the "zod parameters shape has ONLY `text`" test went RED immediately (`['text','today']` vs `['text']`). Confirms the model-facing contract (`jsonSchema.properties` + zod `.shape`) exposes only `text`; `today`/`tz` are pure-core-internal params never reachable from the tool call, so the model cannot forge a date. Reverted; re-ran green.
6. **isLongWeekend re-derivation**: `cam-462-thai-holidays-data.test.ts` independently re-derives the "≥3-day contiguous non-working span" rule from the row set (weekend + holiday adjacency, NOT reading the stored flag) and asserts every `true` row is in a real span and every `false` row is not. This is a genuine seam invariant (the stored flag is never the sole source of truth per D2). Prove-It'd by corrupting one holiday date in the JSON fixture (moved `2026-07-30` → `2026-07-31`) — both this re-derivation test AND the new Asalha/Khao-Phansa adjacency test (below) went RED. Reverted; re-ran clean (`diff` confirmed byte-identical).
7. **DATA ACCURACY (not blocked)**: the lunar-holiday dates (Makha/Visakha/Asalha Bucha, Khao Phansa) are best-effort per CAM-474 — **added 2 structural-only tests**, never asserting a specific lunar ground-truth date: (a) Asalha Bucha immediately precedes Khao Phansa in both seeded years (`addDaysISO(asalha,1) === khaoPhansa`), (b) every `ชดเชย` (substitution) row has an earlier matching-name row it substitutes for. Both hold for the current data (2026/2027) and are Prove-It'd (see #6 — the same mutation broke both).
8. **Gap-fill (coverage-driven)**: ran `vitest --coverage` scoped to `resolve-dates.ts` — started at 95.68%/89.65%/100%/96.03% (stmt/branch/func/line); closed every real branch gap except 2 justified-skip defensive fallbacks (below), ending at **99.28% stmt / 96.55% branch / 100% func / 100% line**.

## Gap-fill artifacts (this pass)

- `__tests__/cam-462-resolve-dates.test.ts`: +5 tests (BR-2 empty date-set; Friday-forward holiday expansion; two-non-contiguous-holiday-runs; year-scope success path; unqualified multi-weekend phrase — all Prove-It mutation-tested) = **33 tests total** (was 28).
- `__tests__/cam-462-thai-holidays-data.test.ts`: +2 tests (Asalha→Khao-Phansa adjacency; substitution-follows-holiday) = **10 tests total** (was 8).
- `__tests__/cam-462-prompt-date-tool.test.ts`: unchanged, 3 tests.
- CAM-462 total: **46 tests** (was 39 before this pass). No production code changed by QA (per role boundary) — all 7 findings were TEST gaps, not code gaps; zero defect sub-tickets opened.

## Justified-skip (not gap-filled)

Two branches remain uncovered by design, both defensive fallbacks unreachable given the current call graph — writing a test would require fabricating an impossible internal state, which QA's own standard rejects ("coverage is a floor, not a target... cover the branch that carries risk, not lines that cannot fail"):
- `groupContiguousRuns`'s `if (sortedDates.length===0) return []` guard — the only caller (`nextLongWeekendSpan`) already early-returns on an empty `flaggedFutureDates` array before calling it.
- `nextLongWeekendSpan`'s `anchorHoliday?.nameTh ?? 'วันหยุดยาว'` fallback — `anchorHoliday` is guaranteed found by construction (`firstRun.startDate` is always drawn from the same `holidays` array `groupContiguousRuns` grouped).

## Coverage

`lib/ai/tools/resolve-dates.ts` (the story's new code; real `vitest --coverage` run, scoped): **99.28% statements (138/139) · 96.55% branch (56/58) · 100% functions (26/26) · 100% lines (126/126)**. Well above the ≥80% gate. `lib/ai/openrouter-client.ts`'s new code (the 1-line BR-6 prompt swap) is exercised by `cam-462-prompt-date-tool.test.ts`'s exact-string assertions (present + old string gone); the file's overall low % in a scoped run reflects its large pre-existing surface, not the diff.

## Migration (D2 self-verify)

Confirmed `prisma migrate status` reports the `ThaiHoliday` migration applied and up to date against the shared local dev Postgres (`campvibe` DB), with 42 seeded rows (31 flagged `isLongWeekend`) present via `npm run seed` — within BR-4's "~20-40 rows" guidance (42 is a reasonable overshoot from substitution/in-lieu days). Did **not** execute a live down→up cycle against this DB: it is the shared local dev Postgres the owner's own localhost points to (`.claude/rules/ops.md` §1), and a destructive rollback there risks disrupting a live shared resource outside this dispatch's surface. Reversibility is instead confirmed by static review: the migration SQL is a clean isolated `CREATE TABLE`/`DROP TABLE` pair (no FK, no backfill, no other table touched) — see `tech.md` D2's migration sketch, byte-identical to the applied migration file.

## Links

`story.md` (AC/BR) · `tech.md` (D1-D6 decisions) · `.claude/rules/qa.md` · `lib/ai/tools/resolve-dates.ts` · `lib/ai/tools/index.ts` (registration) · `lib/ai/openrouter-client.ts` (BR-6 prompt line) · `prisma/schema.prisma` (`ThaiHoliday`) · `prisma/data/thai-holidays.json` · `prisma/migrations/20260724064228_cam462_thai_holiday`

## Changelog

- v1 (2026-07-24) — independent QA verify: re-derived AC/BR/EC matrix (6 AC + 8 BR + 6 EC, all covered), Prove-It mutation-tested the 5 highest-risk invariants (tz, exclusive-end, MAX-cap pre-build, anti-spoof, isLongWeekend re-derivation) — all had real teeth. Gap-filled 6 real test-coverage gaps (BR-2 empty date-set; Friday-forward holiday expansion; non-contiguous holiday runs; year-scope success path; unqualified multi-weekend phrase; 2 lunar-holiday structural invariants per CAM-474). Coverage raised to 99.28%/96.55%/100%/100%. Zero defects found in the shipped implementation.
