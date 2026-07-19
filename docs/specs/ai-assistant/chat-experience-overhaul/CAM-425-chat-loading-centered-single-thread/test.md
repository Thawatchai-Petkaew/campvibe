---
linear: CAM-425
feature: ai-assistant
epic: chat-experience-overhaul
persona: camper
artifact: test
owner: qa-engineer
status: Green — 0 open defects, ready for security
version: v1
updated: 2026-07-19
---
# Test — Chat loading is centered + the assistant stays a single thread (CAM-425)

## Test strategy note (read first)

`components/ai-chat/AiChatMessageList.tsx` and `components/ai-chat/AiChatPanel.tsx` are
`useSession()`-gated client components with no jsdom/RTL harness in this repo for this
component class (`vitest.config` `environment: 'node'`) — source-inspection Prove-It tests,
this repo's established precedent (`__tests__/cam-397-live-session-gate.test.ts`,
`__tests__/cam-423-ui-resume.test.ts`). QA independently re-verified the shipped suite (not
accepted on frontend's self-report alone): hand-verified Prove-It red-then-green on the
*entire* new test file against the actual pre-fix source (not just the button-removal
assertions frontend's own comment claimed were "manually verified, not git-encoded"), audited
the 2 CAM-423 test files' updated/removed assertions for legitimacy, closed 1 real coverage
gap, and independently reproduced the "pre-existing delivery-client failure" claim on
`origin/dev` in an isolated worktree.

## AC -> test matrix

| AC/BR | risk | type | test file | status |
|---|---|---|---|---|
| AC-1/BR-1/BR-2/BR-4: resuming indicator is a centered `absolute inset-0` overlay (not the old top-left row), uses `AiChatAvatar size="lg"` + `t.aiChat.loading`, a11y unchanged (`role=status`/`aria-live=polite`/`aria-busy={resuming}`) | H | source-inspection (Prove-It) | `cam-425-centered-loading-and-single-thread.test.ts` | pass |
| AC-1/BR-1 gap: the centering depends on `ScrollArea` Root carrying `position:relative` (components/ui/scroll-area.tsx, untouched by this diff) | M | source-inspection (Prove-It, **QA-added gap test**) | `cam-425-centered-loading-and-single-thread.test.ts` | pass |
| AC-2/BR-3: the "+" new-chat button (`btn--ai-chat-new`, `MessageSquarePlus`) is gone from the panel header for every camper (guest + logged-in); Close button (`btn--ai-chat-close`) unchanged; `isAuthenticated`/`startNewChat` no longer destructured | H | source-inspection (Prove-It) | `cam-425-centered-loading-and-single-thread.test.ts` | pass |
| BR-3: `startNewChat` stays exported/implemented, unchanged, in `use-ai-chat.ts` for a later conversation-switcher story | L | source-inspection | `cam-425-centered-loading-and-single-thread.test.ts` | pass |
| AC-3/BR-2/BR-4: the pulse wrapper class is `motion-safe:animate-pulse`-scoped (disabled under `prefers-reduced-motion: reduce`); `กำลังโหลด…` label still renders | M | source-inspection (logic) + **owner-verify** (visual, browser-only — see below) | `cam-425-centered-loading-and-single-thread.test.ts` | pass |
| EC-1: any resume-fetch failure clears the loader exactly as before (CAM-423 BR-2 unchanged) | M | unchanged, re-confirmed by diff scope (`use-ai-chat.ts` not in the changed-file list) | n/a (no regression possible — file untouched) | pass (by inspection) |

## Prove-It — hand-verified red-then-green (independent re-derivation, not accepted from frontend's comment)

The shipped test file's own comment for AC-2/BR-3 says "Prove-It (manually verified, not
git-encoded to keep this test stable post-commit)" — an unverifiable claim on its own. QA
re-derived it for real, plus extended the same proof to AC-1/BR-1's centering assertions
(never claimed as Prove-It by the shipped file):

1. Checked out both touched production files (`AiChatMessageList.tsx`, `AiChatPanel.tsx`) at
   their pre-fix commit (`495c4e5^`) into the working tree (git-tracked, not a stash).
2. Ran `__tests__/cam-425-centered-loading-and-single-thread.test.ts` against that pre-fix
   source: **7 of 11 assertions went red** — the centering block, the `AiChatAvatar`/pulse
   assertions, the button-absence assertions (`btn--ai-chat-new`, `MessageSquarePlus`), and the
   destructure-line assertion all failed exactly as expected against the superseded code.
3. Restored both files via `git checkout --` (confirmed `git status --short` clean, no residual
   diff) and re-ran: **51/51 pass** (both the new file and the updated `cam-423-ui-resume.test.ts`).
4. Separately Prove-It'd the QA-added gap test (below) the same way: broke
   `scroll-area.tsx`'s `relative` class temporarily -> confirmed red -> restored via `mv` from
   a `.bak` copy -> confirmed `git diff --stat components/ui/scroll-area.tsx` clean -> green.

Production files are byte-identical to the frontend's commit after every proof; no line was
left mutated.

## CAM-423 test-file audit — legitimately updated, not weakened

`__tests__/cam-423-ui-resume.test.ts` had 4 assertions changed by this diff. Audited each
against `git diff origin/dev...HEAD -- __tests__/cam-423-ui-resume.test.ts`:

1. **Removed:** 3 assertions pinning the new-chat button's render/aria-label/icon-import
   (`isAuthenticated && (...)`, `data-testid="btn--ai-chat-new"`, `aria-label={t.aiChat.newChat}`,
   the `MessageSquarePlus` import). **Legitimate** — CAM-425 AC-2 deletes that button entirely;
   the coverage did not disappear, it **moved to a stronger form** in the new file (explicit
   negative assertions: `not.toContain('data-testid="btn--ai-chat-new"')`,
   `not.toMatch(/MessageSquarePlus/)`) — Prove-It'd red above.
2. **Weakened-looking but correct:** the resuming-indicator test dropped its exact-string pin
   on `<LoadingSpinner size="sm" className="h-auto w-auto gap-0" />` (the superseded top-left
   treatment) down to just the `data-testid` presence, with a comment pointing at the new file.
   Per qa.md's own precedent ("a design-system refactor changes canonical classes... updating
   them to the new canonical class is correct, NOT weakening" — CAM-224/226/229), the *specific*
   assertion of what the resuming indicator now renders correctly lives in the new file
   (`AiChatAvatar size="lg"` + `motion-safe:animate-pulse`), so this is reallocation, not loss.

No test coverage was net-removed; the AC-2/AC-1 assertions the CAM-423 file used to carry now
live, in stronger (Prove-It'd) form, in `cam-425-centered-loading-and-single-thread.test.ts`.

## Pre-existing-failure claim — independently reproduced on `origin/dev`

Frontend reported 2 vitest failures in `__tests__/delivery-client.test.ts` as pre-existing/
environment-dependent. Verified, not just accepted:

- Ran the full suite in the feature worktree (before any fix): **3 test files** failed with
  the identical root cause — `Cannot find package '@/prisma/delivery/generated/delivery-client'`
  (`cam-215-sec-a-access-control.test.ts`, `delivery-tickets-api.test.ts` fail at collection
  with 0 tests counted; `delivery-client.test.ts` fails 2 individual tests) — the generated
  Prisma client for the separate delivery-ticket schema (`/prisma/delivery/generated/`,
  gitignored) was never generated in this worktree.
- **Root cause confirmed environment-only, not code:** none of the 5 files this diff touches
  (`AiChatMessageList.tsx`, `AiChatPanel.tsx`, 2 test files, `story.md`) reference
  `lib/delivery/*` or the generated client at all.
- **Independently reproduced on `origin/dev`:** added a detached temporary git worktree at
  `origin/dev` (2a38df5, a fresh checkout with no generated artifacts either) and ran
  `__tests__/delivery-client.test.ts` in isolation — **identical 2/2 failures, same error,
  same lines** — confirms the failure is a worktree/checkout environment gap, not something
  this story's diff introduced. Temporary worktree removed after the repro.
- Ran the standard `npx prisma generate --schema prisma/delivery/schema.prisma` (a gitignored
  generated-artifact step, not a code change) in the feature worktree: **typecheck and the full
  suite both went 100% clean** (215/215 files, 7288/7288 tests, 0 typecheck errors) — confirms
  there is no latent code defect behind the failure, only a missing per-worktree generate step.
- **Verdict: pre-existing failures confirmed = yes.** Not introduced by this diff.

## Coverage

- **v8-instrumented: 0%** for both touched files (`AiChatMessageList.tsx`,
  `AiChatPanel.tsx`) — honestly reported, not fabricated. These components are never imported/
  executed by the tests (read via `fs.readFileSync` only, per the source-inspection strategy);
  v8 cannot see string-level assertions as "coverage." This is the same documented gap as
  `__tests__/cam-397-live-session-gate.test.ts` and `cam-423-ui-resume.test.ts`'s own
  UI-wiring tests.
- **AC/BR-level coverage: 100%.** Every AC (1-3) and every BR (1-4) the ticket enumerates maps
  to at least one passing, Prove-It'd assertion (matrix above); the one behavioral edge (EC-1)
  is unaffected by diff scope and re-confirmed by file-list inspection.
- Full suite (real run, last act, after the `prisma generate` environment fix):
  `npx vitest run` -> **215/215 files, 7288/7288 tests passed**, 0 failed.
  `npx tsc --noEmit`: clean (0 errors). `npx eslint .`: 0 errors, 254 pre-existing warnings
  (none in any file this diff touches — confirmed via a scoped `eslint` run on exactly the
  4 touched/new files: 0 errors, 0 warnings). `npm run check:ds`: PASS (0 violations).
  `npm run check:palette`: PASS (0 violations).

## Owner-verify / staging-G4 rows (browser-only — cannot be proven headless)

| # | Row | Why headless can't prove it |
|---|---|---|
| 1 | AC-3: with OS/browser `prefers-reduced-motion: reduce` set, opening the panel mid-resume shows the avatar static (no pulse) while `กำลังโหลด…` stays visible | `motion-safe:` is a real CSS media-query variant; `environment: 'node'` has no browser/media-query engine to evaluate it. Source-inspection proves the class is correctly scoped; the actual rendered (non-)animation needs a real browser |
| 2 | AC-1 live transition: opening the panel while the resume fetch is in flight visually shows the centered avatar+label in the middle of the chat body (between header and composer), not clipped/offset by the `ScrollArea` Viewport's internal `display:table` wrapper | Radix's internal Viewport layout + the absolute-overlay resolution against the Root's actual rendered box is real-DOM/real-layout territory, not reproducible in `environment: 'node'` |
| 3 | Responsive: the centered loader renders correctly centered on both the mobile bottom-sheet (`~85dvh`) and the desktop anchored card (`sm:h-[min(37.5rem,80dvh)]`) layouts | Tailwind `sm:` breakpoint rendering is a real-viewport concern; no jsdom/RTL harness exists for this component to assert computed layout |

## Defects found

**0.** No defect opened this pass. Prove-It re-derivation (11/12 assertions correctly red
pre-fix, all green post-fix), the CAM-423 test-file audit, and the pre-existing-failure repro
found no behavioral discrepancy against any AC/BR/EC, and no coverage was silently dropped.

## Links

`story.md` (AC/BR/EC) · `.claude/rules/qa.md` · `.claude/rules/loading.md` (§5 a11y pair +
reduced motion) · `__tests__/cam-425-centered-loading-and-single-thread.test.ts` ·
`__tests__/cam-423-ui-resume.test.ts` · `components/ai-chat/AiChatMessageList.tsx` ·
`components/ai-chat/AiChatPanel.tsx` · `components/ai-chat/AiChatAvatar.tsx` ·
`components/ui/scroll-area.tsx` · `__tests__/cam-397-live-session-gate.test.ts`
(source-inspection precedent)

## Changelog

- v1 (2026-07-19) — QA verify of the shipped suite (11 tests, frontend-authored in the same
  commit as the code). Hand-verified Prove-It red-then-green on the whole new test file against
  the actual pre-fix source (7/11 red -> 51/51 green), not just accepted from the shipped
  file's own unverifiable comment. Audited the CAM-423 test file's 4 changed assertions —
  legitimately updated (coverage moved to stronger negative assertions in the new file), not
  weakened. Closed 1 real gap (ScrollArea Root `position:relative` load-bearing dependency,
  Prove-It'd) -> 12 tests. Independently reproduced the pre-existing `delivery-client.test.ts`
  failure on `origin/dev` in an isolated worktree (confirmed environment-only: resolved by the
  standard `prisma generate` step, not a code fix) -> full suite 215/215 files, 7288/7288 tests
  green. 0 defects found. 3 browser-only rows named as explicit owner-verify/G4 rows. Status:
  green, ready for `next: security`.
