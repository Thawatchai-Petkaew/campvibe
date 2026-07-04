---
linear: CAM-173
feature: ai-workflow
epic: ai-delivery-workflow-the-camper (CAM-138)
persona: platform
artifact: design
owner: ux-designer
status: Backlog
version: v1
updated: 2026-06-25
---
# Design — ปรับ modal "ส่งมอบสำเร็จ" ให้เข้า design system + การ์ด list (CAM-173)

## Before → After (context)

**Before (CAM-171):** Modal used `rgba(10,28,20,.88)` dark-green glass with `backdrop-filter: blur(30px)` — a heavy opaque slab that matched the scene's self-contained dark palette. Rows were plain flex rows (no card boundary). Titles rendered raw HTML entities (`&quot;`).

**After (CAM-173):** Modal uses the app's semantic tokens (`bg-popover`, `border-border`, `rounded-3xl`, `shadow-2xl`) via `createPortal` into `document.body`, which inherits the app's theme context — NOT the scene's self-contained CSS. Each delivery renders as a `Card` (from `components/ui/card.tsx`) with a `Badge` chip for epic. Amber accent is kept but scoped only to the Gift icon header and `CheckCircle2` icon, not the whole surface. Titles are decoded before render.

**Key architectural insight:** The modal mounts via `createPortal` to `document.body`. `document.body` carries the app's Tailwind tokens (light/dark via `.dark`). The scene's self-contained `--amber`, `--text`, etc. CSS vars live in `.map-stage` scope, NOT on `document.body`. Therefore, using app tokens (`bg-popover`, `text-foreground`) in the portal modal is correct and will render properly in both light and dark themes.

---

## User job (from AC)

เจ้าของ (platform) เปิด /status/map เห็น gift indicator กดเปิดดู modal ที่ดูเข้าชุดกับ UI ส่วนอื่นของแอป แต่ละ ticket ที่ส่งมอบเป็นการ์ดอ่านง่ายและดูน่าฉลอง ชื่อเรื่องถูกต้อง (ไม่มี `&quot;`) กด ปิด แล้ว gift หายไป

## Flow

1. เปิด /status/map → unseenCount > 0 → GiftIndicator (amber glass, campfire-relative) แสดง
2. กด GiftIndicator → DeliveryModal เปิด via `createPortal` → focus trap (ปุ่มปิดรับ focus แรก)
3. ดูรายการ: แต่ละ ticket เป็น `Card` ใน scroll list
4. กด ปิด (Button ghost) หรือ Esc → `markSeen(ids)` → modal ปิด → focus กลับ GiftIndicator → indicator หาย
5. unseenCount == 0 → ไม่มี indicator; campfire ปกติ

---

## States matrix (8 states)

| State | GiftIndicator (ไม่เปลี่ยน) | DeliveryModal (ปรับ CAM-173) |
|---|---|---|
| **default** | amber glass button + badge count + float animation | modal surface: `bg-popover border-border rounded-3xl shadow-2xl`; list of Cards |
| **hover** | `scale(1.08)` transform, amber border brightens | Card item: `hover:bg-muted/50` (subtle); close Button ghost variant handles hover natively |
| **focus** | scene focus ring `2px solid rgba(91,233,176,.8)` (scene-local, not portal) | Close Button: `focus-visible:ring-ring/30` (app token, native Button component); Card: no focus state needed (non-interactive) |
| **active** | `scale(0.94)` | Close Button `active:scale-95` (native Button behavior); footer Button ghost `active:scale-95` |
| **loading** | N/A (data from MapModel, no async) | N/A — data available at open time; if epics not yet ready, indicator is absent |
| **error** | unchanged | If stories array malformed/empty → empty state text (see empty below); no ErrorBanner (no network call) |
| **empty** | not shown (unseenCount == 0) | `role="status"` div with `text-muted-foreground text-sm text-center py-6`: `ไม่มีข้อมูลงานที่ส่งมอบ` |
| **disabled** | N/A | Close button: disabled while markSeen is in-flight (very brief; `disabled:opacity-50` native) |

---

