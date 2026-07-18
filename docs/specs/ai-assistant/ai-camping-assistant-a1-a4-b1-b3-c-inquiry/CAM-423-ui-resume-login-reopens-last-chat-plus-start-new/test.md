---
linear: CAM-423
feature: ai-assistant
epic: ai-camping-assistant-a1-a4-b1-b3-c-inquiry (CAM-266)
persona: camper
artifact: test
owner: qa-engineer
status: Green — 0 open defects, ready for security
version: v1
updated: 2026-07-19
---
# Test — UI resume: login re-opens the last chat + a "start new" button (ADR-013 S9) (CAM-423)

## Test strategy note (read first)

`components/ai-chat/conversation.ts`'s two new pure exports (`isAuthedSession`,
`restoreEntriesFromMessages`) and `lib/api-client.ts`'s three new facade methods
(`sendTurn`/`listConversations`/`getConversation`) get REAL unit tests, `fetch` always
mocked. `use-ai-chat.ts` (the `useSession()`-gated resume effect) and the panel/list wiring
get source-inspection Prove-It tests — this repo's established precedent for a
`useSession()` client gate with no jsdom/RTL harness for this component class
(`vitest.config` `environment: 'node'`; see `__tests__/cam-397-live-session-gate.test.ts`,
`__tests__/cam-396-*`). QA independently re-verified the shipped suite (not accepted on
frontend's self-report alone): re-derived the guest byte-stability claim from the route
source (`app/api/ai/chat/route.ts`'s `handleLegacyTurn`, untouched by this diff — confirmed
via `git diff --stat` across the story's 2 commits, `route.ts` not in the changed-file list),
closed 3 real coverage gaps (below), and Prove-It'd 3 of the highest-risk behavioral
assertions by hand (temporary mutation -> red -> revert -> green, production files restored
byte-identical after each proof, `git diff --stat` clean).

## AC -> test matrix

| AC/EC/BR | risk | type | test file | status |
|---|---|---|---|---|
| AC-4/BR-5/EC-3: guest turn is byte-identical to pre-CAM-423 (request body, response handling, no resume/persist calls) | H | unit + source-inspection + **independent route re-derivation** | `cam-423-ui-resume.test.ts` (guest branch describe) + QA re-derivation: `handleLegacyTurn` in `app/api/ai/chat/route.ts` is untouched by this diff (not in the 8-file changed list) and its 200 body is `{answer, cards, suggestions?}` — never a `conversationId` key — so `parseAiChatSuccessBody`'s shared `conversationId` extraction is always a no-op for a guest response | pass |
| AC-1/BR-1: authed resume — `listConversations` -> newest -> `getConversation` -> restore, once per open, authed-only | H | unit (`restoreEntriesFromMessages`) + source-inspection (call-order pin) | `cam-423-ui-resume.test.ts` (BR-1 describe: guard string, call-order-index pin) | pass |
| AC-2: authed + no saved conversation -> unchanged welcome state, no fetch/create until send | M | source-inspection | `cam-423-ui-resume.test.ts` (welcome-state gate `!resuming && entries.length===0`) + BR-1's `!authed \|\| hasResumedRef.current` guard (same code path proves "nothing fetched" for the 0-conversation authed case too, since the list call itself always fires once for any authed open — the empty-result branch is the AC-5/EC-1 test below) | pass |
| AC-3/BR-4: `เริ่มแชทใหม่` clears thread + conversationId, authed-only, next send creates fresh | M | source-inspection | `cam-423-ui-resume.test.ts` (AC-3/BR-4 describe: `conversationIdRef.current = undefined`, `setEntries([])`, authed-only render gate, i18n label, lucide-only icon) | pass |
| AC-5/EC-1/EC-4: any resume-fetch failure (empty list, 401/404/500, thrown network error) falls back to fresh welcome, never a crash | H | unit + source-inspection | `cam-423-ui-resume.test.ts` (`listConversations`/`getConversation` non-2xx cases + **new** genuine `fetch`-throw cases for both + hook-level fallback guards) | pass |
| AC-6/BR-6/EC-2: restored `blocks` validated via the shared `normalizeBlocks`; malformed/unrecognized entries skipped, never thrown | H | unit (Prove-It, hand-verified red) | `cam-423-ui-resume.test.ts` (`restoreEntriesFromMessages` describe: null/malformed/unrecognized-type cases) | pass |
| AC-7/BR-5: authed turn posts v2 `{conversationId?, message}`; returned `conversationId` threads the next turn | H | unit (Prove-It, hand-verified red) | `cam-423-ui-resume.test.ts` (`aiChatAPI.sendTurn` describe: omitted-key / present-key / conversationId-surfaces / 429-503-401-network-throw / same-route-no-parallel-endpoint) | pass |
| BR-3: composer send action (button, Enter, suggestion pills) disabled while `resuming`; resuming indicator = the same inline `LoadingSpinner` override, own `aria-busy`/`role=status`/`aria-live=polite` | M | source-inspection | `cam-423-ui-resume.test.ts` (composer `canSend` gate + **new** suggestion-pill gate + a11y describe) | pass |
| i18n: `aiChat.newChat` TH verbatim (`เริ่มแชทใหม่`) + EN present | L | unit | `cam-423-ui-resume.test.ts` (locales describe) | pass |

## Guest byte-stability verdict

**YES — byte-stable, independently re-derived, not just accepted from the shipped test's own
assertions.**

- **Request:** `runTurn`'s guest branch calls `aiChatAPI.send(buildOutgoingHistory(base, questionText))`
  — the exact pre-CAM-423 call shape (confirmed: `buildOutgoingHistory`/`appendOutcome`/
  `appendUserQuestion`/`entriesBeforeRetry`/`isAssistantDisabled` in `conversation.ts` are
  byte-unchanged; only 2 new exports were added to the file, nothing existing was edited).
  `lib/api-client.ts`'s `send()` function body is unchanged (confirmed via `git diff` — the
  diff for this file is purely additive, no existing line touched).
- **Response:** `git diff --stat` across both story commits (`2db5cee..80e97d2`) does not list
  `app/api/ai/chat/route.ts` — the legacy `handleLegacyTurn` branch guests hit is untouched.
  Its 200 body is exactly `{answer, cards, suggestions?}` — it never emits a `conversationId`
  key, so `parseAiChatSuccessBody`'s (pre-existing, CAM-420) `conversationId` extraction always
  resolves to `undefined` for a guest turn; `conversationIdRef.current` is set but never read
  again on the guest branch (only the authed `sendTurn` branch reads it) — inert, not a leak.
- **UI-local gating:** the welcome-state/composer/suggestion-pill gates now also check
  `resuming`, and `AiChatMessageList` takes a new `resuming` prop — but `resuming` can only
  ever become `true` inside the resume effect's body, which is unreachable for a guest
  (`if (!authed || hasResumedRef.current) return;` short-circuits first, `authed` is always
  `false` for a guest session). `resuming` stays `false` for the full guest session, every new
  gate degenerates to its pre-CAM-423 behavior, and the `เริ่มแชทใหม่` button never renders
  (`isAuthenticated` gate). **No guest-visible or guest-network behavior changed.**

## Prove-It — hand-verified red-then-green (3 mutations, production restored byte-identical)

Per qa.md's guard-teeth requirement, 3 of the highest-risk REAL (non-source-grep) assertions
were mutated, re-run to confirm red, then reverted (`git diff --stat` clean after each revert
— confirmed, no residual diff on `conversation.ts`/`lib/api-client.ts`):

1. **`restoreEntriesFromMessages` unknown/malformed `blocks` (AC-6/EC-2).** Mutated to pass
   `message.blocks` straight through as `cards` instead of validating via `normalizeBlocks`.
   Result: 2 tests went red (`toMatchObject({cards: [], ...})` failed, received the raw
   malformed/unrecognized block payload as `cards`) — proves the guard has teeth against
   exactly the regression the AC forbids.
2. **`isAuthedSession` boundary (`loading` status, D1).** Mutated `status === 'authenticated'`
   to `status !== 'unauthenticated'`. Result: the `[boundary] the transient 'loading' status ->
   false` test went red (`expected true to be false`) — proves the test actually pins the D1
   invariant (a transient status is never treated as authed) rather than passing vacuously.
3. **`aiChatAPI.sendTurn` request shape (AC-7/BR-5).** Mutated to always send a
   `conversationId` key (`?? null`) even when the caller omitted it. Result: the
   `[normal] posts { message } with NO conversationId key when omitted` test went red
   (received `{conversationId: null, message}` vs expected `{message}`) — proves the exact-shape
   assertion would catch a regression that leaks a spurious key into the CAM-420 zod union body.

All 3 reverted; full file re-confirmed green (43/43) after each revert.

## Gaps closed this pass (3 new tests added, real gaps — not padding)

1. `aiChatAPI.listConversations` — a genuine `fetch` throw (not just a non-2xx status) resolves
   to `{error}`, never rejects. EC-1 explicitly names "network error" as a resume-fetch failure
   mode; the shipped suite only exercised non-2xx `ok:false` responses for this method.
2. `aiChatAPI.getConversation` — same gap, same fix, for the detail fetch (EC-4 sibling).
3. BR-3's suggestion-pill gate (`if (sending || disabled || resuming) return;` inside
   `handleSuggestion`) had no direct source-pin; the shipped suite pinned the composer's
   `canSend` gate but not the separate pill-tap gate. Added.

