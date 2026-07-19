---
linear: CAM-432
feature: ai-assistant
epic: chat-experience-overhaul
persona: camper
artifact: test
owner: qa-engineer
status: Green — 0 open defects, ready for security
version: v1
updated: 2026-07-19
---
# Test — น้องกองไฟ fire aura + flicker + launcher reposition (CAM-432)

## Test strategy note (read first)

`components/ai-chat/*` are `"use client"` components with no jsdom/RTL harness in this repo
(`vitest.config` `environment: 'node'`, `HTMLCanvasElement.getContext` also unavailable) —
source-inspection Prove-It tests are this repo's established precedent (`cam-272`, `cam-411`,
`cam-426`, `cam-429`). This is an **independent QA verify** of a frontend-authored diff (PR
#501, branch `feature/cam-432-fire-aura`) — not accepted on the frontend self-report alone: I
hand-verified Prove-It red-then-green on the entire shipped 19-assertion test file against the
actual pre-fix (PR #498-merged / `ed16f48`) source, audited the 4 updated pinned tests
(`cam-272`, `cam-411`, `cam-426`, `cam-429`) for legitimacy, and re-verified the DESIGN.md §2.1
exception amendment against the shipped prose.

## AC→test matrix

| AC | risk | type | test file | status |
|---|---|---|---|---|
| AC-1 (both marks fire-toned, `bg-ai-ember/10`, not teal `bg-primary`) | M | unit (source-inspection) | `cam-432-fire-aura-flicker.test.ts` | pass |
| AC-2 (VISIBLE `--ai-flame-aura` token, `:root`+`.dark`, mapped to `shadow-ai-flame-aura`, built from ember/firefly only) | H | unit (source-inspection) | `cam-432-fire-aura-flicker.test.ts` | pass |
| AC-3 (`ai-flame-flicker` keyframe: opacity+brightness+scale, gated `prefers-reduced-motion: no-preference`) | H | unit (source-inspection) | `cam-432-fire-aura-flicker.test.ts` | pass |
| AC-4 (`prefers-reduced-motion: reduce` → `animation: none` alongside the other 3 named loops) | H | unit (source-inspection) | `cam-432-fire-aura-flicker.test.ts` | pass |
| AC-4/BR-1 (aura span is a SEPARATE decorative `-z-10`/`pointer-events-none`/`aria-hidden` layer on both surfaces, never on the `<Button>`/`<svg>` itself) | H | unit (source-inspection) + manual read of both components | `cam-432-fire-aura-flicker.test.ts` | pass |
| AC-5/BR-4 (launcher wrapper `bottom-6`→`bottom-10 right-6`; FAB size/interaction states unchanged) | M | unit (source-inspection) + repo-wide `grep` for collision | `cam-432-fire-aura-flicker.test.ts` + independent grep (below) | pass |
| AC-6/BR-3 (DESIGN.md §2.1 amended: closed token list gains `--ai-flame-aura`; motion prose names the 4th loop) | M | unit (source-inspection) | `cam-432-fire-aura-flicker.test.ts` | pass |
| Stale-pin update: `cam-272-ai-chat-components.test.ts` (`bottom-6`→`bottom-10`) | M | pinned-test audit | `cam-272-ai-chat-components.test.ts` | pass, legitimate |
| Stale-pin update: `cam-411-assistant-personality.test.ts` (`bg-primary/10`→`bg-ai-ember/10`, `bottom-6`→`bottom-10`) | M | pinned-test audit | `cam-411-assistant-personality.test.ts` | pass, legitimate |
| Stale-pin update: `cam-426-ai-expression-layer.test.ts` (chip retint to `bg-ai-ember/10` + aura assertion added) | M | pinned-test audit | `cam-426-ai-expression-layer.test.ts` | pass, legitimate |
| Stale-pin update: `cam-429-chat-shell-launcher.test.ts` (position, fire-tone, aura span, span count 2→3) | M | pinned-test audit | `cam-429-chat-shell-launcher.test.ts` | pass, legitimate |
| Standing rules (no emoji, token-only, no off-tier shadow) | L | unit (source-inspection) | `cam-432-fire-aura-flicker.test.ts` | pass |

Type mix: 12/12 rows unit/source-inspection (0% integ/e2e) — consistent with the established
precedent for this component family (no jsdom harness in this repo; see strategy note above),
not a deviation this story introduces.

## Repo-wide FAB-collision check (AC-5, independent of the shipped test)

```
grep -rn "fixed bottom-6\|fixed bottom-10\|fixed bottom-24" components app
  → HostOnboardingFab.tsx:  fixed bottom-6 left-6   (unchanged)
  → AiChatLauncher.tsx:     fixed bottom-10 right-6 (CAM-432, moved up from bottom-6)
```
Different corners AND different vertical offsets now — no collision, confirmed by direct grep,
not just by reading the diff.

## Pinned-test audit — 4 updated stale pins, legitimate not weakened

Re-read all 4 diffs against `git diff ed16f48 HEAD`:

1. **`cam-272-ai-chat-components.test.ts`** — old assertion pinned
   `<div className="fixed bottom-6 right-6 z-50">` (BR-1, "launcher always renders"); replaced
   with the new live `bottom-10 right-6` value + an explicit negative check against the old
   `bottom-6`/`bottom-24` classNames surviving live. **Legitimate** — BR-4/AC-5 genuinely moved
   the position; this pin change is orthogonal to the test's own subject (launcher-always-
   renders), so only the position literal needed updating.
2. **`cam-411-assistant-personality.test.ts`** — two pins updated: (a) the chip-background
   assertion `rounded-full bg-primary/10` → `rounded-full bg-ai-ember/10` (BR-2, AC-1's direct
   subject); (b) the launcher-interaction-states test's position literal `bottom-6 right-6` →
   `bottom-10 right-6` (hover/active-scale/size assertions in the same test are untouched).
   **Legitimate** — both are the exact values this story's AC-1/AC-5 changed, not incidental
   weakening; the doc-comment above (a) was also updated to describe the CAM-432 retint
   instead of silently keeping the outdated "chip background stays bg-primary/10" claim.
3. **`cam-426-ai-expression-layer.test.ts`** — the old assertion
   `expect(avatarSrc).toContain("rounded-full bg-primary/10")` (titled "chip background stays
   ... unchanged") is replaced with the new `bg-ai-ember/10` value PLUS two ADDED assertions
   (`shadow-ai-flame-aura`, `ai-flame-flicker`) — net MORE coverage on this test, not less.
   **Legitimate.**
4. **`cam-429-chat-shell-launcher.test.ts`** — the most substantial rewire: (a) position pin
   `bottom-6 right-6` → `bottom-10 right-6`; (b) the "shadow-ai-glow not shadow-lg" test
   replaced with a fire-tone assertion (`bg-ai-ember/10 hover:bg-ai-ember/20`, no live
   `shadow-ai-glow` className) — the old `shadow-ai-glow` claim is genuinely superseded by
   `shadow-ai-flame-aura` per this story; (c) a NEW assertion added for the aura span itself;
   (d) the "2 decorative dots" test updated to "3 spans total (aura + 2 dots)" and now filters
   by `animate-pulse` to isolate the 2 motion-safe dot spans from the new aura span (which uses
   `ai-flame-flicker`, not `animate-pulse`) — correctly narrower and more precise, not weaker;
   (e) the "no new keyframe in this file" structural test's own wording was corrected to
   clarify `ai-flame-flicker`/`ai-flame-glow` are globals.css class-name REFERENCES, not new
   inline keyframes in this file (still `not.toContain("@keyframes")`/`not.toContain(
   "animation:")` — unchanged assertion, clarified comment only).

No test coverage was net-removed in any of the 4 files; every change is either a genuine
value-shift this story caused, or a net-added assertion. All 4 are legitimate re-pins.

## Prove-It — hand-verified red-then-green (independent re-derivation)

1. Copied the shipped (post-fix) `AiChatAvatar.tsx` / `AiChatLauncher.tsx` / `app/globals.css`
   / `DESIGN.md` aside, restored the pre-CAM-432 versions via `git show ed16f48:<path>` into
   the working files (no branch switch), and re-ran `cam-432-fire-aura-flicker.test.ts`.
2. **14 of 19 shipped assertions went red** exactly on the AC-1/AC-2/AC-3/AC-4/AC-5/AC-6 rows
   tied to this diff (fire-tone retint on both surfaces, `--ai-flame-aura` token existence/
   mapping/hue, the `ai-flame-flicker` keyframe/motion-safe-gate/reduce-motion-off, both aura
   spans, the `bottom-10` reposition, and the DESIGN.md §2.1 exception line) — 5 assertions
   describing unchanged behavior (Flame icon still `text-ai-ember`+`fill-current`, FAB tap
   target still `h-12 w-12`, no-emoji/token-only/no-off-tier-shadow standing-rule checks that
   don't depend on the diff) correctly stayed green.
3. Restored the shipped files byte-for-byte (`cp` back from the aside copies; `git status
   --short` confirmed clean, zero diff vs HEAD) and re-ran the full suite: **226/226 files,
   7431/7431 tests pass**.

Production files are byte-identical to the shipped commit after the proof; no line was left
mutated in `components/*`/`app/globals.css`/`DESIGN.md`.

## Coverage

- **v8-instrumented (`npx vitest run --coverage`), scoped to the 2 touched production
  components: 0% / not meaningfully measurable** — `environment: 'node'` has no jsdom/render
  harness, and these tests read the files via `fs.readFileSync` (never `import`ed/executed),
  so V8 never instruments them. This is the **same repo-wide, pre-existing characteristic**
  documented in CAM-426's and CAM-429's test.md for every `"use client"` `ai-chat` component
  tested this way — not something this story introduced, and not fixable within this story's
  scope (an architecture/harness change, out of scope per `.claude/rules/qa.md` §"NOT for").
- **AC/BR/EC-level coverage: 100%** of this story's scope (matrix above) — every AC row, every
  BR rule (BR-1..BR-4), every EC edge case (EC-1, EC-2) has at least one passing, Prove-It-
  verified assertion.
- Full suite (real run, last act after the Prove-It restore):
  `npx vitest run` → **226/226 files, 7431/7431 tests pass**, 0 failed.
  `npx tsc --noEmit`: clean (0 errors) — required regenerating the gitignored
  `prisma/delivery/generated/delivery-client` + `@prisma/client` via `npx prisma generate`
  first (a per-worktree setup step for this fresh worktree, not a code fix; the two generated
  dirs are gitignored and unrelated to this diff — before regenerating, 3 pre-existing test
  files failed on `Cannot find package '@/prisma/delivery/generated/delivery-client'`,
  including the "known env-dependent" `delivery-client.test.ts`; all 3 are green after
  regeneration).
  `npm run lint`: 0 errors, 256 pre-existing warnings, none in the touched files.
  `npm run check:ds`: PASS (0 violations, R1-R8). `npm run check:palette`: PASS (0 violations).

## Owner-verify / staging-G4 rows (browser-only — cannot be proven headless)

| # | Row | Why headless can't prove it |
|---|---|---|
| 1 | **Aura clearly visible now (not plain)** — both the launcher FAB and the in-chat header avatar show a distinct warm ember/firefly glow ring around the mark, in both light and dark theme, that reads as noticeably stronger than the old faint `shadow-ai-glow` depth shadow (the owner's original complaint) | Perceived-brightness/"reads as fire, not plain" is a real-render visual judgment; source confirms the new `--ai-flame-aura` box-shadow stack is layered/more opaque than `--ai-glow`, but the *subjective read* against the reference image is browser-only |
| 2 | **Flicker reads as a gentle continuous วูบวาบ** — the aura's opacity/brightness/scale oscillates smoothly on a ~2.6s loop, distinguishable from the avatar's own `ai-flame-glow` pulse, without looking janky or distracting | Animation timing/smoothness/"gentle not jarring" is real-browser territory; source confirms the keyframe stops (opacity 0.65-1.0, brightness 0.9-1.3, scale 0.97-1.06) and the `ease-in-out infinite` timing function, not the perceived motion quality |
| 3 | **`prefers-reduced-motion: reduce` → visibly static** — with the OS preference set, both marks show a steady (non-flickering) aura, confirmed by actually toggling the OS/browser reduced-motion setting and observing the rendered page, not just reading the CSS | Source confirms `animation: none` inside the `reduce` media block (unit-tested); the actual rendered stillness under a real browser + OS toggle is browser-only |
| 4 | **Launcher sits noticeably higher, easier thumb reach, no visual collision with the host FAB** at common mobile/desktop viewport widths, in both themes | Layout/viewport rendering + "feels easier to reach" is real-device/browser territory; source + grep confirm the two FABs no longer share a corner or offset, not the rendered non-collision at every real viewport |

## Defects found

**0 production defects.** All 4 pinned-test updates were audited and are legitimate (see
audit above); no test-coverage gap was found in the shipped 19-assertion file — it already
covers all 6 AC rows + both rule-BR concerns (separation of the decorative layer; reduce-
motion gate) directly.

## Links

`docs/specs/ai-assistant/chat-experience-overhaul/CAM-432-fire-aura-flicker/story.md` ·
`.claude/rules/qa.md` · `DESIGN.md` §2.1 ·
`__tests__/cam-432-fire-aura-flicker.test.ts` ·
`__tests__/cam-272-ai-chat-components.test.ts` ·
`__tests__/cam-411-assistant-personality.test.ts` ·
`__tests__/cam-426-ai-expression-layer.test.ts` ·
`__tests__/cam-429-chat-shell-launcher.test.ts` ·
`components/ai-chat/AiChatAvatar.tsx` · `components/ai-chat/AiChatLauncher.tsx` ·
`app/globals.css` ·
`docs/specs/ai-assistant/chat-experience-overhaul/CAM-429-chat-shell-launcher/test.md`
(source-inspection + coverage-honesty + Prove-It precedent this file follows)

## Changelog

- v1 (2026-07-19) — Independent QA verify of the shipped suite (PR #501, 19 assertions,
  frontend-authored). Hand-verified Prove-It red-then-green on the full shipped file (14/19
  correctly red against the pre-CAM-432 source, 19/19 green after restore). Audited all 4
  updated pinned tests (`cam-272`, `cam-411`, `cam-426`, `cam-429`) — all legitimate, none
  weakened (one is net-more-coverage). Confirmed no FAB collision via independent grep.
  Regenerated the gitignored delivery-client/prisma-client for this fresh worktree (unrelated
  to the diff) — resolved 3 pre-existing failures including the noted env-dependent
  `delivery-client.test.ts`. Full suite 226/226 files, 7431/7431 tests green; typecheck clean;
  lint 0 errors/256 pre-existing warnings (0 new); `check:ds`/`check:palette` both PASS.
  0 production defects. 4 browser-only rows named as explicit owner-verify/G4 rows (aura
  visibility read, flicker smoothness, reduce-motion static confirm, launcher reach/no-
  collision at real viewports). Status: green, ready for `next: security`.