## Modal surface spec (design-system tokens)

The modal is a **standard app Dialog surface** — same family as booking-cancel AlertDialog and CampgroundDetail dialogs. It DOES NOT use the scene's dark glass.

### Overlay (backdrop)

```
position: fixed; inset: 0; z-index: 50
bg-foreground/15                    ← token (not rgba hardcode)
supports-backdrop-filter:backdrop-blur-sm
```

This matches `DialogOverlay` from `components/ui/dialog.tsx` exactly. Frontend can reuse `DialogOverlay` or replicate these classes.

### Modal box

| Property | Value | Token / scale |
|---|---|---|
| Background | `bg-popover` | `--popover` (= card; auto light/dark) |
| Text | `text-popover-foreground` | auto light/dark |
| Border | `ring-1 ring-foreground/5` | matches Card primitive |
| Border-radius | `rounded-3xl` | DESIGN.md §2: card/modal role |
| Shadow | `shadow-2xl` | DESIGN.md §2: modal tier |
| Width | `w-full max-w-[calc(100%-2rem)] sm:max-w-md` | matches DialogContent |
| Max-height | `max-h-[min(600px,calc(100svh-4rem))]` | scale utility (not inline px where avoidable) |
| Layout | `flex flex-col` | |
| Overflow | `overflow-hidden` on box; scroll on body | |

### Entry animation (preserve from CAM-171)

```css
/* wrap in prefers-reduced-motion: no-preference */
/* overlay: opacity 0→1, 160ms ease */
/* modal box: scale(0.92) translateY(8px) → scale(1) translateY(0), 200ms cubic-bezier(0.23,1,0.32,1) */
```

Animation uses `transform + opacity` only. Duration 160–200ms within 120–250ms rule.

### Header

```
flex items-center gap-2.5 px-6 py-4 border-b border-border flex-shrink-0
```

| Element | Spec |
|---|---|
| Gift icon | `<Gift size={20} aria-hidden="true" className="text-warning shrink-0"` | — warning token = amber/golden, celebratory accent |
| Title | `id="delivery-modal-title"` `text-base font-semibold text-foreground` (font-heading class) |
| Close button | `<Button variant="ghost" size="icon" aria-label="ปิด modal ส่งมอบสำเร็จ">` — `size="icon"` = `h-11 w-11` (44px tap target, DESIGN.md §2) + `<X size={18} aria-hidden="true" />` |

Note: `text-warning` token maps to `--warning` (OKLCH amber tone in both light and dark). This is the celebratory accent — visible, warm, but contained to the header icon only. Contrast is **not measured** but amber on card/popover white background is a decorative icon (not body text), a11y check: the icon is `aria-hidden`, so contrast of the decorative icon does not gate AA compliance.

### Body (scroll area)

```
flex-1 overflow-y-auto px-6 py-4 space-y-3
scrollbar-width: thin (CSS)
```

Each delivery item is a `Card` (see Card layout below).

### Footer

```
px-6 py-4 border-t border-border flex-shrink-0
```

Single `<Button variant="ghost" className="w-full">ปิด</Button>` — h-11 (44px) native.

---

## Delivery Card layout

Each unseen delivery item renders as a `<Card size="sm">` (`[--card-spacing:--spacing(4)]` = `p-4`). This replaces the plain flex row.

### Card structure

```
<Card size="sm" className="hover:bg-muted/50 transition-colors duration-120">
  <CardContent className="flex items-start gap-3 p-4">
    <!-- Left: accent icon -->
    <CheckCircle2
      size={20}
      aria-hidden="true"
      className="text-success shrink-0 mt-0.5"
    />
    <!-- Right: content -->
    <div className="flex-1 min-w-0 space-y-1.5">
      <!-- Title (decoded) -->
      <p className="text-sm font-semibold text-foreground leading-snug">
        {decodeHtmlEntities(item.title)}
      </p>
      <!-- Meta row: epic badge + date -->
      <div className="flex items-center gap-2 flex-wrap">
        <Badge variant="muted" className="shrink-0">
          {item.epic}
        </Badge>
        {item.completedAt && (
          <span className="text-xs text-muted-foreground tabular-nums">
            {formatThaiDate(item.completedAt)}
          </span>
        )}
      </div>
    </div>
  </CardContent>
</Card>
```

