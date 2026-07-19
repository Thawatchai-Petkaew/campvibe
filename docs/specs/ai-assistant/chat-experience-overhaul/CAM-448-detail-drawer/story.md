---
linear: CAM-448
feature: ai-assistant
epic: chat-experience-overhaul
persona: camper
artifact: story
owner: frontend-engineer
status: In Progress
version: v1
updated: 2026-07-19
---
# The in-chat camp-detail card opens as a card-styled drawer and shows every review (CAM-448)

<!-- Gate class: G2 = standard class (reuses existing tokens/components: bg-ai-surface, shadow-ai-glow, border-ai-tint, backdrop-blur-xl, rounded-3xl/rounded-t-3xl, tw-animate-css slide-in-from-* utilities already used by AiChatPanel.tsx — no new screen/flow/token) — no separate G2 tap. -->

## Story
As a **Camper**, I want the floating camp-detail card in น้องกองไฟ's chat to slide in like a drawer (while still looking like the glass card the rest of the assistant uses) and to show every amenity/review/available date it has, so that opening a camp's details feels like a natural drawer instead of a pop-in and I don't lose information the assistant already fetched.
Why: R5 owner staging feedback on CAM-447 — the centered scale-in-place "materialize" read as a pop-in rather than a drawer, and only 2 review snippets showed when a camp had more.
Scope: `components/ai-chat/AiChatDetailCard.tsx` only (geometry + entrance + the review render cap) — no change to `AiChatPanel.tsx` (its mount call site/props are untouched), no new component, no new token, no schema/API change.
Depends on: CAM-447 (the floating detail card this refines) · CAM-446 (`getCampDetail`, already server-bounded at `MAX_REVIEWS_RETURNED = 10`) · CAM-431 (the `expanded` no-remount fork this mirrors) · CAM-407 (the definite-height-vs-`max-height` lesson this geometry reuses).

## AC
| # | Given | When | Then (user sees, Thai verbatim) | System effect | Neg/edge |
|---|---|---|---|---|---|
| AC-1 | the camper taps a result card on desktop (sm+ viewport) | the detail card opens | a rounded glass card slides in from the right edge, anchored to the right with the chat still visible to its left; no centered pop-in | no data change; geometry-only (`right`-anchored, `left` auto, width capped) | EC-1 |
| AC-2 | the camper taps a result card on a narrow (mobile) viewport | the detail card opens | a rounded-top glass sheet slides up from the bottom edge | no data change; geometry-only (bottom-sheet) | EC-1 |
| AC-3 | the camper has `เคลื่อนไหวลดลง` (reduced motion) enabled at the OS level | the detail card opens | the card appears in place instantly, no slide | `motion-reduce:animate-none` cancels the enter transform; still readable content | — (accessibility default, no failure path) |
| AC-4 | the fetched camp detail has more than 2 verified reviews | the async section finishes loading | every verified review the assistant fetched is listed (not capped at 2), full review text (not cut short) | client renders `detail.reviews` in full (server already bounds it at 10, CAM-446); no new fetch | EC-2 |
| AC-5 | the camper toggles the chat panel's fullscreen expand while the detail card is open | the panel expands/collapses | the same open detail card widens/narrows into the (still right-anchored on desktop) drawer without closing or losing its data | `expanded` reclassNames the SAME mounted element — no remount, no re-fetch | — (mirrors CAM-431's existing no-remount guarantee, not a new risk this story introduces) |

## Rules
- BR-1 The detail card stays a single `absolute z-20` div layer inside `PanelPrimitive.Content` (never a second Radix `Dialog`) — CAM-447's mount-point decision is unchanged by this geometry refinement. (proves AC-1/AC-2/AC-5)
- BR-2 Geometry forks on the panel's `expanded` boolean via `className` only (no conditional mount) — desktop = `right` pinned + `left` auto + a `max-w-md` (collapsed) / `max-w-lg`+`lg:max-w-xl` (expanded) cap; mobile = a bottom sheet in both states. (proves AC-1/AC-5)
- BR-3 The box uses a definite top+bottom (or `inset-y`) inset pair, never an auto-height box capped only by `max-height` — required for the inner `h-full` card to resolve a real height (CAM-407 lesson). (proves AC-1/AC-2)
- BR-4 Entrance is `animate-in slide-in-from-bottom-8` on mobile; `sm:slide-in-from-bottom-0 sm:slide-in-from-right-8` resets the vertical translate at `sm:` so desktop slides purely horizontally; `motion-reduce:animate-none` cancels the transform entirely under reduced motion. (proves AC-1/AC-2/AC-3)
- BR-5 `detail.reviews` renders with no client-side slice/cap and no `line-clamp` on `review.content` — the server-side `MAX_REVIEWS_RETURNED = 10` (CAM-446, unchanged) is the only bound, so there is no unbounded-fetch risk in showing every row returned. (proves AC-4)
- BR-6 Amenities and available-weekend-date badges already rendered in full pre-CAM-448 (no cap existed there) — unchanged by this story, confirmed by test.

