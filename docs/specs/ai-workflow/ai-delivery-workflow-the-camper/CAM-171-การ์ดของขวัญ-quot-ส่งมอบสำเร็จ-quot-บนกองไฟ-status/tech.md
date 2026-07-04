---
linear: CAM-171
feature: ai-workflow
epic: ai-delivery-workflow-the-camper (CAM-138)
persona: platform
artifact: tech
owner: frontend-engineer
status: In Progress
version: v1
updated: 2026-06-25
---
# Tech — การ์ดของขวัญ "ส่งมอบสำเร็จ" บนกองไฟ /status/map (CAM-171)

## Files changed

| File | Role |
|---|---|
| `lib/map-delivery.ts` | Pure helper module (no React, no DOM beyond localStorage) |
| `app/status/map/delivery-gift.tsx` | `"use client"` component: gift indicator + modal + scene CSS |
| `app/status/map/campsite-scene.tsx` | Wired: import + CSS injection + `<DeliveryGift epics={epics} />` mount |
| `locales/translations.json` | Added `map.delivery.*` keys (TH + EN) |
| `docs/delivery/…/CAM-171-…/tech.md` | This file |

---

## lib/map-delivery.ts — API

```ts
// Constants
export const DELIVERY_SEEN_KEY = "cv-map-delivery-seen";

// Types
export interface DeliveryItem { id, title, epic, completedAt }

// Data helpers (pure — no side-effects)
export function selectDeliveries(epics: MapEpicItem[]): DeliveryItem[]
export function selectUnseen(deliveries: DeliveryItem[], seenIds: Set<string>): DeliveryItem[]

// localStorage helpers (SSR-safe, no-throw)
export function readSeenIds(): Set<string>
export function writeSeenIds(ids: string[]): void
export function markSeen(ids: string[]): void

// First-visit pre-seed
export function hasInitialized(): boolean
export function preSeed(currentDoneIds: string[]): void
```

- `selectDeliveries`: flattens `epics[].stories[]` where `statusType === "completed"`, sorted newest-first by `completedAt`.
- `selectUnseen`: filters by id ∉ seenIds.
- `readSeenIds`: returns `Set<string>` from `JSON.parse(localStorage.getItem(DELIVERY_SEEN_KEY))`, empty Set if absent/error.
- `markSeen`: merges ids into existing set and writes back.
- `hasInitialized`: returns `localStorage.getItem(DELIVERY_SEEN_KEY) !== null`.
- `preSeed`: writes current Done ids to localStorage on first-ever visit.

---

## localStorage model + pre-seed rule

```
key:   "cv-map-delivery-seen"
value: JSON.stringify(string[])   // array of story ids already seen
```

**First-visit pre-seed rule:**
1. On component mount, call `hasInitialized()`.
2. If `false` → `preSeed(allCurrentDoneIds)` → set unseen to `[]` (no gift on first visit).
3. If `true` → `readSeenIds()` → `selectUnseen(deliveries, seenIds)`.

This ensures only stories that become Done AFTER the first visit ever trigger the gift indicator. Existing historical Done stories are silently seeded into the seen-set.

---

## Where / how the component mounts in the scene

```tsx
// campsite-scene.tsx

// 1. Import at top
import DeliveryGift, { DELIVERY_GIFT_CSS } from "./delivery-gift";

// 2. CSS injection (appended to existing style block)
<style dangerouslySetInnerHTML={{ __html: SCENE_CSS + HUD_CSS + DELIVERY_GIFT_CSS }} />

// 3. Mount inside .scout-layer (before YouScout so z-index stacking is correct)
<DeliveryGift epics={epics} />
```

`<DeliveryGift>` renders:
- A `.delivery-gift-wrapper` (absolute, `left:50% top:44%`, `pointer-events:none`) wrapping a `.gift-indicator` button (`pointer-events:auto`).
- The button is `44×44px`, amber glass, with `giftFloat + giftGlow` animation under `prefers-reduced-motion: no-preference`.
- An unseen count badge (`.gift-badge`), `aria-hidden="true"` (count is in button `aria-label`).
- A `<DeliveryModal>` rendered via `createPortal(…, document.body)` when open.

**Position:** `top:44%` sits above the campfire center (`cy=54`). At `top:44%` the element is 10% above center (44% vs 54%), well outside the keep-out circle (`r=7%`).

**No CLS:** absolute positioned inside `.scout-layer`, does not reflow any DOM. Modal via `createPortal`.

---

## i18n keys (locales/translations.json)

| Key path | TH | EN |
|---|---|---|
| `map.delivery.indicatorLabel` | `ดูงานที่ส่งมอบสำเร็จ {count} รายการ` | `View {count} delivered items` |
| `map.delivery.modalTitle` | `ส่งมอบสำเร็จ` | `Delivery complete` |
| `map.delivery.closeBtn` | `ปิด` | `Close` |
| `map.delivery.emptyState` | `ไม่มีข้อมูลงานที่ส่งมอบ` | `No delivery data available` |
| `map.delivery.epicLabel` | `Epic` | `Epic` |
| `map.delivery.dateLabel` | `ส่งมอบเมื่อ` | `Delivered on` |

Note: the scene does not use `useLanguage` context. Copy is referenced from the component's `COPY` constant whose strings match `locales/translations.json` TH values. The JSON is the authoritative SoT.

---

## 44px close button fix (Design Critical)

`design.md` flagged the close `[X]` button at `36×36px` as Critical. This implementation uses `width: 44px; height: 44px` on `.delivery-modal-close` — meeting the `≥ 44px` tap target requirement.

---

## Token provenance

All CSS values in `DELIVERY_GIFT_CSS` resolve to scene CSS vars declared in `SCENE_CSS`:
- `var(--amber)` `#FFB454`, `var(--text)` `#F1F6FB`, `var(--muted)`, `var(--faint)`, `var(--line)`, `var(--mono)`, `#5BE9B0` (scene success green), `#241402` (badge text on amber — You-alert reference)
- No new token added to `DESIGN.md` or `app/globals.css` (scene is self-contained; `app/status/**` is exempt from `check:palette` per DESIGN.md §0).

---

## States coverage (all 8)

| State | Coverage |
|---|---|
| default (unseen > 0) | Gift button renders with float + glow animation |
| hover | `scale(1.08)` + amber border brightens (150ms) |
| focus | `outline: 2px solid rgba(91,233,176,.8)` + `outline-offset: 2px` |
| active | `scale(0.94)` on press (120ms via transition) |
| loading | Not applicable — data comes from MapModel already in memory; no async fetch |
| error | Malformed data → empty `items` array → modal shows `.delivery-modal-empty` "ไม่มีข้อมูลงานที่ส่งมอบ" |
| empty (unseen == 0) | Component returns `null`; campfire unchanged |
| disabled | Not applicable — when epics not ready, no items → empty state (returns null) |

---

## QA targets

- `data-testid="btn--map-delivery-gift"` — gift indicator button
- `data-testid="modal--map-delivery"` — modal container
- `lib/map-delivery.ts` — all helpers are pure; unit-testable without DOM (except localStorage helpers which need `window` mock)
- Coverage target: ≥ 80% on `lib/map-delivery.ts` (AC self-verify)
- Pre-seed test: call `hasInitialized()` → false → `preSeed(['id1'])` → `readSeenIds()` → Set{'id1'}
- markSeen test: `markSeen(['id2'])` after preSeed → readSeenIds → Set{'id1', 'id2'}
- selectUnseen test: filters correctly; selectDeliveries sorts newest-first

## Changelog

- v1 (2026-06-25) — created by frontend-engineer