| Element | Token / class | Rationale |
|---|---|---|
| Card surface | `bg-card` (default, `rounded-3xl`) | system Card primitive |
| Card size | `size="sm"` → `p-4` | compact; not full `p-6` density |
| Card hover | `hover:bg-muted/50 transition-colors` | subtle; muted is tinted teal per DESIGN.md |
| CheckCircle2 icon | `text-success` | confirmed/delivered state; DESIGN.md §2 success token |
| Title | `text-sm font-semibold text-foreground` | primary text, readable |
| Epic Badge | `variant="muted"` → `bg-muted text-muted-foreground border-border rounded-xl` | status label not a filter chip; muted = secondary info |
| Date | `text-xs text-muted-foreground tabular-nums` | secondary, Thai พ.ศ. |
| Card radius inner | `rounded-3xl` from Card primitive; inner content has no additional rounded override | |

**"Delivered gift" feel:** Clean card boundary with subtle hover lift, success-green checkmark, warm amber header icon. Celebratory but restrained — no gradient, no emoji, no nested cards-in-cards. The card list inside the popover-surface modal provides natural visual rhythm.

---

## Token table

| Token (Tailwind class) | DESIGN.md source | Used for |
|---|---|---|
| `bg-popover` | `--popover` = card (auto light/dark) | Modal box background |
| `text-popover-foreground` | auto light/dark | Modal body text |
| `ring-1 ring-foreground/5` | `--foreground/5` | Modal box border ring |
| `border-border` | `--border` | Header/footer dividers |
| `rounded-3xl` | §2 card/modal role | Modal box + Card corners |
| `shadow-2xl` | §2 modal shadow tier | Modal elevation |
| `bg-foreground/15` | overlay backdrop | Same as DialogOverlay |
| `bg-card` | `--card` | Individual delivery Card background |
| `text-foreground` | `--foreground` | Card title, modal title |
| `text-muted-foreground` | `--muted-foreground` | Date, meta text, empty state |
| `bg-muted/50` | `--muted` at 50% | Card hover state |
| `text-success` | `--success` | CheckCircle2 icon (confirmed) |
| `text-warning` | `--warning` | Gift icon in header (celebratory accent) |
| `Badge variant="muted"` | `bg-muted text-muted-foreground border-border` | Epic chip/badge |
| `Button variant="ghost" size="icon"` | h-11 w-11 = 44px, ghost | Close button |
| `Button variant="ghost" className="w-full"` | h-11 = 44px, full width | Footer close button |
| `tabular-nums` | DESIGN.md §2 typography | Date span |
| `space-y-3` | gap-3 scale | Card list vertical rhythm |
| `max-w-[calc(100%-2rem)] sm:max-w-md` | matches DialogContent | Modal responsive width |

**No new tokens required in `DESIGN.md` or `app/globals.css`.** All values come from the existing token layer. `text-warning` and `text-success` are already defined in globals.css.

---

## Entity decode spec (the bug fix)

**Problem:** `item.title` values from Linear/API contain HTML entities (`&quot;`, `&amp;`, `&lt;`, `&gt;`, `&#39;`). These render as raw text when set as React `textContent`.

**Solution:** A pure `decodeHtmlEntities(str: string): string` utility function. It must:
- Handle at minimum: `&quot;` → `"`, `&amp;` → `&`, `&lt;` → `<`, `&gt;` → `>`, `&#39;` → `'`
- Render via normal React `{text}` (plain textContent) — NOT `dangerouslySetInnerHTML` (security rule)
- Live in `lib/` (e.g. `lib/html-utils.ts`) as a named export, unit-tested
- Be applied to `item.title` before passing to the Card title `<p>` element

