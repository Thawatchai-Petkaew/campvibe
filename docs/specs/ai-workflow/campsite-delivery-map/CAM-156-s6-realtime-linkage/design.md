# CAM-156 S6 — Design

## Dashboard|Map toggle

- Segmented control: `แดชบอร์ด | แผนที่` (Thai, no em-dash, no jargon).
- `role="tablist"` on the `<nav>` container; each option has `role="tab"` + `aria-selected="true|false"`.
- The active tab is rendered as `<span>` (not a link, not interactive). The inactive tab is a real `<a>` anchor so it works without JS.
- Tap target: `min-height: 44px; min-width: 44px` on each tab.
- Focus ring: inherited from the glass chip style (`outline: 2px solid rgba(91,233,176,.8); outline-offset: 2px`) on anchor links.
- Color: active = `#5BE9B0` (emerald token) + `rgba(91,233,176,.15)` background; inactive = `rgba(223,234,245,.6)` on `rgba(16,26,42,.52)` glass.
- All values come from the existing scene design tokens (`--text`, `--muted`, glass palette).

## Placement

- `/status/map`: fixed at `top: 70px, left: 16px` (just below the scope chip at `top: 16px`), inside the scene canvas (no chrome outside the canvas). `z-index: 22`.
- `/status`: inside `topBar` HTML string, to the right of the existing Overview/Epic tabs via `margin-left: 10px` on the toggle `<nav>`.

## States

| State | Description |
|---|---|
| Default (map active) | `แดชบอร์ด` = muted anchor; `แผนที่` = emerald + glass active |
| Default (dashboard active) | `แดชบอร์ด` = emerald span; `แผนที่` = muted anchor |
| Hover (inactive link) | browser default underline + lighter glass hover (no custom CSS needed in the topBar HTML) |
| Focus (inactive link) | `outline: 2px solid rgba(91,233,176,.8); outline-offset: 2px` |
| Reduced-motion | Layout unchanged; animated scene is static (unchanged by this story) |

## Reconcile UX

- No visible loading spinner on reconcile — the overlay data updates silently.
- The live dot + clock in `/status` dashboard-client.tsx already flashes on refresh; the map has no live-dot but the overlay numbers update smoothly.
- An open overlay stays open during reconcile (`openOverlay` state is not touched).
- Character positions do not reset (rAF loop not interrupted).
