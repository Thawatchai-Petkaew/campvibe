---
linear: CAM-174
feature: ai-workflow
epic: ai-delivery-workflow-the-camper (CAM-138)
persona: platform
artifact: design
owner: ux-designer
status: Backlog
version: v1
updated: 2026-06-25
---
# Design — ปรับ modal ส่งมอบให้ใช้ glass ของ scene /status/map (CAM-174)

## Before → After

**Before (CAM-173 — what we are undoing):**
Modal uses app design-system tokens: `bg-popover rounded-3xl shadow-2xl ring-1 ring-foreground/5`. Each delivery is a `<Card size="sm">` with `bg-card` surface and `text-foreground` text. The surface is white/near-white (light mode) and clashes visibly against the dark campfire forest scene. These tokens resolve from `document.body` in the portal — they are light-theme tokens, not scene-dark.

**After (CAM-174 — this design):**
Modal surface and delivery cards use the **scene's own CSS variables and rgba values**, following the exact pattern of the `hud-modal-box` (KanbanModal) and the `hud-kc`/`hud-card` item cards in `campsite-overlays.tsx`. No app DS tokens (`bg-popover`, `bg-card`, `ring-foreground`, etc.) anywhere inside the modal or cards. The scene's glass language: translucent dark-green + saturate+blur backdrop-filter + thin green-tinted border + soft drop shadow + inset top highlight. This is the same treatment as the Backlog panel cards and the Overview (ภาพรวม) panel cards on the same page.

---

## User job (from AC)

เจ้าของ (platform) เปิด /status/map → เห็น gift button บนกองไฟ → กดเปิด modal "ส่งมอบสำเร็จ" ที่กลมกลืนกับ scene ทั้งหน้า (glass โทนเข้มโปร่ง ไม่ใช่พื้นขาว) → ดูรายการ delivery แต่ละรายการเป็นการ์ด glass สไตล์เดียวกับ Backlog item → กดปิด → gift หาย

Flow: gift button (campfire) → modal opens via createPortal → scroll list of glass delivery cards → close (Esc or X or ปิด) → markSeen → gift disappears

---

## Scene token reference (source: campsite-scene.tsx :root block)

These CSS variables are declared on `:root` in the `SCENE_CSS` string injected by `campsite-scene.tsx`. Because the portal mounts to `document.body`, they are available globally — `:root` custom properties cascade to all descendants including the portal.

| Token name | Value | Used for |
|---|---|---|
| `--glass` | `rgba(11,30,24,.42)` | base glass surface (scene :root) |
| `--blur` | `saturate(195%) blur(30px)` | scene :root — backdrop-filter shorthand |
| `--line` | `rgba(150,240,195,.12)` | thin green-tinted border |
| `--line-2` | `rgba(150,240,195,.16)` | slightly stronger border variant |
| `--hi` | `rgba(255,255,255,.16)` | inset top highlight |
| `--text` | `#F1F6FB` | primary text (bright near-white) |
| `--muted` | `rgba(223,234,245,.66)` | secondary/label text |
| `--faint` | `rgba(223,234,245,.42)` | tertiary/very dim text |
| `--amber` | `#FFB454` | amber accent (gift icon, badge count) |
| `--mono` | `'JetBrains Mono','Fira Mono','Consolas',monospace` | monospace (IDs, dates) |
| (teal accent) | `#5BE9B0` | CheckCircle2 / success indicators |
| (teal accent dim) | `rgba(91,233,176,.5)` | icon at rest / label text |

**Important guard note:** `app/globals.css` exempts `app/status/**` from `check:palette`. The scene already uses raw rgba values throughout `HUD_CSS` and `SCENE_CSS`. Following the exact same pattern (rgba in inline CSS-in-JS strings or a scene-scoped `<style>`) is the correct approach and will pass `check:palette`. Do NOT attempt to map scene values to main-DS tokens.

---

## Modal surface spec (mirror: KanbanModal / hud-modal-box)

The delivery modal is a **centered large modal** — the same grammar as `KanbanModal` in `campsite-overlays.tsx`. Use the same backdrop + box treatment exactly.

### Overlay / backdrop

```
position: fixed; inset: 0; z-index: 60;
background: rgba(4,8,22,.72);
```

Entry animation (prefers-reduced-motion: no-preference):
```css
animation: bdFade 200ms ease both;
@keyframes bdFade { from { opacity: 0; } to { opacity: 1; } }
```

This matches `.hud-modal-backdrop` from `campsite-overlays.tsx` exactly.

