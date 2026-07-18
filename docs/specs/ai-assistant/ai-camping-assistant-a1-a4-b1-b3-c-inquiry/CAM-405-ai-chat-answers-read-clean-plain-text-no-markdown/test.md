---
linear: CAM-405
feature: ai-assistant
epic: ai-camping-assistant-a1-a4-b1-b3-c-inquiry (CAM-266)
persona: camper
artifact: test
owner: qa-engineer
status: In Progress
version: v1
updated: 2026-07-18
---
# Test — AI chat answers read clean plain text, no markdown (CAM-405)

## AC→test matrix
| AC | risk (H/M/L) | type (unit/integ/e2e) | test file | status |
|---|---|---|---|---|
| AC-1 | M | unit | `__tests__/cam-270-openrouter-client.test.ts` | ✅ |
| AC-2 | M | unit | `__tests__/cam-270-openrouter-client.test.ts` | ✅ |
| AC-3 | L | unit | `__tests__/cam-270-openrouter-client.test.ts` | ✅ |
| AC-4 | H | unit | `__tests__/cam-270-openrouter-client.test.ts` | ✅ |

## Validation cases
- BR-1/BR-2/BR-3: asserted via regex on the built `SYSTEM_PROMPT` string (plain-text-only, never-enumerate, 2-3 sentence guidance) — no Thai copy to assert (prompt-only story, no UI change; `Then` column is `—` per story.md note).
- BR-4 (regression guard): exact-once occurrence count of the pre-existing delimiter/injection-defense sentence — proven to go red both when the sentence is dropped (0) and when duplicated (2).

## Coverage
Not measured via `--coverage` this pass (spec-lite, single-file prompt-string diff, no branch logic added — 4 new assertions on an existing string constant, all new lines exercised by the 4 new tests). All 18 tests in the touched file pass; 0 pre-existing tests modified or weakened.

## Prove-It (red→green)
Reverted `lib/ai/openrouter-client.ts` to the pre-fix (`origin/dev`) prompt and re-ran the 4 new tests: AC-1/2/3 failed red (missing style-rule strings); AC-4 passed (sentence still present once, as expected — it's a regression guard, not a new-behavior test). Separately duplicated the delimiter sentence in the prompt: AC-4 failed red (`expected 2 to be 1`). Restored the real diff: all 18 tests green, `git status` clean (no residual edits), `npm run typecheck` clean.

## Links
`story.md` (AC/BR) · `.claude/rules/qa.md`

## Changelog
- v1 (2026-07-18) — QA verify note: diff-surface confirmed prompt-only (3 files, pure additions, no removed lines); red→green proven for AC-1..4; typecheck clean.
