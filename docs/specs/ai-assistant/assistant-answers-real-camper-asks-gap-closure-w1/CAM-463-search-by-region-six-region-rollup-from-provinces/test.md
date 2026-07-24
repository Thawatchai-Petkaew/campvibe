---
linear: CAM-463
feature: ai-assistant
epic: assistant-answers-real-camper-asks-gap-closure-w1
persona: Camper
artifact: test
owner: qa-engineer
status: Blocked — 1 real defect open (Important), 1 spec-completion gap (Suggestion), gap-fill green
version: v1
updated: 2026-07-24
---
# Test — search by region: 6-region rollup from provinces (CAM-463)

## Test strategy note (read first)

Independent QA verify of a shipped diff (branch `feature/cam-463-region`, commit `9cc1c6a`,
authored before this dispatch — not accepted on the authoring agent's self-report alone). I
re-derived the AC/BR/EC → test matrix from `story.md`/`tech.md` BEFORE reading the pinned 42
tests, then diffed. Ran the PARTITION AUTHORITY spot-audit (the risk the completeness/size test
cannot catch). Verified the region-wins-vs-province where-object exclusivity. Diffed
`buildCampSiteWhere` byte-for-byte against `origin/dev` to verify the "byte-identical" claim for
every existing catalog caller — found one real edge-case regression (below). Added 21 gap-fill
tests (all Prove-It'd red-then-green by hand). **1 real defect found (Important)** — story is
`blocked`, not green.

## Re-derivation diff (before reading the pinned suite)

My independent AC/BR/EC → test-case list matched the pinned suite's intent on every AC row
(AC-1..AC-6, all 6 EC-1..EC-6). Gaps found beyond the pinned 42, all closed by gap-fill except
where noted:

- **Partition CORRECTNESS, not just completeness** — the pinned `cam-463-thai-regions.test.ts`
  proves the map is a complete partition (77, no dup, none missing) and pins per-region SIZE
  (9/20/22/7/5/14) plus 2 explicit spot-checks (lower-north-under-CENTRAL, Tak-under-WEST). A
  completeness+size test **cannot** catch a same-size SWAP between two regions (e.g. filing
  Prachuap Khiri Khan under SOUTH and Ranong under WEST keeps both region sizes correct and
  passes every existing test, yet silently returns the wrong camps). **Closed** — added a
  15-province ambiguous-province pin (see Partition Authority Audit below), each asserted present
  in its region AND absent from every other region.
- **`region` arg zod schema boundary** (empty / whitespace-only / exactly-50 / over-50) had no
  dedicated test — the resolver's own boundary (`lib/thai-regions.ts`) is thoroughly tested, but
  the schema gate in front of it (`searchCampsitesArgsSchema`) was not. **Closed** — 5 gap-fill
  tests, Prove-It'd (see below).
- **Non-breaking province widening — deep check** — the pinned suite proves the string branch is
  byte-identical for `province` ALONE and for `province + district`, but never for a realistic
  MULTI-param catalog call (province + min/max + petFriendly + keyword together — the actual shape
  every `/api/campgrounds` request carries). **Closed** — added a combined-params regression test.
  **This deeper check also surfaced a real defect** (below) that the pinned suite's narrower
  byte-identical assertions do not exercise.
- **golden-cases.json P18 cases (tech.md Decision 5)** — tech.md explicitly designs 4 P18 region
  cases for `scripts/ai-eval/golden-cases.json` and the story's own Self-verify calls for them
  ("re-run the golden eval — no regression + the new P18 case passes"). **Not implemented** — the
  fixture is unchanged at 8 cases (verified: `grep -c region scripts/ai-eval/golden-cases.json` →
  0 hits). Flagged below as a spec-completion gap, not a functional defect (soft dependency on
  CAM-457, same pattern tech.md itself cites for CAM-460, which also shipped without its
  equivalent addition — checked via `git show ac3faa7 --stat`, no `golden-cases.json` touch).

## PARTITION AUTHORITY AUDIT (independent, before accepting BR-1's 77→6 assignment)

No `region` column exists anywhere in the repo (`prisma/schema.prisma`, `ThailandLocation`,
`AdminArea`) to mechanically cross-check the map against — the map in `lib/thai-regions.ts` is the
**only** source of truth, hand-authored against "Thailand's standard 6-region geographic partition
(การแบ่ง 6 ภาคของคณะกรรมการภูมิศาสตร์แห่งชาติ / NESDB)" per tech.md. Verified two independent ways:

**1. Domain-knowledge spot-audit, 15 provinces** (exceeds the dispatch's ≥12 ask), targeting every
named ambiguous/border case plus additional quirks:

| Province | Assigned | Common wrong guess | Verified against |
|---|---|---|---|
| Phetchabun | CENTRAL | NORTH (lower-north) | standard 6-region scheme: yes, CENTRAL |
| Tak | WEST | NORTH (borders Chiang Mai) | standard scheme: yes, WEST |
| Nakhon Sawan / Uthai Thani / Kamphaeng Phet / Sukhothai / Phitsanulok / Phichit | CENTRAL | NORTH (lower-north bloc) | standard scheme: yes, all CENTRAL |
| Nakhon Nayok | CENTRAL | EAST (adjacent to seaboard provinces) | standard scheme: yes, CENTRAL |
| Prachuap Khiri Khan | WEST | SOUTH (peninsula isthmus) | standard scheme: yes, WEST |
| Sa Kaeo | EAST | NORTHEAST (Cambodia border, landlocked like Isan) | standard scheme: yes, EAST |
| Trat | EAST | SOUTH (far down the gulf coast) | standard scheme: yes, EAST |
| Ranong | SOUTH | WEST (Myanmar border, like western provinces) | standard scheme: yes, SOUTH |
| Chumphon | SOUTH | transition-zone | standard scheme: yes, SOUTH |
| Nakhon Ratchasima | NORTHEAST | sanity pin | correct |

**2. Structural corroboration** — the Ministry-of-Interior 2-digit numeric province codes in
`prisma/data/thailand-locations.json` (independent of the region map): NORTH = codes 50-58 (clean
9-province contiguous block, matches the map exactly), NORTHEAST = codes 30-49 (clean 20-province
block, matches exactly), SOUTH = codes 80-86 + 90-96 (clean 14-province block, matches exactly).
The CENTRAL/EAST/WEST split (codes 10-27 and 60-77) is NOT a clean numeric block — it interleaves
CENTRAL and EAST (10-19 = CENTRAL, 20-27 = EAST **except** Nakhon Nayok at 26 which the map correctly
routes to CENTRAL) and interleaves CENTRAL and WEST (60-67 = CENTRAL **except** Tak at 63 which the
map correctly routes to WEST; 70-77 splits 4/4 between CENTRAL and WEST). Both of the two
"exceptions to the numeric block" are exactly the two well-documented quirks of the standard
6-region scheme, and both match the code. **0 misassignments found.**

Honesty note: this audit is domain-knowledge + structural corroboration, not a live lookup against
an external authoritative API (none was available in this environment) — stated per metric
honesty, not claimed as a formal citation-verified authority pass.

## Region-wins-vs-province verification (risk #3)

Confirmed at both layers:
- `executeSearchCampsites`: `province` is read in an `if`, `region` only in the `else` — region is
  **structurally unreachable** when province is present (not just empty at runtime), so no
  province+region combination can ever leak a region-shaped filter in.
- `buildCampSiteWhere({ province: 'Chiang Mai' })` where-object inspected directly: `{isActive,
  isPublished, deletedAt, location:{province:'Chiang Mai'}}` — no stray `region` key, no `in`-set,
  exactly the single-province equality shape. The pinned test's
  `.not.toEqual({ in: expect.any(Array) })` assertion is a real, specific assertion (not a
  tautology) — confirmed by inspection.

## AC→test matrix

| AC | risk | type | test file | status |
|---|---|---|---|---|
| AC-1 (region → province-set where, cards from >1 province) | H | unit (where-clause) + owner-verify (cross-province card render) + eval (P18, **not implemented**, see gap) | `cam-463-search-campsites-region.test.ts` | pass / owner-verify pending / eval gap |
| AC-2 (colloquial อีสาน === formal ภาคตะวันออกเฉียงเหนือ) | H | unit | `cam-463-thai-regions.test.ts` + `cam-463-search-campsites-region.test.ts` | pass |
| AC-3 (province-only unchanged, CAM-404 regression) | H | unit (regression) | `cam-463-search-campsites-region.test.ts` + `cam-463-campsite-filters-province-set.test.ts` | pass |
| AC-4 (province+region → province wins, never intersected) | H | unit | `cam-463-search-campsites-region.test.ts` | pass |
| AC-5 (recognized-but-empty region → honest banner) | M | unit (`{cards:[]}`) + owner-verify (banner render, CAM-437 territory unchanged) | `cam-463-search-campsites-region.test.ts` | pass / owner-verify pending |
| AC-6 (unrecognized region → same banner, never error) | H | unit | `cam-463-search-campsites-region.test.ts` + `cam-463-thai-regions.test.ts` | pass |
| BR-1 (77→6 partition, official scheme) | H | unit (completeness+size, pinned) + unit (ambiguous-province identity, gap-fill) | `cam-463-thai-regions.test.ts` + `cam-463-qa-partition-audit-and-boundary.test.ts` | pass |
| BR-2 (alias normalization, additive, exact-key) | H | unit | `cam-463-thai-regions.test.ts` | pass |
| BR-3 (province wins, region dropped, never AND-ed) | H | unit | `cam-463-search-campsites-region.test.ts` | pass |
| BR-4 (honest empty/fallback, never throws) | H | unit | `cam-463-thai-regions.test.ts` + `cam-463-search-campsites-region.test.ts` | pass |
| BR-5 (10-cap unchanged) | L | unit (pre-existing, unaffected by this diff) | `cam-461-search-campsites-sort-exclude.test.ts` | pass (unchanged) |
| region arg zod boundary (empty/whitespace/50/51 chars) | M | unit (gap-fill) | `cam-463-qa-partition-audit-and-boundary.test.ts` | pass |
| `buildCampSiteWhere` non-breaking, single param (regression) | H | unit (pinned) | `cam-463-campsite-filters-province-set.test.ts` | pass |
| `buildCampSiteWhere` non-breaking, multi-param combined (gap-fill) | H | unit (gap-fill) | `cam-463-qa-partition-audit-and-boundary.test.ts` | pass — **but see Defect #1**, a narrower edge (empty-string province) this same test family surfaced |
| EC-1..EC-6 | — | see AC-1..AC-6 rows (1:1 twins per story.md) | as above | pass |

Type mix (CAM-463 tests, this dispatch's additions + pinned): 63/63 unit (100%), 0% integ/e2e —
consistent with the sibling CAM-404/458/461 resolver-family precedent (mocked-Prisma unit tests);
AC-1 cross-province card render and AC-5 banner render correctly delegated to owner-verify per
story.md's own Self-verify, not skipped.

## Defects found

### Defect #1 (Important) — `buildCampSiteWhere` province widening is NOT byte-identical for an explicit empty-string province + a truthy district

**Severity:** Important (data-correctness regression on a public, unauthenticated endpoint;
false-negative search results — not data loss/security escalation, and not reachable through the
built UI, but reachable via any direct client of `GET /api/campsites`).

**Failing AC/claim:** not a story.md AC row directly, but a direct violation of **tech.md Decision
4's own confirmation claim**: "Regression unit test: a single-province call … produces … identical
to pre-CAM-463" and the story's `## Data` promise of a "backward-compatible … additive `string |
string[]` widening" for the province string branch.

**Reproduction:**
```ts
import { buildCampSiteWhere } from '@/lib/campsite-filters';
buildCampSiteWhere({ province: '', district: 'Mueang' });
```
- **Actual (current CAM-463 code):** `{ location: { province: '', district: 'Mueang' } }` — an
  exact-match filter on an empty string, which matches ZERO real camps (no camp has
  `location.province === ''`) → the district search silently returns no results.
- **Expected (pre-CAM-463 / `origin/dev` behavior, confirmed by reading the diffed source):**
  `{ location: { district: 'Mueang' } }` (no `province` key at all) — because the old code guarded
  the assignment with `if (province) where.location.province = province;` (a TRUTHY check), so an
  empty string was silently skipped, correctly searching the district across all provinces.

**Root cause:** the CAM-463 widening replaced the truthy guard with `if (province !== undefined)`
then unconditionally does `where.location.province = province;` in the non-array branch — it never
reproduces the OLD code's implicit "falsy province = no filter" behavior for the plain-string case,
unlike the sibling `addOptionFilter` (CAM-461's own taxonomy-widening pattern) which explicitly
guards `if (!param) return;` before doing anything.

**Reachability (traced, not assumed):**
- `app/api/campgrounds/route.ts` — SAFE: normalizes with `searchParams.get('province') || undefined`
  before calling `buildCampSiteWhere`, so `''` never reaches it.
- **`app/api/campsites/route.ts` (the cursor/catalog GET route) — REACHABLE.** Its
  `lib/validations/catalog-cursor.ts` `catalogQuerySchema` declares `province: z.string().optional()`
  with **no** `.min(1)` and no empty→undefined normalization — a request to
  `GET /api/campsites?province=&district=Mueang` parses `province: ''` (present key, empty value)
  and passes it straight to `buildCampSiteWhere`. This is a public, unauthenticated endpoint.
- The AI tool itself (`searchCampsitesArgsSchema`) is **NOT** affected — both its `province` and
  `region` args carry `.min(1)`, so an empty string fails zod validation before ever reaching
  `buildCampSiteWhere`; this defect cannot occur via the region-search feature this story ships.
- The built UI (`SearchModal.tsx`) is **NOT** a practical trigger either: `handleSearch` deletes
  the `province` URL param entirely when empty, and the district `<Select>` is `disabled={!province}`
  — a normal user cannot reach this combination through the app's own UI. The realistic exposure is
  a direct/scripted call to the public `/api/campsites` endpoint.

**Expected vs actual:** expected = no province filter applied (district-only search, all
provinces); actual = an impossible-to-match province filter (`province: ''`), forcing 0 results.

**Recommendation:** add the same falsy/empty-string guard the array branch already has (mirror
`addOptionFilter`'s `if (!param) return;` idiom) to the string branch in
`lib/campsite-filters.ts` step 3, e.g. `else if (province) { where.location.province = province; }`.
Route to `backend` as a sub-ticket; QA does not fix production code. A Prove-It regression test
belongs in the fix ticket (not added here as a permanently-red test — leaving a dangling red/skip
in this story's suite would violate the "no test debris" DoD bar).

### Finding #2 (Suggestion, not a defect) — golden-cases.json P18 region cases (tech.md Decision 5) not implemented

tech.md Decision 5 designs 4 `P18-*` eval cases for `scripts/ai-eval/golden-cases.json`, and
story.md's own Self-verify calls for re-running the golden eval with the new P18 case passing.
Verified: the fixture is unchanged (8 cases, 0 occurrences of "region" in the file). This is a
spec-completion gap, not a functional bug — the region-search feature itself works correctly per
the AC→test matrix above. Consistent with the sibling CAM-460 story, which similarly shipped
without its equivalent eval-suite addition (soft dependency, as tech.md itself notes). Recommend a
fast-follow to add the 4 P18 cases; not blocking, and not filed as a defect sub-ticket.

## Prove-It — hand-verified red-then-green (all new gap-fill tests)

1. **Partition-swap detection** — mutated `lib/thai-regions.ts` to move Ranong out of SOUTH and
   Prachuap Khiri Khan out of WEST (simulating a same-size cross-region swap) → 2 of the 15
   ambiguous-province pins went **red** (`expected [...] to include 'Ranong'`, `expected [...] to
   include 'Prachuap Khiri Khan'`) — proves the pin catches what the completeness/size test cannot.
   Reverted → 21/21 green.
2. **Schema boundary teeth** — loosened `searchCampsitesArgsSchema`'s `region` field from
   `z.string().trim().min(1).max(50).optional()` to `z.string().optional()` → all 3 boundary tests
   (empty, whitespace-only, over-50) went **red** (`expected true to be false`). Reverted → 21/21
   green.

Full CAM-463-relevant suite re-run after both reverts: `npx vitest run
__tests__/cam-463-*.test.ts __tests__/cam-408-*.test.ts __tests__/cam-461-*.test.ts` →
**106/106 pass**. Full repo suite (last act): `npx vitest run` → **271/271 files, 8273/8273 tests
pass**, 0 failed, 0 skipped. `npm run typecheck`: clean. `npm run lint`: 0 errors, 0 new
warnings (262 pre-existing warnings unchanged, none in the new test file).

## Coverage

Whole-file v8 coverage across every test file that exercises the touched shared files (cam-463 +
cam-408 + cam-461 + cam-404 + cam-427 + cam-270, since `campsite-filters.ts`/`search-campsites.ts`
are shared across many stories):

- `lib/thai-regions.ts` — 100% (new file, fully exercised by the pinned + gap-fill suite).
- `lib/campsite-filters.ts` — 89.7% stmts / 92.85% lines / 77.27% branch; uncovered lines 134-139
  are the pre-existing guest-capacity filter (step 5), **outside this story's diff** (step 3,
  province widening — fully exercised, string branch / array branch / empty-array guard /
  falsy-entry filter / combined-with-district / combined-with-taxonomy all asserted).
- `lib/ai/tools/search-campsites.ts` — 97.36% stmts / 97.22% lines / 100% branch; the one
  uncovered line is the trivial `execute: (args, _ctx) => executeSearchCampsites(args)`
  tool-definition wrapper, an existing pattern unrelated to this story's diff.
- Note: line/branch coverage numbers, by construction, could **not** have caught Defect #1 above
  (the buggy and correct behavior sit on the SAME branch, differing only in the runtime VALUE of
  `province`) — that required the manual `origin/dev` diff + reachability trace, not a coverage
  metric. Stated for metric honesty per `.claude/rules/performance.md`/`qa.md` conventions.

## Owner-verify / staging-G4 rows (browser/DB-render, cannot be proven headless)

| # | Row | Why headless can't prove it |
|---|---|---|
| 1 | AC-1 — camp cards render from >1 province in the real chat for a region ask | Requires real camps seeded across ≥2 provinces of one region + rendering the actual chat UI |
| 2 | AC-5 — the exact `aiChat.zeroResult` banner renders with no camp named, for a recognized-but-empty region | Banner render is chat-UI territory (CAM-437/CAM-458, unchanged this story); tool-layer `{cards:[]}` is unit-proven, the DOM/LLM-response render is not |
| 3 | Golden eval (CAM-457) re-run — no regression | Separate harness, owner/CI action; also currently N/A since P18 cases were never added (Finding #2) |

## Links

`docs/specs/ai-assistant/assistant-answers-real-camper-asks-gap-closure-w1/CAM-463-search-by-region-six-region-rollup-from-provinces/story.md` ·
`docs/specs/ai-assistant/assistant-answers-real-camper-asks-gap-closure-w1/CAM-463-search-by-region-six-region-rollup-from-provinces/tech.md` ·
`.claude/rules/qa.md` ·
`__tests__/cam-463-thai-regions.test.ts` · `__tests__/cam-463-campsite-filters-province-set.test.ts` ·
`__tests__/cam-463-search-campsites-region.test.ts` · `__tests__/cam-463-qa-partition-audit-and-boundary.test.ts` ·
`lib/thai-regions.ts` · `lib/ai/tools/search-campsites.ts` · `lib/campsite-filters.ts` ·
`app/api/campsites/route.ts` · `lib/validations/catalog-cursor.ts`

## Changelog

- v1 (2026-07-24) — Independent QA verify of the shipped diff (branch `feature/cam-463-region`, 42
  pinned tests, authored before this dispatch). Re-derived the AC/BR/EC matrix before reading the
  pinned tests. Ran a PARTITION AUTHORITY audit (15-province ambiguous-case spot-audit +
  numeric-code structural corroboration) — 0 misassignments found. Verified region-wins-vs-province
  where-object exclusivity (structurally unreachable, not just untested). Found **1 real defect**
  (Important — `buildCampSiteWhere` empty-string province + district loses the pre-CAM-463 falsy
  guard, reachable via the public `/api/campsites` route, not via this story's own AI-tool feature)
  and **1 spec-completion gap** (golden-cases.json P18 cases from tech.md Decision 5 never
  implemented — Suggestion, not blocking). Added 21 gap-fill tests, all Prove-It'd red-then-green
  by hand. Full CAM-463-relevant suite 106/106 pass; full repo suite 271/271 files, 8273/8273 tests
  green; typecheck clean; lint 0 new errors/warnings. **Status: blocked** pending Defect #1's
  backend fix — do not merge as green.