### Modal box

```
position: fixed; inset: 0; z-index: 61;
display: flex; align-items: center; justify-content: center;
padding: 20px 16px;
```

Inner box dimensions and glass surface:

| Property | Value | Source reference |
|---|---|---|
| Width | `min(520px, 96vw)` | mirrors hud-modal-box `min(900px,96vw)` scaled for list modal |
| Max-height | `min(600px, calc(100svh - 4rem))` | overflow-y:auto on the box |
| Overflow-y | `auto` | scrollable list |
| Background | `rgba(11,30,24,.68)` | `.hud-modal-box` exact value |
| Backdrop-filter | `saturate(195%) blur(34px)` | `.hud-modal-box` exact value |
| -webkit-backdrop-filter | `saturate(195%) blur(34px)` | required for Safari |
| Border | `1px solid rgba(150,240,195,.13)` | `.hud-modal-box` exact value |
| Border-radius | `22px` | `.hud-modal-box` exact value |
| Box-shadow | `0 32px 72px rgba(0,0,0,.64), inset 0 1px 0 rgba(200,255,232,.14)` | `.hud-modal-box` exact value |
| Padding | `24px 26px 28px` | `.hud-modal-box` exact value |
| Color (default text) | `rgba(223,234,245,.9)` = `var(--muted)` at high opacity | `.hud-modal-box` pattern |

Entry animation (prefers-reduced-motion: no-preference):
```css
animation: modalIn 200ms cubic-bezier(0.23,1,0.32,1) both;
@keyframes modalIn {
  from { opacity: 0; transform: scale(.92); }
  to   { opacity: 1; transform: scale(1); }
}
```

This matches `.hud-modal-box` animation from `campsite-overlays.tsx` exactly.

### Header

```
display: flex; align-items: center; gap: 14px; margin-bottom: 18px;
```

| Element | Spec | Source |
|---|---|---|
| Gift icon | `<Gift size={20} color="var(--amber)" aria-hidden="true" />` | amber accent = `--amber` = `#FFB454` |
| Title "ส่งมอบสำเร็จ" | `font-family: 'Outfit','Anuphan',system-ui,sans-serif; font-size: 17px; font-weight: 700; color: var(--text);` | mirrors `.hud-modal-title` |
| Close button | `width: 44px; height: 44px; min-width: 44px; border-radius: 50%; background: rgba(255,255,255,.08); border: 1px solid rgba(255,255,255,.14); color: rgba(223,234,245,.7); cursor: pointer; display: inline-flex; align-items: center; justify-content: center; font-size: 18px;` | `.hud-modal-close` exact |
| Close button hover | `background: rgba(255,255,255,.14)` | `.hud-modal-close:hover` |
| Close button focus-visible | `outline: 2px solid rgba(91,233,176,.8); outline-offset: 2px` | `.hud-modal-close:focus-visible` |
| Close icon | `<X size={18} aria-hidden="true" />` | lucide |
| Close aria-label | `"ปิด modal ส่งมอบสำเร็จ"` | unchanged from CAM-173 |

### Scroll body

```
flex: 1; overflow-y: auto; display: flex; flex-direction: column; gap: 8px;
padding: 0 0 8px;
scrollbar-width: thin; scrollbar-color: rgba(91,233,176,.18) transparent;
```

```css
::-webkit-scrollbar { width: 4px; }
::-webkit-scrollbar-thumb { background: rgba(91,233,176,.2); border-radius: 4px; }
```

### Footer / close row

```
margin-top: 14px; border-top: 1px solid rgba(150,240,195,.09);
padding-top: 14px;
```

Single scene-style ghost button spanning full width:

```
display: flex; align-items: center; justify-content: center; gap: 6px;
padding: 9px 14px; border-radius: 12px; width: 100%; min-height: 44px;
background: rgba(91,233,176,.08); border: 1px solid rgba(91,233,176,.15);
font-size: 12px; font-weight: 700; color: rgba(91,233,176,.75);
cursor: pointer; transition: background 120ms, border-color 120ms;
```

Hover: `background: rgba(91,233,176,.15); border-color: rgba(91,233,176,.30)`
Focus-visible: `outline: 2px solid rgba(91,233,176,.8); outline-offset: 2px`

Label: "ปิด" (TH) / "Close" (EN)

---

## Delivery card spec (mirror: hud-kc / hud-card — Backlog item cards)

