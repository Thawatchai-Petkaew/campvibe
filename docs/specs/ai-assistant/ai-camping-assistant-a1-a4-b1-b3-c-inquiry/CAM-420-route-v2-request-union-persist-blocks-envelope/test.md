---
linear: CAM-420
feature: ai-assistant
epic: ai-camping-assistant-a1-a4-b1-b3-c-inquiry
persona: platform
artifact: test
owner: qa-engineer
status: Fixed — 1 defect closed by backend same-day (see Changelog v2)
version: v2
updated: 2026-07-19
---
# Test — Route v2: request union + optional session + persist + blocks[] envelope (CAM-420)

> Independent adversarial QA verify (fresh-context) of the integration point: the whole authed
> pipeline, the guest/legacy path staying untouched, and persistence integrity. The shipped suite
> (`cam-420-ai-chat-route-v2.test.ts` + `cam-420-ai-chat-validation-union.test.ts` +
> `cam-420-api-client-blocks.test.ts` + `cam-420-rate-limit-per-user.test.ts`, backend-authored, 43
> tests) already proves every AC/EC/BR at the route-orchestration level cleanly (route calls the
> right store function, right args, right status). This pass attacks the 7 items the dispatch named,
> re-runs every sibling suite (CAM-271/272/408/409/410/411/414/415/416/417/418/419) unmodified as a
> byte-identical regression guard, spot-diffs the pre-v2 route source, and adds
> `cam-420-adversarial-verify.test.ts` (10 new tests) to close two real gaps: (1) nobody had proven
> persistence integrity through the REAL `conversation-store` end-to-end (only Prisma mocked), and
> (2) a genuine defect this story newly exposes in production. ALL model calls are mocked in every
> file (`runAssistantTurnFromMessages` / `fetch`) — zero paid calls, no live happy-path POST was ever
> made.

## AC→test matrix

| AC | risk (H/M/L) | type | test file | status |
|---|---|---|---|---|
| AC-1: guest `{messages}` byte-identical — guest-tier tools only, no session ever read, nothing persisted | H | integration + regression | `cam-420-ai-chat-route-v2.test.ts` (existing, `auth()` never called even with a resolvable session) + full re-run of `cam-271/272/408/409/410/411` suites unmodified (482 tests) + source spot-diff (`git diff` `handleLegacyTurn` vs pre-v2 `POST` — line-for-line identical logic, only extracted into a function) | pass |
| AC-2: v2 no `conversationId` -> `createConversation`, authed `ToolContext`, persists 2 rows, `conversationId` in response | H | integration + **new** real-store | `cam-420-ai-chat-route-v2.test.ts` (existing) + **new** Part 1 (real `conversation-store`, only Prisma mocked): exactly 2 `chatMessage.create` calls inside ONE `$transaction`, sanitized text | pass |
| AC-3: v2 resume, `loadWindow(id,userId,10)`, history enters as real messages (stored ASSISTANT unfenced, `source:'server'`), same `conversationId` echoed | H | integration | `cam-420-ai-chat-route-v2.test.ts` (existing) | pass |
| AC-4: 31st persisted-path request in the rolling window -> `429`, no model call, nothing persisted; per-user limit independent of per-IP | H | integration + unit (boundary) | `cam-420-ai-chat-route-v2.test.ts` + `cam-420-rate-limit-per-user.test.ts` (existing, real `lib/rate-limit`) + **new** Part 1 (429 -> zero Prisma calls of any kind) | pass |
| AC-5: model call fails/times out -> `502`; on the v2 path `appendTurn` never called (zero rows) | H | integration + **new** real-store | `cam-420-ai-chat-route-v2.test.ts` (existing) + **new** Part 1 (502 -> `$transaction` called exactly once — conversation creation only, never the append transaction) | pass |
| AC-6: no session, `{message}` body (well-formed v2 shape) -> `401`, no per-user rate-limit/store/model call | H | integration | `cam-420-ai-chat-route-v2.test.ts` (existing, incl. `{user:{}}` no-id case) | pass |
| AC-7: `conversationId` missing or belongs to another camper -> `404` identical for both (no existence leak), two-user fixture | H | integration (security) | `cam-420-ai-chat-route-v2.test.ts` (existing, `OTHER_USER_ID` fixture asserts `loadWindow` scoped to the session user) | pass |
| AC-8: unrecognized `blocks[].type` kept, never rejected; malformed entry dropped, sibling survives | M | unit | `cam-420-api-client-blocks.test.ts` (existing, 7 cases incl. empty/non-array/absent) | pass |
| BR-1/BR-3/EC-5/EC-6: union parses legacy-first, no shared field, matches-neither -> `400`, well-formed-v2-no-session -> `401` not `400` | H | unit + integration | `cam-420-ai-chat-validation-union.test.ts` (existing, 10 cases) + `cam-420-ai-chat-route-v2.test.ts` (EC-5/EC-6) | pass |
| BR-9: sanitize-before-store — forged `<user_message>` tag never reaches persisted text | H | security | `cam-420-ai-chat-route-v2.test.ts` (existing, mocked store) + **new** Part 1 (real store, asserts the actual `prisma.chatMessage.create` call payload — the sanitize boundary is proven end-to-end, not just at the mock edge) | pass |
| BR-10/EC-8: `appendTurn` fails after success -> answer still returned, `conversationId` omitted | M | integration | `cam-420-ai-chat-route-v2.test.ts` (existing) | pass |
| Security forward-flag: `loadWindow`'s window size cannot be induced from the request ([1,MAX] clamp is moot — no client-influenced field exists at all) | M | security (source-pinned) | **new** Part 0 — zod shape has no window/limit field; a smuggled `limit`/`window` key is stripped; route source pins `HISTORY_WINDOW_SIZE=10` as a literal, never derived from `data` | pass |
| Item (g): authed request registers `authed`-tier tools (`getMy*`); guest does not | H | unit + integration | `cam-417-tool-registry-tiers.test.ts` (existing, tier filter) + `cam-420-ai-chat-route-v2.test.ts` AC-2 (asserts `ctx={userId}` reaches `runAssistantTurnFromMessages`) + `openrouter-client.ts` source (`buildToolSchemas`: `ctx.userId ? ['guest','authed'] : ['guest']`) | pass |
| **DEFECT** — an authed personal tool (`getMyBookings` et al.) that throws crashes the whole turn uncaught instead of a handled `502` | H | security/reliability (Prove-It, red confirmed) | **new** Part 2, `it.fails` (pins current buggy behavior; flips to a real failure if silently "fixed" without updating the test) | **fails as documented — see Defects found** |