**Implementation pattern** (Frontend to verify):
```ts
// lib/html-utils.ts
const HTML_ENTITIES: Record<string, string> = {
  "&quot;": '"',
  "&amp;": "&",
  "&lt;": "<",
  "&gt;": ">",
  "&#39;": "'",
  "&apos;": "'",
};

export function decodeHtmlEntities(str: string): string {
  return str.replace(/&(?:quot|amp|lt|gt|#39|apos);/g, (match) => HTML_ENTITIES[match] ?? match);
}
```

This is safe: output is a plain string rendered as React textContent. No DOM parsing. No XSS risk.

---

## Copy (locales/)

Keys already added in CAM-171. No new keys needed. Carry forward:

| Key | TH | EN |
|---|---|---|
| `map.delivery.modalTitle` | `ส่งมอบสำเร็จ` | `Delivery complete` |
| `map.delivery.closeBtn` | `ปิด` | `Close` |
| `map.delivery.emptyState` | `ไม่มีข้อมูลงานที่ส่งมอบ` | `No delivery data available` |
| `map.delivery.epicLabel` | `Epic` | `Epic` |
| `map.delivery.dateLabel` | `ส่งมอบเมื่อ` | `Delivered on` |
| `map.delivery.indicatorLabel` | `ดูงานที่ส่งมอบสำเร็จ {count} รายการ` | `View {count} delivered items` |

No em-dash separators. No technical jargon in user-facing text.

Close button aria-label (not in locales, used as `aria-label` prop): `ปิด modal ส่งมอบสำเร็จ` — same as CAM-171.

---

## Error pattern

No network call → no `ErrorBanner` from `form-patterns.md`. Only error state is malformed/empty data:

- Empty story array or all items malformed → `role="status"` div in modal body, `text-muted-foreground text-sm text-center py-6`: `ไม่มีข้อมูลงานที่ส่งมอบ`
- Indicator still appears (user opened it, should see feedback not a blank modal)

---

## a11y (WCAG 2.1 AA)

| Check | Spec | Status |
|---|---|---|
| **Keyboard** | Tab order: close button → footer button; focus trap active in modal; Esc closes; focus returns to GiftIndicator | Required |
| **Screen reader** | Modal: `role="dialog" aria-modal="true" aria-labelledby="delivery-modal-title"`; GiftIndicator: `aria-label={t('map.delivery.indicatorLabel', { count })}` ; badge: `aria-hidden="true"`; icons: `aria-hidden="true"` | Required |
| **Contrast — modal title** | `text-foreground` (`oklch(0.148…)`) on `bg-popover` (white/near-white light) = well above 4.5:1 | Not measured with tool; token pair is standard app pattern |
| **Contrast — muted text** | `text-muted-foreground` (`oklch(0.56…)`) on `bg-popover` — this is the muted-on-card pattern used throughout the app | Not measured; marked for axe verification |
| **Contrast — success icon** | `text-success` is a decorative icon (`aria-hidden`); does not require 4.5:1 | N/A for decorative |
| **Contrast — warning icon (Gift)** | `text-warning` is a decorative icon (`aria-hidden`); does not require 4.5:1 | N/A for decorative |
| **Tap target** | Close button: `Button size="icon"` = `h-11 w-11` = 44px x 44px ✓; Footer "ปิด" button: `h-11` = 44px ✓; GiftIndicator: 44x44px (unchanged from CAM-171) ✓ | All ≥ 44px |
| **Focus ring** | Close Button and footer Button use the app's native `focus-visible:ring-ring/30` ring (from `buttonVariants`); GiftIndicator keeps scene-local ring from CAM-171 (it lives in-scene, not in the portal) | Per component defaults |
| **Color not only signal** | CheckCircle2 icon + "ส่งมอบสำเร็จ" title text + Thai date = state communicated by text/icon/layout, not color alone | Pass |
| **axe** | Run axe DevTools on /status/map after implementation; resolve all violations | Required before merge |
| **Motion** | Entry animation under `prefers-reduced-motion: no-preference`; static (no animation) under reduce | Required |

---

## What Frontend must NOT change