Each delivery item is a **glass card** styled after `.hud-kc` (Status Board story card) and `.hud-card` (Backlog/Kanban card) from `campsite-overlays.tsx`. These are the cards used inside the Backlog and Overview panels.

### Card surface

| Property | Value | Source |
|---|---|---|
| Background | `rgba(91,233,176,.05)` | `.hud-kc` / `.hud-card` exact |
| Border | `1px solid rgba(150,240,195,.13)` | `.hud-kc` / `.hud-card` exact |
| Border-radius | `12px` | `.hud-kc` / `.hud-card` exact |
| Padding | `10px 11px` | `.hud-kc` / `.hud-card` exact |
| Color | `rgba(223,234,245,.88)` | `.hud-card-title` / `.hud-kt` |

### Card structure layout

```
display: flex;
align-items: flex-start;
gap: 9px;
```

| Slot | Element | Spec |
|---|---|---|
| Left icon | `<CheckCircle2 size={16} aria-hidden="true" />` | color `#5BE9B0` (teal); `flex: none; margin-top: 1px` — mirrors `.hud-kt svg` |
| Content area | `<div style="flex:1;min-width:0">` | wraps title + meta row |
| Title | `<p>` decoded title | `font-size: 12.5px; color: rgba(223,234,245,.88); line-height: 1.35;` — mirrors `.hud-card-title` |
| Meta row | flex row, gap 6px | epic chip + date |
| Epic chip | scene chip | see spec below |
| Date | `<span>` Thai date | `font-family: var(--mono); font-size: 9.5px; color: rgba(223,234,245,.45);` — mirrors `.hud-card-id` / `.hud-bl-id` |

### Epic chip (scene chip pattern)

Mirrors `.hud-card-role` / `.hud-epic-chip` from `campsite-overlays.tsx`:

```
display: inline-flex; align-items: center;
font-size: 9.5px; font-weight: 600;
padding: 2px 7px; border-radius: 999px;
background: rgba(91,233,176,.08);
border: 1px solid rgba(150,240,195,.15);
color: rgba(223,234,245,.55);
```

This is exactly `.hud-card-role` — not `Badge variant="muted"` (which is a main-DS token).

### Card hover state

```
background: rgba(91,233,176,.09); border-color: rgba(150,240,195,.22);
transition: background 120ms, border-color 120ms;
```

This matches `.hud-kc.prog` adjusted slightly for a hover (not active) state.

### Empty state

When `items.length === 0`:
```
font-size: 11.5px;
color: rgba(223,234,245,.38);
text-align: center;
padding: 20px 0;
```
Text: `ไม่มีข้อมูลงานที่ส่งมอบ`
This mirrors `.hud-empty` from `campsite-overlays.tsx`.

---

## States matrix (all 8)

| State | Gift button (unchanged) | Modal backdrop | Modal box | Delivery card |
|---|---|---|---|---|
| **default** | amber glass, float animation, badge count | `rgba(4,8,22,.72)` dark scrim | `rgba(11,30,24,.68)` glass, blur 34px, shadow | `rgba(91,233,176,.05)` glass, border `rgba(150,240,195,.13)` |
| **hover** | `scale(1.08)`, amber border brightens | — | — | card background `rgba(91,233,176,.09)`, border `rgba(150,240,195,.22)` |
| **focus** | `outline: 2px solid rgba(91,233,176,.8); outline-offset: 2px` | — | — | cards are non-interactive; close + footer buttons: same teal outline |
| **active** | `scale(0.94)` | — | — | close button: `opacity .85` on press |
| **loading** | N/A (data from MapModel) | N/A | N/A | N/A |
| **error** | unchanged | present | present | empty state text (`.hud-empty` style): `ไม่มีข้อมูลงานที่ส่งมอบ` |
| **empty** | not shown (unseenCount === 0) | present | present | `.hud-empty` style text: `ไม่มีข้อมูลงานที่ส่งมอบ` |
| **disabled** | N/A | — | close button: `opacity: .5; pointer-events: none` while markSeen in-flight | — |

---

## Token mapping table (scene CSS → element)