## Edge cases
- EC-1 IF the camper has `prefers-reduced-motion: reduce` set THEN the card appears in its resting position with no translate animation (AC-3) — same rule for both AC-1 and AC-2's entrance.
- EC-2 IF the fetched camp has zero reviews THEN the existing empty-state copy (`t.aiChat.card.noReviews`) shows, unchanged by this story (no new empty state introduced).

## Data
— n/a (className/JSX render-cap change only; no schema/API/migration).

## Seams & refs
- Reuse: `bg-ai-surface`/`shadow-ai-glow`/`border-ai-tint`/`backdrop-blur-xl` (CAM-426 AI Expression Layer token set) · `rounded-t-3xl`/`sm:rounded-3xl` (existing radius scale) · `animate-in`/`slide-in-from-*`/`motion-reduce:animate-none` (tw-animate-css utilities already used by `AiChatPanel.tsx`'s own collapsed bottom-sheet entrance) · the CAM-407 definite-height-inset idiom (`AiChatPanel.tsx`'s `h-[85dvh]` comment).
- Refs: `docs/specs/ai-assistant/chat-experience-overhaul/CAM-446-camp-detail-endpoint/story.md` (the `MAX_REVIEWS_RETURNED` server bound) · CAM-447 (the card this refines, no dedicated spec file was authored for it at the time).

## Out of scope
- Any change to `AiChatPanel.tsx`'s mount call site, props, or its own `expanded`/`inert` wiring — untouched.
- An exit-slide animation on close — the card still unmounts immediately (`{selectedCamp && <AiChatDetailCard .../>}` in `AiChatPanel.tsx`); adding a delayed-unmount exit transition is a follow-up if the owner wants it, not part of this fix.
- Any new `--ai-*` token, new component, or the `.ai-materialize` CSS utility itself (still owned by CAM-426/CAM-432 and their tests; simply no longer applied to this card).

## Self-verify
Updated `__tests__/cam-447-ai-chat-detail-card.test.ts` (source-inspection, same convention as CAM-447 — this repo's Vitest runs `environment: 'node'`, no jsdom):
- AC-1/AC-2/BR-2/BR-3 → structural: exact right-anchored-drawer / bottom-sheet classes present for both `expanded` branches.
- AC-1/AC-2/AC-3/BR-4 → structural: `animate-in slide-in-from-bottom-8 sm:slide-in-from-bottom-0 sm:slide-in-from-right-8` + `motion-reduce:animate-none` present; `ai-materialize` absent.
- AC-4/BR-5 → structural: `detail.reviews.map(...)` present, `MAX_REVIEW_SNIPPETS`/`.slice(0,`/`line-clamp-3` all absent.
- BR-1 → structural (pre-existing, re-run): no `PanelPrimitive`/`<Dialog`/`aria-modal` in the detail card source.
- All other CAM-447 coverage (instant block, async loading/empty/error, Esc/focus, i18n, token-only, zero debug UI) re-run green, unaffected by this diff.
- Gate = `/quality-gate` (`npm run lint` · `npm run typecheck` · `npx vitest run` · `check:ds` · `check:palette`) · Done = merge to `dev` + AC verified on localhost before merge. AC-1/AC-2/AC-3 (visual geometry + reduced-motion) are owner-verify on localhost (browser-only, not asserted by source-inspection alone).

## Changelog
- v1 (2026-07-19) — created (spec-first, template v2, terse per the spec-lite class; owner R5 staging feedback fix on CAM-447).
