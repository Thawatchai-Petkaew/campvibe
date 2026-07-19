---
linear: CAM-451
feature: ai-assistant
epic: chat-experience-overhaul
persona: camper
artifact: story
owner: frontend-engineer
status: In Progress
version: v1
updated: 2026-07-20
---
# The in-chat camp-detail view becomes a push navigation instead of a floating overlay (CAM-451)

<!-- Gate class: full G2 (owner-directed, NOT the pre-authorized standard class) — this is a NEW container/navigation
     pattern (overlay+scrim -> two-pane push track), not a reuse of an existing flow, even though it composes only
     already-existing tokens (bg-ai-surface/shadow-ai-glow/border-ai-tint/backdrop-blur-xl/rounded-3xl) and no new
     component. staging-only rollout, no prod. -->

## Story
As a **Camper**, I want the camp-detail view to slide in and take over the full chat panel (chat slides away, detail
takes its place) instead of floating on top of the chat behind a dimmed backdrop, so that the detail reads clearly on
small screens instead of feeling cramped, and going back is an obvious, symmetric "slide away" motion.
Why: owner staging feedback (2026-07-20) — CAM-447/450's floating card + scrim felt cramped on small screens; the
owner chose PUSH navigation (chat off-screen left, detail full-width from the right) over the prior overlay, identical
at every breakpoint, with no scrim/dim.
Scope: `components/ai-chat/AiChatPanel.tsx` (new two-pane push track: chat pane | detail pane, each `absolute inset-0`
+ its own `transition-transform`) + `components/ai-chat/AiChatDetailCard.tsx` (drop the floating-card wrapper + scrim
+ absolute-inset positioning; render as an in-flow `h-full w-full` column; bound its scrollable content + CTA to the
same `max-w-2xl sm:max-w-3xl` reading column the chat body uses when `expanded`; bump the two near-floor-contrast
secondary labels from `text-muted-foreground` to `text-foreground/70`; add a "สุดสัปดาห์หน้า"/"Next weekend" caption to
the glance availability stat tile) + `locales/translations.json` (new `aiChat.detail.statNextWeekendLabel` key). No
schema/API change, no change to the 8 decision-order sections' content/order/data-fetch, no change to the CTA/booking
deep-link (out of scope from CAM-450, still out of scope here).
Depends on: CAM-450 (the section-order + glass-card content this reshuffles the container around, content
UNCHANGED) · CAM-447 (the original mount point + a11y contract this extends symmetrically).

## AC
| # | Given | When | Then (user sees, Thai verbatim) | System effect | Neg/edge |
|---|---|---|---|---|---|
| AC-1 | the camper taps a result card | the detail opens | the chat slides fully off-screen to the left as the detail slides in from the right, filling the whole panel; no dimmed backdrop appears at any point | `selectedCamp` set; push track translates both panes in lockstep (`transition-transform duration-200`) | EC-1 |
| AC-2 | the detail view is open | the camper presses the back button (`data-testid="btn--ai-chat-detail-back"`) | the detail slides back off to the right as the chat slides back into view from the left | `selectedCamp` cleared; track reverses; focus restores to the originating card button | EC-2 |
| AC-3 | the detail view is open, on ANY breakpoint (mobile sheet or desktop anchored panel) | the camper looks at the geometry | the push behavior and the full-panel-width detail look identical — no separate mobile/desktop fork | one geometry, no `sm:` breakpoint fork on the track itself | — |
| AC-4 | the chat is slid off-screen (detail open) | the camper tries to Tab into the hidden chat controls | focus never reaches the composer/send/expand/close buttons behind the detail | the chat pane carries `inert` while off-screen | EC-3 |
| AC-5 | the detail is off-screen (chat shown) | the camper tries to Tab toward the hidden detail | focus never reaches the detail's back button or CTA while it is off-screen | the detail pane carries `inert` while off-screen | — |
| AC-6 | the camp's next-weekend stat is fully booked | the camper glances at the availability stat tile | the tile reads "สุดสัปดาห์หน้า" plus the date, so `เต็มแล้ว` is read as next-weekend-only, not the whole camp | stat tile label prefixed with the new `statNextWeekendLabel` copy; the full availability section below is unaffected | — |

## Rules
- BR-1 The push track holds exactly two panes (chat, detail); each is `absolute inset-0` inside one `overflow-hidden`
  viewport and carries its own `transition-transform duration-200 ease-out motion-reduce:transition-none` — never a
  third pane, never a scrim layer. (proves AC-1/AC-2)
- BR-2 The two panes always translate in exactly opposite lockstep off the SAME `selectedCamp` boolean (chat:
  `translate-x-0` / `-translate-x-full`; detail: `translate-x-full` / `translate-x-0`) — never independently
  triggered, never a partial/asymmetric state. (proves AC-1/AC-2/AC-3)
- BR-3 Geometry has no breakpoint fork (`sm:` classes) on the track/pane wrappers themselves — identical at every
  viewport width. `AiChatDetailCard` still receives `expanded` only to bound its OWN internal reading column (matches
  the chat body's existing `expanded`-only max-w convention), never to change push behavior. (proves AC-3)
- BR-4 Whichever pane is off-screen is `inert` (both directions, symmetric) — extends CAM-447's one-directional
  guarantee (chat inert while detail shown) to the detail pane too (detail inert while chat shown). (proves AC-4/AC-5)
- BR-5 `AiChatDetailCard` never fetches for a pane the camper can't see — it only mounts (and its `getCampDetail`
  effect only runs) while `selectedCamp` is set, regardless of push-track position.
