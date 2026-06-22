---
linear: CAM-127
feature: reviews-reputation
epic: camper-post-trip-review (CAM-35)
persona: camper
artifact: design
owner: ux-designer
status: In Progress
version: v1
updated: 2026-06-22
---
# Design — ปุ่มบันทึกบนหน้า Campground Detail (CAM-127)

## Flow

1. **Entry** — Camper lands on `/campgrounds/[slug]`. Server resolves `initialSaved` (BR-3: query Wishlist for `{userId, campSiteId}`; unauthenticated = `false`).
2. **Detail header action bar** — the static `<Button variant="ghost">` at lines ~299–301 of `CampgroundDetailClient.tsx` is replaced by the new labeled-button toggle. The bar reads: `[Edit (owner only)] · [Share] · [บันทึก / บันทึกแล้ว]`.
3. **Authenticated — unsaved → saved (AC-1):** tap `บันทึก` → optimistic flip to `บันทึกแล้ว` + heart fills teal → POST `/api/wishlist` → on success: toast `บันทึกลงรายการที่ถูกใจแล้ว`. On failure: rollback to `บันทึก` + heart outline + toast `บันทึกไม่สำเร็จ กรุณาลองใหม่อีกครั้ง` (AC-5).
4. **Authenticated — saved → unsaved (AC-3):** tap `บันทึกแล้ว` → optimistic flip back + DELETE `/api/wishlist` → on success: toast `นำออกจากรายการที่ถูกใจแล้ว`. On failure: rollback + toast error.
5. **Authenticated — page load already saved (AC-2):** button renders immediately as `บันทึกแล้ว` + filled heart (initial state from server, no flash).
6. **Guest (AC-4 / BR-2):** tap `บันทึก` → no API call → LoginModal opens with subtitle `เข้าสู่ระบบเพื่อบันทึกแคมป์นี้`. Heart does not toggle. No record created.

## States (8)

The button is `<Button variant="ghost" size="default">` (h-11, rounded-full) with a lucide `Heart` icon left of label text. All state classes below are token-only per DESIGN.md §2.

| State | Visual | Classes / behaviour |
|---|---|---|
| **default — unsaved** | Heart outline (`text-foreground`) + label `บันทึก` | `variant="ghost"` baseline: `hover:bg-muted hover:text-foreground`; heart `w-4 h-4 text-foreground` (no fill) |
| **default — saved** | Heart filled teal + label `บันทึกแล้ว` | Same shell; heart `w-4 h-4 text-primary fill-current`; label color `text-foreground` |
| **hover** | Muted bg wash | `hover:bg-muted hover:text-foreground` (built into `ghost` variant); heart color unchanged |
| **focus** | Visible ring | `focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/30` (built into `Button`); no custom override needed |
| **active** | Scale-down press | `motion-safe:active:scale-95` (built into `Button`); duration 120–150ms `transform` only |
| **loading** | Button disabled + opacity 50% | `disabled` prop set to `true` while API in-flight; `disabled:pointer-events-none disabled:opacity-50` (built into `Button`); icon and label remain visible — no spinner (tap area stays ≥44px and label communicates state via `aria-label` loading key) |
| **error** | Rollback to prior state + toast | Optimistic state rolled back synchronously; `toast.error` with `t.wishlist.toastErrorSave` or `t.wishlist.toastErrorRemove`; button returns to default (unsaved or saved, whichever it was before). No persistent error in the button itself — toast is the signal (BR-1) |
| **empty** | N/A | Not applicable — the button always represents the save toggle; it is never absent from the header (even for guests it shows as unsaved) |
| **disabled** | Opacity 50%, no pointer events | Same as loading; `disabled` prop; used only during in-flight request (BR-5) |

### State transition summary (authenticated)

```
unsaved (default)
  → tap → [loading] → saved (success) / unsaved (error + toast)
saved (default)
  → tap → [loading] → unsaved (success) / saved (error + toast)
```

## Validation UX

