---
artifact: story
feature: ai-assistant
epic: assistant-answers-real-camper-asks-gap-closure-w1 (CAM-456)
story: CAM-475 — populate the 40-case golden eval fixture from the real corpus
status: Build (QA — fixture + ceiling-lift authored, cross-story test collision found)
version: v1
updated: 2026-07-24
---

<!-- Dev-facing tooling story (capstone of the wave-1 eval track): no user-facing UI, so AC "Then" describes fixture/test output in plain language. Thai appears only INSIDE golden-case utterances (tool input data), never as screen copy. -->

## Story
As a **CampVibe maintainer**, I want the CAM-457 eval harness's golden-case fixture populated with the real 40-case corpus from `docs/research/ai-chat/campvibe-conversation-to-booking-research.md` §5, so that the harness's ≥95% tool-call-correctness gate is measured against the actual research-defined eval set instead of the original 8 smoke cases — closing the gap CAM-457's own Out-of-scope section named ("Authoring the 40 case CONTENTS ... arrives via the owner-imported corpus").
Why: CAM-457 shipped the harness FORMAT + runner only (its corpus dependency wasn't in the repo yet); the corpus has since landed. This story is DATA + a ceiling-lift only — no prompt/tool/model production code changes.
Scope: `scripts/ai-eval/golden-cases.json` (append the 40 corpus cases to the 8 existing smoke cases) + `__tests__/cam-457-eval-harness.test.ts` (raise its hard-coded fixture-size ceiling to match) + this story's own docs. NO new tool, NO schema, NO prompt/runner-logic change. The real-model baseline run itself is owner-gated (cost) and explicitly OUT of this story (see Self-verify).
Depends on: CAM-457 (eval harness + `GoldenCase` schema/loader/scorer, merged) · `docs/research/ai-chat/campvibe-conversation-to-booking-research.md` §3 (tool contract) §5 (the 40 cases) · CAM-459 (zone policy — this story's zone tags follow its A/B/C definitions)

## AC
| # | Given | When | Then (dev-facing fixture/test output, plain language) | System effect | Neg/edge |
|---|---|---|---|---|---|
| AC-1 | The 40 research §5 cases + the 9 whose capability isn't built yet | The fixture is loaded via `loadCasesFromFile` | Every one of the 48 total cases (8 smoke + 40 corpus) parses with zero load errors | `golden-cases.json` conforms to the `GoldenCase` zod schema for every entry | EC-1 |
| AC-2 | A corpus case whose capability IS built (31 of 40) | The fixture is inspected | The case's `expected.tool` (when `kind:"tool"`) names one of the real registered tools in `lib/ai/tools/index.ts` | Tool-call-correctness scoring in a future real run is meaningful, not fabricated | EC-2 |
| AC-3 | A corpus case whose capability is NOT built (setWatch, getUserContext, planTrip, getPriceHistory, checkPitchAdjacency, P16 flow-resume — 9 of 40) | The fixture is inspected | The case carries `group:"deferred"` and documents which unbuilt capability it targets | Excluded from the pass-threshold by convention (see EC-2 note); never silently faked as a real tool | — |
| AC-4 | The fixture size grew from 8 to 48 | `__tests__/cam-457-eval-harness.test.ts` runs | The harness's own fixture-size assertion is raised to the real count (48) and bounded by `DEFAULT_MAX_EVAL_CASES` (500); every other CAM-457 assertion (zero load errors, ≥1 zone-A no_tool case, ≥1 guardrail case) still passes | `npx vitest run __tests__/cam-457-eval-harness.test.ts` → 50/50 pass | EC-3 |
| AC-5 | This story ships | No real-model call is made | `npm test` never spends against OpenRouter; the fixture is validated purely structurally (loader + schema) | Zero spend; the real baseline run stays owner-gated | — |

## Rules
- BR-1 Every case maps 1:1 to one of the corpus's 40 §5 entries (or the 8 pre-existing smoke cases); no corpus case is dropped, silently merged, or invented.
- BR-2 A case is tagged `group:"deferred"` ONLY when no real registered tool (`lib/ai/tools/index.ts`) can plausibly answer it even approximately — not merely because the research doc named an aspirational tool. Where a real tool DOES cover the intent even partially (e.g. `getCampDetail`'s generic facet/review fields for a facet the structured scorer doesn't compute), the case is mapped to that real tool and kept live, not deferred (BR-2 self-audit, see test.md rationale table).
- BR-3 `params` on a live case asserts only key/value pairs derivable with confidence from the utterance or a directly-authored prior turn (province/keyword/sort/criteria/boolean filters); a value that depends on runtime context resolution the harness doesn't wire in (e.g. a UUID resolved from `<shown_results>` state) is left OUT of `params` (`strictParams` stays false/default — a subset match on zero keys still asserts the correct TOOL was dispatched).
- BR-4 The CAM-457 harness's own ceiling assertion (`cam-457-eval-harness.test.ts`) is the ONLY runner-adjacent file this story edits, and only its fixture-size number/comment — no scoring/runner logic changes.

## Edge cases
- EC-1 IF any of the 48 entries fails `goldenCaseSchema.safeParse` THEN `loadCasesFromFile` records a named load error and the fixture ships red — this story's Done bar requires zero load errors.
- EC-2 IF a corpus case's ideal behavior spans MULTIPLE tool calls (e.g. `resolveDates` → `bulkAvailability`) THEN this fixture asserts only the ONE tool that most directly answers the camper's question (scoreCase only needs one matching dispatched call) — documented per-case in test.md, not a gap.
- EC-3 IF a sibling story's OWN test file also hard-codes an assumption about `golden-cases.json`'s size (found: `__tests__/cam-459-answer-policy-3-zones.test.ts` asserts `cases.length <= 8`, outside this story's allowed file surface) THEN this story does NOT edit that file (STOP RULE — never touch a file outside the stated surface); it is reported back to the orchestrator as a fast-follow, not silently fixed or silently left red.

## Data
- No schema/DB change; no migration (`migration: none`). Test data only: `scripts/ai-eval/golden-cases.json` grows from 8 to 48 entries.

## Seams & refs
- Reuse: `scripts/ai-eval/case-schema.ts` (`GoldenCase` zod schema, unchanged) · `scripts/ai-eval/load-cases.ts` (loader, unchanged) · `scripts/ai-eval/score.ts` (scorer, unchanged — subset-match semantics relied on for context-dependent params). Source: `docs/research/ai-chat/campvibe-conversation-to-booking-research.md` §3 (tool contract) + §5 (40 cases) · `lib/ai/tools/index.ts` (the real registered-tool ground truth) · `docs/specs/.../CAM-459-.../story.md` (zone A/B/C definitions).
- NO production code change (`lib/**`, `app/**` untouched) — this story is fixture data + one test-ceiling edit only.

## Out of scope
- Running the real-model baseline (AC-7 of CAM-457) — owner-gated (cost); this story ships the FIXTURE, not baseline numbers.
- Building any of the 9 deferred capabilities (setWatch/watchers, getUserContext/preferences/episodic memory, trip planning, price-history aggregate, pitch-adjacency filter, P16 flow-suspend/resume) — each is its own future story per the research doc's §6 rollout order.
- Fixing `__tests__/cam-459-answer-policy-3-zones.test.ts`'s stale `<=8` ceiling assertion — outside this story's file surface; reported as a fast-follow (EC-3).

## Self-verify
- AC-1..AC-4 → `npx tsx` loader script (0 load errors, 48 cases) + `npx vitest run __tests__/cam-457-eval-harness.test.ts` (50/50 pass) + a grep-verify of every non-deferred `expected.tool` against `lib/ai/tools/index.ts`.
- AC-5 → no `OPENROUTER_API_KEY` used/read in this story's diff; `npm test` run confirms zero network dependency for these tests.
- Gate = `npm run lint` (0 errors) · `npm run typecheck` (clean) · `npm test` (green except the pre-existing out-of-surface EC-3 collision, reported) · Done = fixture validated on localhost before merge; the real baseline is a separate owner-gated follow-up.

## Changelog
- v1 (2026-07-24) — created; 40 corpus cases mapped (31 live + 9 deferred), CAM-457 ceiling raised 8→48, cross-story test collision with CAM-459 found and reported (not fixed, outside surface).
