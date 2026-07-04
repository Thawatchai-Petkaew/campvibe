# CAM-157 (S7) — Design Brief

> S7 is a hardening pass, not a new design. The visual language is unchanged from S1–S6.
> This brief documents the a11y states, reduced-motion label layout, and the design decisions made.

## Reduced-motion label (AC1)

Under `prefers-reduced-motion: reduce`, each agent character gets a two-line text label below the sprite:

```
[display name]       e.g. "Frontend"
[status tag]         e.g. "กำลังทำ" (pill, teal border) | "พัก" (pill, muted)
```

For You:
```
คุณ
⚑3 รอคุณ  (amber pill when gates > 0)
ปกติ       (muted pill when 0 gates)
```

The label is always in the accessibility tree (`role` is on the `<button>`, not the label itself). Under normal motion the `.rm-label` is `display:none` so it does not clutter the animated scene; under `reduce` it becomes `display:block`.

### Label CSS design decisions
- Font: system-ui (no custom font load needed — the map page is not in the normal layout)
- Name: 11px font-weight:700 `--text` color
- Status pill: 9.5px border-radius:999px — matches the `.badge` pill grammar on the scene
- Working state: `#5BE9B0` (teal, --emerald) border + text — same as orb values in overlays
- Gate/amber state: `var(--amber)` (#FFB454) border + text — same as You badge

## Keyboard / screen-reader (AC2)

### Scene `role="img"` + `aria-label`
The `.map-stage` element gets `role="img"` and a computed `aria-label` that summarises:
`แผนที่แคมป์: กำลังทำงาน {N}/7 คน, รออนุมัติ {G} งาน, คืบหน้า {P}%`

This matches the pattern for canvas/SVG regions that have a meaningful summary but individual interactive items are in the accessibility tree separately.

### Agent `<button>` elements
Each agent changes from `<div>` → `<button>` with:
- `type="button"`
- `aria-label`: `{displayName} ({roleLabel}): กำลังทำ {taskId}` or `{displayName} ({roleLabel}): พัก`
- `min-width: 44px`, `min-height: 44px` (tap target)
- Focus ring: inherits `outline:2px solid rgba(91,233,176,.8)` from `.you-alert:focus-visible` — same green ring used across the overlay chips

You button aria-label: `คุณ: มี {N} gate รอตรวจสอบ — กดเพื่อดูรายละเอียด` | `คุณ: ไม่มี gate รอ`

### Tab order
You is rendered first in the DOM (before the agents array) so it comes first in tab order — matching the AC2 requirement ("tab order reaches You first").

After You: agents in ROLE_CONFIG order (architect → designer → backend → frontend → devops → qa → security), then overlay chips.

### Popover on focus
The existing `.scout:focus-visible .popover { opacity:1 }` CSS rule already shows the popover on keyboard focus — no additional code needed.

## Error state (AC3)
The error banner uses `.map-placeholder` + `.map-placeholder-text` (same classes as the loading state). The SCENE HTML is rendered unconditionally before the error conditional — so the night background is always present.

Copy matches `/status` exactly: `โหลดข้อมูลจาก Linear ไม่ได้: {err}`

## Loading state (AC4)
The `scene-loader.tsx` loading function adds `role="status"` + `aria-live="polite"` to the wrapper div, making it perceivable by screen readers as a live region. Text: `กำลังโหลดแผนที่แคมป์…` (ellipsis added for completeness).

## Design gate checklist

| Item | Status |
|---|---|
| Token-only — no stray hex/px in new code | Hardcoded hex values are only inside `SCENE_CSS` (a self-contained string — exempted by `app/status/**` in `.check:palette` config). No new violations. |
| WCAG AA contrast | rm-label text on night-scene background: `#F1F6FB` on `rgba(16,26,42,.9)` — meets 7:1+ (very high contrast). Status pills: teal/amber text on `rgba(18,30,48,.55)` — browser-only verification required. |
| Focus ring visible | `.you-alert:focus-visible` + `.ovl-chip:focus-visible` rings already exist. Agent buttons inherit outline via CSS. |
| Tap targets ≥44px | `min-width: 44px; min-height: 44px` on agent buttons. `min-height:44px` on you-alert and overlay chips (pre-existing). |
| Anti-slop | No placeholder/lorem text. No commented-out code. No debug output. No `console.log`. |
| motion transform/opacity only | All new CSS uses `display` toggle (reduced-motion) and existing transitions (opacity, transform). |
