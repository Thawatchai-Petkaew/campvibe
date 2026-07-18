---
linear: CAM-416
feature: ai-assistant
epic: ai-chat-foundation-adr-013
persona: Platform
artifact: test
owner: qa-engineer
status: Green — 7/7 termination+spend invariants proven, no defect found, ready for security
version: v1
updated: 2026-07-19
---
# Test — CAM-416 Agent loop cap 4, forced final, tool cap 6, 45s deadline (CAM-416)

> Independent adversarial QA verify (fresh-context) of the ADR-013 D4 bounded agent loop's
> TERMINATION + SPEND invariants — the money-control module. All model calls mocked (`vi.stubGlobal`
> on `fetch`); zero real spend, no real OpenRouter call was ever made in this pass. Attacks the loop
> from 7 angles the existing build-time suite (`cam-416-agent-loop.test.ts`, backend-authored) left
> open, and Prove-It's the two hard caps by temporarily weakening them in source (reverted, `git diff`
> clean) to confirm the guard tests actually go red.

## AC→test matrix

| AC | risk (H/M/L) | type | test file | status |
|---|---|---|---|---|
| AC-1: no `tool_calls` → exactly 1 completion, unaffected by the loop | M | unit | `cam-416-agent-loop.test.ts` (existing) | pass |
| AC-2: 2-3 tool rounds then natural stop, never reaches the cap | H | unit | `cam-416-agent-loop.test.ts` (existing) + `cam-270-openrouter-client.test.ts` (superseded EC-2 pin) | pass |
| AC-3: iteration 4 forced (`tool_choice:'none'`); any tool_calls it still returns are ignored, never a 5th call | H | unit + boundary | `cam-416-agent-loop.test.ts` (existing) + **new** adversarial (a) torture case (max tool_calls every round through the cap) + (b) null-content forced-final edge | pass |
| AC-4: turn tool cap 6 bounds the SUM across rounds, on top of the unchanged per-round cap 3 | H | security/boundary | `cam-416-agent-loop.test.ts` (existing, 3+3+2 case) + **new** adversarial (c) EXACT boundary (3+3 then precisely a 7th) | pass |
| AC-5: 45s wall-clock deadline, checked before every completion after the first; content-bearing vs zero-content recovery | H | error/validation | `cam-416-agent-loop.test.ts` (existing, breach before iteration 2, both content states) + **new** adversarial (d) breach generalized to before iteration 3 (after 2 successful rounds — not special-cased to iteration 2) | pass |
| AC-6: fallback runs ONLY on the turn's first completion; the answering model is pinned for the rest of the turn | H | normal | `cam-416-agent-loop.test.ts` (existing, 2-iteration case) + **new** adversarial (e) pin holds across a 3-iteration turn — every subsequent call asserted, primary never re-attempted | pass |
| AC-7: `POST /api/ai/chat` wire contract byte-identical; `maxDuration=60` route config only | M | unit + integration | `cam-271-ai-chat-route.test.ts` / `cam-272-ai-chat-contract-reconciliation.test.ts` (existing, untouched, still green) + **new** direct assertion `route.maxDuration === 60` (previously untested — BR-7 had zero direct coverage) | pass |
| BR-6: suggestions extracted ONLY from the FINAL completion | H | security | **new** adversarial (f) — a mid-loop completion smuggling its own `<suggestions>` block (alongside `tool_calls`) never leaks into the returned `suggestions` or `answer` | pass |
| D7 seam: single final-assembly point (streaming precondition) | M | architecture (source inspection) | **new** adversarial (g) — `extractSuggestions` defined once, called from exactly 1 place; `finalizeAnswer` called from exactly the 2 loop-exit branches | pass |
| Malformed model output (not a numbered AC — a hostile-input case implied by "any scripted model behavior") | H | error/validation | **new** adversarial (a) — schema-invalid `tool_calls` shape on the first completion (both primary+fallback) and mid-turn (post-pin) both end the turn safely, never a raw parse exception, never an extra retry loop | pass |

## Validation cases

### (a) Termination cap holds under hostile model behavior

- error/validation: schema-invalid `tool_calls` (missing `type`/`function`) on the turn's first completion — treated as a call failure, goes through the SAME one-shot fallback dance as a network failure (2 fetch calls total), never a bespoke retry loop, never a raw exception — `{ok:false, error:'assistant_unavailable'}`.
- error/validation: well-formed round 1, schema-invalid round 2 (post-pin, no fallback dance available) — loop stops AT iteration 2, never attempts iteration 3/4.
- boundary/security: **torture case** — 3 tool_calls requested EVERY round (max per-round AND cumulative-turn stress simultaneously) through the iteration cap, with the forced-final iteration itself hostilely still requesting tools. `fetch` never exceeds `MAX_AGENT_ITERATIONS` (4); `dispatchTool` never exceeds `MAX_TOOL_CALLS_PER_TURN` (6, computed as 3+3+0+0-ignored); forced-final's own tool_calls are ignored.

### (b) Forced-final null-content edge

- boundary: iteration 4 (forced final) returns `content:null` alongside tool_calls — the turn still terminates with `{ok:true, answer:'', cards:[]}`, no throw, no `undefined` leak into the response.

### (c) Per-turn cap exact boundary (off-by-one guard)

- boundary: round 1 executes 3, round 2 executes 3 (turn budget of 6 fully spent), round 3 requests **exactly one more call (the literal 7th)** — `executeLimit = max(0, min(3, 6-6)) = 0`, so that single call is fully rejected (`too_many_tool_calls`), `dispatchTool` stays at 6, never 7. Proves the boundary is `>=` the cap, not an off-by-one `>`.

