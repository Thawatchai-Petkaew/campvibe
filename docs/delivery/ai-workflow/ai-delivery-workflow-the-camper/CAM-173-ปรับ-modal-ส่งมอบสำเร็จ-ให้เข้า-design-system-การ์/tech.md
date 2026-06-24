---
linear: CAM-173
feature: ai-workflow
epic: ai-delivery-workflow-the-camper (CAM-138)
persona: platform
artifact: tech
owner: frontend
status: Done
version: v1
updated: 2026-06-25
---
# Tech — ปรับ modal "ส่งมอบสำเร็จ" ให้เข้า design system + การ์ด list (CAM-173)

## Summary

UI-only change. No API, no migration, no data change. Two files created, two files modified.

---

## Files touched

| File | Action |
|---|---|
| `lib/html-utils.ts` | Created — `decodeHtmlEntities()` pure util |
| `__tests__/html-utils.test.ts` | Created — 18 unit tests (normal/empty/boundary/error) |
| `app/status/map/delivery-gift.tsx` | Modified — modal rebuilt with DS components |
| `__tests__/map-delivery.test.ts` | Modified — 2 source-inspection assertions updated to match CAM-173 close button |

`lib/map-delivery.ts` is untouched (confirmed no diff).

---

## 1. decodeHtmlEntities util (`lib/html-utils.ts`)

Pure named export. Handles `&amp;` → `&`, `&quot;` → `"`, `&lt;` → `<`, `&gt;` → `>`, `&#39;` → `'`, `&apos;` → `'`. Uses a single regex replace with a lookup table. No DOM, no React — runnable in Vitest/Node. Output is a plain string for React textContent (no `dangerouslySetInnerHTML`). `&amp;` is listed first in the table so it decodes correctly without cascading (e.g. `&amp;quot;` → `&quot;` not `"`).

Applied in the modal: `decodeHtmlEntities(item.title)` inside the `<p>` element inside each `Card`.

---

## 2. Modal rebuild approach — restyled portal (createPortal kept)

`createPortal` to `document.body` is preserved. The portal mounts into the app theme context on `body`, so Tailwind app tokens (`bg-popover`, `text-foreground`, etc.) resolve correctly in both light and dark modes.

The old dark-green glass surface CSS is replaced by Tailwind utility classes directly on the JSX elements.

DS components used:
- `Button` (`variant="ghost" size="icon"`) — close button; `size-11` = 44×44px tap target
- `Button` (`variant="ghost" className="w-full"`) — footer close; `h-11` = 44px
- `Card size="sm"` + `CardContent` — each delivery item
- `Badge variant="muted"` — epic chip

Lucide icons: `Gift` (header, `text-warning`), `CheckCircle2` (card, `text-success`), `X` (close button).

### Modal surface tokens applied
| Property | Token/class |
|---|---|
| Background | `bg-popover` |
| Text | `text-popover-foreground` |
| Border | `ring-1 ring-foreground/5` |
| Radius | `rounded-3xl` |
| Shadow | `shadow-2xl` |
| Overlay | `bg-foreground/15 supports-[backdrop-filter]:backdrop-blur-sm` |
| Header/footer dividers | `border-b border-border` / `border-t border-border` |
| Card hover | `hover:bg-muted/50 transition-colors duration-[120ms]` |

---

## 3. CSS blocks removed vs kept in `DELIVERY_GIFT_CSS`

### Removed (replaced by Tailwind + DS components)
- `.delivery-modal-overlay` — now Tailwind classes on the overlay `<div>`
- `.delivery-modal` — now Tailwind classes on the modal box `<div>`
- `.delivery-modal-header` — now Tailwind flex/border classes
- `.delivery-modal-title` — now Tailwind text classes on `<span>`
- `.delivery-modal-close` — replaced by `Button variant="ghost" size="icon"`
- `.delivery-modal-body` — now Tailwind flex/overflow classes
- `.delivery-modal-empty` — now Tailwind text classes
- `.delivery-story-item` — replaced by `<Card size="sm">`
- `.delivery-story-icon` — replaced by `<CheckCircle2 className="text-success">`
- `.delivery-story-title` — now Tailwind text-sm font-semibold
- `.delivery-story-meta` — replaced by Badge + date span with tabular-nums
- `.delivery-modal-footer` — now Tailwind border/padding classes
- `.delivery-modal-footer-btn` — replaced by `Button variant="ghost" className="w-full"`

### Kept (gift indicator button — unchanged per AC Rules)
- `.delivery-gift-wrapper` — position:absolute wrapper
- `.gift-indicator` — amber glass button (44×44px tap target, scene-local CSS vars)
- `.gift-badge` — unseen count badge
- Float/glow keyframe animations (`giftFloat`, `giftGlow`) under `prefers-reduced-motion: no-preference`
- `prefers-reduced-motion: reduce` → `animation: none` guard

### Added (modal entry animations — renamed class)
- `.delivery-modal-overlay` animation `deliveryFadeIn` (160ms ease)
- `.delivery-modal-box` animation `deliveryModalIn` (200ms cubic-bezier)
  Note: renamed from `.delivery-modal` to `.delivery-modal-box` to avoid collision with removed block

---

## 4. What was preserved (unchanged logic)

- `lib/map-delivery.ts` — zero diff; all pure helpers, seen-set, pre-seed, view-once logic intact
- `useFocusTrap` hook — Esc closes + Tab wraps + focus returns to gift button
- `formatThaiDate` — `th-TH` locale date formatter
- `computeUnseenItems` — pre-seed on first visit, SSE reconcile on epics prop change
- Cross-tab `storage` event listener
- `DELIVERY_SEEN_KEY`, `markSeen`, `setUnseen([])` on close
- `data-testid="btn--map-delivery-gift"` and `data-testid="modal--map-delivery"` unchanged
- `role="dialog" aria-modal="true" aria-labelledby="delivery-modal-title"` unchanged
- `if (unseenCount === 0) return null;` unchanged

---

## 5. Test updates

`__tests__/map-delivery.test.ts` source-inspection suite — 2 assertions updated:
- Old: asserted `className="delivery-modal-close"` (removed class) → New: asserts `size="icon"` (Button prop)
- Old: asserted `width: 44px` / `height: 44px` in modal CSS → New: asserts `.gift-indicator` CSS (gift button retains 44px; modal button uses `size-11` via Tailwind)

All other 56 source-inspection + logic + i18n tests pass unchanged.

---

## 6. Quality gate results

| Check | Result |
|---|---|
| `npm run lint` | 0 errors (245 pre-existing warnings, none from new code) |
| `npm run typecheck` | Clean |
| `npm test` | 2515/2515 passed (45 test files) |
| `npm run check:palette` | PASS (0 violations) |
| `npm run check:ds` | PASS (0 violations) |
| `npm run build` | Clean, 0 errors |

CWV scorecard:
- LCP: not measured (no image, no network fetch added; portal render is synchronous)
- CLS: not measured (risk: none — modal via `createPortal` to body, no layout shift on page)
- INP: not measured (risk: none — no new client bundle added beyond ~0.5KB for `decodeHtmlEntities`)

---

## Links

- `story.md` (CAM-173) — AC and Rules
- `design.md` (CAM-173) — token spec, states matrix, card layout
- `app/status/map/delivery-gift.tsx` — rebuilt file
- `lib/html-utils.ts` — new util
- `__tests__/html-utils.test.ts` — new test
- `__tests__/map-delivery.test.ts` — updated source-inspection assertions