**BR-2 — guest tap → LoginModal:**
- No validation error shown on the button itself.
- LoginModal opens with a contextual subtitle: `เข้าสู่ระบบเพื่อบันทึกแคมป์นี้` (i18n key `wishlist.loginPromptGuest`; already exists in `locales/translations.json` TH + EN).
- The modal subtitle slot already exists in the LoginModal component — Frontend wires the `subtitle` prop with `t.wishlist.loginPromptGuest`.

**BR-1 / AC-5 — API error → toast:**
- Error is transient feedback (sonner toast), not an inline field error. This is correct per DESIGN.md §3 component matrix: "transient feedback → toast (sonner), not a persistent inline alert."
- No `ErrorBanner` is warranted here — the action is a toggle, not a form submission with fields.

## Components & tokens

### Component

`Button` from `components/ui/button.tsx`
- `variant="ghost"` — matches Share button adjacent in the same action bar (consistent grammar).
- `size="default"` — h-11, gap-1.5, px-4; tap target 44px height met. Width expands with label text (rounded-full, no fixed width).

### Icon

`Heart` from `lucide-react` (lucide-only per DESIGN.md §7).
- Unsaved: `className="w-4 h-4 text-foreground"` — outline, no fill.
- Saved: `className="w-4 h-4 text-primary fill-current"` — filled teal via `--primary` token.
- `aria-hidden="true"` on the icon (accessible name is on the button via `aria-label`).

### Tokens used

| Token | Usage |
|---|---|
| `text-primary` + `fill-current` | Heart fill color when saved — teal `--primary` (OKLCH) |
| `text-foreground` | Heart outline color when unsaved; label text |
| `hover:bg-muted` | Ghost variant hover bg |
| `ring-ring` | Focus ring via `focus-visible:ring-ring/30` |
| `h-11` (size=default) | Button height, satisfies tap ≥44px |
| `rounded-full` | Button radius per §2 button role |
| `gap-1.5` | Icon-to-label gap (built into size=default) |
| `opacity-50` | Disabled/loading state |
| `duration-150` + `scale-95` | Active press animation (transform only, 120–250ms range) |

No new tokens required. All values come from the existing token layer.

### New i18n key required

| Key | TH | EN |
|---|---|---|
| `wishlist.savedLabel` | `บันทึกแล้ว` | `Saved` |

The unsaved label (`บันทึก` / `Save`) maps to `t.common.save` which already exists. The saved label `บันทึกแล้ว` is new — Frontend adds `wishlist.savedLabel` to `locales/translations.json` (TH + EN) before shipping.

All other keys reused from the existing wishlist namespace already in `locales/translations.json`:
- `wishlist.heartAriaLabelSave` — TH `บันทึกลงรายการที่ถูกใจ` / EN `Save to liked campsites`
- `wishlist.heartAriaLabelRemove` — TH `นำออกจากรายการที่ถูกใจ` / EN `Remove from liked campsites`
- `wishlist.heartAriaLabelLoading` — TH `กำลังอัปเดตรายการที่ถูกใจ...` / EN `Updating liked campsites...`
- `wishlist.toastSaved` — TH `บันทึกลงรายการที่ถูกใจแล้ว`
- `wishlist.toastRemoved` — TH `นำออกจากรายการที่ถูกใจแล้ว`
- `wishlist.toastErrorSave` — TH `บันทึกไม่สำเร็จ กรุณาลองใหม่อีกครั้ง`
- `wishlist.loginPromptGuest` — TH `เข้าสู่ระบบเพื่อบันทึกแคมป์นี้` / EN `Log in to save this campsite`

### Test ID

`data-testid="btn--wishlist-toggle"` — reuse the same ID as `CampgroundCard` (QA tests across both surfaces).

## a11y

WCAG 2.1 AA — all items below are required per DESIGN.md §3 accessibility checklist.

