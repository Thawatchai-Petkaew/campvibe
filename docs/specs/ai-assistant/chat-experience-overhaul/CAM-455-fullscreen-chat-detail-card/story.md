---
linear: CAM-455
feature: ai-assistant
epic: chat-experience-overhaul
persona: camper
artifact: story
owner: frontend-engineer
status: In Progress
version: v1
updated: 2026-07-20
---
# The expanded AI-chat panel reverts to true fullscreen; the detail panel becomes the inset floating card (CAM-455)

<!-- Gate class: spec-lite (S story, owner clarification correcting CAM-454's misread, same PR as the code) — file
     surface = AiChatPanel.tsx only + test pin updates. No schema/API/new component. staging-only. -->

## Story
As a **Camper**, I want the EXPANDED AI-chat panel to fill the whole screen edge-to-edge again, with the camp-detail
view reading as a card floating inside it, so that the chat still feels big and immersive while the detail I opened
is visually set apart instead of blending into the same full-bleed surface.
Why: owner clarification (2026-07-20) — CAM-454 misread the earlier feedback and turned the whole expanded CHAT
into an inset card. The "inset card with top/bottom spacing that slides in" was always about the DETAIL panel (the
right-hand info panel CAM-451/453 introduced), not the chat itself.
Scope: `components/ai-chat/AiChatPanel.tsx` only — (a) revert the expanded `PanelPrimitive.Content` geometry from
CAM-454's bounded inset back to CAM-431's `inset-0` fullscreen, with the calmer pre-454 zoom/fade entrance; (b) add
a margin gap to the detail pane's wrapper div (both the CAM-451 mobile/collapsed full-push variant and the CAM-453
desktop split rail) so `AiChatDetailCard`'s own already-carded surface (`rounded-3xl border-ai-tint bg-ai-surface
shadow-ai-glow`, unchanged) reads as a floating inset card.
Depends on: CAM-431 (the fullscreen geometry this restores) · CAM-454 (the geometry this reverts, on the chat only)
· CAM-451/453 (the push track + desktop split this margin change wraps, otherwise unchanged) · CAM-440 (the
non-modal fix, unaffected either way).

## AC
| # | Given | When | Then (user sees, Thai verbatim) | System effect | Neg/edge |
|---|---|---|---|---|---|
| AC-1 | the chat is `expanded` | the panel opens | the chat fills the entire screen edge-to-edge, no gap/rounding/border at the outer edge | expanded Content className is `inset-0`, no `rounded-3xl`/border on the outer geometry | — |
| AC-2 | the chat is `expanded` | the panel opens or closes | the panel fades/zooms in and out (not a directional slide) | `data-open:zoom-in-95 data-open:fade-in-0` / `data-closed:zoom-out-95 data-closed:fade-out-0`, `duration-200`, motion-reduce safe | EC-1 |
| AC-3 | the chat is `expanded` on desktop (`lg:`+) | the camper taps a result card | the detail rail appears as a card with a visible gap on top/bottom/right from the fullscreen chat/screen edge | detail pane carries `lg:my-4 lg:mr-4` on top of its existing `lg:w-[26rem]` rail width; `AiChatDetailCard`'s own rounded/border/shadow paint the card | — |
| AC-4 | the chat is `expanded` on mobile, or the chat is collapsed | the camper taps a result card | the detail view appears as a card with a visible gap on top/bottom (and sides) rather than filling the pane edge-to-edge | detail pane carries `my-3 mx-2` in the full-push (translate) variant | — |
| AC-5 | the chat is `expanded` with the CAM-453 desktop split active | the camper looks at the seam between chat and detail | there is still no visible divider line between the two panes (the margin gap alone separates them) | `lg:border-l` remains absent (CAM-454 already removed it, not reintroduced) | — |
| AC-6 | any AiChatPanel state from CAM-451/453/454 (scroll-lock, background-inert, hidden scrollbars, chrome-hide on detail-open, close-on-route-change) | unrelated to this story's geometry change | that behavior is unaffected | `modal={false}`, the manual scroll-lock effect, `overscroll-contain`, `data-scrollbar-hidden`, the `selectedCamp === null` chrome guard, and `AiChatLauncher`'s pathname-close effect are all unchanged | — |

## Rules
- BR-1 The expanded `PanelPrimitive.Content` className is the bare string `"inset-0 duration-200
  data-open:animate-in data-open:fade-in-0 data-open:zoom-in-95 data-closed:animate-out data-closed:fade-out-0
  data-closed:zoom-out-95"` — no `cn()` wrapper, no rounded/border classes, matching CAM-431 byte-for-byte. The
  collapsed branch (384px card / mobile bottom sheet) is untouched. (proves AC-1/AC-2)
- BR-2 The detail pane wrapper (both the unprefixed full-push variant and the `lg:`-prefixed split variant) drops
  `h-full` and adds a non-auto margin (`my-3 mx-2` / `lg:my-4 lg:mr-4`) instead. An explicit `height:100%` paired
  with `top`/`bottom` both set on an absolutely-positioned box is CSS-over-constrained (CSS2.1 §10.6.4: the browser
  recomputes `bottom` to satisfy the equation, and the box overflows by the margin amount) — dropping the explicit
  height lets the box derive a correct definite height from the insets (full-push) or flex `stretch` (split) minus
  the margin, which the CAM-407 definite-height chain still needs for `AiChatDetailCard`'s own `h-full` child to
  resolve against. (proves AC-3/AC-4)