| Element | CSS property | Scene value | Campsite-overlays.tsx class reference |
|---|---|---|---|
| Modal box background | `background` | `rgba(11,30,24,.68)` | `.hud-modal-box` |
| Modal box backdrop | `backdrop-filter` | `saturate(195%) blur(34px)` | `.hud-modal-box` |
| Modal box border | `border` | `1px solid rgba(150,240,195,.13)` | `.hud-modal-box` |
| Modal box radius | `border-radius` | `22px` | `.hud-modal-box` |
| Modal box shadow | `box-shadow` | `0 32px 72px rgba(0,0,0,.64), inset 0 1px 0 rgba(200,255,232,.14)` | `.hud-modal-box` |
| Backdrop scrim | `background` | `rgba(4,8,22,.72)` | `.hud-modal-backdrop` |
| Modal title text | `color` | `var(--text)` = `#F1F6FB` | `.hud-modal-title` |
| Modal title font | `font-family / size / weight` | `'Outfit','Anuphan',system-ui; 17px; 700` | `.hud-modal-title` |
| Body text (default) | `color` | `rgba(223,234,245,.9)` | `.hud-modal-box` |
| Close button bg | `background` | `rgba(255,255,255,.08)` | `.hud-modal-close` |
| Close button border | `border` | `1px solid rgba(255,255,255,.14)` | `.hud-modal-close` |
| Close button size | `width / height / min-width` | `44px` | `.hud-modal-close` |
| Close button icon color | `color` | `rgba(223,234,245,.7)` | `.hud-modal-close` |
| Close focus ring | `outline` | `2px solid rgba(91,233,176,.8)` | `.hud-modal-close:focus-visible` |
| Gift icon accent | `color` | `var(--amber)` = `#FFB454` | scene `--amber` |
| Card background | `background` | `rgba(91,233,176,.05)` | `.hud-kc` / `.hud-card` |
| Card border | `border` | `1px solid rgba(150,240,195,.13)` | `.hud-kc` / `.hud-card` |
| Card radius | `border-radius` | `12px` | `.hud-kc` / `.hud-card` |
| Card padding | `padding` | `10px 11px` | `.hud-kc` / `.hud-card` |
| Card title text | `color` | `rgba(223,234,245,.88)` | `.hud-card-title` / `.hud-kt` |
| Card title size | `font-size` | `12.5px` | `.hud-card-title` |
| Card title line-height | `line-height` | `1.35` | `.hud-card-title` |
| CheckCircle2 icon | `color` | `#5BE9B0` | teal accent; mirrors `.hud-kt svg` opacity treatment |
| Epic chip bg | `background` | `rgba(91,233,176,.08)` | `.hud-card-role` |
| Epic chip border | `border` | `1px solid rgba(150,240,195,.15)` | `.hud-card-role` |
| Epic chip text | `color` | `rgba(223,234,245,.55)` | `.hud-card-role` |
| Epic chip radius | `border-radius` | `999px` | `.hud-card-role` |
| Epic chip font-size | `font-size` | `9.5px` | `.hud-card-role` |
| Date text | `color` | `rgba(223,234,245,.45)` | `.hud-card-id` / `.hud-bl-id` |
| Date font | `font-family` | `var(--mono)` | `.hud-bl-id` / `.hud-card-id` |
| Date font-size | `font-size` | `9.5px` | `.hud-bl-id` |
| Footer divider | `border-top` | `1px solid rgba(150,240,195,.09)` | `.hud-sum-sep` pattern |
| Footer close button | scene ghost style | `rgba(91,233,176,.08)` bg + `rgba(91,233,176,.15)` border + `rgba(91,233,176,.75)` text | `.hud-sb-seeall` |
| Empty state text | `color / font-size` | `rgba(223,234,245,.38); 11.5px` | `.hud-empty` |
| Scrollbar thumb | `background` | `rgba(91,233,176,.2)` | `.hud-sb-body::-webkit-scrollbar-thumb` |

---

## Implementation guidance for Frontend

The scene's CSS variables live in `SCENE_CSS` inside `campsite-scene.tsx` (injected as a `<style>` tag at `:root`). They cascade to `document.body` and therefore to the `createPortal` modal. Use them via `var(--glass)`, `var(--amber)`, `var(--text)`, `var(--muted)`, etc. where applicable; where no variable is defined (e.g. the rgba values specific to `hud-modal-box`), use the literal rgba values inline in the CSS — exactly as `campsite-overlays.tsx` does in `HUD_CSS`.

**Correct approach:** add a new block to `DELIVERY_GIFT_CSS` (the exported const in `delivery-gift.tsx`) for `.delivery-modal-*` and `.delivery-card-*` classes, using raw rgba values and `var()` references. This is the same pattern the scene already uses and is exempt from `check:palette` (`app/status/**`).

**Do not use:** `bg-popover`, `bg-card`, `bg-foreground/15`, `ring-foreground/5`, `border-border`, `text-foreground`, `text-muted-foreground`, `text-success`, `text-warning`, `rounded-3xl`, `shadow-2xl`, or any other Tailwind DS class inside the modal or delivery cards. These resolve from `document.body`'s app theme (white/light) and will clash with the dark scene.

