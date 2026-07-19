---
linear: CAM-433
feature: ai-assistant
epic: chat-experience-overhaul
persona: camper
artifact: test
owner: qa-engineer
status: Green — 0 open defects, ready for security
version: v1
updated: 2026-07-19
---
# Test — loading = flickering น้องกองไฟ flame, drop visible label (CAM-433)

## Test strategy note (read first)

`components/ai-chat/*` are `"use client"` components with no jsdom/RTL harness in this repo
(`vitest.config` `environment: 'node'`, `HTMLCanvasElement.getContext` also unavailable) —
source-inspection Prove-It tests are this repo's established precedent (`cam-272`, `cam-411`,
`cam-425`, `cam-426`, `cam-429`, `cam-432`). This is an **independent QA verify** of a
frontend-authored diff (PR #502, branch `feature/cam-433-loading-flame`) — not accepted on the
frontend self-report alone: I hand-verified Prove-It red-then-green on the shipped 10-assertion
test file against the actual pre-fix (`d7978a3`-merged / CAM-425) source, audited the 1 updated
pinned test file (`cam-425-centered-loading-and-single-thread.test.ts`) for legitimacy, grepped
every other test file referencing the resuming block / `motion-safe:animate-pulse` /
`aiChat.loading` for stale pins, and confirmed the `ai-flame-flicker` reduce-motion gate in
`globals.css` was genuinely untouched by this diff.

## AC→test matrix

| AC | risk | type | test file | status |
|---|---|---|---|---|
| AC-4/EC-2/BR-2 (visible `กำลังโหลด…` removed; `sr-only` span keeps the exact `t.aiChat.loading` string; `role="status"`/`aria-live="polite"`/`aria-busy` unchanged) | H | unit (source-inspection) | `cam-433-loading-flame.test.ts` | pass |
| AC-1/EC-1 (no `motion-safe:animate-pulse` wrapper `<div>` left around `AiChatAvatar`; avatar renders directly) | M | unit (source-inspection) | `cam-433-loading-flame.test.ts` | pass |
| AC-2/AC-3 (flicker/glow are `AiChatAvatar`'s own CAM-432 classes; no new keyframe/class added in this file; `globals.css` reduce-motion gate on `.ai-flame-flicker` untouched) | M | unit (source-inspection) | `cam-433-loading-flame.test.ts` | pass |
| AC-5 (centering `absolute inset-0 flex flex-col items-center justify-center` unchanged — CAM-425 regression guard) | M | unit (source-inspection) | `cam-433-loading-flame.test.ts` | pass |
| Stale-pin update: `cam-425-centered-loading-and-single-thread.test.ts` (old pulse-wrapper + visible-label assertions superseded) | M | pinned-test audit | `cam-425-centered-loading-and-single-thread.test.ts` | pass, legitimate |
| Standing rules (no emoji, token-only — no stray hex/px in the touched block) | L | unit (source-inspection) | `cam-433-loading-flame.test.ts` | pass |

Type mix: 6/6 rows unit/source-inspection (0% integ/e2e) — consistent with the established
precedent for this component family (no jsdom harness in this repo; see strategy note above),
not a deviation this story introduces. All 5 AC rows + both EC rows (EC-1, EC-2) + all 3 BR
rules (BR-1..BR-3) have at least one passing, Prove-It-verified assertion.

## Pinned-test audit — 1 updated file, legitimate not weakened

Re-read the diff against `d7978a3` (pre-CAM-433 merge base):

**`cam-425-centered-loading-and-single-thread.test.ts`** — two describe blocks touched:

1. `"AC-1/BR-2 — on-brand treatment"` — the old assertion `expect(block).toContain(
   "motion-safe:animate-pulse")` is **removed** (this story's BR-1 explicitly deletes that
   wrapper `<div>` — asserting its continued presence would now be asserting the bug this story
   fixes) and the `<AiChatAvatar size="lg" />` presence check is **kept** (still true — the
   avatar itself is unchanged, still rendered, just no longer wrapped). A traceability comment
   naming CAM-433 + pointing at the new test file was added. **Legitimate** — this is exactly
   the "update the guard to the new canonical state" pattern (`.claude/rules/code.md`
   rationalization table), not a coverage cut: the condition being pinned (pulse wrapper
   present) is the literal thing this story removes by design.
2. `"AC-1/BR-4/AC-3 — a11y contract"` — the `role`/`aria-live`/`aria-busy` assertion is
   **unchanged** (still asserts all three). The second test, previously titled "the pulse
   animation class is motion-safe:-scoped" (asserting `className="motion-safe:animate-pulse"`
   literally on the resuming block), is **replaced** with an assertion that the label is now
   `<span className="sr-only">{t.aiChat.loading}</span>` — again the exact condition this
   story's BR-2 changes on purpose (label moves from visible-with-motion-safe-pulse-sibling to
   sr-only-only), not an unrelated coverage loss.

