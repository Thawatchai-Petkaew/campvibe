---
linear: CAM-429
feature: ai-assistant
epic: chat-experience-overhaul
persona: camper
artifact: test
owner: qa-engineer
status: Green — 0 open defects, ready for security
version: v1
updated: 2026-07-19
---
# Test — Chat shell + launcher polish (CAM-429)

## Test strategy note (read first)

`components/ai-chat/*` and `components/HostOnboardingFab.tsx` are `"use client"` components
with no jsdom/RTL harness in this repo (`vitest.config` `environment: 'node'`,
`HTMLCanvasElement.getContext` also unavailable) — source-inspection Prove-It tests are this
repo's established precedent (`cam-272-ai-chat-components.test.ts`,
`cam-411-assistant-personality.test.ts`, `cam-426-ai-expression-layer.test.ts`). This is an
**independent QA verify** of a frontend-authored diff (PR #498) — not accepted on the frontend
self-report alone: I hand-verified Prove-It red-then-green on the entire shipped 18-assertion
test file against the actual pre-fix (dev-branch) source, audited the 2 updated pinned tests
(`cam-272`, `cam-411`) for legitimacy, verified the 3 technical claims in the code comments
against the real `@radix-ui/react-dialog`/`@radix-ui/react-dismissable-layer` source in
`node_modules`, and found + closed one real test-coverage gap (below) by authoring one
additional assertion myself (QA-owned test work, no production code touched).

## AC/BR/EC -> test matrix

| # | risk | type | test file | status |
|---|---|---|---|---|
| AC-1 (no background dim; dismiss/focus/a11y untouched) | H | unit (source-inspection) + verified against `node_modules/@radix-ui/react-dialog` + `react-dismissable-layer` source | `cam-429-chat-shell-launcher.test.ts` | pass |
| BR-1/BR-2 (Overlay stays in tree as `bg-transparent`; no dismiss-override) | H | unit (source-inspection) | `cam-429-chat-shell-launcher.test.ts` | pass |
| EC-1 (outside-click still closes) | H | verified structurally: `disableOutsidePointerEvents`/`DismissableLayer` live on `Content`, independent of `Overlay`'s style (real Radix source read) | `cam-429-chat-shell-launcher.test.ts` (no-override guard) | pass |
| AC-2 (expand toggle -> near-full-page) | M | unit (source-inspection) | `cam-429-chat-shell-launcher.test.ts` | pass |
| AC-3 (collapse toggle -> restores card size, no remount) | M | unit (source-inspection) | `cam-429-chat-shell-launcher.test.ts` | pass |
| AC-4 (expand choice persists this tab) | M | unit (source-inspection) | `cam-429-chat-shell-launcher.test.ts` | pass |
| BR-3 (sessionStorage read/write never throw) | M | unit (source-inspection) | `cam-429-chat-shell-launcher.test.ts` | pass |
| BR-4 (no remount of message list/composer/`useAiChat` on toggle) | H | unit (source-inspection: destructure + JSX unchanged) | `cam-429-chat-shell-launcher.test.ts` | pass |
| EC-2 (sessionStorage unavailable -> no crash, defaults collapsed next open) | M | unit (source-inspection: try/catch both wrapped) | `cam-429-chat-shell-launcher.test.ts` | pass |
| Panel desktop-anchor reset (`sm:bottom-24` -> `sm:bottom-6`, doc item 3) | M | unit (source-inspection) — **gap found + closed this pass**, see below | `cam-429-chat-shell-launcher.test.ts` (new assertion) | pass |
| AC-5/BR-5 (HostOnboardingFab -> `bottom-6 left-6`; AiChatLauncher -> `bottom-6 right-6`; no collision) | M | unit (source-inspection) + repo-wide grep for any other `fixed bottom-6 left-6` | `cam-429-chat-shell-launcher.test.ts` + independent `grep` (below) | pass |
| Stale-pin update: `cam-272-ai-chat-components.test.ts` (old `bottom-24` assertion) | M | pinned-test audit | `cam-272-ai-chat-components.test.ts` | pass, legitimate |
| Stale-pin update: `cam-411-assistant-personality.test.ts` (old `bottom-24` assertion) | M | pinned-test audit | `cam-411-assistant-personality.test.ts` | pass, legitimate |
| AC-6/BR-6 (campfire aura: `shadow-ai-glow`, `text-ai-ember`+`ai-flame-glow`, 2 dots `bg-ai-ember`/`bg-ai-firefly`) | M | unit (source-inspection) + cross-checked against `DESIGN.md` §2.1's closed token list | `cam-429-chat-shell-launcher.test.ts` | pass |
| EC-3 (`prefers-reduced-motion` -> static; no new keyframe) | M | unit (source-inspection: `motion-reduce:animate-none` on both dots; no `@keyframes`/`animation:` in the file; `animate-pulse` confirmed stock Tailwind, not redefined in `app/globals.css`) | `cam-429-chat-shell-launcher.test.ts` | pass |
| Standing rules (no emoji, token-only, no raw Thai in JSX, i18n keys exist TH+EN) | L | unit (source-inspection) | `cam-429-chat-shell-launcher.test.ts` | pass |

## Independent source verification — the 3 technical claims behind AC-1/BR-2

Read the actual shipped `node_modules/@radix-ui/react-dialog/dist/index.mjs` +
`@radix-ui/react-dismissable-layer/dist/index.mjs` (not taken on the code comment's word):

1. `Dialog`'s default `modal = true` (line 30) and `AiChatPanel`'s `<Dialog>` never passes
   `modal={false}` -> `DialogOverlay` renders `DialogOverlayImpl` (wraps `RemoveScroll`,
   body scroll-lock) and `DialogContent` renders `DialogContentModal` (`hideOthers` in a
   `useEffect` on `contentRef`, plus `trapFocus: context.open` / `disableOutsidePointerEvents:
   context.open` passed to `DialogContentImpl`).
2. `DialogContentImpl` wires `FocusScope` (`trapped: trapFocus`) and `DismissableLayer`
   (`onDismiss: () => context.onOpenChange(false)`) — both live on `Content`, not `Overlay`.
   `DismissableLayer` wires `useEscapeKeydown` internally (Esc-dismiss), also independent of
   `Overlay`.
3. `cn()` = `twMerge(clsx(...))` (`lib/utils.ts`) — `bg-transparent` passed as the last class
   correctly wins over the base `bg-foreground/15` (Tailwind-merge resolves same-group
   conflicts to the last one), confirming the overlay is genuinely non-dimming, not just
   visually coincidentally transparent.

Verdict: the story's BR-1/BR-2 claims and the shipped code comments are technically accurate
against the real library internals, not an assumption.

## Repo-wide FAB-collision check (BR-5, independent of the shipped test)

```
grep -rn "fixed bottom-6" components app        # only HostOnboardingFab.tsx (left-6) + AiChatLauncher.tsx (right-6)
grep -rn "left-6" components app                # ImageGallery.tsx hits are `absolute`, not `fixed` — no collision
grep -rn "bottom-24" components app __tests__   # survives only inside doc-comments/traceability, no live className
```
Confirms no other fixed element shares `bottom-6 left-6` anywhere in the app.

## Gap found + closed this pass (not a production defect)

The shipped test file pinned the toggle mechanics, sizing, and sessionStorage wiring, but did
**not** independently assert the `AiChatPanel`'s own collapsed desktop-anchor move
(`sm:bottom-24` -> `sm:bottom-6`, item 3 of the file's docblock) — only `AiChatLauncher`'s and
`HostOnboardingFab`'s positions were pinned. The underlying code was already correct (confirmed
by direct `grep`); only the regression guard was incomplete for this one line. I authored one
additional test (`the collapsed desktop anchor resets from sm:bottom-24 to sm:bottom-6`) and
hand-verified Prove-It: red against the reverted pre-fix `AiChatPanel.tsx` (old
`sm:bottom-24` literal), green against the shipped file. No production code was touched; this
is QA-owned test authoring, not a sub-ticket-worthy defect.

## Prove-It — hand-verified red-then-green (independent re-derivation)

1. Copied the shipped (post-fix) `AiChatPanel.tsx`/`AiChatLauncher.tsx`/`HostOnboardingFab.tsx`
   aside, restored the `dev`-branch (pre-CAM-429) versions via `git show dev:<path>` into the
   working files (no branch switch, no `checkout <branch> -- .`), and re-ran
   `cam-429-chat-shell-launcher.test.ts`.
2. **10 of 18 shipped assertions went red** exactly on the AC-1/AC-2/AC-3/AC-4/AC-5/AC-6 rows
   tied to the reverted files (Overlay-transparent, expand-toggle wiring, className variants,
   sessionStorage, FAB positions, aura tokens, decorative dots) — 8 assertions describing
   unchanged behavior (aria-label/onOpenAutoFocus wiring, i18n keys, no-emoji/token-only
   standing-rule checks that don't depend on the diff) correctly stayed green.
3. Restored the shipped files byte-for-byte (`cp` back from the aside copies; `git status
   --short` confirmed clean except my own added test) and re-ran: **18/18 pass**.
4. Repeated steps 1-3 for the one NEW assertion I authored (desktop-anchor reset): red against
   the reverted `AiChatPanel.tsx` (old `sm:bottom-24` literal present), green after restore.

Production files are byte-identical to the shipped commit after every proof; no line was left
mutated in `components/*`.

## Pinned-test audit — `cam-272`/`cam-411` updates, legitimate not weakened

Re-read both diffs against `git diff dev...HEAD`:

1. **`cam-272-ai-chat-components.test.ts`** — the old assertion
   `expect(launcherSrc).toContain("bottom-24 right-6")` (a design.md-seam test proving the
   launcher dodged the FAB) was replaced with an assertion for the NEW live position
   (`fixed bottom-6 right-6 z-50`) plus an explicit negative check that no live className still
   carries `bottom-24`. **Legitimate** — the underlying position genuinely changed (BR-5), so
   pinning the new value and guarding against the old one surviving is correct, not a
   weakening.
2. **`cam-411-assistant-personality.test.ts`** — the old assertion
   `expect(launcherSrc).toContain("bottom-24 right-6")` (inside a broader "all interaction
   states unchanged" test) was replaced with `expect(launcherSrc).toContain("bottom-6
   right-6")`; the hover/active-scale/size assertions in the same test are untouched. **Legitimate**
   — same reasoning; the test's own name was updated to say the offset "resets per CAM-429"
   rather than silently keep an outdated claim.

No test coverage was net-removed in either file; both are strictly correct given the shipped
position change.

## Coverage

- **v8-instrumented (`npx vitest run --coverage`), scoped to the 3 touched production files:
  not measurable / effectively 0%** — `environment: 'node'` has no jsdom/render harness, and
  these tests read the files via `fs.readFileSync` (never `import`ed/executed), so V8 never
  instruments them; they don't even appear as 0%-rows in the coverage table (no bytecode was
  loaded). This is a **repo-wide, pre-existing characteristic** of every `"use client"`
  component tested this way in this codebase (same gap documented in CAM-426's test.md one
  story prior for the sibling `ai-chat` files) — not something this story introduced, and not
  fixable within this story's scope (an architecture change, out of scope per `.claude/rules/qa.md`
  §"NOT for" — API/architecture decisions).
- **AC/BR/EC-level coverage: 100%** of this story's scope (matrix above) — every AC row, every
  BR rule, every EC edge case has at least one passing, Prove-It-verified assertion; the one
  real gap found (desktop-anchor pin) was closed in this pass.
- Full suite (real run, last act after the added assertion):
  `npx vitest run` -> **223/223 files, 7382/7382 tests pass**, 0 failed.
  `npx tsc --noEmit`: clean (0 errors) — required regenerating the gitignored
  `prisma/delivery/generated/delivery-client` via `npm run delivery:generate` first (a
  per-worktree setup step, not a code fix; confirmed via `git check-ignore` that the directory
  is gitignored and unrelated to this diff).
  `npm run lint`: 0 errors, 255 pre-existing warnings (one stray `eslint-disable` comment in
  the shipped test file was removed by QA — it triggered "Unused eslint-disable directive",
  a NEW warning the diff would otherwise have added; now back to the 255 pre-existing baseline,
  none in the touched files).
  `npm run check:ds`: PASS (0 violations, R1-R8). `npm run check:palette`: PASS (0 violations).

## Owner-verify / staging-G4 rows (browser-only — cannot be proven headless)

| # | Row | Why headless can't prove it |
|---|---|---|
| 1 | **No-dim**: opening the chat on Home genuinely reads as "no scrim" (the page behind stays fully legible, no perceptible wash) in both light/dark themes | Real compositing/perceived-brightness judgment; `bg-transparent` is confirmed via source + `twMerge` resolution, but the *visual read* is browser-only |
| 2 | **Expand-full-page**: the header Maximize2/Minimize2 toggle visibly grows the panel to near-full-page and back, smoothly, on both mobile and desktop breakpoints, with the message thread/composer never flashing or losing scroll position | Layout/animation/viewport behavior is real-browser territory; source confirms the className swap and state, not the perceived transition |
| 3 | **Launcher aura**: the campfire glow/ember-firefly dots read as a warm, subtle campfire aura (not distracting, not looking broken) around the launcher button, in both themes | Subjective-but-specified visual judgment over real rendering; also flagging per the dispatch note — no NEW keyframe was added (reuses `ai-flame-glow` + stock `animate-pulse`), so this ships as a glow/pulse effect, not literal moving fireflies. If the owner's staging feedback expected more motion, that is a **new motion** and routes back to full human G2 (BR-6/DESIGN.md §2.1) — flagging explicitly, not assuming either way. |
| 4 | **Host FAB at left**: on Home, logged-in + dashboard-ineligible, both FABs (host CTA bottom-left, chat launcher bottom-right) render simultaneously with no visual overlap at common viewport widths | Requires the `/api/access/dashboard` gate to resolve `true` + a real layout render; source confirms the fixed positions, not the rendered non-collision at every viewport |

## Defects found

**0 production defects.** One test-coverage gap was found (the panel's own desktop-anchor
pin was missing) and closed by QA authoring one additional test — this is normal QA test
work, not a code defect, since the underlying `AiChatPanel.tsx` behavior was already correct.

## Links

`docs/specs/ai-assistant/chat-experience-overhaul/CAM-429-chat-shell-launcher/story.md` ·
`.claude/rules/qa.md` · `DESIGN.md` §2.1 · `__tests__/cam-429-chat-shell-launcher.test.ts` ·
`__tests__/cam-272-ai-chat-components.test.ts` · `__tests__/cam-411-assistant-personality.test.ts` ·
`components/ai-chat/AiChatPanel.tsx` · `components/ai-chat/AiChatLauncher.tsx` ·
`components/HostOnboardingFab.tsx` ·
`docs/specs/ai-assistant/chat-experience-overhaul/CAM-426-ai-expression-layer/test.md`
(source-inspection + coverage-honesty precedent)

## Changelog

- v1 (2026-07-19) — Independent QA verify of the shipped suite (PR #498, 18 assertions,
  frontend-authored). Verified the 3 Radix/`cn()` technical claims directly against
  `node_modules` source. Hand-verified Prove-It red-then-green on the full shipped file
  (10/18 correctly red pre-fix, 18/18 green post-fix). Found + closed one real test-coverage
  gap (panel's own `sm:bottom-24` -> `sm:bottom-6` desktop-anchor pin was unguarded) by
  authoring one new assertion, Prove-It verified. Audited the `cam-272`/`cam-411` pinned-test
  updates — legitimate, not weakened. Removed one stray `eslint-disable` comment from the
  shipped test file (was producing a new lint warning). Full suite 223/223 files, 7382/7382
  tests green; typecheck clean (after regenerating the gitignored delivery-client); lint 0
  errors/255 pre-existing warnings; `check:ds`/`check:palette` both PASS. 0 production
  defects. 4 browser-only rows named as explicit owner-verify/G4 rows (no-dim read,
  expand-full-page transition, launcher-aura feel + motion-scope flag, host-FAB-left
  non-collision). Status: green, ready for `next: security`.
