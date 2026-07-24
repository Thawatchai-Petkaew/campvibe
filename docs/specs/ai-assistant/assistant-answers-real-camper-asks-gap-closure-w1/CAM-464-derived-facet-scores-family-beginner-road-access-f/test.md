---
linear: CAM-464
feature: ai-assistant
epic: assistant-answers-real-camper-asks-gap-closure-w1
persona: Camper
artifact: test
owner: qa-engineer
status: In Review
version: v1
updated: 2026-07-24
---
# Test — Derived facet scores: family / beginner / road_access (CAM-464, PR #548)

Independent QA verification pass on branch `feature/cam-464-facet-scores` (already implemented by a
prior dispatch; this file documents an adversarial re-derivation of the AC/BR/EC → test matrix from
`story.md`/`tech.md` BEFORE reading the shipped tests, plus 3 gap-fill tests this pass added).

## Independent re-derivation vs shipped tests (diff)

Re-derived the AC/BR/EC coverage list from `story.md` cold, then diffed against the 26 shipped tests
(20 in `cam-464-facet-scores.test.ts` + 6 in `cam-464-get-camp-detail-facets.test.ts`). Result: **26/26
required cases present, 0 missing** against my independent list. 3 additional edge cases were found
during hand-arithmetic re-derivation of tech.md D3's weight tables (see "Gap-fill" below) — these are
real, previously-untested behavior, not required-but-missing AC coverage.

## AC→test matrix

| AC/BR/EC | risk (H/M/L) | type | test file | status |
|---|---|---|---|---|
| AC-1 family grounded evidence (TOIL+SHOW+DRIV, no age limit) | H | unit + integ | `cam-464-facet-scores.test.ts`, `cam-464-get-camp-detail-facets.test.ts` | ✅ pass |
| AC-2 beginner grounded evidence (DRIV + comforts) | H | unit | `cam-464-facet-scores.test.ts` | ✅ pass |
| AC-3 road_access honest sedan-hedge (DRIV, confidence capped, `vehicle_class_unknown` note) | H | unit + integ | both test files | ✅ pass |
| AC-4 empty evidence ⇒ facet absent (never a fake 0) | H | unit + integ | both test files (EC-1/EC-4 rows) | ✅ pass |
| AC-5 deterministic / reproducible (BR-6, P13) | H | unit | `cam-464-facet-scores.test.ts` (2 determinism tests) | ✅ pass |
| BR-1 family weight table + age-ceiling clamp (>=12 → cap 0.40, CLAMPS a would-be-0.85) | H | unit | `cam-464-facet-scores.test.ts` (boundary test, raw 0.85→0.40) | ✅ pass |
| BR-1 neutral age 7–11 (neither fires kidsWelcome nor caps) | M | unit | `cam-464-facet-scores.test.ts` | ✅ pass |
| BR-2 beginner weight table + hard-access cap (no DRIV + BAOT/HIKE → cap 0.30, CLAMPS a would-be-0.40) | H | unit | `cam-464-facet-scores.test.ts` | ✅ pass |
| BR-2/EC-2 drive-up but zero comfort ⇒ low confidence, `answerable:false` | H | unit | `cam-464-facet-scores.test.ts` | ✅ pass |
| BR-3/EC-3 road_access not-drivable → score 0.15, evidence BAOT→HIKE→WALK order | H | unit | `cam-464-facet-scores.test.ts` (2 tests) | ✅ pass |
| BR-4 road_access confidence CAPPED ≤ 0.50 for every input | H | unit | `cam-464-facet-scores.test.ts` (4-fixture loop) | ✅ pass |
| BR-4 answerable gate = confidence >= 0.30 | H | unit | covered inline across family/beginner tests | ✅ pass |
| BR-5 evidence mandatory, non-empty on every emitted score | H | unit | `cam-464-facet-scores.test.ts` (dedicated test) | ✅ pass |
| BR-6/P13 determinism — identical input ⇒ deep-equal; changed field ⇒ changed output | H | unit | `cam-464-facet-scores.test.ts` | ✅ pass |
| BR-7 facet scope (only family/beginner/road_access emitted; photo/pet_detail absent) | M | unit (type-level) | `FacetId` union + `FACET_COMPUTERS satisfies Record<FacetId,…>` compile check | ✅ pass (typecheck) |
| EC-1 zero family source fields ⇒ absent | H | unit | `cam-464-facet-scores.test.ts` | ✅ pass |
| EC-4 essentially-empty listing ⇒ ALL facets absent | H | unit + integ | both test files | ✅ pass |
| EC-6 unpublished/inactive/deleted camp ⇒ no facets field at all (no new visibility path) | H | integ | `cam-464-get-camp-detail-facets.test.ts` | ✅ pass |
| D4 additive `facets` field — pre-existing `ok:true` fields unchanged | H | integ | `cam-464-get-camp-detail-facets.test.ts` (backward-compat test) | ✅ pass |
| D4 zero added DB round-trips (perf/N+1 guard) | M | integ | `cam-464-get-camp-detail-facets.test.ts` | ✅ pass |
| Tool description names facets + sedan-honesty caveat | L | unit | `cam-464-get-camp-detail-facets.test.ts` | ✅ pass |
| CAM-427/CAM-449 regression (existing getCampDetail consumers unaffected) | H | integ (existing suite) | `cam-427-*.test.ts` (6 files), `cam-449-camp-detail-fields.test.ts` | ✅ pass (unchanged, re-run) |