### (d) Deadline breach generalizes past iteration 2

- error/validation: two successful tool rounds run (not one); the breach is detected before iteration 3, not iteration 2 — exactly 2 network calls total, never a 3rd, and the 2nd round's own content becomes the final answer. Proves the deadline check is a general "before every completion after the first" rule, not hardcoded to the first re-entry.

### (e) Fallback pin holds across every subsequent call

- normal: primary fails once; a 3-iteration turn is run entirely on the pinned fallback model afterward — **every** iteration-2 and iteration-3 request body asserts `model === 'fallback/model'`, and the very first request body is separately asserted `model === 'primary/model'` (the only primary attempt, ever, across the whole turn).

### (f) Suggestions never leak from a mid-loop completion (BR-6)

- security: iteration 1 returns BOTH `tool_calls` AND a smuggled `<suggestions>["คำถามลวงระหว่างทาง"]</suggestions>` block in its content (adversarial — real models don't normally emit prose alongside tool_calls, but nothing in the wire schema forbids it). The loop discards that content entirely (only ever tracked as `lastRawContent` for the deadline-recovery path, never passed through `extractSuggestions` while a round is still executing). The FINAL completion (iteration 2, natural stop) carries its own distinct `<suggestions>["คำถามจริงที่ควรถาม"]</suggestions>` block — only THAT one appears in the result; the mid-loop smuggled text/tag is asserted absent from `answer`, `suggestions`, and the full serialized result.

### (g) Single final-assembly point (source inspection, D7 precondition)

- architecture: `extractSuggestions` is defined exactly once and called from exactly ONE call site (inside `finalizeAnswer`); `finalizeAnswer` itself is defined exactly once and called from exactly the two loop-exit branches (the deadline-breach-with-content branch, and the natural/forced-stop branch). This is the structural precondition the ADR names for D7 (a future single-flush-point streaming hook can instrument `finalizeAnswer` alone, no rewrite). Has real teeth: a future change that duplicates suggestion-extraction logic inline elsewhere (e.g. an unplanned 3rd exit path) trips the call-site count.

### AC-7 / BR-7 — route config

- unit: `app/api/ai/chat/route.ts` exports `maxDuration === 60`, and `60 > TURN_DEADLINE_MS/1000` (45s) — confirms the stated headroom relationship, not just the literal number. This export had zero direct test coverage before this pass (the existing route suite tests request/response behavior only).

## Prove-It (red-before-green, performed this pass)

Both hard caps were temporarily weakened in `lib/ai/openrouter-client.ts` (never committed — reverted immediately after, `git diff` confirmed clean each time) to prove the guard tests actually have teeth:

1. `MAX_AGENT_ITERATIONS` 4→5 — **4 tests went red** across both `cam-416-agent-loop.test.ts` (the hardcoded `.toBe(4)` constants pin + the 4-round forced-final boundary test) and `cam-416-adversarial-verify.test.ts` (the torture case + the null-content edge case). Reverted → all 17 green again.
2. `MAX_TOOL_CALLS_PER_TURN` 6→8 — **3 tests went red** (the hardcoded `.toBe(6)` constants pin + the existing 3+3+2 turn-cap test + the new exact-7th-boundary test). Reverted → all 17 green again.

Confirms: a regression that silently weakens either cap is caught immediately by the existing suite, not just by this pass's new additions — the hardcoded `constants match ADR-013 D4` unit test is the first line of defense (catches ANY value drift, even one that happens to match a test fixture's own request count), and the behavioral boundary tests independently catch the same drift via dispatch/fetch-count mismatches.

## Coverage

Measured via `npx vitest run <cam-416 suites> --coverage --coverage.include='lib/ai/openrouter-client.ts'` (real run, not estimated):

- `lib/ai/openrouter-client.ts`: **95.29% stmts / 86.84% branch / 100% funcs / 98.02% lines** (uncovered lines 229, 247 = pre-existing CAM-410 `extractSuggestions` malformed-JSON edge branches, unrelated to this story's diff; line 589 = the documented-unreachable defensive final return).
- Well above the 80% floor on new code (the entire bounded-loop diff is new code for this story).

Full repo suite (real run, last act of this pass): **194/195 files, 7023/7024 tests pass** (`npx vitest run --coverage`). The 1 failure is the pre-existing, known env-dependent flake `__tests__/delivery-client.test.ts` (unrelated to this story, per the dispatch contract — not chased).

`npm run lint`: 0 errors (251 pre-existing warnings across the repo, none in the new file). `npm run typecheck`: clean.

## Defects found

None. All 7 termination/spend invariants hold under adversarial pressure; no production code was modified (the two weakenings used for Prove-It were reverted, never committed).

## Links

`story.md` (AC/BR/EC) · ADR-013 §D4 · `.claude/rules/qa.md` · `.claude/rules/security.md` §6 (AI/LLM spend/turn cap) · `lib/ai/openrouter-client.ts` · `app/api/ai/chat/route.ts` · `__tests__/cam-416-agent-loop.test.ts` (existing, backend-authored) · `__tests__/cam-416-adversarial-verify.test.ts` (new, this pass) · `__tests__/cam-270-openrouter-client.test.ts` (sibling regression pins)

## Changelog

- v1 (2026-07-19) — created: 7/7 verdicts recorded (a–g per the dispatch), 10 new tests added in `cam-416-adversarial-verify.test.ts`, 0 defects found, Prove-It performed on both hard caps (4 + 3 tests respectively went red, confirmed reverted + green). Ready to hand off to `security`.
