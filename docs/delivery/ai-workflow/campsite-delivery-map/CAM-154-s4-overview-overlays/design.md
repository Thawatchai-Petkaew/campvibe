# S4 — Design

## `<Overlay>` primitive pattern

Single reusable primitive in `campsite-overlays.tsx`. Instantiated 5 times (4 edge chips + You/Gates).

### Props API

```ts
interface OverlayProps {
  id: string               // unique key for single-open management
  position: OverlayPosition // "top-right" | "right" | "bottom-right" | "bottom-left" | "you-gates"
  chipNode: React.ReactNode // chip label content
  chipLabel: string        // aria-label for the chip button
  panelTitle: string       // dialog aria-label + visible heading
  children: React.ReactNode // panel body content
  isOpen: boolean
  onOpen: () => void
  onClose: () => void
}
```

### Chip states

| State | Visual |
|---|---|
| default | glass pill, rgba(16,26,42,.52) bg, white/16% border |
| hover | translateY(-2px), deeper shadow — inside `@media (prefers-reduced-motion: no-preference)` |
| focus | outline 2px emerald #5BE9B0 at offset 2px |
| active (aria-expanded=true) | chip hidden, panel shown instead |
| disabled | N/A (chip is always enabled in S4) |

### Full panel states

| State | Visual |
|---|---|
| open | rgba(10,20,36,.88) bg, 22px blur, 18px radius, shadow 24px |
| close | unmounted (no CSS hide/show — remove from DOM entirely) |

### Focus trap

- On panel open: focus moves to first focusable element inside the panel (close button or first link).
- Tab wraps within the panel: last focusable → first focusable (forward), first → last (backward with Shift+Tab).
- Esc: close panel + return focus to the chip button (`chipRef.current?.focus()`).
- Click-outside: `mousedown` on any element not inside the panel or chip closes the panel.

### Motion

- Chip lift: `transform: translateY(-2px)` + shadow lift on hover — transition 150ms ease-out.
- Canvas dim: `rgba(6,11,26,.38)` overlay at z-index 19 when a panel is open; opacity transition 200ms.
- Scene opacity: 0.82 when panel open, 1 when closed; transition 200ms.
- All motion inside `@media (prefers-reduced-motion: no-preference)` or with `transition` (chip transforms only under the MQ guard; the scene opacity fade is a CSS transition that still runs under reduced-motion — acceptable because it is not vestibular-risk animation, only a static fade).

### 8 states coverage

| State | Delivery | Crew | Env | Backlog | Gates |
|---|---|---|---|---|---|
| default (chip) | ✓ | ✓ | ✓ | ✓ | n/a (triggered by You) |
| hover | ✓ | ✓ | ✓ | ✓ | n/a |
| focus | ✓ aria outline | ✓ | ✓ | ✓ | n/a |
| active (panel open) | ✓ | ✓ | ✓ | ✓ | ✓ |
| disabled | n/a in S4 | n/a | n/a | n/a | n/a |
| loading | n/a (data from server) | n/a | n/a | n/a | n/a |
| empty | `ยังไม่มีสตอรีในโปรเจกต์` | You row always shown | `—` per column | `— ไม่มี story ใน backlog` | `✓ ไม่มีงานรออนุมัติจากคุณตอนนี้` |
| error | n/a (handled by page.tsx error state above) | — | — | — | — |

### A11y

- `role="dialog"` `aria-modal="true"` `aria-label` on each panel.
- `aria-expanded` + `aria-controls` on each chip button.
- Focus trap + Esc + return-focus enforced per panel.
- Contrast: panel bg `rgba(10,20,36,.88)` with white text ≥ 4.5:1 on the dark scene.
- Tap targets: chip `min-height:44px`; close button 28×28 (visually) but the chip + dialog have adequate targets.
- `you-alert` changed from `div` to `button` — keyboard accessible, focusable, fire on Enter/Space.

### Anti-slop

- Every number rendered in a panel is a `MapModel` field — no hardcoded mock data.
- Chip summary strings constructed from live model values in `MapOverlays` root.
- Empty states present for all panels with zero-count data.
- No CSS debug borders, no `console.log`, no placeholder lorem text.
- The `—` glyph used only as an empty-cell sentinel in Env columns and Backlog empty state, never as a separator.
