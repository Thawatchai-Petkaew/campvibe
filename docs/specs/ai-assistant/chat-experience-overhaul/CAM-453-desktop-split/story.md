---
linear: CAM-453
feature: ai-assistant
epic: chat-experience-overhaul
persona: camper
artifact: story
owner: frontend-engineer
status: In Progress
version: v1
updated: 2026-07-20
---
# The detail view becomes a desktop split (chat stays visible) while mobile keeps the full-push (CAM-453)

<!-- Gate class: spec-lite (S story, owner-directed refinement of CAM-451, same PR as the code) — single
     file-surface (AiChatPanel.tsx + tests), no schema/API/new component, reuses only existing tokens. staging-only. -->

## Story
As a **Camper**, I want the camp-detail view to push the chat aside (not fully off-screen) when I'm on a desktop
screen with the chat expanded to fullscreen, so that I can still see and use the chat while reading a camp's detail,
while on mobile the detail still takes over the full screen the way CAM-451 shipped.
Why: owner staging feedback (2026-07-20) after seeing CAM-451 on staging — CAM-451's full off-screen push works well
on mobile (no room for two panes) but wastes the extra width a fullscreen desktop chat already has.
Scope: `components/ai-chat/AiChatPanel.tsx` only — a responsive fork on TOP of the CAM-451 push track. No change to
`AiChatDetailCard.tsx` (its content/props/behavior are untouched; a concurrent story, CAM-452, owns that file).
Depends on: CAM-451 (the two-pane push track this forks) · CAM-452 (concurrent, same file untouched by either story).

## AC
| # | Given | When | Then (user sees, Thai verbatim) | System effect | Neg/edge |
|---|---|---|---|---|---|
| AC-1 | the chat is `expanded` (fullscreen) on a desktop-width viewport (≥ Tailwind `sm:`, 640px) | the camper taps a result card | the chat panel narrows and stays visible + usable on the left; the camp detail slides open as a bounded panel on the right; nothing goes off-screen | track becomes a row split; chat pane `sm:flex-1`, never translated/never `inert`; detail pane widens `sm:w-0 → sm:w-[22rem]`/`lg:w-[26rem]` | EC-1 |
| AC-2 | the desktop split is open (detail panel showing) | the camper types in the composer or taps a suggestion in the still-visible chat | the chat responds normally — nothing behind the detail is blocked | chat pane is not `inert`; composer/send/expand/close remain focusable and clickable | — |
| AC-3 | the desktop split is open | the camper presses the detail's back button | the detail panel narrows back to nothing and the chat regains full width | `selectedCamp` cleared; detail pane returns to `sm:w-0`; focus restores to the originating card button (same path as CAM-451) | EC-2 |
| AC-4 | the chat is on a mobile-width viewport (< `sm:`), OR the chat is collapsed (not `expanded`, the 384px anchored card) at any width | the camper taps a result card | the chat slides fully off-screen and the detail takes the whole panel, exactly as CAM-451 shipped | full-push classes apply unchanged; no split; chat pane `inert` while detail is open | EC-3 |
| AC-5 | the desktop split is NOT active (mobile, or the collapsed card) | the camper taps a result card | the (now off-screen) chat cannot be reached by Tab while the detail is open | chat pane `inert` only in this mode | — |

## Rules
- BR-1 The split layout applies only when BOTH `expanded` is true AND the viewport is at Tailwind's `sm:` breakpoint
  (≥640px) — gated purely via `expanded && "sm:…"` classes so the same JSX renders both behaviors with no separate
  mount/remount. (proves AC-1/AC-4)
- BR-2 In split mode the chat pane is `sm:relative sm:flex-1 sm:min-w-0 sm:translate-x-0` (in-flow, visible, grows to
  fill remaining width) — it is never `absolute`/translated-off and never `inert` while split is active. (proves AC-2)
- BR-3 In split mode the detail pane is a bounded rail (`sm:w-[22rem]` / `lg:w-[26rem]` open, `sm:w-0` closed) that
  animates WIDTH, not transform — a translated fixed-width flex sibling would still reserve its layout box and leave a
  blank gap, so width is the correct axis for a flex-row sibling. (proves AC-1/AC-3)
- BR-4 Outside split mode (mobile, or the collapsed 384px card at any width) the CAM-451 full-push classes apply
  unchanged — both panes `absolute inset-0`, translate fully on/off, chat `inert` while detail is open. (proves AC-4/AC-5)
