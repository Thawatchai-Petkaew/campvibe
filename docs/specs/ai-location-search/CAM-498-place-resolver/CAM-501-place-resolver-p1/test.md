---
linear: CAM-501
feature: ai-location-search
epic: CAM-498
persona: Camper
artifact: test
owner: qa-engineer
status: blocked
version: v1
updated: 2026-07-25
---
# Test — P1 Place Resolver: deterministic province/region parse + mandatory hint + honest scope (CAM-501)

## AC→test matrix
| AC | risk (H/M/L) | type (unit/integ/e2e) | test file | status |
|---|---|---|---|---|
| AC-1 (province search never dropped) | H | unit | `__tests__/cam-501-place-resolver.test.ts` (`resolvePlace` province cases) + `scripts/ai-eval/golden-cases.json` `SMOKE-B4-CAM501-PLACE-PROVINCE` | pass (unit) / defect found (adversarial free-text) |
| AC-2 (region search, no invented province) | H | unit | `__tests__/cam-501-place-resolver.test.ts` (region cases) + golden `SMOKE-B5-CAM501-PLACE-REGION` | pass |
| AC-3 (honest scope, no hallucinated place) | H | unit (prompt text) | reasoned against `lib/ai/openrouter-client.ts` diff (BR-3 line); no behavioral/LLM run (cost-gated, orchestrator step) | pass (wording verified) |
| AC-4 (terrain word alone -> no province/region) | M | unit | `__tests__/cam-501-place-resolver.test.ts` (`AC-4` describe block) | pass |
| EC-2 (region alias false-match guard) | H | unit | `__tests__/cam-501-place-resolver.test.ts` (existing EC-2 block: NORTHEAST-substring-of-NORTH/EAST) + **new DEFECT block** (ordinary-vocabulary false match) | **FAIL — defect (see below)** |
| EC-3 (province wins over region) | M | unit | `__tests__/cam-501-place-resolver.test.ts` | pass |
| two-ceilings (cam-457 + cam-459 golden count) | M | unit | `__tests__/cam-457-eval-harness.test.ts:285`, `__tests__/cam-459-answer-policy-3-zones.test.ts:115` — both assert `56`, matches real `golden-cases.json` length | pass |

## Validation cases

**BR-1 resolver — happy:** Thai province ("เชียงใหม่"→"Chiang Mai"), English province (case-insensitive, word-boundary guarded), 6 regions + aliases (อีสาน/เหนือ/ใต้/ตะวันออก/ตะวันตก/กลาง), formal Northeast form. **boundary:** province+region both present → province wins (EC-3); empty string → `{}`, never throws. **error/false-positive (DEFECT, red):** ordinary Thai vocabulary containing a region/province name as a substring — "ใต้ต้นไม้" (under a tree), "กลางคืน"/"กลางแจ้ง" (nighttime/open-air — a camping term!), "เหนือกว่า" (better-than), "เยอะเลย"/"ดีเลย" (common emphasis particle "เลย", collides with Loei province), "ตากแดด"/"ตากผ้า" (sunbathe/dry-laundry, collides with Tak province) — all currently **false-positive resolve** to a region/province that was never named. 8 new tests added, all RED against current `lib/ai/place-resolver.ts`.

**BR-2 hint wiring:** traced `buildSystemPrompt(now, ctx, shownResults, placeHint)` call sites — `runAssistantTurn`, `runAssistantTurnFromMessages`, `runAssistantTurnFromMessagesStreaming` all thread `resolvePlace(...)` on the LATEST user-turn text only; `placeHintBlock` is `null` (byte-identical prompt) when no place resolved. Interpolated value is always one of the 77-province/6-region canonical set, never raw user text — confirmed safe against prompt injection via the hint itself. Not independently unit-tested by this QA pass beyond reading the diff (existing `cam-416-agent-loop` suite green, no regression).

**BR-3 honest scope:** system-prompt line reviewed verbatim — instructs the model to state ONLY the filter actually applied this turn, and to say plainly when a named place returned 0 results rather than mislabeling unfiltered results. Thai wording matches AC-1's verbatim string pattern; no em-dash used.

## Coverage
`npx vitest run __tests__/cam-501-place-resolver.test.ts` (with QA's added defect block): 25 pass / 7 pre-existing-style pass / **8 new FAIL (expected — proves the defect is real, Prove-It red state)**. Coverage %: not measured (vitest run in this repo does not have `--coverage` wired for a single-file targeted run in this pass; existing suite coverage baseline unchanged, no new coverage tooling gap introduced by QA — QA added tests only, no production code).

## Links
`story.md` (AC/BR) · `.claude/rules/qa.md` · defect: see QA return `defects[0]` (CAM-501 sub-ticket, opened by orchestrator)

## Changelog
- v1 (2026-07-25) — created; QA verify pass found a real EC-2 false-match defect (free-text substring scan against ordinary Thai vocabulary/short province names); added 8 red regression tests as the Prove-It guard for the fix.
