---
linear: CAM-431
feature: ai-assistant
epic: chat-experience-overhaul
persona: camper
artifact: test
owner: qa-engineer
status: Green — 0 open defects, ready for security
version: v1
updated: 2026-07-19
---
# Test — Full-screen immersive expanded chat (CAM-431)

## Test strategy note (read first)

`components/ai-chat/AiChatPanel.tsx` is a `"use client"` component with no jsdom/RTL harness in
this repo (`vitest.config` `environment: 'node'`, `HTMLCanvasElement.getContext` also
unavailable) — source-inspection Prove-It tests are this repo's established precedent
(`cam-272-ai-chat-components.test.ts`, `cam-429-chat-shell-launcher.test.ts`). This is an
**independent QA verify** of a frontend-authored diff (PR #500) — not accepted on the frontend
self-report alone: I hand-verified Prove-It red-then-green on the shipped 16-assertion test file
against the actual pre-CAM-431 (`origin/dev`) source, audited the 2 updated pinned tests
(`cam-272`, `cam-429`) for legitimacy, verified the no-remount claim by reading the full diff
(className-only forks, zero conditional mount/unmount), and confirmed the collapsed variant
renders byte-identical output.

## AC/BR/EC -> test matrix

| # | risk | type | test file | status |
|---|---|---|---|---|
| AC-1/BR-1 (expand -> inset-0, no card frame, no `sm:` variant, ambient edge-to-edge) | H | unit (source-inspection) | `cam-431-fullscreen-immersive-chat.test.ts` | pass |
| AC-2 (collapse -> byte-identical CAM-407 card; no remount) | H | unit (source-inspection) | `cam-431-fullscreen-immersive-chat.test.ts` | pass |
| AC-3/BR-3 (centered `max-w-2xl`/`sm:max-w-3xl` column + gutters; collapsed no-op) | M | unit (source-inspection) | `cam-431-fullscreen-immersive-chat.test.ts` | pass |
| AC-4/BR-4 (fullscreen composer = rounded-full glass dock, gradient on stock `primary`/`info`, no new `--ai-*` token) | H | unit (source-inspection) + repo-wide grep for a new custom property | `cam-431-fullscreen-immersive-chat.test.ts` | pass |
| AC-5 (collapsed composer classes `border-t border-border/60 p-4` byte-identical) | H | unit (source-inspection) | `cam-431-fullscreen-immersive-chat.test.ts` | pass |
| AC-6 (header drops `border-b`; expand/close group into a floating pill; identity cluster unchanged) | M | unit (source-inspection) | `cam-431-fullscreen-immersive-chat.test.ts` | pass |
| BR-2 (every node shared, className-only forks, no conditional mount -> `useAiChat`/`entries`/`draft` never lost) | H | unit (source-inspection: each wiring string present exactly once, unconditional) + manual full-diff read (0 ternary-JSX branches, only `cn(...)` class forks) | `cam-431-fullscreen-immersive-chat.test.ts` | pass |
| BR-5 (`sessionStorage` persistence untouched) | L | unit (source-inspection: `EXPANDED_STORAGE_KEY`/read-write helpers byte-identical to CAM-429) | verified by direct diff read (no assertion needed — zero lines in that block changed) | pass |
| EC-1 (repeated toggle never resets `entries`/`draft`/conversation) | H | covered by BR-2's unconditional-wiring assertions (same mechanism) | `cam-431-fullscreen-immersive-chat.test.ts` | pass |
| EC-2 (`prefers-reduced-motion` guard unchanged) | L | unit (source-inspection: `motion-reduce:data-open:animate-none motion-reduce:data-closed:animate-none` present, untouched by the geometry edit) | verified by direct diff read | pass |
| EC-3 (short viewport / added wrapper introduces no new overflow bug) | M | unit (source-inspection: new wrapper carries `min-h-0 flex-1`, the same scroll-bounding classes CAM-407 already proved via Playwright) | verified by direct diff read; scroll mechanics unchanged | pass, owner-verify row also named below |
| Stale-pin update: `cam-429-chat-shell-launcher.test.ts` (old `inset-2 rounded-3xl border`/`sm:inset-6` assertion) | M | pinned-test audit | `cam-429-chat-shell-launcher.test.ts` | pass, legitimate |
| Stale-pin update: `cam-272-ai-chat-components.test.ts` (old single-line header/composer shrink-0 assertion) | M | pinned-test audit | `cam-272-ai-chat-components.test.ts` | pass, legitimate |
| Standing rules (no emoji, token-only, no raw Thai in JSX, no new `--ai-*`/`app/globals.css` edit) | L | unit (source-inspection) | `cam-431-fullscreen-immersive-chat.test.ts` | pass |

## Prove-It — hand-verified red-then-green (independent re-derivation)

1. Backed up the shipped `AiChatPanel.tsx`, then wrote `origin/dev`'s pre-CAM-431 version
   (`git show origin/dev:components/ai-chat/AiChatPanel.tsx`) into the working file (no branch
   switch).
2. Ran `cam-431-fullscreen-immersive-chat.test.ts` against the reverted source:
   **6 of 16 assertions went red** — exactly the AC-1/BR-1 geometry row, the AC-3 centered-column
   row, the AC-4 gradient-dock row, and both AC-6 header/pill rows (the rows this story actually
   changes). The other 10 (BR-2 no-remount wiring, the collapsed byte-identical CAM-407
   assertions, the glass-shell/DESIGN.md §2.1 binding, standing rules) correctly stayed green —
   they assert things this story does not touch.
3. Restored the shipped file byte-for-byte (`cp` from the backup); `git status --short` showed a
   clean tree. Re-ran `cam-431-fullscreen-immersive-chat.test.ts` +
   `cam-429-chat-shell-launcher.test.ts` + `cam-272-ai-chat-components.test.ts` together:
   **90/90 pass**.

Production files are byte-identical to the shipped commit after the proof; no line was left
mutated.

## Pinned-test audit — `cam-429`/`cam-272` updates, legitimate not weakened

1. **`cam-429-chat-shell-launcher.test.ts`** — the old assertion pinning the near-full-page
   geometry (`inset-2 rounded-3xl border border-border/60` + `sm:inset-6`) was replaced with a
   positive assertion for the new `inset-0 duration-200` string PLUS two explicit negative
   assertions (`.not.toContain`) that the old geometry strings are gone. The collapsed sizing
   pins (`sm:h-[min(37.5rem,80dvh)]`, `sm:w-96`) are untouched. The indentation-shift assertion
   (`<AiChatMessageList\n                entries={entries}` -> `\n                  entries=`)
   correctly reflects the new centered-column wrapper div added one level up (BR-3). **Legitimate**
   — the underlying geometry genuinely changed per this story's own AC-1/BR-1; the update adds
   a negative guard rather than removing coverage.
2. **`cam-272-ai-chat-components.test.ts`** — the old single-string assertion
   (`"flex shrink-0 items-center justify-between border-b"`) was split into two assertions
   (`"flex shrink-0 items-center justify-between"` + `"border-b border-border/60 px-4 py-3"`)
   because the header className now forks via `cn(...)` on `expanded`; both substrings still
   concatenate to the exact original string in the collapsed branch (verified: `cn` with a
   falsy second arg reduces to the first string, unchanged). The composer assertion
   (`"shrink-0 border-t border-border/60 p-4"` -> `"border-t border-border/60 p-4"`) drops only
   the now-forked `shrink-0` prefix from the same combined string, still asserted via the header
   test's own `"flex shrink-0 items-center justify-between"` line and the file's other `shrink-0`
   checks. **Legitimate** — no coverage was net-removed; the split follows the source's real
   structure post-refactor.

No test coverage was net-removed in either file.

## No-remount verification (BR-2, EC-1) — manual full-diff read

Read the entire component diff line-by-line: every fork introduced by this story is a
`className={cn(..., expanded ? A : B)}` or `cn(..., expanded && C)` ternary on an **already-existing**
DOM node — zero `{expanded ? <NodeA/> : <NodeB/>}` JSX branches were added. The `useAiChat()`
destructure (line 137), the `entries={entries}` wiring, and the `useState("")` draft declaration
each appear exactly once, unconditionally, matching the pre-CAM-431 source. Confirmed: toggling
`expanded` cannot remount the message list, composer, or hook state.

## Coverage

- **v8-instrumented (`npx vitest run --coverage`), scoped to `components/ai-chat/AiChatPanel.tsx`:
  0%** (43/43 statements, 15/15 functions, 37/37 lines uncovered). `environment: 'node'` has no
  jsdom/render harness, and this test reads the file via `fs.readFileSync` (never `import`ed/
  executed), so V8 never instruments it. This is a **repo-wide, pre-existing characteristic** of
  every `"use client"` component tested this way (same gap documented in CAM-429's/CAM-426's
  `test.md` for the sibling `ai-chat` files) — not introduced by this story, and not fixable
  within this story's scope.
- **AC/BR/EC-level coverage: 100%** of this story's scope (matrix above) — every AC row, BR rule,
  and EC edge case has at least one passing, Prove-It-verified assertion.
- Full suite (real run, last act after restoring the shipped file):
  `npx vitest run` -> **226/226 files, 7427/7427 tests pass**, 0 failed.
  (One-time worktree setup: `npm run delivery:generate` was needed to regenerate the gitignored
  `prisma/delivery/generated/delivery-client` — this worktree had never run `postinstall`; a
  per-worktree setup step, unrelated to this diff, confirmed via `git check-ignore`.)
  `npx tsc --noEmit`: clean (0 errors).
  `npm run lint`: 0 errors, 256 pre-existing warnings, none in the touched files
  (`AiChatPanel.tsx`, the 3 test files).
  `npm run check:ds`: PASS (0 violations, R1-R8). `npm run check:palette`: PASS (0 violations).
  `npm run build`: succeeds.

## Owner-verify / staging-G4 rows (browser-only — cannot be proven headless)

| # | Row | Why headless can't prove it |
|---|---|---|
| 1 | **Fullscreen visual (light theme)**: expanding the chat on a real page genuinely reads as an immersive full-screen space (no card frame perceptible at any edge), the campfire ambient fills edge-to-edge, and the centered reading column sits with comfortable, visually-balanced side gutters at common desktop widths | Real compositing/perceived-space judgment; source confirms `inset-0` + no `rounded-3xl`/border classes + the `max-w-2xl`/`sm:max-w-3xl` wrapper, not the perceived "immersive, not boxed-in" read |
| 2 | **Fullscreen visual (dark theme)**: same read holds in dark mode — the ambient, glass dock, and floating header pill remain legible and cohesive, no washed-out or overly-dim regions | Theme-dependent visual judgment is real-browser territory |
| 3 | **Glass dock AA contrast**: the composer's placeholder text and the send-button icon stay at WCAG 2.1 AA contrast against the `bg-ai-surface` + gradient-accent (`from-primary/10 via-info/10`) dock background, in both themes, over the moving ambient behind it | Contrast over a translucent/gradient surface with a dynamic canvas backdrop requires a real rendered composite (axe/manual contrast check); cannot be computed from source alone |
| 4 | **Toggle transition (expand/collapse) feel**: growing to full-screen and back reads as a single smooth transition with the message scroll position/composer draft visibly preserved across the shape change (per EC-1's accepted scroll-reset) | Layout/animation perception is real-browser territory; source confirms the no-remount wiring, not the perceived motion |

## Defects found

**0 production defects.** No test-coverage gap found — the shipped 16-assertion suite covers
every AC/BR/EC row 1:1; the 2 sibling pin updates are legitimate refactor re-pins, not
weakenings.

## Links

`docs/specs/ai-assistant/chat-experience-overhaul/CAM-431-fullscreen-immersive-chat/story.md` ·
`.claude/rules/qa.md` · `DESIGN.md` §2.1 · `__tests__/cam-431-fullscreen-immersive-chat.test.ts` ·
`__tests__/cam-429-chat-shell-launcher.test.ts` · `__tests__/cam-272-ai-chat-components.test.ts` ·
`components/ai-chat/AiChatPanel.tsx` ·
`docs/specs/ai-assistant/chat-experience-overhaul/CAM-429-chat-shell-launcher/test.md`
(source-inspection + coverage-honesty precedent)

## Changelog

- v1 (2026-07-19) — Independent QA verify of the shipped suite (PR #500, 16 assertions,
  frontend-authored). Hand-verified Prove-It red-then-green (6/16 correctly red against the
  pre-CAM-431 `origin/dev` source, 90/90 green across the 3 touched test files post-restore).
  Audited the `cam-429`/`cam-272` pinned-test updates — legitimate, not weakened. Manually
  re-derived the BR-2 no-remount guarantee via a full diff read (className-only forks, zero new
  conditional JSX branches). Full suite 226/226 files, 7427/7427 tests green (after a one-time
  worktree `delivery:generate` setup step); typecheck clean; lint 0 errors/256 pre-existing
  warnings; `check:ds`/`check:palette` both PASS; build succeeds. 0 production defects. 4
  browser-only rows named as explicit owner-verify/G4 rows (fullscreen light/dark visual read,
  glass-dock AA contrast, toggle-transition feel). Status: green, ready for `next: security`.