| Check | Specification |
|---|---|
| `aria-pressed` | `true` when saved, `false` when unsaved. Conveys toggle state to screen readers without relying on color alone. |
| `aria-label` (dynamic, per state) | Loading: `t.wishlist.heartAriaLabelLoading` · Saved: `t.wishlist.heartAriaLabelRemove` · Unsaved: `t.wishlist.heartAriaLabelSave`. Mirror the exact same logic from `CampgroundCard.tsx` lines 87–91. |
| Color not the only signal | State is communicated by (a) icon fill vs outline (shape change), (b) label text change `บันทึก` ↔ `บันทึกแล้ว`, and (c) `aria-pressed` — not color alone. Passes color-not-only requirement. |
| Focus ring | Built into `Button` via `focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/30`. Visible on keyboard navigation. No override needed. |
| Tap target ≥44px | `size="default"` = h-11 (44px). Width is flexible (wider than 44px due to label). Passes. |
| Keyboard operability | `Button` is a native `<button>`; fully keyboard operable (Enter/Space triggers click). No trap. |
| Screen reader | Icon `aria-hidden="true"`, accessible name on the button via `aria-label`. Label text is supplementary (redundant with aria-label is acceptable and adds visible context). |
| Contrast (not measured) | `text-primary` (teal) on `background` (white): **not measured** — relies on the system token; `--primary` was verified WCAG AA at prior design gate (CampgroundCard G2). The ghost variant `text-foreground` on `bg-muted` passes trivially. Recommend axe verification at the staging review. |

## Design gate

**PASS** — this is a reuse of the approved CampgroundCard heart pattern, adapted from icon-only to labeled button.

Gate checklist:

- [x] **Token-only** — `text-primary`, `fill-current`, `hover:bg-muted`, `ring-ring`, `h-11`, `rounded-full`, `opacity-50`, `gap-1.5`. No hardcoded hex/px. `npm run check:palette` will pass.
- [x] **Component-in-system** — `Button` from `components/ui/button.tsx`. `Heart` from `lucide-react` (lucide-only per DS-5 / DESIGN.md §7).
- [x] **Scale matches role** — button role → `rounded-full h-11` per §2. No inline height override.
- [x] **All 8 states** — defined in the States table above. Error = optimistic rollback + toast (not a missing state).
- [x] **a11y AA** — `aria-pressed`, dynamic `aria-label`, color-not-only (shape + text + ARIA), focus ring from Button primitive, tap ≥44px. Contrast relies on system tokens (prior AA verification).
- [x] **i18n** — one new key `wishlist.savedLabel` (TH + EN) in `locales/translations.json`; all other keys already exist. No hardcoded strings. No em-dash separator. No technical jargon.
- [x] **Motion** — `active:scale-95` transform-only, 120–150ms (within 120–250ms range). No `transition:all`. Respects `motion-safe:` (built into Button).
- [x] **Anti-slop** — ghost variant matches the adjacent Share button grammar exactly. No decorator elements added. Teal fill is purposeful (brand signal: saved = primary action color). Layout stays in the existing action bar — no new chrome invented.
- [x] **Test ID** — `btn--wishlist-toggle` (reuse from CampgroundCard, consistent across surfaces).

No new tokens proposed. No new components invented. No design decisions that require a token change in `DESIGN.md` or `app/globals.css`.

## Links

- `story.md` (AC-1..5, BR-1..5) — `docs/delivery/reviews-reputation/camper-post-trip-review/CAM-127-ปุ่มบันทึกบนหน้า-campground-detail/story.md`
- `DESIGN.md` — `/Users/tawatchaipetkaew/Claude/Projects/CAMPVIBE/DESIGN.md`
- `CampgroundCard.tsx` (pattern source) — `components/CampgroundCard.tsx` lines 51–91 (handleHeartClick + heartAriaLabel) and lines 174–200 (button markup)
- `CampgroundDetailClient.tsx` (target location) — lines ~296–301 (static ghost button to replace)
- `locales/translations.json` — wishlist namespace lines 533–551 (EN) and 1137–1155 (TH)

## Changelog

- v1 (2026-06-22) — created
