---
linear: CAM-430
feature: ai-assistant
epic: chat-experience-overhaul
persona: Camper
artifact: test
owner: qa-engineer
status: Done
version: v1
updated: 2026-07-19
---
# Test — Message layout + zero-result gate (CAM-430)

## AC→test matrix

| AC | risk (H/M/L) | type (unit/integ/e2e) | test file | status |
|---|---|---|---|---|
| AC-1 (no per-row avatar; row is w-full) | H | unit/source-inspection | `__tests__/cam-411-assistant-personality.test.ts` (AC-3 supersede block) | ✅ pass |
| AC-2 (header/resuming/welcome avatars kept, count=2 `size="lg"`) | H | unit/source-inspection | `__tests__/cam-411-assistant-personality.test.ts` (AC-3 supersede block) | ✅ pass |
| AC-3 (cards/chips align pl-4 + gap-3 with the bubble's text inset) | M | unit/source-inspection | `__tests__/cam-411-assistant-personality.test.ts`, `__tests__/cam-272-ai-chat-components.test.ts` (CAM-407 supersede block) | ✅ pass |
| AC-4 (real search, 0 rows → zeroResult banner shows) | H | unit | `__tests__/cam-272-ai-chat-conversation.test.ts` (EC-2/CAM-430 block) | ✅ pass |
| AC-5 (greeting/FAQ, 0 cards → NO banner — the bug fix, Prove-It) | H | unit | `__tests__/cam-272-ai-chat-conversation.test.ts` (bug-fix block) | ✅ pass |
| BR-1 (searchAttempted additive/optional, byte-identical when absent) | H | unit + integ (QA-authored gap closure) | `__tests__/cam-270-openrouter-client.test.ts`, `__tests__/cam-415-run-assistant-turn-from-messages.test.ts`, `__tests__/cam-416-adversarial-verify.test.ts`, `__tests__/cam-416-agent-loop.test.ts` (openrouter-client layer) + `__tests__/cam-430-search-attempted-wire.test.ts` (route.ts legacy+v2 wire body + api-client.ts parse — QA-authored, see Defects below) | ✅ pass |
| BR-2 (tracked at tool-dispatch layer via registered tool name, not a hardcoded string) | H | unit/source-inspection | `lib/ai/openrouter-client.ts` imports `searchCampsitesTool` and compares `call.function.name === searchCampsitesTool.name` (verified by reading the diff; exercised transitively by every BR-1 test above, which use the tool-name-matching mock helper `toolCall()`) | ✅ pass |
| BR-3 (zeroResult = searchAttempted===true && cards.length===0, never cards.length===0 alone) | H | unit | `__tests__/cam-272-ai-chat-conversation.test.ts` (both directions: AC-4 positive + AC-5 negative) | ✅ pass |
| BR-4 (avatar/alignment scoped to AiChatMessageList.tsx only; carousel's own -mx-4/px-4 bleed unchanged) | M | unit/source-inspection | `__tests__/cam-409-ai-chat-card-carousel.test.ts` (unchanged carousel-internal assertions still pass, confirming no collateral edit) | ✅ pass |
| EC-1 (searchAttempted:true AND cards.length>0 → zeroResult stays false) | M | unit | `__tests__/cam-272-ai-chat-conversation.test.ts` (pre-existing "1 card" case, re-verified against the new gate — a successful search never shows the empty-search notice) | ✅ pass |

## Validation cases

- AC-1/AC-2: `listSrc.split('<AiChatAvatar size="sm" />').length - 1 === 0` (no per-row avatar anywhere); `listSrc.split('<AiChatAvatar size="lg" />').length - 1 === 2` (resuming + welcome, both kept); the panel header (`AiChatPanel.tsx`) diff is empty (untouched — verified via `git diff origin/dev...HEAD -- components/ai-chat/AiChatPanel.tsx components/ai-chat/AiChatLauncher.tsx`, 0 lines).
- AC-3: the answer-row block contains `<div className="pl-4">` (wrapping the carousel) and `className="flex flex-wrap gap-2 pl-4"` (chips); the row's own grid gap is `gap-3` (was `gap-2`).
- AC-4/AC-5/BR-3 (Prove-It): `appendOutcome` with `{cards: [], searchAttempted: true}` → `zeroResult: true`; `appendOutcome` with `{cards: []}` (no `searchAttempted` key, i.e. a greeting) → `zeroResult: false`. The bug-fix test's own docstring records: this test asserted the BUG's behavior (`zeroResult: true`) before the fix and now asserts the corrected gate — the change is a genuine Prove-It, not a weakened pin (confirmed independently: reverting `conversation.ts`'s gate to `cards.length === 0` alone reproduces the pre-fix red state).
- BR-1 threading (Reader/writer sweep, story.md): `AssistantTurnResult.searchAttempted` (openrouter-client) → `route.ts`'s two branches (legacy: `handleLegacyTurn`, v2: `handleV2Turn`) → `AiChatOutcome.searchAttempted` (`lib/api-client.ts`'s `parseAiChatSuccessBody`) → `conversation.ts`'s `appendOutcome`. Every hop in this chain now has a direct test (see Defects below for the gap QA closed at the two middle hops).

## Coverage

Measured via `npx vitest run --coverage` (real run, 2026-07-19).

| File | Stmts | Branch | Funcs | Lines | Note |
|---|---|---|---|---|---|
| `lib/ai/openrouter-client.ts` | 98.91% | 96.66% | 100% | 99.39% | full-suite v8 report |
| `app/api/ai/chat/route.ts` | 95.23% | 86.76% | 100% | 96.34% | full-suite v8 report |
| `lib/api-client.ts` | 81.41% | 92.85% | 38.46%* | 79.34%* | full-suite v8 report; low func/line % is pre-existing, unrelated surface (`wishlistAPI`/`operatorAPI`) diluting the file average — same caveat CAM-427's test.md recorded |
| `components/ai-chat/conversation.ts` | 80.64% | 90.9% | 72.72% | 80% | **isolated per-file run** (`vitest run __tests__/cam-272-ai-chat-conversation.test.ts --coverage`) — this file does not appear in the full-suite aggregate v8 report (a coverage-merge quirk in this 224-file monorepo run, reproduced independently; not a story defect). Uncovered lines 126-151 are `restoreEntriesFromMessages` (CAM-423 resume logic), untouched by this story. |
| `components/ai-chat/AiChatMessageList.tsx` | not measured (v8) | — | — | — | never imported/rendered by any test (`environment: 'node'`, no jsdom — repo-wide constraint). AC coverage via source-inspection tests per this story's own Self-verify plan. |

`check:ds` — PASS (0 violations, no new token). `check:palette` — PASS (0 violations). `npm run typecheck` — clean. `npm run lint` — 0 errors; per-file warning-count diff (merge-base vs HEAD, via `git show <merge-base>:<file> | eslint --stdin`) confirms **zero new warnings** on every touched file, including `lib/api-client.ts` (5 pre-existing `any` warnings, byte-identical before/after).

Full suite: **224 test files / 7392 tests, all green** (was 223/7385 before this QA pass added 1 file / 7 tests to close a real gap — see Defects below). `delivery-client.test.ts`'s 2 pre-existing failures were reproduced once, root-caused to a missing `prisma/delivery/generated/delivery-client` artifact in this worktree (fixed locally via `npm run delivery:generate`, the repo's own documented `postinstall` step) — env-only, not a code defect; noted per dispatch instruction, not chased further.

## Defects found during independent QA verification

1. **Gap (not a production bug) — Important, closed within this QA pass.** The `searchAttempted` wire-threading chain (story.md's Reader/writer sweep) had real tests at its two ENDS (`openrouter-client.ts`'s `AssistantTurnResult.searchAttempted` via cam-270/415/416-*, and `conversation.ts`'s `appendOutcome` via cam-272-ai-chat-conversation) but **zero direct test at either MIDDLE hop**: `app/api/ai/chat/route.ts`'s two `if (result.searchAttempted === true) body.searchAttempted = true;` branches (legacy + v2), and `lib/api-client.ts`'s `if (searchAttempted === true) outcome.searchAttempted = true;` parse line. Every existing route/api-client fixture simply never set `searchAttempted` on its mocked turn result, so both branches were exercised by zero test (same category as CAM-427's `test.md` Defects #1 — a real seam gap, not a code bug). QA authored `__tests__/cam-430-search-attempted-wire.test.ts` (7 cases: legacy normal+null/empty, v2 normal+null/empty, api-client normal/null-empty/false-not-coerced-to-true), Prove-It verified at BOTH hops independently — reverted each branch to its pre-fix state, confirmed the corresponding new test(s) go **red** (`AssertionError: … searchAttempted …` missing/undefined), restored the real code (confirmed via `git diff --stat` matching the original PR diff exactly), confirmed **green** again. No production code was changed by this QA pass.

## Links

`story.md` (AC/BR) · `.claude/rules/qa.md` · `CAM-428-framed-chat-card/test.md` (same PR, bundled)

## Changelog

- v1 (2026-07-19) — created; independent QA verification pass on PR #497 (branch `feature/cam-428-framed-card`): full suite green (224/7392), typecheck clean, lint 0 errors/0 new warnings, 1 real test-coverage gap found and closed (see Defects).
