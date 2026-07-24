---
linear: CAM-459
feature: ai-assistant
epic: assistant-answers-real-camper-asks-gap-closure-w1 (CAM-456)
persona: Camper
artifact: test
owner: qa-engineer
status: Discovery (spec authored, awaiting G1 fold-in)
version: v1
updated: 2026-07-24
---
# Test — Answer policy 3 zones (CAM-459)

## Independent verify — re-derivation result

Re-derived the AC/BR/EC → test matrix from `story.md` BEFORE reading the shipped
`__tests__/cam-459-answer-policy-3-zones.test.ts`, then diffed. **7/7 matrix
rows the pinned test file already covered**; **2 real gaps found and closed in
this pass** (3rd `buildSystemPrompt` call path untested; the AC-5/Zone-C "no
write tool exists" claim had no runtime regression guard). Both gap-fill tests
were red-then-green proven (see below) before being kept.

## AC→test matrix

| AC | risk (H/M/L) | type (unit/integ/e2e) | test file | status |
|---|---|---|---|---|
| AC-1 (zone A, zero tools) | M | unit (prompt-assertion) + eval-fixture | `cam-459-...test.ts` "BR-1... Zone A instructs dispatching ZERO tools"; `scripts/ai-eval/golden-cases.json` SMOKE-A1/SMOKE-A2 (real-model behavior proven only by `npm run ai:eval`, real spend — not run in this pass, see Coverage note) | ✅ (prompt+fixture) / ⬜ (real-model, owner/CI-gated separately) |
| AC-2 (zone A, exactly ONE bridge) | M | unit | `cam-459-...test.ts` "BR-2/AC-2" — asserts `BRIDGE_COPY` present AND occurs exactly once (`.split().length - 1 === 1`) | ✅ |
| AC-3 (zone B, correct tool+params) | H | eval-fixture (behavioral, unchanged pre-existing code) | SMOKE-B1/B2-STRICT/C1 (pre-existing, untouched by this story); "you must call the matching tool" prompt assertion | ✅ (prompt) / ⬜ (real-model) |
| AC-4 (zone B, honest no-data) | H | unit | `cam-459-...test.ts` "BR-3" — asserts `HONEST_NO_DATA_COPY` verbatim + generalization language | ✅ |
| AC-5 (zone C, no transaction claimed) | H | unit + regression (registry invariant) | `cam-459-...test.ts` "BR-1/AC-5/EC-5" (guest) + authed-path test + **new**: "CAM-459 zone-C invariant" describe block (registry roster + tier check) | ✅ |
| AC-6 (zone A, MAX_TOKENS unchanged) | L | unit | `cam-459-...test.ts` "BR-4/AC-6: MAX_TOKENS spend guard is unchanged at 680" | ✅ |

## Edge cases (EC-n)

| EC | Covered by | status |
|---|---|---|
| EC-1 (mixed intent -> camp-specific part is Zone B) | "EC-1: a mixed-intent question is instructed to route its camp-specific part to Zone B" | ✅ |
| EC-2 (Zone A with no bridge = policy failure) | Prompt instructs mandatory bridge (BR-2 test); actual absence-of-bridge failure mode is owner-verify per story's own Self-verify (model behavior, not source) | ⬜ owner-verify (named in story.md, not a gap) |
| EC-3 (Zone B no data -> honest copy) | Same as AC-4 | ✅ |
| EC-4 (prompt-injection guardrail, zone A) | SMOKE-GUARDRAIL-1 fixture (pre-existing, unchanged); persona/injection-guard regression test in this file | ✅ (fixture+prompt) / ⬜ (real-model via `ai:eval`) |
| EC-5 (book/cancel -> no claim, no confirmation) | Same as AC-5 | ✅ |

## Independent-verify findings (dispatch items 1-5)

1. **Re-derivation diff**: 6 AC + 5 EC re-derived from `story.md` independently; all 11 rows were already covered by the shipped test file's 14 original tests + the golden-cases fixture. No AC/EC was silently skipped.
2. **Pinned-test audit**: the shipped test DOES assert both guest (`runAssistantTurn`, ctx={}) AND authed (`ctx.userId` set) prompt variants, via `runAssistantTurn` and `runAssistantTurnFromMessages`. It asserts all 3 zone markers + the exact bridge copy + the exact honest-no-data copy as full-string `toContain`/`toMatch` checks (not loose substrings that a truncated/broken line could still satisfy) — e.g. the bridge test additionally asserts the copy occurs **exactly once** (`content.split(BRIDGE_COPY).length - 1 === 1`), which would catch a duplicated/malformed insertion.
3. **MAX_PROMPT_CHARS truncation claim (b)**: verified directly by reading `lib/ai/build-turn-messages.ts`. `MAX_PROMPT_CHARS` (12000) bounds ONLY the turn-history `messages[]` array (`totalContentLength(kept) > MAX_PROMPT_CHARS` drops the OLDEST history turns); the system prompt is prepended AFTER that truncation in all 3 callers (`{ role:'system', content: buildSystemPrompt(...) }, ...turnMessages`) and is never counted against the budget or sliced anywhere else in `openrouter-client.ts`. **Confirmed true**: the system prompt (and therefore the 3-zone policy) can never be truncated or dropped.
4. **tool-registry.ts write-tool claim (c)**: `ToolTier = 'guest' | 'authed'` only (no `'write'` member exists in the type today); `lib/ai/tools/index.ts` registers exactly 7 tools, all read-only (grepped for `prisma.*.create|update|delete|upsert` in `lib/ai/tools/*.ts` — zero matches). **Gap found**: no runtime regression test previously asserted this invariant — a future write tool could be added without any test going red. **Closed**: added a 2-test regression guard (tier allowlist + exact-roster equality) in the new "CAM-459 zone-C invariant" describe block; Prove-It'd by temporarily registering a fake extra tool (`fakeWriteTool`, tier `'authed'`) in `lib/ai/tools/index.ts` — the roster-equality test went RED, then reverted to green (git-diff-clean confirmed after revert).
5. **Adversarial guest-vs-authed divergence (item 5)**: read all 3 `buildSystemPrompt` call sites (`runAssistantTurn`, `runAssistantTurnFromMessages`, `runAssistantTurnFromMessagesStreaming`). All 3 call `buildSystemPrompt(new Date(), ctx)` unconditionally with an identical array-construction pattern; the ONLY conditional line inside `buildSystemPrompt` itself is the pre-existing "camper is signed in" line (`...(ctx.userId ? [...] : [])`), which sits BEFORE the new zone-policy lines — those are appended unconditionally regardless of `ctx.userId`. No divergent path exists. **Gap found**: the 3rd call path (`runAssistantTurnFromMessagesStreaming`, the streaming SSE entry point used by the real chat route) had ZERO existing test asserting its outgoing prompt content — a future edit that diverges its own inline array construction would ship silently. **Closed**: added a streaming-path test (ctx.userId set) asserting all 3 zone markers + bridge + honest-no-data + signed-in line are present; Prove-It'd by stripping the 3 CAM-459 prompt lines from `buildSystemPrompt` — 9/14 tests (including this new one) went RED; reverted via `git checkout`, re-ran green (16/16, git-diff-clean confirmed).

## Gap-fill artifacts (this pass)

- `__tests__/cam-459-answer-policy-3-zones.test.ts`: +1 test (3rd call path, streaming) +2 tests (zone-C tool-registry invariant) = 16 tests total (was 14).
- No production code changed by QA (per role boundary) — both gaps were TEST gaps, not code gaps.
- No defect sub-ticket opened — no AC/BR/EC violation found in the shipped code; both findings were coverage gaps in the test suite, now closed.

## Coverage

`lib/ai/openrouter-client.ts` (scoped run: cam-459 + cam-457 + cam-270 + cam-412 + cam-415 + cam-416 test files): **96.37% lines / 92.81% statements / 85.2% branch / 97.22% funcs** (v8, real run). The 3 new CAM-459 prompt lines are unconditional array entries inside `buildSystemPrompt`, executed by every test in the file — 100% exercised.

AC-1/AC-3/EC-4's "real-model eval BEHAVIOR passes" clause (golden-cases.json run against the live model) is **not measured** in this pass — `npm run ai:eval` makes real OpenRouter spend and is out of this dispatch's scope; per story.md's own BR-5 ("testable contract = eval BEHAVIOR + owner-verify"), that layer is intentionally owner/CI-gated separately, not a QA unit-test gap.

## Links

`story.md` (AC/BR) · `.claude/rules/qa.md` · `lib/ai/openrouter-client.ts` (`buildSystemPrompt`) · `lib/ai/build-turn-messages.ts` (`MAX_PROMPT_CHARS`) · `lib/ai/tool-registry.ts` (`ToolTier`) · `lib/ai/tools/index.ts` (registered-tool roster) · `scripts/ai-eval/golden-cases.json`

## Changelog

- v1 (2026-07-24) — independent QA verify: re-derived AC/BR/EC matrix (7/7 covered by the shipped test), verified MAX_PROMPT_CHARS never truncates the system prompt, verified zero write-capable tools exist today, gap-filled 2 real test gaps (3rd call-path coverage; zone-C tool-registry regression guard), both Prove-It'd red-then-green.
