---
linear: CAM-454
feature: ai-assistant
epic: chat-experience-overhaul
persona: camper
artifact: story
owner: frontend-engineer
status: In Progress
version: v1
updated: 2026-07-20
---
# The expanded AI-chat panel becomes an inset sliding card with the page locked behind it (CAM-454)

<!-- Gate class: spec-lite (S story, owner-directed refinement of CAM-431/451/453, same PR as the code) — file
     surface = AiChatPanel.tsx (most changes) + AiChatDetailCard.tsx (scroll-lock class + divider spacing only) +
     app/globals.css (new scrollbar/lock utilities) + tests. No schema/API/new component. staging-only. -->

## Story
As a **Camper**, I want the EXPANDED AI-chat panel to feel like a big card sliding in from the right with the page
behind it fully locked, so that the assistant reads as a focused, contained surface instead of a full-bleed overlay
that lets me accidentally scroll or click the page underneath.
Why: owner staging feedback (2026-07-20) — an earlier version of the expanded panel was felt to misread the intent;
this round nails scroll containment, background lock (without reintroducing CAM-440's Radix-modal scrollbar-gutter
bug), and chrome/scrollbar/spacing cleanup in one pass.
Scope: `components/ai-chat/AiChatPanel.tsx` (the shell — most changes) · `components/ai-chat/AiChatDetailCard.tsx`
(only its own ScrollArea's `overscroll-contain`/scrollbar-hidden opt-in + the section-divider spacing balance) ·
`app/globals.css` (new `.ai-chat-scroll-lock` / `.no-scrollbar` / `data-scrollbar-hidden` utilities).
Depends on: CAM-431 (the expanded geometry this supersedes) · CAM-440 (the non-modal fix this must not regress) ·
CAM-451/453 (the push track + desktop split this card now wraps, unchanged).

## AC
| # | Given | When | Then (user sees, Thai verbatim) | System effect | Neg/edge |
|---|---|---|---|---|---|
| AC-1 | the chat is `expanded` | the camper scrolls the message list (or the open detail) to its end | the page behind the panel does not scroll | `overscroll-contain` on both ScrollArea viewports (chat + detail) | — |
| AC-2 | the chat is `expanded` | the camper clicks/taps anywhere in the visible gap around the card | nothing on the page behind reacts | a plain backdrop div (not Radix modal) intercepts the pointer event; the page is `overflow:hidden` + background marked `inert` | EC-1 |
| AC-3 | the chat is collapsed (384px card / mobile bottom sheet), NOT expanded | the camper opens the chat | the rest of the page stays scrollable and usable exactly as before | no scroll-lock class applied; no backdrop pointer capture; `modal={false}` unchanged | — |
| AC-4 | the chat is `expanded` | the panel opens | it visibly slides in as a big card from the right, with a gap on top/bottom/right/left (wider on desktop), not edge-to-edge | `inset-4` (mobile/tablet) / `lg:inset-y-4 lg:right-4 lg:left-24` (desktop) + `rounded-3xl border` + `slide-in-from-right` entrance | — |
| AC-5 | the chat is `expanded` with the CAM-453 desktop split active | the camper looks at the seam between chat and detail | there is no visible line between the two panes | `lg:border-l` divider class removed from the detail rail | — |
| AC-6 | the chat panel is open (any size) | the camper looks for a scrollbar anywhere in the chat/detail/page | no scrollbar is visible anywhere, but scrolling still works | `.no-scrollbar` + `data-scrollbar-hidden` rules hide native + Radix-custom scrollbar affordances on all 3 regions | — |
| AC-7 | a detail panel is open (`selectedCamp !== null`) | the camper looks at the chat header | the close (X) and minimize/expand buttons are hidden | button group conditionally rendered on `selectedCamp === null` | EC-2 |
| AC-8 | a detail panel is open | the camper presses the detail's back button (or Esc) | the detail closes and the chat's close/expand buttons reappear | `selectedCamp` cleared; conditional block re-renders; focus restores to the originating card | — |

## Rules
- BR-1 The scroll-lock is a manual class toggle (`document.documentElement.classList.add("ai-chat-scroll-lock",
  "no-scrollbar")`), never Radix `modal={true}` — `modal={false}` on the Dialog root is unchanged from CAM-440.
  `.ai-chat-scroll-lock` is `overflow:hidden` only, no scrollbar-gutter reservation, so it can never reintroduce the
  CAM-440 phantom-sidebar shift. (proves AC-1/AC-2/AC-3)
- BR-2 The lock + background-inert effect runs only while `open && expanded`; it un-locks and un-inerts on cleanup
  (dependency change or unmount). Collapsed mode never locks. (proves AC-3)
- BR-3 The pointer-capturing backdrop is a plain `<div>` (not Radix's `Dialog.Overlay`, which renders `null`
  whenever the Root's `modal` is `false` — confirmed against `@radix-ui/react-dialog` source) with no
  `RemoveScroll`/`hideOthers`; it only sets `pointer-events-auto` while `expanded`. (proves AC-2/AC-3)
- BR-4 Background elements are marked DOM-`inert` by iterating `document.body`'s children and excluding this
  panel's own portal nodes (`data-ai-chat-node`), so every other on-page control (including the launcher FAB) is
  unreachable while locked. (proves AC-2)
- BR-5 The expanded Content geometry is `inset-4` (mobile/tablet) widening to `lg:inset-y-4 lg:right-4 lg:left-24`
  (desktop) + `rounded-3xl border border-border/60`, entering via `data-open:slide-in-from-right-10` /
  `data-closed:slide-out-to-right-10` at `duration-200` (≤250ms, `motion-reduce`-safe via the existing shared guard).
  The CAM-453 desktop split (chat + detail rail) renders inside this same Content, unchanged. (proves AC-4/AC-5)
- BR-6 Every Radix `ScrollArea` in this story opts into scrollbar-hiding via a `data-scrollbar-hidden` attribute,
  which (with the new `.no-scrollbar` utility) hides both the native browser scrollbar and Radix's own custom
  Thumb/Track, while the Viewport itself stays fully scrollable (wheel/touch/keyboard unaffected). (proves AC-6)
- BR-7 The chat header's close/expand button group is conditionally rendered (`{selectedCamp === null && (...)}`),
  not just visually hidden, so it is also unreachable by Tab while a detail is open; the detail's own back button
  and the existing window-capture Esc listener remain the close path. (proves AC-7/AC-8)

## Edge cases
- EC-1 IF the camper presses Esc while `expanded` and no detail is open THEN Radix's existing `DismissableLayer` on
  `Dialog.Content` closes the whole panel unchanged (the new backdrop does not add or remove any Esc handling).
- EC-2 IF the camper is in the desktop split (chat + detail both visible) THEN the close/expand buttons still hide
  while `selectedCamp !== null`, consistent with the mobile/collapsed push case (AC-7 applies in both layouts).
- EC-3 IF `document`/`window` is unavailable (SSR) THEN the scroll-lock effect no-ops (`typeof document ===
  "undefined"` guard) — this panel is already `next/dynamic(ssr:false)`, so this is a defensive guard, not a live path.

## Data
— n/a. No schema/API/migration change; pure client-side shell/CSS story.

## Seams & refs
- Reuse: the CAM-451/453 push-track + desktop-split JSX (untouched, now living inside the new inset-card geometry) ·
  the existing `expanded` sessionStorage state (CAM-429) as the lock's gate condition · the existing `Dialog
  modal={false}` fix (CAM-440, unchanged) · Radix ScrollArea's own `data-slot` markers (`scroll-area-viewport`,
  `scroll-area-scrollbar`) as CSS selector targets (no edit to the shared `components/ui/scroll-area.tsx` primitive).
- Refs: `docs/specs/ai-assistant/chat-experience-overhaul/CAM-431-fullscreen-immersive-chat/story.md` (the
  true-fullscreen geometry this supersedes) · `docs/specs/ai-assistant/chat-experience-overhaul/CAM-440-non-modal-panel/story.md`
  (the scrollbar-gutter bug this must not regress) · `docs/specs/ai-assistant/chat-experience-overhaul/CAM-453-desktop-split/story.md`
  (the split this card now wraps) · `DESIGN.md` §2.1 (AI-surface glass shell, unchanged).

## Out of scope
- Any change to the CAM-453 desktop-split JSX/logic itself (only the divider class was removed).
- A new shared `viewportClassName`/`scrollbarHidden` prop on `components/ui/scroll-area.tsx` — the CSS-selector
  opt-in (`data-scrollbar-hidden`) was used instead so the shared primitive stays untouched; a future story may
  formalize this as a real prop if more consumers need it.
- Persisting the inset-card breakpoint values as new DESIGN.md tokens — they are one-off geometry for this panel.

## Self-verify
`__tests__/cam-454-expanded-card-shell.test.ts` (new, Prove-It source-inspection: inset-card classes replace
`inset-0`, `slide-in-from-right` entrance, `overscroll-contain` on both ScrollArea viewports, manual scroll-lock
class + `modal={false}` preserved, background-inert wiring, plain backdrop with no RemoveScroll/hideOthers, no
`lg:border-l` divider, `.no-scrollbar`/`data-scrollbar-hidden` utilities present + scrolling not disabled, close/expand
buttons conditionally hidden on `selectedCamp`, balanced `pb-6`/`last:pb-0` divider spacing) + surgical pin updates to
`__tests__/cam-431-fullscreen-immersive-chat.test.ts`, `__tests__/cam-429-chat-shell-launcher.test.ts`,
`__tests__/cam-436-fullscreen-composer.test.ts`, `__tests__/cam-272-ai-chat-components.test.ts`,
`__tests__/cam-453-desktop-split.test.ts` (each pin updated to the new, legitimately-changed class string — same
class/prop, not weakened — per the "design-system refactor changes canonical classes" precedent in
`.claude/rules/qa.md`).
- AC-1/BR-6 → structural: `overscroll-contain` present on both ScrollArea viewports.
- AC-2/AC-3/BR-1/BR-2/BR-3/BR-4 → structural: `modal={false}` unchanged; manual lock effect gated on `open &&
  expanded`; backdrop div's `pointer-events-auto/none` fork; `data-ai-chat-node` exclusion marker present exactly
  twice; no `RemoveScroll`/`hideOthers` import or call.
- AC-4/BR-5 → structural: the new inset-card class string + `slide-in-from-right-10`/`slide-out-to-right-10` present;
  old `inset-0`/`zoom-in-95` expanded-branch string gone.
- AC-5 → structural: no `lg:border-l` anywhere in the live source.
- AC-6/BR-6 → structural: `.no-scrollbar` + `[data-scrollbar-hidden]` rules in `globals.css`; both ScrollAreas carry
  `data-scrollbar-hidden`; no `overflow-hidden` added to either ScrollArea (scrolling not disabled).
- AC-7/AC-8/BR-7 → structural: button group behind `{selectedCamp === null && (...)}`; back button + Esc listener
  unchanged in `AiChatDetailCard.tsx`; `handleCloseDetail` clears `selectedCamp`.
- Gate = `/quality-gate` (`npm run lint` 0 errors · `npm run typecheck` clean · `npx vitest run` 251/251 files green
  · `check:ds`/`check:palette` 0 violations). `npm run build` skipped locally (Turbopack fails on this worktree's
  symlinked `node_modules`; CI verifies the real build). The visual card entrance, backdrop click-through, and
  scrollbar-hidden-but-scrollable behavior are owner-verify on localhost (browser-only, per `.claude/rules/qa.md`).

## Changelog
- v1 (2026-07-20) — created (spec-lite, filled in the same PR as the code; owner-directed refinement of the
  expanded AI-chat panel shell).
