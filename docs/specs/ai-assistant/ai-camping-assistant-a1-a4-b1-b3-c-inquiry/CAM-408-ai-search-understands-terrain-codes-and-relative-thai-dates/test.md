---
linear: CAM-408
feature: ai-assistant
epic: ai-camping-assistant-a1-a4-b1-b3-c-inquiry (CAM-266)
persona: camper
artifact: test
owner: qa-engineer
status: In Progress
version: v1
updated: 2026-07-18
---
# Test — AI search understands terrain codes and relative Thai dates (CAM-408)

## AC→test matrix
<!-- risk = H/M/L (impact × likelihood if this AC breaks — ISTQB). Type mix ≈ 70/20/10 unit/integ/e2e (Google ratio). -->
| AC | risk (H/M/L) | type (unit/integ/e2e) | test file | status |
|---|---|---|---|---|
| AC-1 (terrain/access/activities/facilities/keyword → real matches) | H | unit + integ | `__tests__/cam-408-search-campsites-taxonomy-dates.test.ts` | ✅ |
| AC-2 (relative Thai date → real availability check) | H | unit | `__tests__/cam-408-search-campsites-taxonomy-dates.test.ts` | ✅ |
| AC-3 / EC-3 (unknown taxonomy code → rejected before Prisma) | H | unit + integ | `__tests__/cam-408-search-campsites-taxonomy-dates.test.ts` | ✅ |
| EC-1 (no camp matches → `{cards: []}`, no throw) | M | unit | `__tests__/cam-408-search-campsites-taxonomy-dates.test.ts` (mockFindMany → `[]`) | ✅ |
| EC-2 (checkAvailability path unchanged) | L | regression (no new test needed — CAM-270 unchanged) | `__tests__/cam-270-check-availability.test.ts` | ✅ (unchanged, re-run green) |

## Validation cases (BR-n)
- **BR-1** (terrain/access/activities/facilities: single optional code, validated, passthrough): normal — RIVE+petFriendly, MTNS+type, access/activities/facilities each own AND filter; null/empty — no taxonomy args leaves `where.AND` free of `options` filters; error — unknown code per group (KITC/PARK/FLY/NOPE) fails `z.enum` via `safeParse`.
- **BR-2** (keyword = passthrough to name/description OR match, not a characteristic search): normal — keyword `ม่อนแจ่ม` reaches `where.OR` `nameTh: { contains }`.
- **BR-3** (unknown code rejected by zod before Prisma, `dispatchTool` → `invalid_args`): error/validation — direct `safeParse` rejection (unit) **and** a real end-to-end `dispatchTool('searchCampsites', {...})` call through the actual registered tool (integration, added by QA) asserting `{ ok:false, code:'invalid_args' }` **and** `mockFindMany` never invoked — closes the gap between "schema rejects" and "no query runs" for the real wiring (the generic mechanism was already proven with a fake tool in `cam-270-tool-registry.test.ts`; this adds the CAM-408-specific real-tool proof).
- **BR-4** (system-prompt date line computed fresh every call, never cached at module load): normal — `formatTodayContextLine` format assertion via an injected fixed clock (`2026-07-18T10:00:00Z` → `"Today's date is 2026-07-18 (วันเสาร์), Asia/Bangkok time."`, deterministic, no real-clock flakiness); normal — the real system-prompt message sent to the model contains the ISO-date/Thai-weekday line + the relative-date/keyword guidance sentences; **added by QA**: a freshness regression guard — two `runAssistantTurn` calls under `vi.useFakeTimers()` at two different system times (`2026-07-18` / `2026-08-25`) produce two *different* system-prompt date lines, proving the value is computed per-call and never hoisted to a module-level constant (the exact bug class this story fixes).

## Adversarial QA verification (this dispatch)
- **(a) enum-vs-DB check** — ran a read-only `masterData.findMany()` against the real local dev DB (Postgres, `localhost:5432`, scheme+host only per `security.md` no-secret-in-log rule) and diffed every code in `TERRAIN_CODES`/`ACCESS_CODES`/`ACTIVITY_CODES`/`FACILITY_CODES` against the DB rows per group (`Terrain`/`Access type`/`Activity`/`Internal facility`). **Result: exact match, 0 enum codes missing from the DB, 0 DB codes missing from the enum**, across all 4 groups (4/4/10/17 codes respectively). No defect. (Script run ad-hoc from the worktree, not committed — read-only, no schema change.)
- **(b) unknown code rejected before Prisma (real wiring)** — added 2 integration tests calling `dispatchTool('searchCampsites', ...)` against the REAL registered tool (via the `openrouter-client.ts` → `tools/index.ts` side-effect import already in the suite) with an unrecognized `terrain`/`facilities` code; asserts `{ok:false, code:'invalid_args'}` and `mockFindMany` never called.
- **(c) date-line format, no exact-now flakiness** — confirmed the existing `formatTodayContextLine` unit test injects a fixed `Date`, and the system-prompt integration test asserts via a generic regex (`\d{4}-\d{2}-\d{2}`), never comparing against `new Date()` at test-run time. No flakiness risk found.
- **(d) taxonomy passthrough into `buildCampSiteWhere`'s `options: { some: { code } }` AND shape** — verified via the existing 5 tests mocking `prisma.campSite.findMany` and inspecting `where.AND`/`where.OR`; all pass through unchanged as BR-1/BR-2 specify.

## Prove-It (red→green)
Swapped in the pre-fix (`origin/dev`-parent) versions of `lib/ai/tools/search-campsites.ts` and `lib/ai/openrouter-client.ts` and re-ran the CAM-408 suite: 14/15 tests went **red** (including both QA-added integration tests and the freshness guard — confirmed via `--reporter=verbose`), the 1 pass being a test with no dependency on the fix (no-taxonomy-args case). Restored the real implementation (`git status` confirmed 0 diff on production files after restore) → all 15 tests green again. Full regression suites (`cam-270-*`, `cam-404-*`, 8 files / 74 tests) re-run unmodified and green — no regression to the existing tool/prompt contract.

## Coverage
- `lib/ai/tools/search-campsites.ts` (new args + jsonSchema): **100% lines, 100% branches** (measured, `npx vitest run --coverage`, restricted to the two changed files).
- `lib/ai/openrouter-client.ts`: **100% lines** on the diff; **86.36% branches** on the whole file — the uncovered branches (lines ~206/288/304) are pre-existing CAM-270 tool-call-loop/fallback paths untouched by this diff, not new CAM-408 code. The new `formatTodayContextLine`/`buildSystemPrompt` functions have no uncovered branch.

## Defects found
None. No sub-ticket opened.

## Links
`story.md` (AC/BR) · `.claude/rules/qa.md` · `__tests__/cam-270-tool-registry.test.ts` (generic `dispatchTool` invalid-args mechanism, reused reasoning) · `prisma/seed.ts` (MasterData source)

## Changelog
- v1 (2026-07-18) — created; QA light-verify pass (spec-lite CAM-408), 2 gap tests added (real-wiring invalid_args, BR-4 freshness guard), enum-vs-DB verified against the real dev DB (match)
