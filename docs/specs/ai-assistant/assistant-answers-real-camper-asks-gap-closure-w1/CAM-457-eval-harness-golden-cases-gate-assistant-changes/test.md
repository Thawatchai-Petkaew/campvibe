---
linear: CAM-457
feature: ai-assistant
epic: assistant-answers-real-camper-asks-gap-closure-w1 (CAM-456)
persona: CampVibe maintainer (dev-facing tooling — no Admin/Camper/Host)
artifact: test
owner: qa-engineer
status: Independent QA verify complete — 50/50 green, 0 defects found
version: v2
updated: 2026-07-21
---
# Test — Eval harness golden suite (CAM-457)

> Independent QA verify (house pattern): re-derived the AC/EC matrix from `story.md` BEFORE
> reading the existing 36 tests, diffed against them, ran a pinned-test audit + an adversarial
> pass, and added 14 gap-fill tests (same branch, same file:
> `__tests__/cam-457-eval-harness.test.ts`). Final: **50/50 tests pass**. No production-code
> defect found — `scripts/ai-eval/**` implements the spec correctly on every AC/BR/EC audited.

## AC→test matrix

| AC | risk (H/M/L) | type (unit/integ/e2e) | test file | status |
|---|---|---|---|---|
| AC-1 (file+key → prints table, writes report, no prod path touched) | M | unit | `report.ts` render tests + **NEW** `writeReports` file-I/O tests + `plan-run` action=run test | ✅ |
| AC-2 (zone B/C tool+params match) | H | unit | `score.ts` BR-2 tests + `replay-case.ts` AC-2 seam test | ✅ |
| AC-3 (zone A no-tool; pass only if no dispatch) | H | unit | `score.ts` zone-A tests + `replay-case.ts` AC-3 seam test | ✅ |
| AC-4 (guardrail fail flips verdict at ≥95% tool-call) | H | unit | `score.ts` guardrail-flip test (19 pass + 1 guardrail-fail, ≥95% but REPORTING) + **NEW** errored-guardrail interaction test | ✅ |
| AC-5 (key unset → loud self-skip, zero network, exit 0) | H | unit + **real command** | `guards`/`plan-run`/`global-setup` tests + `env -u OPENROUTER_API_KEY npm run ai:eval` (real run, see Commands) | ✅ |
| AC-6 (below-threshold → advisory, never blocks) | M | unit + config inspection | `score.ts` below-threshold REPORTING test + `.github/workflows/ai-eval.yml` (`workflow_dispatch` only, `continue-on-error: true`, non-required) | ✅ |
| AC-7 (first baseline run → reference report) | — | owner-verify (real spend) | Explicitly out of automatable scope per `story.md` Self-verify ("the REAL-model baseline run is an OWNER-VERIFY step"); harness logic proven at zero spend | N/A (by spec) |

## Rules/Edge-cases → test matrix

| BR/EC | risk | test file | status |
|---|---|---|---|
| BR-1 (typed record; malformed → load error, never crash) | H | `load-cases.ts` tests + **NEW** duplicate-id / empty-array / empty-file / invalid-`kind` tests | ✅ |
| BR-2 (subset match default; `strictParams` exact) | H | `score.ts` BR-2 tests + **NEW** nested-object `deepEqual` tests (match/mismatch/type-mismatch/null) | ✅ |
| BR-3 (≥95% tool-call, guardrail=100%, zone-A counts inside) | H | `score.ts` verdict tests | ✅ |
| BR-4 (mocked `dispatchTool` seam, zero DB, CAM-416 idiom) | H | `replay-case.ts` tests (vi.mock idiom, real fetch stubbed) | ✅ |
| BR-5 (self-skip, named var, zero spend) | H | `guards`/`plan-run`/`global-setup` tests + **real** `env -u OPENROUTER_API_KEY npm run ai:eval` | ✅ |
| BR-6 (CI advisory, non-required, report-mode) | M | `ai-eval.yml` inspection (own workflow file, `workflow_dispatch` only — never push/PR — `continue-on-error: true`) + `score.ts` below-threshold test | ✅ |
| BR-7 (MAX_EVAL_CASES cap before loop, CAM-344) | H | `guards` boundary tests (exactly 500 vs 501) + `plan-run` refuse test + **real** `OPENROUTER_API_KEY=fake MAX_EVAL_CASES=1 npm run ai:eval` (refuses, exit 1, zero fetch) | ✅ |
| BR-8 (model pinned via `OPENROUTER_MODEL`, no `temperature`) | M | `replay-case.ts` BR-8 test (no `temperature` key in outgoing body) + report header carries `model` | ✅ (see Gaps: `resolveModelForReport()` itself untested — trivial, in `run.eval.ts`) |
| EC-1 (malformed entry → named load error, batch continues) | H | `load-cases.ts` tests + **NEW** invalid-`kind` test | ✅ |
| EC-2 (wrong/no tool on B/C → fail, actual-vs-expected recorded) | H | `score.ts` BR-2 tests | ✅ |
| EC-3 (model error → ERROR bucket, kept in denominator, distinct from fail) | H | `score.ts` EC-3 test + **NEW** errored-guardrail test + `replay-case.ts` EC-3 test | ✅ |
| EC-4 (key unset → never a silent green) | H | `global-setup` pinned test (banner reaches raw `console.log`, the exact defect fixed at HEAD `a5f77cd`) + **real** run | ✅ |
| EC-5 (below-threshold stays advisory) | M | `score.ts` below-threshold test + `ai-eval.yml` `continue-on-error` | ✅ |
| EC-6 (tool leak on zone-A → fail, leaked name recorded) | H | `score.ts` test (`reason` contains the literal leaked tool name) | ✅ |

