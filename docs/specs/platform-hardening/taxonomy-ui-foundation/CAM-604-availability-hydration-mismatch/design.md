---
linear: CAM-604
feature: platform-hardening
epic: taxonomy-ui-foundation
persona: Host
artifact: design
owner: frontend-engineer
status: done
version: v1
updated: 2026-07-28
---
# Design — stop the host availability screen rendering twice (CAM-604)

## Flow
No new flow/screen — this is a rendering-correctness fix on the existing availability screen (`/dashboard/campsites/[id]/availability`, CAM-55/CAM-56/CAM-343). The visible calendar, form, and holds sections are unchanged; only the hydration-safety of the calendar header/day-cells (which read "today") changed.

## Non-goals
Does not redesign the calendar, change its layout, or add a new component. Does not fix the separate CSP/streaming defect found under fault injection (AC-3 of `story.md`) — that requires changing shared middleware (`proxy.ts`) outside this story's file surface.

## Alternatives considered
Considered deferring `today`/`month` computation to a post-mount effect (seeding a fixed placeholder for the very first render) to avoid the divergence entirely. Rejected: the calendar's month-label `<span>` and the nav buttons' `disabled` state are rendered UNCONDITIONALLY (not gated behind the loading skeleton), so a placeholder would flash a wrong month label ("January 1970") for a moment on every load — a real, always-visible regression traded for an astronomically rare (day/month-boundary-only) one. `suppressHydrationWarning`, scoped to exactly the elements that read `today`/`month`, is the React-team-sanctioned pattern for this exact "live clock value" case (see Links) and has zero visible cost.

## States (8)
No new interactive element or state was added. The fix touches only how already-existing states render:
- **default / loading / empty / error / disabled** — unchanged; this story does not touch the skeleton, empty, or error branches of `AvailabilityCalendar`.
- **hover / focus (ring) / active** — unchanged on the nav buttons; only their `disabled` attribute's hydration-safety changed, not their interaction states.
The day-cell's "is this today" ring highlight and the nav buttons' disabled-at-bound state are the two pieces of UI whose underlying value (`today`) is now hydration-safe.

## Validation UX
Not applicable — no form/input on this story's surface. No `BR-n` in `story.md` describes a user-facing validation rule.

## Components & tokens
`components/ui/button.tsx` (`<Button variant="outline" size="icon">`, unchanged) · no new component · no new token · `suppressHydrationWarning` is a React DOM attribute, not a design-system concern.

## a11y
Unchanged: the nav buttons already carry `aria-label` (`prevMonthAriaLabel`/`nextMonthAriaLabel`) and `disabled`; the day-cell's `isToday` ring is a supplementary visual cue, not the sole signal (the day number itself is always legible text). Tap targets (`size="icon"` = 44px) and focus ring are untouched by this fix.

## Links
`../../feature.md` · `DESIGN.md` · `story.md` (BR-1..4) · `tech.md` (the full investigation + evidence) · React docs — handling different client/server content: https://react.dev/reference/react-dom/client/hydrateRoot#handling-different-client-and-server-content

## Changelog
- v1 (2026-07-28) — created; documents the (non-visual) hydration-safety fix and the rejected placeholder-deferral alternative.