## Validation cases

### Part 0 — `loadWindow` limit cannot be induced from the request

`chatRequestV2Schema`'s shape is exactly `{conversationId, message}` (no window/limit field exists to
smuggle); a request body carrying `limit`/`window` keys is stripped by zod's default parse (never
reaches the route); the route source itself pins `const HISTORY_WINDOW_SIZE = 10` as a literal and
calls `loadWindow(data.conversationId, userId, HISTORY_WINDOW_SIZE)` — never `data.something`. The
"[1,MAX] clamp" the dispatch asked about is structurally moot: there is no client-influenced value
to clamp in the first place.

### Part 1 — REAL persistence integrity, end-to-end (only Prisma mocked)

The shipped route suite mocks `conversation-store` itself (proves the ROUTE calls it correctly);
CAM-414's own suite mocks `@/lib/prisma` (proves the STORE's transaction is atomic in isolation).
Neither proves the two wired together through the real `POST` handler. This file does (qa.md §6:
never mock the layer under test — here the layer under test is the ROUTE+STORE integration, so only
the external boundary, Prisma, is mocked):

- success: exactly 2 `prisma.chatMessage.create` calls inside exactly 2 `prisma.$transaction` calls
  total (one for `createConversation`, one for `appendTurn`); the persisted `userText` has the forged
  `<user_message>`/`</user_message>` fragment stripped — proven against the REAL `prisma.chatMessage.create`
  call arguments, not just the mocked-store call arguments.
- model failure (502): exactly ONE `$transaction` call (conversation creation) — the append
  transaction never fires, `chatMessage.create` never called. Zero rows.
- per-IP rate-limited (429): ZERO Prisma calls of any kind — real rate-limit module, before body
  parse even runs (BR-2).

### Part 2 — DEFECT: authed personal tool throw is never caught (Important, tracked)