## Pinned-test audit (dispatch step 2 — real behavior, not tautologies)

1. **Loud-skip test** (`global-setup` describe) — asserts `logSpy.mock.calls[0][0]).toContain(API_KEY_ENV_VAR)`: the literal string `OPENROUTER_API_KEY` in the CAPTURED console output, not just a truthy check. Confirmed real via the actual `a5f77cd` fix history (banner previously swallowed by the default reporter).
2. **Guardrail-flip test** — uses exactly a ≥95%-tool-correct-but-guardrail-fail scenario: 19/19 non-guardrail pass (100% ≥ 95%) + 1 guardrail fail → `guardrailPassPct < 1.0` → verdict `REPORTING`. Not a trivial all-fail scenario; it isolates the AC-4 interaction.
3. **Zone-A leak test** — asserts `result.reason).toContain('searchCampsites')`, the actual leaked tool name, not just `result === 'fail'`.
4. **ERROR bucket test** — asserts `counts.error===1`, `counts.total===1` (kept in the denominator), `toolCallCorrectnessPct===0` (not counted as pass) — distinct bucket, never silently dropped.
5. **Subset vs strictParams, both directions** — subset: extra param tolerated → pass; strict: extra param → fail, exact → pass. Both directions asserted in the same test.

All 5 confirmed to pin real behavior, not tautologies, by direct code reading (assertions target literal values/strings, not just truthiness).

## Adversarial pass (dispatch step 3) — gaps found + fixed (same branch)

Re-deriving the matrix from the AC/EC before reading the 36 existing tests surfaced these untested paths (all closed with new tests, all Prove-It'd red→green where the underlying logic could plausibly regress):

| # | Gap | Fix | Prove-It |
|---|---|---|---|
| 1 | `writeReports` never actually asserted to write files to disk (AC-1) | 2 new tests: writes `baseline-report.json`+`.md` w/ matching numbers; creates a nested dir that doesn't exist | Injected: dropped the `.md` write → both tests went red (`ENOENT`); restored → green |
| 2 | `deepEqual`'s recursive object-comparison branch (score.ts:35-43) never exercised — all existing param tests were flat primitives | 5 new tests: nested-object match, nested-object mismatch, type mismatch, null-vs-object, primitive value mismatch | Injected: `return true` instead of recursing → nested-mismatch test went red; restored → green |
| 3 | ERRORED guardrail case's effect on verdict untested (only guardrail-FAIL was tested, not guardrail-ERROR) | 1 new test: an `errorResult` on a `guardrail:true` case flips verdict to REPORTING | Injected: dropped `guardrailPassPct` from the verdict condition → test went red; restored → green |
| 4 | Duplicate case ids — no test proved the loader doesn't crash/dedupe silently | 1 new test: both duplicates load, no error | Structural (BR-1 doesn't enforce uniqueness by design; verified via code read, not a defect) |
| 5 | Empty-array fixture (valid, 0 cases) and a genuinely empty (0-byte) FILE — only a *nonexistent*-path case was tested, not a real empty file | 2 new tests | Structural — `loadCasesFromFile`'s try/catch already correctly buckets both |
| 6 | Invalid `expected.kind` discriminant value (e.g. `"bogus"`) not explicitly tested | 1 new test — confirms zod's discriminated union rejects it as a named load error | Structural — zod's own discriminatedUnion mechanism, already proven generally |
| 7 | Multiple dispatched tool calls in one case (model calls 2 tools) — scorer's `.find()` never exercised with >1 entry | 1 new test — correct match found regardless of order | Structural |
| 8 | `computeRollup([])` boundary never asserted | 1 new test — documents the vacuous PASS at 0/0 (Info-severity note below, not a defect) | Structural |

