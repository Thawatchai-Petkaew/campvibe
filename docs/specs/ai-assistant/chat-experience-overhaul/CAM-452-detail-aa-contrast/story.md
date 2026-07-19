---
linear: CAM-452
feature: ai-assistant
epic: chat-experience-overhaul
persona: camper
artifact: story
owner: frontend-engineer
status: In Progress
version: v1
updated: 2026-07-20
---
# All remaining small labels in the AI-chat detail drawer clear WCAG AA on the glass surface (CAM-452)

<!-- Gate class: standard (pre-authorized) — reuses the exact `text-foreground/70` token CAM-451 already introduced
     and measured; no new token, no new component, no layout/structure change. staging-only. -->

## Story
As a **Camper**, I want every small caption in the camp-detail drawer to be readable against the glass background, so
that rating, price, review, and travel details don't strain to read regardless of theme.
Why: CAM-451's G3 review (Designer + QA) flagged that only the 2 most prominent labels (section heading, stat-tile
caption) were bumped off the sub-AA `text-muted-foreground` pairing; ~16 sibling small labels on the identical
`bg-ai-surface` glass were left at the same ~4.3:1 light-mode contrast (below the 4.5:1 AA floor).
Scope: `components/ai-chat/AiChatDetailCard.tsx` ONLY — every remaining small-text `text-muted-foreground` /
`text-muted-foreground/80` label bumped to `text-foreground/70` (the CAM-451 token, no new value). No copy, layout,
spacing, or structural class changes.
Depends on: CAM-451 (introduced + measured `text-foreground/70` on this same drawer).

## AC
| # | Given | When | Then (user sees, Thai verbatim) | System effect | Neg/edge |
|---|---|---|---|---|---|
| AC-1 | the camper opens a camp's detail drawer, in either theme | the camper reads any small caption (rating/province line, distance, price captions, activities heading, review meta/content, travel/about lines, per-night CTA caption) | every caption is clearly legible against the glass card, matching the readability of the already-fixed section headings | class changed from `text-muted-foreground`(`/80`) to `text-foreground/70` on all ~16 remaining labels; no copy/order/layout change | EC-1 |

## Rules
- BR-1 Every small-text (`text-xs`/`text-sm`, not large-text) `text-muted-foreground` / `text-muted-foreground/80`
  usage inside `AiChatDetailCard.tsx` is bumped to `text-foreground/70` — the single existing token, not a new value.
  (proves AC-1)
- BR-2 No layout, spacing, grid, or structural class changes accompany the token bump (owner rule: "ui เป็นแบบเดิม") —
  only the text-color class changes on each flagged element.

## Edge cases
- EC-1 IF a label sits on a nested nearly-opaque surface (e.g. the review card's `bg-muted/50`, StatTile's
  `bg-muted/30`) rather than directly on `bg-ai-surface` THEN it still uses the same `text-foreground/70` token for
  visual consistency (computed contrast on the nested surface is equal-or-higher than on the direct glass — verified
  by source-inspection test, not source-of-truth for a design decision).

## Data
— n/a. No schema/API/migration change; token-class-only diff.

## Seams & refs
- Reuse: `text-foreground/70` (introduced + measured by CAM-451 on this exact `bg-ai-surface` combination — see
  `docs/specs/ai-assistant/chat-experience-overhaul/CAM-451-drawer-push/story.md` §Self-verify).
- Refs: CAM-450/447 (original component + IA this drawer implements), CAM-451 (introduced the token + flagged the
  remaining gap in its own review).

## Out of scope
- Any `text-muted-foreground` usage outside `AiChatDetailCard.tsx` (e.g. `AiChatCampCard.tsx`, `AiChatPanel.tsx`) —
  a broader app-wide audit is a separate follow-up ticket if the owner wants one.
- Any copy, layout, spacing, or component change — token-color-only.

## Self-verify
`__tests__/cam-452-detail-aa-contrast.test.ts` (new, Prove-It): re-derives CAM-444's OKLCH -> linear-sRGB contrast
math, additionally compositing through both alpha layers (`--ai-surface`'s own alpha over `--background`, then
`--foreground`'s `/70` alpha over that composited surface — alpha blends in gamma-encoded sRGB, gamma-decoded back
before computing WCAG relative luminance). Measured: **light 7.41:1, dark 8.69:1** for `text-foreground/70` vs the
composited `bg-ai-surface` (both ≥ 4.5:1; matches CAM-451's own ~7.3-7.4:1/~8.3-8.5:1 claim); the original
`text-muted-foreground` pairing measures **4.40:1 light** (confirmed below the 4.5:1 floor, the regression case) and
7.12:1 dark. The nested `bg-muted/50` review-card surface measures 7.31:1 light / 8.24:1 dark for the same token — no
regression on a nested surface. Source-inspection asserts every previously-flagged label (rating/province/distance,
price captions, activities heading, review meta+content, travel/about lines, per-night CTA) now uses
`text-foreground/70`, that zero live `className`s still carry `text-muted-foreground` in this file, and that the two
CAM-451 fixes are untouched. Plus regression run of `__tests__/cam-451-drawer-push.test.ts` +
`__tests__/cam-450-detail-drawer.test.ts`.
- Gate = `/quality-gate` (`npm run lint` 0 errors · `npm run typecheck` clean · `npx vitest run` full suite 249/249
  files green · `check:ds`/`check:palette` 0 violations). `npm run build` skipped locally (Turbopack/worktree symlink
  issue, noted in prior stories on this same worktree); CI verifies the real build. Visual confirmation of the
  legibility improvement in both themes is owner-verify on localhost (browser-only).

## Changelog
- v1 (2026-07-20) — created (spec-lite, filled in the same PR as the code).