No assertion elsewhere in the file (centering, single-thread guard, etc.) was touched — this
story's scope (`AiChatMessageList.tsx` resuming branch only) is respected. Net effect: 0 removed
assertions describing UNCHANGED behavior, 2 updated assertions describing behavior this story
intentionally changed. **Legitimate re-pin.**

## Stale-pin sweep — other files referencing the resuming block / motion-safe / loading label

Grepped every `__tests__/*.test.ts` for `status--ai-chat-resuming`, `motion-safe:animate-pulse`,
and `aiChat.loading` beyond the two files above:

- `cam-272-ai-chat-components.test.ts:287` / `cam-411-assistant-personality.test.ts:140` — both
  assert `motion-safe:animate-pulse` exists **somewhere** in `AiChatMessageList.tsx`; confirmed
  it still does, at line 179, on the unrelated **typing-dots** pulse (`size-1.5 rounded-full
  bg-muted-foreground motion-safe:animate-pulse`), never touched by this diff. Still valid.
- `cam-423-ui-resume.test.ts:329` — asserts `data-testid="status--ai-chat-resuming"` exists;
  still true (BR-3 keeps this test-id unchanged).
- `cam-423-ui-resume.test.ts:336` — asserts `{t.aiChat.loading}` appears anywhere in the file;
  still true (it now appears inside the `sr-only` span rather than a visible one — the
  assertion doesn't distinguish, and BR-2 requires the string to survive verbatim either way).
- `cam-429-chat-shell-launcher.test.ts:127` — asserts a motion-safe pattern on the **launcher's**
  decorative dots, a different file entirely; unaffected.

No stale/weakened pin found outside the one legitimately-updated file above.

## Prove-It — hand-verified red-then-green (independent re-derivation)

1. Saved the shipped (post-fix) `components/ai-chat/AiChatMessageList.tsx` aside, restored the
   pre-CAM-433 version via `git show 25b1b9f~1:components/ai-chat/AiChatMessageList.tsx` into
   the working file (no branch switch), and re-ran `cam-433-loading-flame.test.ts` in isolation.
2. **2 of 10 shipped assertions went red** exactly on the rows tied to this diff: the "no
   `motion-safe:animate-pulse` wrapper" check (AC-1/EC-1) and the "sr-only span carries
   `t.aiChat.loading`" check (AC-4/BR-2) — both failed against the pre-fix source, which still
   had the wrapper `<div>` + a visible (non-sr-only) `<span>`. The other 8 assertions (avatar
   rendered, no new keyframe/class, `globals.css` gate untouched, role/aria-live/aria-busy
   present, centering classes present, no-emoji/token-only standing rules) correctly stayed
   green — they describe behavior this story does not change.
3. Restored the shipped file byte-for-byte (`cp` back from the aside copy; `git status --short`
   confirmed clean, zero diff vs `HEAD`) and re-ran the isolated file: **10/10 pass**, then the
   full suite: **228/228 files, 7457/7457 tests pass**.

Production files are byte-identical to the shipped commit after the proof; no line was left
mutated in `components/*`.

## Coverage

- **v8-instrumented (`npx vitest run --coverage --coverage.include=components/ai-chat/
  AiChatMessageList.tsx`): 0% / not meaningfully measurable** — `environment: 'node'` has no
  jsdom/render harness, and this test reads the file via `fs.readFileSync` (never `import`ed/
  executed), so V8 never instruments it. This is the **same repo-wide, pre-existing
  characteristic** documented in CAM-425's, CAM-426's, CAM-429's, and CAM-432's `test.md` for
  every `"use client"` `ai-chat` component tested this way — not something this story
  introduces, and not fixable within this story's scope (an architecture/harness change, out of
  scope per `.claude/rules/qa.md` §"NOT for").
- **AC/BR/EC-level coverage: 100%** of this story's scope (matrix above) — every AC row (AC-1
  through AC-5), every BR rule (BR-1..BR-3), every EC edge case (EC-1, EC-2) has at least one
  passing, Prove-It-verified assertion.