- BR-5 `inert` on the chat pane is `!isSplitMode && selectedCamp !== null` — a real runtime viewport check
  (`useSyncExternalStore` over `matchMedia("(min-width: 640px)")`, SSR-safe: server snapshot `false`), because `inert`
  is a DOM boolean a CSS `sm:` media query cannot drive. The detail pane's own `inert` (`selectedCamp === null`) is
  unchanged in both modes. (proves AC-2/AC-5)
- BR-6 Motion stays ≤250ms and `motion-reduce`-safe in both modes; the split's width transition repeats the
  `motion-reduce:transition-none` guard at the `sm:` variant so it still wins once the transitioned property switches
  from `transform` to `width` at that breakpoint.

## Edge cases
- EC-1 IF the camper resizes the window across the `sm:` boundary while the detail is open THEN the layout
  re-renders correctly on the next paint (CSS media query for the visual split, `matchMedia` change listener for
  `inert`) — no stale `inert` state.
- EC-2 IF the camper presses Esc while the desktop split is open THEN the same window-capture Esc handler (unchanged
  from CAM-447/451) closes the detail via the same `onClose` path as the back button.
- EC-3 IF the camper collapses the panel (`expanded → false`) while the desktop split is open THEN the layout falls
  back to the full-push classes on the next render (no separate remount; `selectedCamp` state is untouched).

## Data
— n/a. No schema/API/migration change; pure client-side responsive layout fork in one existing component.

## Seams & refs
- Reuse: the CAM-451 two-pane push track (`absolute inset-0` + `transition-transform`) as the mobile/collapsed
  fallback, unchanged · the existing `expanded` sessionStorage state (CAM-429) as the split's gate condition ·
  Tailwind's `sm:`/`lg:` breakpoint prefixes (no new breakpoint token).
- Refs: `docs/specs/ai-assistant/chat-experience-overhaul/CAM-451-drawer-push/story.md` (the push track this forks) ·
  `docs/specs/ai-assistant/chat-experience-overhaul/CAM-452-detail-aa-contrast/story.md` (concurrent, same
  `AiChatDetailCard.tsx`, untouched by this story).

## Out of scope
- Any change to `AiChatDetailCard.tsx` content, props, or behavior (owned by the concurrent CAM-452 story).
- A resizable/user-draggable split width — the rail width is fixed per breakpoint (`22rem`/`26rem`).
- Persisting split-vs-push as a separate user preference — it is fully derived from `expanded` + viewport, not stored.

## Self-verify
`__tests__/cam-453-desktop-split.test.ts` (new, Prove-It: split classes gated by `expanded`+`sm:`, full-push variant
retained unprefixed, chat `inert` conditional on full-push mode only, motion-reduce preserved through the width
transition) + surgical updates to `__tests__/cam-451-drawer-push.test.ts`, `__tests__/cam-447-ai-chat-detail-card.test.ts`,
`__tests__/cam-426-ai-expression-layer.test.ts` (3 pins on the track's className / chat pane's `inert` string updated
to match the legitimate rename — same class/prop, now composed via `cn()` with the new split fork, per the
"design-system refactor changes canonical classes" precedent in `.claude/rules/qa.md`).
- AC-1/AC-4/BR-1/BR-4 → structural: split classes present gated by `expanded && "sm:…"`; full-push classes
  (unprefixed translate) still present unchanged.
- AC-2/BR-2 → structural: chat pane's split-mode classes (`sm:flex-1 sm:min-w-0 sm:translate-x-0`) present.
- AC-3/BR-3 → structural: detail pane's `sm:w-0` / `sm:w-[22rem] lg:w-[26rem]` fork present; `sm:transition-[width]`
  present (not `transform`).
- AC-2/AC-5/BR-5 → structural: `inert={!isSplitMode && selectedCamp !== null}` on the chat pane; `isSplitMode`
  derivation (`expanded && isDesktopViewport`) and the `useSyncExternalStore`/`matchMedia` hook present; detail pane's
  `inert={selectedCamp === null}` unchanged.
- BR-6 → structural: `motion-reduce:transition-none` present on both panes' base classes + `sm:motion-reduce:transition-none`
  on the split's width-transition fork.
- Gate = `/quality-gate` (`npm run lint` 0 errors · `npm run typecheck` clean · `npx vitest run` 250/250 files green ·
  `check:ds`/`check:palette` 0 violations). `npm run build` skipped locally (Turbopack fails on this worktree's
  symlinked `node_modules`; CI verifies the real build). The visual split geometry, the resize-across-breakpoint
  transition (EC-1), and the reduced-motion path are owner-verify on localhost (browser-only, per `.claude/rules/qa.md`).

## Changelog
- v1 (2026-07-20) — created (spec-lite, filled in the same PR as the code; owner-directed responsive refinement of
  CAM-451).