- BR-6 The availability stat tile's label is `{statNextWeekendLabel} · {date}` (never the bare date alone); the full
  `weekendAvailability` section below keeps its own unrelated heading and is not touched. (proves AC-6)

## Edge cases
- EC-1 IF `prefers-reduced-motion: reduce` is set THEN both panes jump directly to their end position with no
  animated transform (`motion-reduce:transition-none`).
- EC-2 IF the camper presses Esc while the detail is open THEN the same window-capture Esc handler (unchanged from
  CAM-447) closes the detail via the same `onClose` path as the back button.
- EC-3 IF the camper opens the detail, then reopens the whole chat panel later THEN no stale detail reappears —
  `handleOpenChange(false)` already clears `selectedCamp` on panel close (unchanged from CAM-447).

## Data
— n/a. No schema/API/migration change; this story only changes the container/navigation behavior and touches i18n
copy (one new key) and two token-level contrast fixes.

## Seams & refs
- Reuse: `bg-ai-surface`/`shadow-ai-glow`/`border-ai-tint`/`backdrop-blur-xl`/`rounded-3xl` (CAM-426/450 glass tokens,
  unchanged) · `useMinimumLoading`/`aiChatAPI.getCampDetail`/`ErrorState` (unchanged async wiring) · the chat body's own
  `expanded && "mx-auto max-w-2xl sm:max-w-3xl"` reading-column convention (mirrored onto the detail's scroll content +
  CTA) · `text-foreground/70` (existing secondary-caption token already used in `LocationPicker.tsx`,
  `CampgroundDetailClient.tsx`).
- Refs: `docs/specs/ai-assistant/chat-experience-overhaul/CAM-450-drawer-ia/story.md` (the section-order + glass-card
  content this reshuffles the container around, content unchanged) · `docs/specs/ai-assistant/chat-experience-overhaul/CAM-447-...` (mount point + a11y contract this extends).

## Out of scope
- Any change to the 8 decision-order sections' content, order, or data-fetch (CAM-450's IA is untouched).
- The booking CTA/deep-link behavior (still out of scope from CAM-450).
- A broader `text-muted-foreground` contrast audit across the rest of the app — only the two specific near-floor
  labels this story's own container change surfaces (the section heading + the stat-tile caption) are bumped.

## Self-verify
`__tests__/cam-451-drawer-push.test.ts` (new, Prove-It: no scrim, in-flow full-width pane, translate/transition per
`selectedCamp`, symmetric `inert`, back+Esc still close, new next-weekend label, contrast-bump token) + surgical
updates to `__tests__/cam-450-detail-drawer.test.ts` (floating-card-geometry block replaced with the in-flow/no-scrim
assertions) + `__tests__/cam-447-ai-chat-detail-card.test.ts` (mount-point geometry assertions replaced; entrance-
animation assertion replaced since motion moved to the track) + `__tests__/cam-426-ai-expression-layer.test.ts` and
`__tests__/cam-429-chat-shell-launcher.test.ts` (2 indentation-shift-only string pins updated after the new wrapping
pane div, no behavior change):
- AC-1/AC-2/BR-1/BR-2 → structural: both panes' `transition-transform`/translate classes asserted; no scrim testid/
  class anywhere.
- AC-3/BR-3 → structural: no `sm:` fork on the track/pane wrappers; `expanded` still only bounds the detail's own
  reading column.
- AC-4/AC-5/BR-4 → structural: `inert={selectedCamp !== null}` (chat) and `inert={selectedCamp === null}` (detail)
  both present.
- BR-5 → structural: `AiChatDetailCard` only rendered inside the `{selectedCamp && (...)}` guard (unchanged mount
  condition).
- AC-6/BR-6 → structural + i18n: stat-tile label template asserted; new key verbatim TH/EN, no em-dash.
- Gate = `/quality-gate` (`npm run lint` 0 errors · `npm run typecheck` clean · `npx vitest run` 248/248 files green ·
  `check:ds`/`check:palette` 0 violations). `npm run build` skipped locally (Turbopack fails on this worktree's
  symlinked `node_modules`; CI verifies the real build). AC-1/AC-2/AC-3 (visual push motion, identical-breakpoint
  geometry) and the reduced-motion path are owner-verify on localhost (browser-only). WCAG AA on the two bumped labels
  was checked via a manual OKLCH -> linear-sRGB contrast computation (not an automated axe run): `text-muted-foreground`
  vs the `ai-surface`/`bg-muted` combination measured ~4.3:1 in light mode (below the 4.5:1 floor) and ~6.6-6.9:1 in
  dark; the bumped `text-foreground/70` measures ~7.3-7.4:1 light / ~8.3-8.5:1 dark — both comfortably clear 4.5:1.

## Changelog
- v1 (2026-07-20) — created (spec-lite, filled in the same PR as the code; owner-directed container-behavior change,
  full G2 per the gate-class note above).