## Rule-table fidelity — independent hand-arithmetic re-derivation (tech.md D3)

Computed expected score/confidence by hand from D3's weight tables BEFORE reading the shipped test
assertions, then compared. All matched exactly:

| Fixture | Hand-derived expected | Code produces | Match |
|---|---|---|---|
| family: TOIL(.25)+SHOW(.20)+DRIV(.25)+kidsWelcome(.15), age null | score 0.85, conf 4/5=0.80 | 0.85 / 0.80 | ✅ |
| family: TOIL+SHOW+DRIV+WATE(4 slots=0.85 raw)+age=15 | raw 0.85 clamped→0.40, conf 4/5=0.80 (limits entry excluded from count) | 0.40 / 0.80 | ✅ — proves the clamp REDUCES a would-be-high score, not just sets 0.40 |
| family: TOIL only, age=9 (neutral) | score 0.25, no clamp/no kidsWelcome | 0.25 | ✅ |
| beginner: DRIV+TOIL+SHOW+ELEC (4/7 slots) | score .35+.10+.10+.10=0.65, conf 4/7=0.57 | 0.65 / 0.57 | ✅ |
| beginner: DRIV only (1/7) | score 0.35, conf 1/7=0.14 <0.30 | 0.35 / 0.14, answerable false | ✅ |
| beginner: TOIL+SHOW+ELEC+POTA (4 slots=.40 raw) + BAOT, no DRIV | raw 0.40 clamped→0.30 | 0.30 | ✅ — proves the cap REDUCES a would-be-0.40, not just sets 0.30 |
| road_access: DRIV present | score 0.70, conf 0.50 (capped), note `vehicle_class_unknown` | 0.70 / 0.50 / note present | ✅ |
| road_access: HIKE+BAOT, no DRIV | score 0.15, conf 0.50, evidence BAOT→HIKE order, no note | 0.15 / 0.50 / order correct / no note | ✅ |

## Gap-fill — 3 tests added this pass (independent QA finding, not a defect)

Hand-deriving the rule tables surfaced an interaction the shipped tests did not cover: when a facet's
**only** fired entry is a `limits`-type evidence push (the age-cap or hard-access-cap branch), the facet
is **NOT** treated as absent — because `evidence.length > 0` (the cap entry IS real evidence), BR-5's
"empty evidence ⇒ absent" rule does not apply. The result is an honestly-produced facet with
`score:0, confidence:0, answerable:false` — distinct from true absence (zero evidence at all). This is
consistent with tech.md D3's literal wording ("AND append… " is unconditional on `minimumAge>=12`/hard-access,
not gated on support-slots firing) and is NOT a defect: `answerable:false` correctly routes the assistant
to "ข้อมูลไม่พอ" either way. But it was untested, so a regression could silently flip it to "absent" (masking
the reason) or to a false `answerable:true` without being caught. Added:

1. `[boundary] family: zero support slots BUT minimumAge>=12 ⇒ NOT absent, score 0/confidence 0/answerable false, evidence=[minimumAge limits]` — **Prove-It**: gated the age-cap append behind `firedSupportSlots>0` (a plausible wrong "fix"), test went **red** (`expected undefined to be defined`), reverted → green.
2. `[boundary] beginner: zero support slots BUT HIKE-only ⇒ NOT absent, score 0/confidence 0/answerable false, evidence=[HIKE limits]` — same class, same reasoning (hard-access cap).
3. `[boundary] road_access: DRIV takes precedence over co-present BAOT/HIKE/WALK` — locks in that `hasDriv` is checked before `otherAccess`, never averaged/mixed. **Prove-It**: mutated `hasDriv` to `codes.has('DRIV') && !codes.has('BAOT')`, test went **red** (`expected 0.15 to be 0.7`), reverted → green.

All 3 gap-fill tests are in `__tests__/cam-464-facet-scores.test.ts` (new suite total: 23, up from 20;
combined with the 6 in the get-camp-detail integration file: **29 total**, up from the dispatched 26).

## Honesty gate (BR-4/BR-5, P13) — verified

- Empty-evidence facets are never emitted with a fake score: confirmed via `EC-1`/`EC-4` tests (family/
  beginner/road_access all return `undefined`/`[]` when no source field fires AND no cap branch fires).
- `answerable:false` correctly gates every low-confidence-but-produced facet (beginner drive-up-only:
  conf 0.14; the 2 new gap-fill zero-slot cases: conf 0.
- Every emitted score's evidence corresponds EXACTLY to the fields that fired — verified by exact
  `toEqual` array assertions (not `toContain`) across all fixtures, so no generic/placeholder evidence
  string could pass undetected.
- road_access confidence NEVER exceeds 0.50 for any input (4-fixture loop test) — the sedan-honesty cap
  is unconditional, matching BR-4.

## Backward-compat (D4) — verified

- `cam-464-get-camp-detail-facets.test.ts`'s dedicated test asserts every pre-existing `ok:true` field
  (`amenities`/`reviews`/`reviewSummary`/`price`/`capacity`/`cancellationPolicy`/`availableWeekendDates`/
  `weekendAvailability`) is still present alongside the new `facets` field.
- Full re-run of the existing CAM-427 (6 files) + CAM-449 (1 file) suites, unmodified: **92/92 pass**,
  confirming zero regression to existing `getCampDetail` consumers.
- `facets` computation adds zero DB round-trips (perf/N+1 guard test: `getCampSiteDailyAvailability` and
  `getEffectiveCapacity` each still called exactly once).

## Coverage

Measured via `npx vitest run --coverage` (real run, 2026-07-24), scoped to this story's files:

| File | Stmts | Branch | Funcs | Lines |
|---|---|---|---|---|
| `lib/facet-scores.ts` | 97.41% | 97.72% | 100% | 97.27% |
| `lib/ai/tools/get-camp-detail.ts` | 94.11% | 57.69% | 85.71% | 95.91% (uncovered lines are pre-existing, unrelated to the CAM-464 diff) |

Combined target suite: **95/95 pass** (26 original + 3 gap-fill CAM-464 tests + 92 CAM-427/449 regression,
minus overlap counted once). `npm run lint` → 0 errors on the touched file. `npm run typecheck` → clean.

## Defects found

None. 0 rule-table divergences, 0 fake-0/false-confidence findings. The 3 gap-fill tests document real
but *correct* (honest) behavior — not defects — and are kept as permanent regression guards.

## Links

`lib/facet-scores.ts` · `lib/ai/tools/get-camp-detail.ts` · `__tests__/cam-464-facet-scores.test.ts` ·
`__tests__/cam-464-get-camp-detail-facets.test.ts` · `story.md` (AC/BR/EC) · `tech.md` (D1–D6, the D3 rule
contract) · `.claude/rules/qa.md`

## Changelog

- v1 (2026-07-24) — created; independent adversarial QA verification pass on PR #548 (branch
  `feature/cam-464-facet-scores`): full target suite green (95/95), typecheck clean, lint 0 errors on
  touched files. Independent hand-arithmetic re-derivation of tech.md D3's weight tables found 0
  divergences. 3 gap-fill tests added (Prove-It confirmed red-then-green) documenting an honest
  zero-score-with-real-evidence edge case + a DRIV-precedence lock-in. No defects found.
