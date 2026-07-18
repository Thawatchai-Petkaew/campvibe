---
linear: CAM-417
feature: ai-assistant
epic: ai-camping-assistant-a1-a4-b1-b3-c-inquiry
persona: platform
artifact: test
owner: qa-engineer
status: Green — 7/7 verdicts proven, no defect found, ready for security
version: v1
updated: 2026-07-19
---
# Test — Tool registry gains guest/authed tiers with server-bound user context (CAM-417)

> Independent adversarial QA verify (fresh-context) of the tiered tool registry — the OWASP
> excessive-agency control point ADR-013 D5 exists to close. The shipped suites
> (`cam-417-tool-registry-tiers.test.ts`, `cam-270-tool-registry.test.ts`, `cam-270-openrouter-client.test.ts`,
> both backend-authored) already prove tier filtering, `dispatchTool`'s refusal codes, and the
> no-userId invariant over TODAY's two real tools. This pass attacks 7 specific angles the dispatch
> named and adds `cam-417-adversarial-verify.test.ts` (7 new tests) to close the real gaps found — it
> does not re-test ground the shipped suite already covers cleanly.

## AC→test matrix

| AC | risk (H/M/L) | type | test file | status |
|---|---|---|---|---|
| AC-1: only guest-tier tools offered when `ctx={}` — byte-identical to pre-CAM-417 | H | unit + security | `cam-270-openrouter-client.test.ts` (existing, `arrayContaining` only) + **new** `cam-417-adversarial-verify.test.ts` (b) — EXACT wire-level tools array, proven with a real authed tool present | pass |
| AC-2: `ctx.userId` present composes guest+authed | H | normal | **new** (b) — exact array `['probeGuestTool','probeAuthedTool']`, tier order preserved | pass |
| AC-3: a registered `authed` tool requested without `ctx.userId` → `unauthorized_tool`, `execute()` never invoked | H | unit + security | `cam-417-tool-registry-tiers.test.ts` (existing, direct dispatchTool spy) + **new** (c) — same refusal proven END-TO-END through the REAL bounded loop (not the mocked-dispatchTool suite), turn still completes normally | pass |
| AC-4: unregistered tool name (hallucination) → `unknown_tool`, distinct from `unauthorized_tool` | M | unit | `cam-417-tool-registry-tiers.test.ts` (existing) | pass |
| AC-5: no tool's zod `parameters` or `jsonSchema` ever exposes `userId` | H | security | `cam-417-tool-registry-tiers.test.ts` (existing, today's 2 real tools) + **new** (a) — the check generalizes to a tool that did NOT exist when the invariant was written (structural proof) + Prove-It (red-before-green on the shipped test) | pass |
| EC-1: guest hallucinates a call to a registered `authed` tool it was never offered | H | security | `cam-417-tool-registry-tiers.test.ts` (existing, `unauthorized_tool` fires regardless of what the model was shown) | pass |
| EC-2: `ctx.userId` present but no `authed` tool registered yet → guest-only, no crash | M | null/empty | **new** (b) third case — explicit, was previously unasserted at the wire level | pass |
| EC-3: `dispatchTool`'s ordering invariant (tier check before zod parse, before execute) | H | unit | `cam-417-tool-registry-tiers.test.ts` (existing) | pass |
| EC-4: `unknown_tool` vs `unauthorized_tool` are never confusable by the caller | M | unit | `cam-417-tool-registry-tiers.test.ts` (existing) | pass |
| EC-5: a future tool author adding `userId` by mistake is caught before merge | H | security | **new** (a) — rogue tool registered directly into the real registry, flagged by name | pass |
| BR-5 / wire byte-stability: default `ctx={}` at every layer, real request body unchanged | H | regression | Full AI sibling suite (36 files / 534 tests) re-run green, zero new failures | pass |
| (g) provenance: `ctx.userId` can only ever come from a server-side session | H | security (source inspection) | **new** (g) — `POST /api/ai/chat` passes NO ctx argument (regex on the real call site) + no `lib/ai/**` file assigns into `userId` from args/body/model output | pass |

## Validation cases

### (a) The no-userId invariant is a property of the CHECK, not a fixed tool list (AC-5, EC-5)

- security: a rogue tool (`rogueFutureTool`) carrying `userId` in **both** its zod schema and its hand-written `jsonSchema` is registered directly into the real registry, alongside the two real shipped tools. The detection logic (same shape as the shipped invariant test) flags **exactly** `rogueFutureTool` by name — the two real tools stay clean. Proves the check generalizes to a tool that did not exist when the invariant was written, not just "today's registry happens to be clean."
- **Prove-It (red-before-green, performed this pass, reverted):** temporarily added `userId: z.string().optional()` to `searchCampsitesArgsSchema` (the real production schema) → the shipped invariant test in `cam-417-tool-registry-tiers.test.ts` went **RED** (`AssertionError: searchCampsites.parameters must not accept a userId field`). Reverted via `git diff` → confirmed empty diff, test **GREEN** again (8/8). Confirms the shipped guard has real teeth against the exact regression EC-5 names, not just against a hypothetical.

### (b)+(f) Wire-level tier isolation is EXACT, not "contains" (AC-1, AC-2, EC-2)

The only pre-existing wire-level assertion (`cam-270-openrouter-client.test.ts`) uses `expect(toolNames).toEqual(expect.arrayContaining([...]))` against a registry that has **no** authed tool registered yet — so it can never prove an authed tool would be *excluded* from a guest request; it can only prove the two guest tools are *included*. Since the current real registry has zero authed tools, that test passing today gives zero evidence the isolation boundary itself works.