## Coverage

Measured via `npx vitest run --coverage __tests__/cam-423-ui-resume.test.ts` (real run),
line-mapped against the actual story diff (qa.md: measure the diff, not the whole file/repo):

- `components/ai-chat/conversation.ts` — the file reports 29% stmts / 10% branch overall, but
  **100% of this story's new code** (lines 112-155: `isAuthedSession` + `restoreEntriesFromMessages`)
  is covered — every uncovered statement (lines 41-109) is pre-existing CAM-272 logic
  (`buildOutgoingHistory`/`appendOutcome`/etc.), untouched by this diff and covered by
  `cam-272-*`'s own suite, not re-measured here.
- `lib/api-client.ts` — file-wide 49.5% stmts, but **100% of this story's new code**
  (`sendTurn` lines 377-393, `listConversations` 397-399, `getConversation` 401-403) is
  covered; the reported uncovered range 353-368 is the pre-existing `send()` function body,
  unchanged by this diff.
- `use-ai-chat.ts`/`AiChatPanel.tsx`/`AiChatMessageList.tsx` (new hook logic + wiring) — **not
  measured via v8 instrumentation** (source-inspection strategy per this repo's precedent for
  `useSession()`-gated client components with no jsdom/RTL harness, `environment: 'node'`);
  every branch the AC/BR set names is pinned by an exact-source assertion instead (see matrix
  above). This is the same documented strategy as `__tests__/cam-397-live-session-gate.test.ts`.