**Info-severity note (not a defect, not filed as a sub-ticket):** `computeRollup([])` returns verdict `PASS` (vacuously, `0/0 → 1 ≥ threshold`). This can only occur if the golden-case fixture itself resolves to zero cases (an already-guarded, separately-reported `load_error` scenario) — the shipped fixture always ships ≥6 cases (asserted by an existing test). Documented for future-maintainer awareness; does not violate any AC.

No BR/AC/EC-level code defect was found in `scripts/ai-eval/**` — every audited rule matched its implementation.

## Coverage

Measured for real via `npx vitest run __tests__/cam-457-eval-harness.test.ts --coverage --coverage.include='scripts/ai-eval/**'`:

| Scope | Stmts | Branch | Funcs | **Lines** |
|---|---|---|---|---|
| `scripts/ai-eval/**` (all 9 files, incl. `run.eval.ts`) | 77.61% | 83.65% | 84.61% | **76.96%** (137/178) |
| Excluding `run.eval.ts` | 99.36% | 94.56% | 100% | **100%** (137/137) |

`run.eval.ts` (0/44 lines) is the **REAL-model entrypoint**, deliberately excluded from `npm test`'s zero-spend gate by file-extension design (`*.eval.ts`, per `tech.md` §4 decision 4 — confirmed structurally: it never appears in the 253-file/7868-test `npm test` run). `story.md`'s own Self-verify section names the real-model baseline run an **owner-verify step**, not a zero-spend unit-test target. Every function `run.eval.ts` calls (`planEvalRun`, `replayCase`, `scoreCase`, `errorResult`, `computeRollup`, `writeReports`) is separately covered at 100%/99.36%. Its orchestration loop was additionally proven correct via 2 **real** end-to-end command runs (see below) — both matched the coded behavior exactly.

**Real number, honestly reported:** 76.96% lines overall / **100% lines on the testable-at-zero-spend surface**. This falls short of the blanket "≥80% new code" gate only because of the by-design real-model entrypoint exclusion; recommend the orchestrator accept this as satisfying the coverage gate given the documented, spec-ratified reason (not a QA shortcut).

## Commands run (real, this session)

```
npx vitest run __tests__/cam-457-eval-harness.test.ts                     → 50/50 pass
npx vitest run __tests__/cam-457-eval-harness.test.ts --coverage \
  --coverage.include='scripts/ai-eval/**'                                 → see Coverage table
npm run lint                                                              → 0 errors, 0 new warnings
npx tsc --noEmit                                                          → clean
npm test                                                                  → 253 files / 7868 tests pass (0 failures)
env -u OPENROUTER_API_KEY npm run ai:eval                                 → self-skip, named var, exit 0
OPENROUTER_API_KEY=sk-or-fake-verify MAX_EVAL_CASES=1 npm run ai:eval     → refuses (7 cases > cap), zero fetch, exit 1
```

## Links

`story.md` (AC-1..AC-7, BR-1..BR-8, EC-1..EC-6) · `tech.md` (6 G2 decisions) · `.claude/rules/qa.md` ·
`__tests__/cam-457-eval-harness.test.ts` (50 tests) · `.github/workflows/ai-eval.yml`

## Changelog
- v1 (2026-07-21) — backend-engineer's original 36-test suite (pre-existing at HEAD `a5f77cd`).
- v2 (2026-07-21) — independent QA verify: re-derived matrix, pinned-test audit, adversarial pass, +14 gap-fill tests (50/50 green), real coverage measured, 2 real end-to-end command proofs (self-skip + over-cap refuse). No production defect found.
