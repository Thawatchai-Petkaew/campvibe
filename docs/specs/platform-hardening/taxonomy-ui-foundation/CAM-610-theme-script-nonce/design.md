---
linear: CAM-610
feature: platform-hardening
epic: taxonomy-ui-foundation
persona: Camper
artifact: design
owner: frontend-engineer
status: done
version: v1
updated: 2026-07-28
---
# Design — Let the theme's anti-flash script run under our CSP (CAM-610)

## Flow
No new screen, flow, or visible UI element. This is root-layout wiring: `app/layout.tsx` reads the
per-request nonce (already present on the request headers since CAM-607) via `headers().get('x-nonce')`
and passes it down `<Providers nonce={nonce}>` → `<ThemeProvider nonce={nonce}>` (a prop `next-themes`
already supports natively). The user-visible effect is negative-space: the theme resolves at the correct
moment (before first paint) instead of a moment later, on the client, after paint — the flash this script
exists to prevent stops happening.

## Non-goals
Does not change what theme is default (CAM-544, already shipped), does not add a new theme, does not touch
the 3-way `ThemeToggle` UI (CAM-105), does not touch any CSP directive (`proxy.ts` is out of bounds — CAM-607
owns it and already carries the correct nonce onto the request).

## States (8)
Not applicable in the usual sense — there is no new interactive component. The "state" this story actually
governs is a **timing** state of the existing theme system, restated against the 8-state frame for
completeness:
- **default / loading (cold load)** — before this fix: script blocked, theme resolves late client-side ⇒
  visible flash of the wrong theme. After: script runs inline pre-paint ⇒ correct theme from first paint,
  no loading flicker to show.
- **error** — n/a; a blocked script throws no error the app surfaces (the CAM-218/CAM-607 family shape);
  this fix removes the silent failure, it does not add error handling for it.
- **hover / focus / active / disabled / empty** — n/a; no interactive element is added by this story. The
  existing `ThemeToggle` (CAM-105) already covers its own 8 states and is unchanged here.

## Validation UX
Not applicable — no form, no user input, no error copy. Nothing in `locales/` changes.

## Components & tokens
No new component. Reuses `next-themes`'s `<ThemeProvider>` (already the system's one theme-provider,
CAM-105/CAM-544) with its native `nonce` prop — a library capability, not an invented one. No token/color/
spacing value is touched.

## a11y
No a11y surface changes: no new control, no new focus target, no new copy. Indirect a11y benefit: a
correctly-timed theme avoids a jarring color flash for photosensitive/vestibular-sensitive users on load
(a real, if secondary, WCAG-adjacent concern for animated/flashing content) — not itself a WCAG success
criterion this story is scored against.

## Links
`../../feature.md` · `DESIGN.md` · `story.md` (BR-1..3) · `docs/specs/platform-hardening/taxonomy-ui-foundation/CAM-607-csp-streaming-script/tech.md` (the mechanism this story's fix reuses) · `.claude/rules/security.md` (CSP lineage: CAM-203/CAM-218/CAM-607).

## Changelog
- v1 (2026-07-28) — created