**Do not use:** `<Card>`, `<CardContent>`, `<Badge>` from `components/ui/*` for the delivery cards or epic chip. These are main-DS primitives with main-DS token surfaces. Replace with the scene CSS classes defined in `DELIVERY_GIFT_CSS`.

**Do keep:** `<Gift>`, `<CheckCircle2>`, `<X>` from `lucide-react` (icons unchanged). Keep `decodeHtmlEntities(item.title)` on every card title. Keep `createPortal` to `document.body`. Keep `useFocusTrap` + Esc + return-focus. Keep `data-testid="modal--map-delivery"` and `data-testid="btn--map-delivery-gift"`.

---

## a11y (WCAG 2.1 AA)

| Check | Spec | Measured? |
|---|---|---|
| Modal ARIA | `role="dialog" aria-modal="true" aria-labelledby="delivery-modal-title"` | Required — unchanged from CAM-173 |
| Focus trap | Tab cycles inside modal; Shift-Tab reverses; Esc closes and returns focus to gift button | Required — unchanged from CAM-173 |
| Close button tap target | `width: 44px; height: 44px; min-width: 44px` (44x44px) | Pass — matches `.hud-modal-close` |
| Footer "ปิด" button tap target | `min-height: 44px; padding: 9px 14px` | Pass — at minimum 44px |
| Gift button tap target | 44x44px (unchanged from CAM-171) | Pass — unchanged |
| Focus ring | `outline: 2px solid rgba(91,233,176,.8); outline-offset: 2px` on close button + footer button | Pass — scene-standard ring |
| Contrast: title `var(--text)` on `rgba(11,30,24,.68)` | `#F1F6FB` on very dark green = well above 7:1 | Not measured with tool; expected high (pair is near-white on very dark) |
| Contrast: muted text `rgba(223,234,245,.66)` on `rgba(11,30,24,.68)` | Light-blue-grey on very dark green | Not measured; expected AA pass; mark for axe verification |
| Contrast: teal `#5BE9B0` on `rgba(11,30,24,.68)` | Teal on very dark green; decorative icon | Not measured; icon is `aria-hidden` — decorative, AA not required |
| Contrast: amber `#FFB454` on `rgba(11,30,24,.68)` | Amber on very dark green; decorative icon | Not measured; icon is `aria-hidden` — decorative, AA not required |
| Icons | All icons `aria-hidden="true"` | Required |
| Cards (non-interactive) | Delivery cards are display-only (no `role`, no tabIndex) | Pass — no keyboard trap |
| Color not sole signal | Title text + CheckCircle2 shape + date text communicate state; not color alone | Pass |
| Motion | Entry: `transform + opacity` only, 160-200ms, inside `prefers-reduced-motion: no-preference` | Required |
| No CLS | modal via `createPortal` to body (unchanged); gift button `position: absolute` (unchanged) | Pass |

---

## Copy (locales/)

No new keys — carry forward from CAM-171/CAM-173. All existing keys in `locales/` are unchanged.

| Key | TH | EN |
|---|---|---|
| `map.delivery.modalTitle` | `ส่งมอบสำเร็จ` | `Delivery complete` |
| `map.delivery.closeBtn` | `ปิด` | `Close` |
| `map.delivery.emptyState` | `ไม่มีข้อมูลงานที่ส่งมอบ` | `No delivery data available` |
| `map.delivery.indicatorLabel` | `ดูงานที่ส่งมอบสำเร็จ {count} รายการ` | `View {count} delivered items` |

No em-dash separators. No technical jargon in user-facing copy. Thai date formatted via `toLocaleDateString("th-TH", { year:"numeric", month:"short", day:"numeric" })`.

Close button aria-label (not a locales key; prop): `"ปิด modal ส่งมอบสำเร็จ"` — unchanged.

---

## Error pattern

No network call → no `ErrorBanner`. Only error surface is malformed or empty data:
- Empty items array or all items filtered → empty state div styled as `.hud-empty` in the scroll body (`font-size: 11.5px; color: rgba(223,234,245,.38); text-align: center; padding: 20px 0`).
- Gift indicator still appears (user opened it and should see feedback, not a blank modal).

---

## What Frontend must NOT change

