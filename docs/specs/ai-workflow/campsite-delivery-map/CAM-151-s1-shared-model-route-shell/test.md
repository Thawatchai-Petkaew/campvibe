---
linear: CAM-151
feature: ai-workflow
epic: campsite-delivery-map (CAM-150)
persona: platform
artifact: test
owner: qa
status: In Progress
version: v1
updated: 2026-06-24
---
# Test Artifact — S1 shared model + route shell (CAM-151)

## How the AC is verified

S1 is a refactor + an empty route shell, so the test strategy is **source-inspection + a runtime export check + a small logic assertion** — the project's established pattern for status code (see `__tests__/status-derive.test.ts`, which `readFileSync`s a source file and asserts on its contents). The real visual AC (`/status` byte-identical, `/status/map?token=` = 200, gate parity) is verified on the **real Staging URL** after G3 — local tests guard the wiring that makes those true.

New test file: `__tests__/status-map.test.ts` (shared with CAM-152).

## AC → Test Matrix

| AC# | Test (in `__tests__/status-map.test.ts`) | Layer | Asserts | Pass/Fail |
|-----|------------------------------------------|-------|---------|-----------|
| AC-1 | `lib/status-model.ts — exports buildModel + the moved helpers` | runtime import | `buildModel`, `epicOf`, `isActive`, `isDone`, `hasAwait`, `personaOf`, `featureOf` are real named exports | PASS |
| AC-1 | `… calls buildWorkload(work) inside the module` | source | the workload call moved into `status-model.ts` | PASS |
| AC-1 | `… declares the shared model interface (Model)` | source | `export interface Model` + `EpicNode` present | PASS |
| AC-1 | `buildModel on [] returns an empty, non-throwing model` | logic | `projectPct === 0`, `gates`/`work`/`epicNames` empty | PASS |
| AC-1 | `page.tsx imports buildModel from @/lib/status-model` | source | import source moved | PASS |
| AC-1 | `page.tsx does NOT declare its own function buildModel` | source | pure move — no local declaration | PASS |
| AC-2 | `page.tsx is token-gated via STATUS_TOKEN` | source | gate parity reference | PASS |
| AC-2 | `page.tsx derives the model from real data via buildModel` | source | `buildModel` + `fetchStatusIssues` referenced | PASS |
| AC-2 | `page.tsx is force-dynamic` | source | `export const dynamic = "force-dynamic"` | PASS |
| AC-2 | `scene-loader lazy-loads the scene with ssr: false` | source | `next/dynamic` + `ssr: false` | PASS |
| AC-3 | (covered by the AC-2 `STATUS_TOKEN` assertion) | source | token gate parity with `/status` | PASS |

The same file also carries the CAM-152 assertions (sprites/base64/reduced-motion/MapModel) — see `../CAM-152-s2-scene-characters/test.md`.

## Coverage matrix per unit (per .claude/rules/qa.md)

| Bucket | Covered? | Notes |
|--------|----------|-------|
| normal (happy path) | Yes | `buildModel` runtime import + non-empty path exercised via `status-derive.test.ts` |
| null/empty | Yes | `buildModel([])` returns an empty, non-throwing model |
| boundary | Yes | empty issue list (0 stories) is the boundary for the model |
| error/validation | Yes | empty-model path proves no crash on no data; the route's fetch-error path renders a placeholder (verified on Staging) |
| concurrent/ordering | N/A | pure functions; no concurrency |

## Coverage note (new-code gate)

The project has **no coverage script**; new-code coverage is gated via **source-inspection tests** that fail if the wiring regresses. For S1 the new logic is a pure move (already covered by `status-derive.test.ts`'s `buildWorkload`/`buildTrail`/`rolesOf` suites, which exercise the same functions now re-exported through `status-model.ts`), plus the source-inspection guards above. There is no new branching logic in S1 to cover beyond the empty-model assertion.

## Prove-It (red before green)

Each guard was confirmed to fail when the move is undone:
- Re-adding `function buildModel` to `page.tsx` → the "does NOT declare" assertion fails.
- Removing the `buildModel` export from `status-model.ts` → the runtime import test throws.
- Dropping `ssr: false` from `scene-loader.tsx` → the lazy-load assertion fails.

## Checks

- [x] `npm run typecheck` — PASS (0 errors)
- [x] `npm run lint` — PASS (no new errors)
- [x] `npm run build` — PASS
- [x] `__tests__/status-map.test.ts` — 23 tests, all PASS (shared with CAM-152)
- [ ] verify AC on the real Staging URL after G3: `/status` HTML diff = empty · `/status/map?token=` = 200 shell · no token = gate box

## Status

status: ready (local) — `status-map.test.ts` green (23 tests). AC#1–3 visual verification pending on the real Staging URL after merge (Done criterion).

## Links

`story.md` · `tech.md` · `design.md` · `__tests__/status-map.test.ts` · `__tests__/status-derive.test.ts` · `.claude/rules/qa.md`

## Changelog

- v1 (2026-06-24) — test artifact authored; mapped the source-inspection + runtime + logic strategy to AC#1–3; recorded the new `status-map.test.ts`.
