---
linear: CAM-174
feature: ai-workflow
epic: ai-delivery-workflow-the-camper (CAM-138)
artifact: tech
owner: frontend
status: Done
version: v1
updated: 2026-06-25
---
# Tech — CAM-174: ปรับ modal ส่งมอบให้ใช้ glass ของ scene /status/map

## Summary

Reverts the CAM-173 design-system (white/light) approach on the delivery modal back to the scene's own glass language, matching the Backlog/Overview item cards and the KanbanModal already on the same page.

---

## Revert: DS → Scene Glass

**CAM-173 approach (removed):**
- Modal surface: Tailwind DS tokens — `bg-popover rounded-3xl shadow-2xl ring-foreground/5`
- Delivery items: `<Card size="sm">` / `<CardContent>` / `<Badge variant="muted">` from `components/ui/*`
- Close button: `<Button variant="ghost" size="icon">` from DS
- Result: white/near-white surface clashing against the dark campfire forest scene

**CAM-174 approach (implemented):**
- All DS imports removed: `Card`, `CardContent`, `Badge`, `Button` from `components/ui/*`
- Modal surface and cards use scene-scoped CSS classes in `DELIVERY_GIFT_CSS` with raw rgba values — the exact same pattern as `HUD_CSS` in `campsite-overlays.tsx`
- `app/status/**` is already exempt from `check:palette`, so raw rgba in `DELIVERY_GIFT_CSS` passes the guard correctly

---

## hud-* Values Mirrored

| Scene class | Delivery class | Key values copied |
|---|---|---|
| `.hud-modal-backdrop` | `.delivery-modal-overlay` | `position:fixed; inset:0; z-index:60; background:rgba(4,8,22,.72)` |
| `.hud-modal` | `.delivery-modal-positioner` | `position:fixed; inset:0; z-index:61; flex; align-items:center; justify-content:center` |
| `.hud-modal-box` | `.delivery-modal-box` | `background:rgba(11,30,24,.68); backdrop-filter:saturate(195%) blur(34px); -webkit-backdrop-filter:saturate(195%) blur(34px); border:1px solid rgba(150,240,195,.13); border-radius:22px; box-shadow:0 32px 72px rgba(0,0,0,.64),inset 0 1px 0 rgba(200,255,232,.14); padding:24px 26px 28px; color:rgba(223,234,245,.9)` |
| `.hud-modal-title` | `.delivery-modal-title` | `font-family:'Outfit','Anuphan',system-ui; font-size:17px; font-weight:700; color:#F1F6FB` |
| `.hud-modal-close` | `.delivery-modal-close` | `width:44px; height:44px; min-width:44px; border-radius:50%; background:rgba(255,255,255,.08); border:1px solid rgba(255,255,255,.14); color:rgba(223,234,245,.7)` |
| `.hud-kc` / `.hud-card` | `.delivery-card` | `background:rgba(91,233,176,.05); border:1px solid rgba(150,240,195,.13); border-radius:12px; padding:10px 11px` |
| `.hud-card-title` / `.hud-kt` | `.delivery-card-title` | `font-size:12.5px; color:rgba(223,234,245,.88); line-height:1.35` |
| `.hud-card-role` | `.delivery-epic-chip` | `font-size:9.5px; padding:2px 7px; border-radius:999px; background:rgba(91,233,176,.08); border:1px solid rgba(150,240,195,.15); color:rgba(223,234,245,.55)` |
| `.hud-card-id` / `.hud-bl-id` | `.delivery-card-date` | `font-family:var(--mono); font-size:9.5px; color:rgba(223,234,245,.45)` |
| `.hud-sb-seeall` | `.delivery-close-btn` | `background:rgba(91,233,176,.08); border:1px solid rgba(91,233,176,.15); color:rgba(91,233,176,.75); border-radius:12px; min-height:44px` |
| `.hud-empty` | `.delivery-empty` | `font-size:11.5px; color:rgba(223,234,245,.38); text-align:center; padding:20px 0` |