**Reproduction:** register/dispatch `getMyBookings` (or `getMyBookingDetail`/`getMyProfile`/`getMyWishlist`)
via the real agent loop with a mocked model response requesting that tool, and make `dispatchTool`
(equivalently, the tool's own `prisma.*` call) reject. Call chain: `dispatchTool` ->
`executeToolCalls` -> `runTurnFromBaseMessages` -> `runAssistantTurnFromMessages` -> `handleV2Turn`
-> `POST`. **Confirmed via a scratch repro (deleted after confirmation, not committed):** the
rejection propagates as an **uncaught throw** all the way out of `runAssistantTurnFromMessages` —
`threw: true`, `result: Error: DB connection reset`. None of the route's own try/catches intercept
it (there are none around this call in either `handleV2Turn` or `handleLegacyTurn`).

**Why this is CAM-420's problem, not a pre-existing one to skip:** `getMyBookings`/`getMyBookingDetail`
(CAM-418) and `getMyProfile`/`getMyWishlist` (CAM-419) were dead code in production until this story
— CAM-420 is the documented first caller to ever pass a real `ToolContext{userId}` into a live
request (story.md BR-7). The guest-tier tools that WERE already live
(`searchCampsites`/`checkAvailability`) each wrap their own Prisma call in a local `try/catch`
(confirmed by reading both files) — the four new personal tools do not. So this exact gap becomes
reachable in production for the first time specifically because of this story's wiring.

**Expected vs actual:**
- Expected (per the route's own documented error-code set in its JSDoc — `401`/`404`/`429`/`500`/`502`/`503`
  — and the spirit of BR-8, "a turn that errors ... persists NOTHING" implies a HANDLED failure, not
  an unhandled crash): a transient DB error inside a tool call resolves `{ok:false, ...}` like every
  other failure path, and the route returns a graceful `502 assistant_error` JSON body.
- Actual: the exception propagates uncaught out of the route handler entirely. Next.js's own
  App-Router error handling then returns its generic framework-level error response instead of the
  route's documented JSON shape — `lib/api-client.ts`'s consumer expects JSON and would fail to parse
  it, surfacing as an unhandled/ungraceful error state to the camper instead of the existing Thai
  error copy path.
- Persistence-integrity impact: none — the throw happens strictly before `appendTurn` is ever
  reached, so zero rows are written either way. This is a graceful-degradation/contract-completeness
  defect, not a data-integrity one.

**Severity:** Important (not Critical — no secret/stack leak to the client in production Next.js
route-handler error handling, and it only fires on a genuine downstream infra failure, e.g. a DB
blip). Still a real, live-reachable gap this story introduces and should close before the tier is
trusted in production.

**Recommendation (for `backend`, not applied here):** wrap the single call site in
`executeToolCalls` (`lib/ai/openrouter-client.ts`) — `const result = await dispatchTool(...)` — in a
try/catch that maps any thrown error to the same shape `dispatchTool` already uses for a handled
failure (e.g. `{ok:false, code:'tool_execution_error', message:'...'}`), mirroring how
`callModelOnce` already catches network errors one level up. Fixing it at this ONE seam (rather than
adding try/catch to each of the four personal-tool files individually) closes the gap for every
current and future `authed`-tier tool at once.

**Regression guard:** `__tests__/cam-420-adversarial-verify.test.ts`'s Part 2 test is written with
`it.fails(...)` (Vitest) — it currently reports as **passing** (the suite stays green) precisely
*because* the inner assertion (`expect(result.ok).toBe(false)`) throws today. Once backend lands the
fix, that assertion will start succeeding, `it.fails` will flip to reporting a FAILURE, forcing
whoever lands the fix to remove the `.fails` modifier — the test cannot silently go stale.

## Coverage

Measured via `npx vitest run --coverage __tests__/cam-271-ai-chat-route.test.ts
__tests__/cam-271-ai-chat-validation.test.ts __tests__/cam-410-route-suggestions.test.ts
__tests__/cam-420-*.test.ts` (real run):

- `app/api/ai/chat/route.ts` (the story's core new/changed file): **93.33% stmts / 84.21% branch /
  90% funcs / 93.24% lines** — comfortably above the 80% floor. Remaining uncovered lines are the
  `suggestions` truthy-array branch on the v2 path specifically (covered on the legacy path by
  CAM-410's suite) and one internal `console.error` log-line branch.
- `lib/validations/ai-chat.ts` (new `chatRequestV2Schema`/`chatRequestUnionSchema`): 100%.
- `lib/ai/rate-limit.ts` (new `checkAssistantRateLimitForUser`): 100%.
- `lib/api-client.ts`'s new surface (`AiChatBlock`/`parseAiChatSuccessBody`'s blocks branch) is
  exercised by all 7 cases in `cam-420-api-client-blocks.test.ts`; the file's overall low % reflects
  large pre-existing unrelated code in that file, not this story's diff.

Full repo suite (real run, last act of this pass): **212 files, 1 failed | 7227 tests, 7225 passed,
1 expected fail (my Part-2 `it.fails`), 1 failed**. The 1 failure is the pre-existing, known
env-dependent flake `__tests__/delivery-client.test.ts` (named in the dispatch contract — not
chased, unrelated to this story).

`npm run lint`: 0 errors (255 pre-existing warnings, none new from this pass's file).
`npx tsc --noEmit`: clean.

## Defects found

**1 found, FIXED same-day by backend (was Important, tracked; now closed — see Changelog v2).**

- **Title:** Authed personal AI tool throw crashes the whole `/api/ai/chat` v2 turn uncaught instead
  of a handled `502`.
- **Repro:** see "Part 2" above — real repro confirmed via a scratch test (deleted after
  confirmation), reproduced again as a permanent regression guard in
  `cam-420-adversarial-verify.test.ts`.
- **Failing AC/BR reference:** violated the spirit of BR-8 (handled-failure-only persistence) and the
  route's own documented complete error-code set (JSDoc on `handleV2Turn`); no AC in this story
  explicitly named "tool throws" as a case, which is exactly why it slipped through the shipped
  suite — the shipped suite only exercised `ok:false`/`skipped:true`, both HANDLED discriminated-union
  outcomes, never an actual thrown exception.
- **Expected vs actual:** see "Part 2" above.
- **Severity:** Important.
- **Fix (backend, same-day):** `dispatchTool(...)` inside `executeToolCalls` (`lib/ai/openrouter-client.ts`)
  is now called via a `safeDispatchTool` wrapper — any throw is caught and mapped to a handled
  `{ok:false, code:'tool_error'}` tool result (mirrors `callModelOnce`'s existing network-error catch
  one level up), fixed at the ONE shared seam so it covers every current AND future `authed`-tier tool,
  not per-tool. The raw error message/stack never reaches the tool message or the client — only the
  tool NAME + error TYPE are logged server-side (no PII). The regression guard in
  `cam-420-adversarial-verify.test.ts` Part 2 was flipped from `it.fails(...)` to a normal green
  assertion (plus a second new assertion on the no-leak property); a direct unit test was also added to
  `cam-270-openrouter-client.test.ts`.
- **Status impact:** defect closed; story status moves from blocked to ready — see Changelog v2.

## Links

`story.md` (AC/BR/EC) · ADR-013 §D5/D6/D7 · `.claude/rules/qa.md` · `.claude/rules/api.md` (5-error-code
contract) · `.claude/rules/security.md` (OWASP insecure-design / misconfig) · `app/api/ai/chat/route.ts` ·
`lib/ai/openrouter-client.ts` · `lib/ai/tool-registry.ts` · `lib/ai/tools/my-bookings.ts` ·
`lib/ai/tools/my-profile-wishlist.ts` · `lib/ai/tools/search-campsites.ts` (guest-tier try/catch
precedent) · `lib/ai/tools/check-availability.ts` (guest-tier try/catch precedent) ·
`__tests__/cam-420-ai-chat-route-v2.test.ts` (existing, backend-authored) ·
`__tests__/cam-420-ai-chat-validation-union.test.ts` (existing) ·
`__tests__/cam-420-api-client-blocks.test.ts` (existing) ·
`__tests__/cam-420-rate-limit-per-user.test.ts` (existing) ·
`__tests__/cam-420-adversarial-verify.test.ts` (new, this pass)

## Changelog

- v1 (2026-07-19) — created: 7 verdicts recorded (persistence-integrity Prove-It done via real-store
  integration, item (f) confirmed structurally moot, item (g) confirmed via source + existing tests).
  10 new tests added in `cam-420-adversarial-verify.test.ts`. 1 Important defect found (authed
  personal-tool throw propagates uncaught) — reproduced, documented, regression-guarded with
  `it.fails`, NOT fixed (QA does not write production code). Status = blocked pending a `backend`
  fix or an explicit owner risk-acceptance. `next: security` deferred until the defect is resolved.
- v2 (2026-07-19) — backend fixed the Important defect same-day: `safeDispatchTool` wraps
  `dispatchTool` inside `executeToolCalls` (`lib/ai/openrouter-client.ts`), containing any tool throw
  as a handled `{ok:false, code:'tool_error'}` result at the one shared loop seam (covers every
  current/future `authed` tool). `cam-420-adversarial-verify.test.ts` Part 2 flipped from `it.fails`
  to a real green assertion (+ 1 new no-leak assertion); `cam-270-openrouter-client.test.ts` gained a
  direct unit test. Full AI-sibling suite + full repo suite re-run green. Status: fixed, ready for
  `next: security`.