- Both new-code files hit the >=80%-on-new-code floor; the two source-inspection-only files
  are honestly reported as not-v8-measured rather than a fabricated percentage.

Full suite (real run, last act): `npx vitest run` -> **213/214 files, 7277/7278 tests passed
(1 failed)**. The 1 failure is the pre-existing, known env-dependent flake
`__tests__/delivery-client.test.ts` (named in the dispatch contract as expected — not chased,
unrelated to this story). `npx tsc --noEmit`: clean. `npx eslint __tests__/cam-423-ui-resume.test.ts`:
0 errors/warnings.

## Owner-verify / staging-G4 rows (browser-only — cannot be proven headless, per qa.md CAM-397 precedent)

| # | Row | Why headless can't prove it |
|---|---|---|
| 1 | AC-1 live transition: log in on a fresh browser session with a saved conversation from a prior visit -> the panel opens already showing the restored thread, with no `กำลังโหลด…` flash longer than the actual fetch | Requires a real `useSession()` re-render across an actual login + a real network round-trip timing; source-inspection proves the LOGIC (call order, fallback), not the perceived flash duration in a browser |
| 2 | AC-1/AC-3 focus transition: opening the panel focuses the composer (`onOpenAutoFocus`) correctly whether or not a resume is in flight, and focus lands correctly after `เริ่มแชทใหม่` clears the thread | Radix focus-trap + `onOpenAutoFocus` behavior is real-DOM/real-focus-manager territory, not reproducible in `environment: 'node'` |
| 3 | Responsive: the resuming indicator + new-chat button render correctly on the mobile bottom-sheet (`~85dvh`) layout vs. the desktop anchored card layout | Tailwind `sm:` breakpoint rendering is a real-viewport concern; no jsdom/RTL harness exists for this component to assert computed layout |
| 4 | EC-3 live transition: log in, open panel (resumes), then actually log out mid-session in the same tab, then send a message -> falls back to the guest legacy path with no crash | Source-inspection proves `runTurn` reads the LIVE `authed` value on every call (the `[authed]` dependency), but only a real browser session-teardown proves the actual NextAuth `useSession()` status flip mid-session |

## Defects found

**0.** No defect opened this pass. The independent re-derivation of the guest-byte-stability
claim, the 3 hand-verified Prove-It mutations, and the 3 closed test gaps found no behavioral
discrepancy against any AC/BR/EC.

## Links

`story.md` (AC/BR/EC) · ADR-013 D1/D6 · `.claude/rules/qa.md` · `.claude/rules/loading.md`
(resume indicator a11y) · `__tests__/cam-423-ui-resume.test.ts` · `components/ai-chat/conversation.ts` ·
`components/ai-chat/use-ai-chat.ts` · `components/ai-chat/AiChatPanel.tsx` ·
`components/ai-chat/AiChatMessageList.tsx` · `lib/api-client.ts` · `app/api/ai/chat/route.ts`
(re-derived untouched, guest byte-stability) · `__tests__/cam-397-live-session-gate.test.ts`
(source-inspection precedent)

## Changelog

- v1 (2026-07-19) — QA verify of the shipped suite (40 tests, frontend-authored in the same
  commit as the code). Independently re-derived the guest byte-stability verdict from
  `app/api/ai/chat/route.ts`'s untouched legacy branch rather than accepting the claim as
  written. Closed 3 real test gaps (network-throw on `listConversations`/`getConversation`,
  BR-3's suggestion-pill gate) -> 43 tests. Hand-verified Prove-It red-then-green on 3
  highest-risk assertions (`restoreEntriesFromMessages` block-skip, `isAuthedSession` boundary,
  `sendTurn` request shape) via temporary mutation, confirmed red, reverted byte-identical.
  0 defects found. Full suite 7277/7278 (1 pre-existing unrelated flake, named in dispatch).
  4 browser-only transitions named as explicit owner-verify/G4 rows. Status: green, ready for
  `next: security`.