- `lib/map-delivery.ts` — untouched (logic, seen-set, pre-seed)
- Gift button `.gift-indicator` CSS in `DELIVERY_GIFT_CSS` — untouched (amber glass button, campfire positioning, float/glow animations)
- `decodeHtmlEntities(item.title)` — keep on every card title
- `createPortal` mounting to `document.body` — keep as-is
- `useFocusTrap` + Esc + return-focus — keep unchanged
- `data-testid="modal--map-delivery"` + `data-testid="btn--map-delivery-gift"` — keep unchanged
- Entry animations (`.delivery-modal-overlay` / `.delivery-modal-box` keyframes) — update the keyframe class names if needed but preserve the transform+opacity-only pattern

---

## Anti-slop audit

| Check | Assessment |
|---|---|
| No floating hex/px outside scene CSS block | The modal CSS goes into `DELIVERY_GIFT_CSS` (the scene-scoped export) — same as all other scene CSS; exempt from `check:palette`. No main-DS hex outside that block. |
| No gradient on modal surface | Surface is flat rgba glass, not a gradient slab. |
| No cards nested inside cards | Glass cards are list items inside a non-card scroll container (the modal box is the container, not a card). |
| No emoji | Lucide only (`Gift`, `CheckCircle2`, `X`). |
| Clear hierarchy | Modal title (heading) > scroll list of glass cards (content) > footer action (close). |
| Celebratory accent contained | Amber (`var(--amber)`) only on Gift icon + badge count. Teal (`#5BE9B0`) only on CheckCircle2. Main body text is `var(--text)` / `var(--muted)`. |
| Scene tone: dark-green glass | Glass = `rgba(11,30,24,.68)` + blur; text = near-white/muted-blue-grey. Matches the Backlog/Overview panel language exactly. |
| Radius by role | Modal box `22px`; delivery cards `12px`; epic chip `999px` (pill); footer ghost button `12px`. All match existing scene CSS class values. |

---

## Design gate (Frontend must pass before merge)

- [ ] **check:palette green** — `npm run check:palette` passes; no main-DS hex in the modal/card CSS outside the scene's `DELIVERY_GIFT_CSS` export block
- [ ] **No main-DS tokens** — no `bg-popover`, `bg-card`, `ring-foreground`, `border-border`, `text-foreground`, `text-muted-foreground`, `text-success`, `text-warning`, `rounded-3xl`, `shadow-2xl`, `<Card>`, `<Badge>` anywhere inside the modal or delivery cards
- [ ] **All 8 states** — default / hover / focus / active / loading / error / empty / disabled per the states matrix
- [ ] **a11y AA** — close button 44x44px, focus trap, Esc, `aria-labelledby`, `role="dialog" aria-modal`, teal focus ring on interactive elements, axe clean
- [ ] **Entity decode** — `decodeHtmlEntities()` on every `item.title`; NOT `dangerouslySetInnerHTML`
- [ ] **Scene glass match** — modal box uses the exact `.hud-modal-box` rgba values; cards use the exact `.hud-kc`/`.hud-card` rgba values (see token mapping table above)
- [ ] **No CLS** — createPortal + position:absolute unchanged
- [ ] **i18n** — copy via locales keys; Thai date `th-TH`; no em-dash; no jargon
- [ ] **Motion** — `transform + opacity` only, 160–200ms, inside `prefers-reduced-motion: no-preference`
- [ ] **lib/map-delivery.ts untouched** — verify no diff
- [ ] **Gift button unchanged** — `.gift-indicator` CSS block untouched
- [ ] **lint + typecheck green** — `npm run lint && npm run typecheck`
- [ ] **Screenshot vs Brief** — dark glass modal over campfire scene; delivery cards glass-green (not white)

---

## Reference

- `app/status/map/campsite-overlays.tsx` — source of truth for the glass treatment: `.hud-modal-backdrop`, `.hud-modal-box`, `.hud-kc`, `.hud-card`, `.hud-card-role`, `.hud-card-title`, `.hud-modal-close`, `.hud-sb-seeall`, `.hud-empty`
- `app/status/map/campsite-scene.tsx` — scene `:root` CSS token declarations (`--glass`, `--blur`, `--line`, `--line-2`, `--hi`, `--text`, `--muted`, `--faint`, `--amber`, `--mono`)
- `app/status/map/delivery-gift.tsx` — the file Frontend will restyle; `DELIVERY_GIFT_CSS` is the correct place for new scene CSS classes
- CAM-173 `design.md` (sibling) — the over-corrected DS-white version; **do not follow**

## Changelog

- v1 (2026-06-25) — created