- BR-3 `AiChatDetailCard`'s own root className (`rounded-3xl border border-ai-tint bg-ai-surface shadow-ai-glow
  backdrop-blur-xl`) is unchanged — the card look is painted by the child; the wrapper's margin only reserves the
  gap. (proves AC-3/AC-4)
- BR-4 The chat pane's own wrapper keeps `h-full` and carries no margin — only the detail pane changes. (proves
  AC-1, by omission — the chat itself never becomes an inset card)
- BR-5 Nothing from CAM-451/453/454 outside the two geometry strings in BR-1/BR-2 is touched: `modal={false}`, the
  scroll-lock + background-inert effect, `overscroll-contain` on both ScrollAreas, `data-scrollbar-hidden`, the
  `selectedCamp === null` chrome-hide guard, the `lg:border-l`-absent divider rule, and `AiChatLauncher`'s
  pathname-close effect. (proves AC-5/AC-6)

## Edge cases
- EC-1 IF `prefers-reduced-motion: reduce` is set THEN the shared `motion-reduce:data-open:animate-none
  motion-reduce:data-closed:animate-none` guard (unchanged from CAM-431/454) suppresses the zoom/fade entrance same
  as it suppressed the slide entrance before.
- EC-2 IF the camper is on desktop but below the `lg:` (1024px) split threshold THEN the detail pane still uses the
  full-push (`my-3 mx-2`) variant, not the split (`lg:my-4 lg:mr-4`) variant — same threshold CAM-453 already
  established, unaffected by this story.

## Data
— n/a. No schema/API/migration change; pure client-side geometry story.

## Seams & refs
- Reuse: `AiChatDetailCard`'s existing card surface tokens (unchanged) · the CAM-451 push-track / CAM-453 split
  JSX structure (unchanged, only the wrapper's own class list forks) · CAM-431's original fullscreen geometry string
  (restored verbatim) · the CAM-454 scroll-lock/inert/scrollbar/chrome-hide machinery (all kept as-is).
- ADR: none — pure Tailwind-class + margin/height CSS-mechanics fix, no new architectural decision.

## Out of scope
- Any change to the detail card's own internal content/sections (untouched, CAM-447/449/450/452 territory).
- A visible divider between chat and detail beyond the margin gap — explicitly not reintroduced (CAM-454 already
  removed it; owner has not asked for it back).
- Any change to collapsed-mode (384px card / mobile bottom sheet) geometry — untouched by this story.

## Self-verify
`__tests__/cam-455-fullscreen-chat-detail-card.test.ts` (new, Prove-It source-inspection: expanded chat is `inset-0`
again with no `rounded-3xl`/border on the outer geometry, `zoom-in-95`/`zoom-out-95` entrance replaces
`slide-in-from-right`, the detail pane carries `my-3 mx-2` (full-push) and `lg:my-4 lg:mr-4` (split) margins, the
chat pane keeps `h-full` with no margin, and the KEEP-list — `modal={false}`, scroll-lock, `.no-scrollbar`,
chrome-hide on `selectedCamp`, no `lg:border-l` — all survive) + surgical pin updates to
`__tests__/cam-429-chat-shell-launcher.test.ts`, `__tests__/cam-431-fullscreen-immersive-chat.test.ts`,
`__tests__/cam-447-ai-chat-detail-card.test.ts`, `__tests__/cam-451-drawer-push.test.ts`,
`__tests__/cam-453-desktop-split.test.ts`, `__tests__/cam-454-expanded-card-shell.test.ts` (each pin updated to the
new, legitimately-changed class string — same class/prop, not weakened — per the "design-system refactor changes
canonical classes" precedent in `.claude/rules/qa.md`).
- AC-1/AC-2/BR-1/BR-4 → structural: the expanded branch's bare `inset-0 ... zoom-in-95 ... zoom-out-95` string
  present; the CAM-454 bounded-inset string absent; the chat pane's `h-full` literal unchanged, no margin added.
- AC-3/AC-4/BR-2/BR-3 → structural: `my-3 mx-2` present on the full-push detail-pane string; `lg:my-4 lg:mr-4`
  present on the split detail-pane string; `AiChatDetailCard`'s own card className unchanged.
- AC-5/AC-6/BR-5 → structural: `lg:border-l` absent; `modal={false}`, scroll-lock add/remove calls,
  `data-scrollbar-hidden`, `{selectedCamp === null && (` chrome guard, and `AiChatLauncher`'s `usePathname`
  close-effect all still present verbatim.
- Gate = `/quality-gate` (`npm run lint` 0 errors · `npm run typecheck` clean · `npx vitest run` 252/252 files green
  · `check:ds`/`check:palette` 0 violations). `npm run build` skipped locally (Turbopack fails on this worktree's
  symlinked `node_modules`; CI verifies the real build). The visual fullscreen chat + floating detail card, and the
  zoom/fade entrance, are owner-verify on localhost (browser-only, per `.claude/rules/qa.md`).

## Changelog
- v1 (2026-07-20) — created (spec-lite, filled in the same PR as the code; owner clarification correcting CAM-454).