Closed by registering a fake `probeGuestTool` (`tier:'guest'`) + a fake `probeAuthedTool` (`tier:'authed'`) directly into the real registry and asserting the **exact** `tools` array sent to the model (via the real, unmocked `buildToolSchemas` path inside `openrouter-client.ts`):

- security: `ctx={}` (the real production default, no argument passed) → `tools` array is **exactly** `['probeGuestTool']` — the authed probe never appears (AC-1).
- normal: `ctx={userId:'user-1'}` → **exactly** `['probeGuestTool','probeAuthedTool']`, guest-tier first (AC-2, tier composition order in `buildToolSchemas`).
- null/empty: `ctx={userId:'user-1'}` with no authed tool registered at all → **exactly** `['probeGuestTool']`, no crash, no phantom entry (EC-2 — previously implicit, now explicit at the wire level).

### (c) End-to-end refusal through the REAL bounded loop, not the mocked-dispatchTool suite (AC-3)

The shipped suite proves `dispatchTool` itself refuses correctly (unit level, direct call). This closes the gap one layer up: does the REAL agent loop (`runTurnFromBaseMessages` → `executeToolCalls` → the REAL `dispatchTool`, nothing mocked except `fetch`) actually route a hallucinated authed-tool call through that refusal without ever reaching `execute()`?

- security: model's first completion returns a `tool_call` for `probeAuthedTool` (registered, `ctx` stays the real default `{}`) → the fake tool's `execute` spy is **never called**; the turn completes normally with `{ok:true, answer:'ขอโทษค่ะ ไม่พบข้อมูลที่ต้องการ', cards:[]}` (no crash, no leak of the refusal's internals to the camper); the follow-up completion's request body carries a well-formed `role:'tool'` message for the exact `tool_call_id`, containing `{ok:false, code:'unauthorized_tool', message: <string>}` — proving the refusal is handled, not silently dropped (which would desync the messages array for the next completion call).

### (g) Provenance — `ctx.userId` can only ever come from a server-side session

- security: `app/api/ai/chat/route.ts` (the only real production caller of `runAssistantTurnFromMessages`) is source-inspected via regex — the call site takes **exactly one** argument (`turnMessages`), proving no ctx of any kind is passed today; `ctx.userId` can only ever resolve to the `{}` default's `undefined` on the real wire (CAM-420 owns wiring a real one via `auth()`).
- security: every file under `lib/ai/**` that could plausibly assign into a `userId` key (`tool-registry.ts`, `openrouter-client.ts`, both tool files, the tools index) is grepped for an assignment pattern sourced from untrusted input (`args`, `rawArgs`, `body`, `req.`, `parsed.data`, `toolCalls`, `call.function`) — none found. The only code that ever touches `ctx.userId` is a **read** (`dispatchTool`'s tier guard, `buildToolSchemas`' tier composition), never a write from client/model input.
- Confirmed independently by a direct grep across `lib/ai/` and `app/api/ai/` for every `userId` occurrence: the sole non-test writer of a real `userId` in this codebase is `lib/ai/conversation-store.ts`, which reads it from `session!.user!.id` inside `app/api/ai/conversations/[id]/route.ts` — an unrelated, already-authed feature (CAM-421) that establishes the exact pattern CAM-420 will reuse; it does not touch `ToolContext` at all.

## Coverage

Measured via `npx vitest run <36 AI sibling suites incl. cam-417-adversarial-verify.test.ts> --coverage --coverage.include='lib/ai/tool-registry.ts' --coverage.include='lib/ai/openrouter-client.ts'` (real run, not estimated):

- `lib/ai/tool-registry.ts` (the story's core diff surface): **100% stmts / 100% branch / 100% funcs / 100% lines**.
- `lib/ai/openrouter-client.ts` (ctx threading + `buildToolSchemas` — the rest of the file is CAM-410/415/416's, out of this diff's scope): **98.84% stmts / 97.53% branch / 100% funcs / 99.35% lines**.
- Both well above the 80% floor on new code.

Full repo suite (real run, last act of this pass): **203 files, 1 failed | 7106 tests, 1 failed** (`npx vitest run`). The 1 failure is the pre-existing, known env-dependent flake `__tests__/delivery-client.test.ts` (unrelated to this story, named in the dispatch contract — not chased). The 36-file AI sibling suite alone: **534/534 pass**, zero new failures from this pass's additions or from the CAM-417 diff itself.

`npm run typecheck`: clean. `npx eslint __tests__/cam-417-adversarial-verify.test.ts`: 0 errors, 0 warnings.

## Defects found

None. All 7 dispatch verdicts (a–g) hold; the userId-cannot-be-model-supplied guarantee is airtight at every layer checked (registry invariant, wire composition, real dispatch, provenance). No production code was modified — the one temporary schema injection used for the Prove-It exercise was reverted before this pass ended (`git diff` confirmed clean).

## Links

`story.md` (AC/BR/EC) · ADR-013 §D5 · `.claude/rules/qa.md` · `.claude/rules/security.md` (OWASP excessive-agency / access-control) · `lib/ai/tool-registry.ts` · `lib/ai/openrouter-client.ts` · `app/api/ai/chat/route.ts` · `__tests__/cam-417-tool-registry-tiers.test.ts` (existing, backend-authored) · `__tests__/cam-417-adversarial-verify.test.ts` (new, this pass) · `__tests__/cam-270-tool-registry.test.ts` / `__tests__/cam-270-openrouter-client.test.ts` (sibling regression pins)

## Changelog

- v1 (2026-07-19) — created: 7/7 verdicts recorded (a–g per the dispatch), 7 new tests added in `cam-417-adversarial-verify.test.ts`, 0 defects found, Prove-It performed on the shipped no-userId invariant (1 real tool schema temporarily injected with `userId`, confirmed red, reverted, confirmed green). Ready to hand off to `security`.