Modal width is `min(520px,96vw)` (scaled down from `hud-modal-box`'s `min(900px,96vw)` — the kanban board needs more horizontal space; the delivery list does not).

---

## CSS Classes Added to DELIVERY_GIFT_CSS

New scene-glass classes (all in the `DELIVERY_GIFT_CSS` export in `delivery-gift.tsx`):

- `.delivery-modal-overlay` — scrim, mirrors `.hud-modal-backdrop`
- `.delivery-modal-positioner` — centering positioner, mirrors `.hud-modal`
- `.delivery-modal-box` — glass surface, mirrors `.hud-modal-box`
- `.delivery-modal-head` — header flex row
- `.delivery-modal-title` — title typography, mirrors `.hud-modal-title`
- `.delivery-modal-close` — close button (44×44px), mirrors `.hud-modal-close`
- `.delivery-modal-body` — scroll container (thin teal scrollbar)
- `.delivery-card` — item card glass, mirrors `.hud-kc`/`.hud-card`; hover state mirrors `.hud-kc.prog` adjusted
- `.delivery-card-title` — card title, mirrors `.hud-card-title`/`.hud-kt`
- `.delivery-card-meta` — flex row: epic chip + date
- `.delivery-epic-chip` — epic label pill, mirrors `.hud-card-role`
- `.delivery-card-date` — Thai date span, mirrors `.hud-card-id`/`.hud-bl-id`
- `.delivery-empty` — empty state text, mirrors `.hud-empty`
- `.delivery-modal-footer` — footer separator + padding
- `.delivery-close-btn` — ghost close action, mirrors `.hud-sb-seeall`

Unchanged gift-button classes: `.delivery-gift-wrapper`, `.gift-indicator`, `.gift-badge` (plus `giftFloat`, `giftGlow` keyframes and reduced-motion guards).

---

## What Was Preserved

- `decodeHtmlEntities(item.title)` on every card title — unchanged
- `createPortal` to `document.body` — unchanged
- `useFocusTrap` + Esc + return-focus — unchanged
- `markSeen` on close + `setUnseen([])` — unchanged
- `data-testid="btn--map-delivery-gift"` + `data-testid="modal--map-delivery"` — unchanged
- `role="dialog" aria-modal="true" aria-labelledby="delivery-modal-title"` — unchanged
- Gift button `.gift-indicator` CSS block including float/glow animations — unchanged
- `COPY` constants (TH strings, no hardcoded inline strings) — unchanged
- View-once logic (`computeUnseenItems`, `preSeed`, `readSeenIds`, `hasInitialized`) — unchanged
- Cross-tab storage listener — unchanged
- `lib/map-delivery.ts` — not touched
- `lib/html-utils.ts` — not touched

---

## Icons

- `<Gift size={20} aria-hidden="true">` — amber via `style={{ color: "var(--amber)" }}`
- `<CheckCircle2 size={16} aria-hidden="true">` — teal via `style={{ color: "#5BE9B0" }}`
- `<X size={18} aria-hidden="true">` — in `.delivery-modal-close`, color inherits `rgba(223,234,245,.7)`

All Lucide; no emoji.

---

## Tests Updated

File: `__tests__/map-delivery.test.ts`

The `Source-inspection` describe block was updated to assert the new scene-glass reality:

**Removed assertions (CAM-173 DS):**
- `size="icon"` (was `Button size="icon"` tap target assertion) — replaced by `.delivery-modal-close` class + explicit 44px in CSS

**Added assertions (CAM-174 scene glass):**
- `.delivery-modal-close` class present + `width:44px; height:44px; min-width:44px` in CSS
- `rgba(4,8,22,.72)` scrim — not `bg-foreground/15` or `backdrop-blur-sm`
- `rgba(11,30,24,.68)` modal box background
- `saturate(195%) blur(34px)` backdrop-filter
- `rgba(150,240,195,.13)` border
- `border-radius: 22px`
- `rgba(0,0,0,.64)` + `inset 0 1px 0 rgba(200,255,232,.14)` box-shadow
- `.delivery-card` class defined in CSS and used in JSX
- `.delivery-epic-chip` mirrors `hud-card-role` rgba values
- `#5BE9B0` on CheckCircle2 (not `text-success`)
- `.delivery-card-date` with `var(--mono)` + `rgba(223,234,245,.45)`
- `.delivery-card-title` with `rgba(223,234,245,.88)` + `12.5px`
- `.delivery-close-btn` mirrors `hud-sb-seeall` rgba values
- `.delivery-empty` with `rgba(223,234,245,.38)`
- `deliveryFadeIn` + `deliveryModalIn` animation keyframes
- `'Outfit','Anuphan',system-ui,sans-serif` modal title font
- `var(--amber)` on Gift icon (not `text-warning`)
- Negative: no `bg-popover`, `rounded-3xl`, `shadow-2xl`, `ring-foreground`
- Negative: no `Card`/`CardContent`/`Badge` imports
- Negative: no `Button` DS import

Total tests: 91 in `map-delivery.test.ts`; 2535 across the full suite — all green.

---

## Quality Gate Results

| Check | Result |
|---|---|
| `npm run lint` | 0 errors (245 pre-existing warnings, none in delivery-gift.tsx or map-delivery.test.ts) |
| `npm run typecheck` | Clean |
| `npm run check:palette` | PASS (0 violations) |
| `npm run check:ds` | PASS (0 violations) |
| `npm test` | 2535 passed, 0 failed |
| `npm run build` | Success — `/status/map` route builds cleanly |

---

## CWV Scorecard

| Metric | Value |
|---|---|
| LCP | not measured |
| CLS | not measured; modal via `createPortal` + `position:absolute` gift button unchanged — no layout shift expected |
| INP | not measured |

Potential regression note: none. The modal is a portal overlay (no layout reflow). Glass CSS is string-injected at scene-mount time (same pattern as `HUD_CSS`). No new client bundles or images added.

---

## Files Changed

- `app/status/map/delivery-gift.tsx` — rebuilt with scene-glass CSS; DS imports removed
- `__tests__/map-delivery.test.ts` — source-inspection tests updated to assert scene-glass classes and rgba values

## Files NOT Changed

- `lib/map-delivery.ts`
- `lib/html-utils.ts`
- `app/status/map/campsite-overlays.tsx`
- `app/status/map/campsite-scene.tsx`
- `locales/translations.json`