- Full suite (real run, last act after the Prove-It restore):
  `npx vitest run` → **228/228 files, 7457/7457 tests pass**, 0 failed.
  `npx tsc --noEmit`: clean (0 errors) — required regenerating the gitignored
  `prisma/delivery/generated/delivery-client` + `@prisma/client` via `npx prisma generate` +
  `npm run delivery:generate` first (a per-worktree setup step for this fresh worktree, not a
  code fix; the two generated dirs are gitignored and unrelated to this diff — before
  regenerating, `__tests__/delivery-client.test.ts` + `lib/delivery/*` (2 more files) failed
  typecheck on `Cannot find module '@/prisma/delivery/generated/delivery-client'`; confirmed all
  green/clean after regeneration, isolated re-run of `delivery-client.test.ts` alone → 2/2 pass).
  `npm run lint`: 0 errors, 256 pre-existing warnings, none in the touched files.
  `npm run check:ds`: PASS (0 violations, R1-R8). `npm run check:palette`: PASS (0 violations).

## Owner-verify / staging-G4 rows (browser-only — cannot be proven headless)

| # | Row | Why headless can't prove it |
|---|---|---|
| 1 | **Loading moment reads as the flame "breathing"** (owner's own framing), not a generic pulse — the resuming state shows only the น้องกองไฟ flame flickering, centered, with no caption underneath, in both light and dark theme | Perceived "reads as on-brand flame, not a stock spinner" is a real-render subjective judgment; source confirms the wrapper div + visible label are gone and only `AiChatAvatar` remains, but the visual read against the owner's original complaint is browser-only |
| 2 | **`prefers-reduced-motion: reduce` → the flame is visibly static** while resuming, confirmed by actually toggling the OS/browser reduced-motion setting and observing the rendered chat panel opening | Source confirms `.ai-flame-flicker`/`.ai-flame-glow` resolve `animation: none` under the existing `reduce` media block (unit-tested, unchanged by this diff); the actual rendered stillness under a real browser + OS toggle is browser-only |
| 3 | **Screen-reader announcement still fires** ("กำลังโหลด…") on opening the chat panel while resuming, with no visible caption on screen | Source confirms the `sr-only` span + `role="status"`/`aria-live="polite"`/`aria-busy` are present (unit-tested); the actual assistive-technology announcement behavior is browser/AT-only |

## Defects found

**0 production defects.** The 1 updated pinned-test file was audited and is legitimate (see
audit above); the stale-pin sweep across 4 other files found no weakened or missed pin; no test
coverage gap was found in the shipped 10-assertion file — it already covers all 5 AC rows + both
EC edge cases + all 3 BR rules directly.

## Links

`docs/specs/ai-assistant/chat-experience-overhaul/CAM-433-loading-flame/story.md` ·
`.claude/rules/qa.md` ·
`__tests__/cam-433-loading-flame.test.ts` ·
`__tests__/cam-425-centered-loading-and-single-thread.test.ts` ·
`components/ai-chat/AiChatMessageList.tsx` · `components/ai-chat/AiChatAvatar.tsx` ·
`app/globals.css` ·
`docs/specs/ai-assistant/chat-experience-overhaul/CAM-432-fire-aura-flicker/test.md`
(source-inspection + coverage-honesty + Prove-It precedent this file follows)

## Changelog

- v1 (2026-07-19) — Independent QA verify of the shipped suite (PR #502, 10 assertions,
  frontend-authored). Hand-verified Prove-It red-then-green on the full shipped file (2/10
  correctly red against the pre-CAM-433 source, 10/10 green after restore). Audited the 1
  updated pinned test file (`cam-425-centered-loading-and-single-thread.test.ts`) — legitimate,
  not weakened (both changes describe behavior this story intentionally changes). Swept 4 other
  test files referencing the resuming block / `motion-safe:animate-pulse` / `aiChat.loading` for
  stale pins — none found. Regenerated the gitignored delivery-client/prisma-client for this
  fresh worktree (unrelated to the diff) — resolved 3 pre-existing typecheck failures including
  the noted env-dependent `delivery-client.test.ts` (2/2 pass in isolation after regen). Full
  suite 228/228 files, 7457/7457 tests green; typecheck clean; lint 0 errors/256 pre-existing
  warnings (0 new); `check:ds`/`check:palette` both PASS. 0 production defects. 3 browser-only
  rows named as explicit owner-verify/G4 rows (on-brand flame read, reduce-motion static
  confirm, screen-reader announcement confirm). Status: green, ready for `next: security`.