- `lib/map-delivery.ts` helpers, seen-set logic, pre-seed logic (out of scope per story Rules)
- GiftIndicator button (amber glass, scene-local CSS, positioning, animations) — unchanged
- `createPortal` mounting strategy — keep as-is; the token change (glass → app tokens) is what makes it work correctly in the portal context

---

## Anti-slop audit

| Check | Pass/Fail |
|---|---|
| No floating hex/px in modal (all tokens) | Pass — all values from token layer |
| No gradient on modal surface | Pass — `bg-popover` flat surface |
| No cards nested inside cards (card-in-card) | Pass — Cards are the list items inside a non-Card scroll container |
| No emoji | Pass — lucide only (`Gift`, `CheckCircle2`, `X`) |
| Clear hierarchy | Pass — title (heading) > card list (content) > footer action |
| Celebratory accent contained | Pass — `text-warning` only on Gift icon in header; `text-success` on CheckCircle2; rest is standard surface |
| CampVibe tone: teal/mist + clean white | Pass — `bg-popover` = white surface; `bg-muted/50` hover = tinted-teal muted per DESIGN.md |
| Radius by role | Pass — modal `rounded-3xl`, Card `rounded-3xl` (Card primitive), Badge `rounded-xl` (Badge primitive), Button `rounded-full` (Button primitive) |

---

## Design Gate checklist (Frontend must pass before merge)

- [ ] **Token-only** — no free hex/px in modal or card layout; `npm run check:palette` green (modal is not under `app/status/**` — it renders in portal on body, so palette check applies)
- [ ] **Component-in-system** — `Card`, `CardContent`, `Badge`, `Button`, `Dialog`-family primitives from `components/ui/*`; icons `Gift`, `CheckCircle2`, `X` from `lucide-react` only
- [ ] **Radius/size/spacing by role** — modal `rounded-3xl`, Card `rounded-3xl`, Badge `rounded-xl`, Button `rounded-full`; no inline height override
- [ ] **All 8 states** — default / hover / focus / active / loading / error / empty / disabled (see matrix)
- [ ] **a11y AA** — close button `h-11 w-11` (44px), focus trap, Esc, `aria-labelledby`, `role="dialog" aria-modal`, axe clean
- [ ] **Entity decode** — `decodeHtmlEntities()` applied to all `item.title` before render; NOT `dangerouslySetInnerHTML`; unit tested
- [ ] **No CLS** — indicator `position: absolute` (unchanged); modal via `createPortal` (unchanged)
- [ ] **i18n** — all copy via locales keys; Thai date `th-TH`; tabular-nums on date; no em-dash; no jargon
- [ ] **Motion** — entry animation `transform + opacity` only, 160–200ms, wrapped in `prefers-reduced-motion: no-preference`
- [ ] **Anti-slop** — screenshot matches this brief; no gradient slab, no emoji, clear hierarchy, celebratory but restrained
- [ ] **`lib/map-delivery.ts` untouched** — verify no diff on that file
- [ ] **lint + typecheck green** (`npm run lint && npm run typecheck`)

---

## Reference

- `components/ui/dialog.tsx` — `DialogOverlay`, `DialogContent` (modal grammar to match; class baseline)
- `components/ui/card.tsx` — `Card`, `CardContent` (delivery item primitive)
- `components/ui/badge.tsx` — `Badge variant="muted"` (epic chip)
- `components/ui/button.tsx` — `Button variant="ghost" size="icon"` (close); `Button variant="ghost" className="w-full"` (footer)
- CAM-171 `design.md` (sibling) — GiftIndicator spec + scene-local tokens (do NOT copy into modal)
- `DESIGN.md` §2 (tokens, radius scale, shadow tiers, motion), §3 (overlay grammar, component matrix), §5 (anti-slop), §6 (gate checklist), §7 (lucide-only)

## Links

- `story.md` (CAM-173) — AC and Rules this design traces back to
- `../CAM-171-*/design.md` — previous design (scene-local glass approach, kept for GiftIndicator reference)
- `app/status/map/delivery-gift.tsx` — the file Frontend will edit
- DESIGN.md — token tables, component matrix, design gate

## Changelog

- v1 (2026-06-25) — created
