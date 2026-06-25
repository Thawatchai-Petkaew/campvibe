---
linear: CAM-171
feature: ai-workflow
epic: ai-delivery-workflow-the-camper (CAM-138)
persona: platform
artifact: design
owner: ux-designer
status: Backlog
version: v1
updated: 2026-06-25
---
# Design — การ์ดของขวัญ "ส่งมอบสำเร็จ" บนกองไฟ /status/map (CAM-171)

## User job (from AC)

เจ้าของ (platform) เปิด /status/map และเห็นทันทีว่ามีงาน Done ใหม่ กดเปิดดูรายการ ticket ได้ครั้งเดียว จากนั้นการ์ดหายไปไม่รบกวนซ้ำ

## Flow

1. เปิด /status/map → hook อ่าน `epics[].stories[]` จาก `MapModel` + เทียบกับ seen-set ใน localStorage
2. (a) unseenCount > 0 → GiftIndicator ปรากฏบน/เหนือกองไฟ พร้อม badge จำนวน
3. เจ้าของกด GiftIndicator → DeliveryModal เปิด (focus trap + Esc)
4. อ่านรายการ Done → กด ปิด หรือกด Esc → `markSeen(ids)` → modal ปิด → GiftIndicator หายไป
5. (b) unseenCount == 0 (ตั้งแต่ต้นหรือหลัง close) → ไม่มี indicator เลย (campfire ปกติ)

---

## States matrix (8 states ครบ)

| State | GiftIndicator | DeliveryModal | หมายเหตุ |
|---|---|---|---|
| **default (unseen > 0)** | แสดง: Gift icon สีทอง + badge count + animation float | ซ่อน | เป็นสถานะหลักที่ต้องดึงดูดสายตา |
| **hover** | เรืองแสง/scale ขึ้นเล็กน้อย (`scale(1.08)`) + cursor pointer | — | transform only, 150ms |
| **focus** | outline ring `2px solid rgba(91,233,176,.8)` + offset 2px (scene focus style) | focus trap active, ปุ่มแรกได้ focus | Esc ปิด modal ได้ |
| **active** | `scale(0.94)` ขณะ press | ปุ่มปิด `scale(0.94)` | 120ms, button press feedback |
| **loading** | ไม่มี (ข้อมูลอ่านจาก MapModel ที่ scene มีอยู่แล้ว ไม่มี async fetch เพิ่ม) | spinner กลาง modal ถ้าข้อมูล epics ยังไม่พร้อม (edge) | โดยปกติ skip state นี้ไปเลย เพราะ MapModel พร้อมก่อน render |
| **error** | ไม่เปลี่ยน (ไม่มี network call ของ indicator เอง) | ถ้า stories array ว่างหรือ parse ผิดพลาด → แสดง fallback "ไม่สามารถแสดงข้อมูลได้" | read-only; error = malformed data only |
| **empty (unseen == 0)** | ไม่แสดง GiftIndicator เลย; campfire เป็นปกติ | ไม่เปิดได้ (ไม่มี trigger) | AC #4, #5 |
| **disabled** | N/A — ไม่มีสถานะ disabled ของ indicator เอง; ถ้า epics ยัง load ไม่ครบ → indicator ไม่แสดง (treat as empty) | — | ไม่ block interaction อื่นบน scene |

---

## Visual treatment — GiftIndicator

### ตำแหน่ง (no-CLS, campfire keep-out)

- Mount เป็น `position: absolute` ใน `.scout-layer` (หรือ fixed overlay ที่ pointer-events: none ยกเว้นตัว button เอง) บน `.map-stage`
- ตำแหน่งกองไฟ canvas center ~`left: 50%, top: 52%` ตามที่ DebugRoutes วาง keep-out circle `cx=50 cy=54`
- Gift button ลอยอยู่ **เหนือกองไฟ**: `left: 50%, top: 44%` (transform: translate(-50%, -100%)) ให้ปลายล่างของ icon อยู่ที่ขอบบนกองไฟ
- `pointer-events: none` บน wrapper; `pointer-events: auto` เฉพาะ button — ไม่ขวาง route ของ agent
- `position: absolute` ไม่ reflow scene → no CLS

### Gift icon + color (scene-local palette — dark map aesthetic)

Scene นี้ใช้ fixed dark palette (self-contained CSS ใน SCENE_CSS/HUD_CSS, intentionally immune to `.dark` toggle) ดังนั้น color ของ indicator ต้องอ้างอิง **scene CSS variables** ที่ประกาศใน `:root` ของ SCENE_CSS ไม่ใช่ Tailwind semantic tokens ของ app (ซึ่งเป็น light/dark toggle) เพราะ `.map-wrap` ถูก render ด้วย `z-index: 5` และ `background: #070d1c` และไม่ inherit `.dark` class

**Scene-local tokens ที่มีอยู่แล้ว (จาก SCENE_CSS `--` vars):**
- `--amber: #FFB454` — ใช้แล้วสำหรับ You-scout; warm/golden = สี "งานส่งมอบมาแล้ว!" ที่เหมาะมาก
- `--amber-glow: rgba(255,150,52,.6)` — ใช้สำหรับ glow effect

**การ์ดของขวัญใช้ `--amber` เป็นสีหลัก** เหตุผล: (1) warm/gold = celebratory, (2) สอดคล้องกับ You-alert ที่ใช้ amber แล้ว (family coherence), (3) contrast อ่านออกบน dark scene พื้นหลัง `#070d1c` — ผ่าน WCAG AA 3:1 สำหรับ large UI element (not measured ด้วย tool แต่ amber `#FFB454` บน dark near-black background ผ่าน 3:1 margin กว้าง)

**ขนาด:** `width: 44px; height: 44px` — tap target ≥ 44px ตาม DESIGN.md; icon Gift `20×20`

### Animation (celebratory float, anti-slop)

ใช้ `transform + opacity` เท่านั้น ตาม DESIGN.md motion rule:

```css
/* scene-local — ประกาศเพิ่มในส่วนต่อขยาย SCENE_CSS */
@media (prefers-reduced-motion: no-preference) {
  .gift-indicator {
    animation: giftFloat 2.4s ease-in-out infinite;
  }
  .gift-glow {
    animation: giftGlow 2.4s ease-in-out infinite;
  }
  @keyframes giftFloat {
    0%, 100% { transform: translate(-50%, -100%) translateY(0); }
    50%       { transform: translate(-50%, -100%) translateY(-5px); }
  }
  @keyframes giftGlow {
    0%, 100% { box-shadow: 0 0 10px 2px rgba(255,180,84,.35), 0 8px 22px rgba(0,0,0,.42); }
    50%       { box-shadow: 0 0 20px 6px rgba(255,180,84,.60), 0 8px 22px rgba(0,0,0,.42); }
  }
}
/* reduced-motion: static — indicator masih terlihat, no looping */
@media (prefers-reduced-motion: reduce) {
  .gift-indicator { animation: none; }
  .gift-glow { animation: none; }
}
```

- Duration 2.4s (restrained, ไม่ jittery) — อยู่ในกรอบ restrained motion ของ CampVibe
- ไม่ใช้ `transition: all`, ไม่ animate width/height/margin
- ภายใต้ `prefers-reduced-motion: reduce` → static (ยังแสดงอยู่ ไม่หาย)

### Unseen-count badge

- ตำแหน่ง: top-right corner ของ button; `position: absolute; top: -4px; right: -4px`
- ขนาด: `min-width: 20px; height: 20px` — `border-radius: 999px`
- สี background: amber `#FFB454`; text: `#241402` (dark brown ที่ You-alert ใช้ — contrast ผ่าน AA บน amber)
- font: `11px bold; font-family: var(--mono)` (monospace tabular-nums สำหรับตัวเลข)
- cap: แสดง `9+` ถ้า > 9 (เหมือน NotificationCenter)
- `aria-hidden="true"` บน badge เพราะ count อยู่ใน `aria-label` ของ button แล้ว

### ลักษณะ button container (สอดคล้อง glass treatment ของ scene)

```css
.gift-indicator {
  position: absolute;
  left: 50%;
  top: 44%;
  transform: translate(-50%, -100%);
  width: 44px;
  height: 44px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border-radius: 999px;
  background: rgba(11,30,24,.50);
  border: 1.5px solid rgba(255,180,84,.55);
  backdrop-filter: saturate(195%) blur(20px);
  -webkit-backdrop-filter: saturate(195%) blur(20px);
  cursor: pointer;
  color: #FFB454;
  pointer-events: auto;
  z-index: 25;
  /* glow */
  box-shadow: 0 0 10px 2px rgba(255,180,84,.35), 0 8px 22px rgba(0,0,0,.42);
}
.gift-indicator:hover {
  background: rgba(255,180,84,.14);
  border-color: rgba(255,180,84,.80);
  transform: translate(-50%, -100%) scale(1.08);
}
.gift-indicator:focus-visible {
  outline: 2px solid rgba(91,233,176,.8);
  outline-offset: 2px;
}
.gift-indicator:active {
  transform: translate(-50%, -100%) scale(0.94);
}
```

---

## DeliveryModal layout ("opening a gift")

### Structure

```
┌─────────────────────────────────────────────────────┐
│  [Gift icon 20px amber]  ส่งมอบสำเร็จ              [X] │
│  ─────────────────────────────────────────────────  │
│  scroll area max-height 420px                       │
│  ┌─────────────────────────────────────────────┐    │
│  │ [CheckCircle2 16px green]  Story title      │    │
│  │   epic label · วันที่ส่งมอบ (Thai พ.ศ.)    │    │
│  └─────────────────────────────────────────────┘    │
│  (repeat per unseen Done story)                     │
│  ─────────────────────────────────────────────────  │
│           [ปิด]  (ghost button, full width)         │
└─────────────────────────────────────────────────────┘
```

### Scene-local modal treatment

Modal ต้องอยู่บน dark map scene — ไม่ใช้ `bg-card` Tailwind token (เป็น light/dark toggle ที่จะขัด aesthetic) แต่ใช้ scene glass style เหมือนกับ `.popover` และ `.hud-dock`:

```css
.delivery-modal-overlay {
  position: fixed;
  inset: 0;
  z-index: 50;
  background: rgba(7,13,28,.65);
  backdrop-filter: blur(4px);
  display: flex;
  align-items: center;
  justify-content: center;
}
.delivery-modal {
  width: min(440px, calc(100vw - 2rem));
  max-height: min(600px, calc(100svh - 4rem));
  background: rgba(10,28,20,.88);
  backdrop-filter: saturate(195%) blur(30px);
  -webkit-backdrop-filter: saturate(195%) blur(30px);
  border: 1px solid rgba(255,180,84,.22);
  border-radius: 20px;
  box-shadow: 0 24px 64px rgba(0,0,0,.70), 0 0 32px rgba(255,180,84,.08);
  display: flex;
  flex-direction: column;
  overflow: hidden;
}
.delivery-modal-header {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 18px 20px 14px;
  border-bottom: 1px solid rgba(150,240,195,.12);
}
.delivery-modal-title {
  flex: 1;
  font-size: 15px;
  font-weight: 700;
  color: var(--text);  /* #F1F6FB */
}
.delivery-modal-close {
  width: 36px;
  height: 36px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border-radius: 999px;
  background: rgba(255,255,255,.06);
  border: 1px solid rgba(255,255,255,.10);
  color: var(--muted);
  cursor: pointer;
}
.delivery-modal-close:hover { background: rgba(255,255,255,.12); color: var(--text); }
.delivery-modal-close:focus-visible { outline: 2px solid rgba(91,233,176,.8); outline-offset: 2px; }
.delivery-modal-body {
  flex: 1;
  overflow-y: auto;
  padding: 12px 20px;
  scrollbar-width: thin;
  scrollbar-color: rgba(150,240,195,.2) transparent;
}
.delivery-story-item {
  display: flex;
  align-items: flex-start;
  gap: 10px;
  padding: 10px 0;
  border-bottom: 1px solid rgba(150,240,195,.08);
}
.delivery-story-item:last-child { border-bottom: none; }
.delivery-story-icon {
  flex: none;
  margin-top: 2px;
  color: #5BE9B0;  /* --success green จาก scene */
}
.delivery-story-title {
  font-size: 13px;
  font-weight: 600;
  color: var(--text);
  line-height: 1.4;
}
.delivery-story-meta {
  font-size: 11px;
  color: var(--muted);
  margin-top: 3px;
  font-family: var(--mono);
}
.delivery-modal-footer {
  padding: 12px 20px 16px;
  border-top: 1px solid rgba(150,240,195,.12);
}
.delivery-modal-footer-btn {
  width: 100%;
  min-height: 44px;
  border-radius: 999px;
  background: rgba(255,255,255,.06);
  border: 1px solid rgba(150,240,195,.20);
  color: var(--text);
  font-size: 13px;
  font-weight: 600;
  cursor: pointer;
}
.delivery-modal-footer-btn:hover { background: rgba(255,255,255,.12); }
.delivery-modal-footer-btn:focus-visible { outline: 2px solid rgba(91,233,176,.8); outline-offset: 2px; }
```

### วันที่ (Thai พ.ศ.)

- `completedAt` จาก `MapEpicStory` เป็น ISO string → แปลงเป็น Thai Buddhist era โดยใช้ `new Date(completedAt).toLocaleDateString('th-TH', { year: 'numeric', month: 'short', day: 'numeric' })`
- ผลลัพธ์เช่น: `25 มิ.ย. 2569`
- ใส่ใน `<span class="tabular-nums">` (scene CSS มี `--mono` สำหรับ monospace tabular digits)

### Entry animation modal (fancy แต่ tasteful)

```css
@media (prefers-reduced-motion: no-preference) {
  .delivery-modal-overlay {
    animation: fadeIn 160ms ease both;
  }
  .delivery-modal {
    animation: modalIn 200ms cubic-bezier(0.23,1,0.32,1) both;
  }
  @keyframes fadeIn {
    from { opacity: 0; }
    to   { opacity: 1; }
  }
  @keyframes modalIn {
    from { opacity: 0; transform: scale(0.92) translateY(8px); }
    to   { opacity: 1; transform: scale(1) translateY(0); }
  }
}
```

- Duration 200ms — อยู่ในกรอบ 120–250ms ของ DESIGN.md
- animate `transform + opacity` เท่านั้น

---

## Token table

| Value | Source | Used for |
|---|---|---|
| `#FFB454` / `var(--amber)` | scene CSS `:root` (SCENE_CSS) | Gift icon color, badge background tone, border accent |
| `rgba(255,180,84,.55)` / `.35` / `.60` / `.08` | scene-local (derived from `--amber`) | border, glow shadow levels |
| `rgba(255,150,52,.6)` / `var(--amber-glow)` | scene CSS `:root` | hover glow reference |
| `#241402` | scene — You-alert text color | badge text (dark on amber, high contrast) |
| `#F1F6FB` / `var(--text)` | scene CSS `:root` | modal title, story title |
| `rgba(223,234,245,.66)` / `var(--muted)` | scene CSS `:root` | meta text, close button color |
| `rgba(223,234,245,.42)` / `var(--faint)` | scene CSS `:root` | empty/error fallback text |
| `rgba(11,30,24,.50)` / `.88` | scene CSS (glass pattern — `.sound-toggle`, `.popover`) | indicator bg, modal bg |
| `rgba(150,240,195,.12)` / `.20` / `var(--line)` | scene CSS `:root` | divider lines, footer border |
| `rgba(91,233,176,.8)` | scene CSS — focus ring (`.sound-toggle:focus-visible`) | focus ring color ทั้ง indicator + modal close + footer btn |
| `#5BE9B0` | scene — Backend agent color / aura-ring working | CheckCircle2 icon in story list |
| `rgba(7,13,28,.65)` | derived from scene `background: #070d1c` | modal overlay scrim |
| `saturate(195%) blur(30px)` | scene CSS `var(--blur)` / `.hud-dock` | modal backdrop-filter |
| `border-radius: 20px` | scene — `.popover` 13px / `.hud-dock` 999px — modal ใหญ่กว่า → 20px fits between popover and dock | modal radius |
| `border-radius: 999px` | scene — `.sound-toggle`, `.badge` | indicator button, badge, footer button |
| `font-family: var(--mono)` | scene CSS `:root` | date/meta text (tabular) |

**ไม่มี token ใหม่ที่ต้องเพิ่มใน `DESIGN.md` + `app/globals.css`** เพราะ scene นี้ self-contained และ exempt จาก `check:palette` CI guard (`app/status/**` excluded ตาม DESIGN.md §0 enforcement note)

---

## Copy (locales/)

Keys ต้องเพิ่มใน `locales/translations.json` และ `locales/translations.ts` — TH + EN:

| Key | TH | EN |
|---|---|---|
| `map.delivery.indicatorLabel` | `ดูงานที่ส่งมอบสำเร็จ {count} รายการ` | `View {count} delivered items` |
| `map.delivery.modalTitle` | `ส่งมอบสำเร็จ` | `Delivery complete` |
| `map.delivery.closeBtn` | `ปิด` | `Close` |
| `map.delivery.emptyState` | `ไม่มีข้อมูลงานที่ส่งมอบ` | `No delivery data available` |
| `map.delivery.epicLabel` | `Epic` | `Epic` |
| `map.delivery.dateLabel` | `ส่งมอบเมื่อ` | `Delivered on` |

Thai copy rules verified:
- ไม่มี em-dash เป็น separator
- ไม่มี jargon ทางเทคนิค (`API`, `webhook`, `statusType`) ในข้อความ user-facing
- `{count}` เป็น placeholder สำหรับ interpolation (ไม่ใช่ Thai grammar จะ append โดยตรง)

**Note:** เนื่องจาก scene เป็น self-contained และ import `t()` ผ่าน `useLanguage` ไม่ได้โดยตรง (scene มี custom CSS context) → Frontend อาจ hardcode TH string ใน scene component และ reference keys จาก locales ผ่าน custom hook แบบเดียวกับที่ overlays อื่นทำ ให้ Frontend ตัดสินใจตาม pattern ที่ใช้อยู่ใน `campsite-overlays.tsx`

---

## a11y (WCAG 2.1 AA)

| Check | Spec |
|---|---|
| **Keyboard** | GiftIndicator เป็น `<button type="button">` — tab-focusable; DeliveryModal focus trap: focus ไปที่ปุ่มปิด [X] ทันที; Esc ปิด modal; กลับ focus ไปที่ GiftIndicator หลัง close |
| **Screen reader** | `aria-label={t('map.delivery.indicatorLabel', { count: unseenCount })}` บน GiftIndicator button; modal ใช้ `role="dialog" aria-modal="true" aria-labelledby="delivery-modal-title"`; badge เป็น `aria-hidden="true"` (count อยู่ใน aria-label ของ button แล้ว) |
| **Contrast** | amber `#FFB454` icon บน dark `rgba(11,30,24,.50)` bg = **not measured with tool**; visual เป็น warm gold on near-black, clearly legible; modal text `#F1F6FB` บน `rgba(10,28,20,.88)` = near-white on near-black = **not measured but AA-compliant by inspection** |
| **Color not only signal** | count badge แสดงตัวเลข; aria-label บอก count ด้วยข้อความ; icon Gift ให้ visual shape; ไม่ใช้สีเป็นสัญญาณเดียว |
| **Tap target** | GiftIndicator `width: 44px; height: 44px` (= 44px ≥ 44px) ✓; ปุ่มปิด [X] `width: 36px; height: 36px` — **Critical: ต่ำกว่า 44px** → Frontend ต้องปรับเป็น `width: 44px; height: 44px` บน close button; footer "ปิด" button `min-height: 44px` ✓ |
| **Focus ring** | `outline: 2px solid rgba(91,233,176,.8); outline-offset: 2px` บนทุก interactive element — รูปแบบเดียวกับ `.sound-toggle:focus-visible` ใน scene |
| **Motion** | Float animation wrapped ใน `@media (prefers-reduced-motion: no-preference)` — ใต้ reduce: indicator คงอยู่ (static), modal open/close ไม่มี animation |

**Action (Critical — ต้องแก้ก่อน merge):** Close button ต้องเป็น `44×44px` ไม่ใช่ `36×36px`

---

## No-CLS + Campfire keep-out

- GiftIndicator เป็น `position: absolute` ใน `.scout-layer` — ไม่ reflow DOM ใดเลย; ปรากฏ/หายด้วย conditional render ใน React (opacity transition ถ้าต้องการ smooth disappear ใน reduced-motion: none mode)
- ตำแหน่ง `left: 50%, top: 44%` (เหนือ campfire center ~50,52) — อยู่นอก keep-out zone (r=7% จาก `cx=50 cy=54`; top: 44% อยู่ห่าง 8% เหนือ center)
- Agent routes ยังเดิน under/around indicator ได้เพราะ indicator เป็น `pointer-events: none` บน wrapper; ขนาด 44px เป็น visual เท่านั้น; walk graph ไม่เปลี่ยน
- DeliveryModal render via `createPortal` ออก `document.body` เหมือน dialog อื่นบน scene — ไม่ reflow `.map-stage` หรือ `.scout-layer`

---

## Pure helper + localStorage seam (implementation contract สำหรับ Frontend)

### localStorage key

```
cv-map-delivery-seen
```

เก็บ `string[]` ของ story id ที่เคยดูแล้ว (เหมือน pattern ใน NotificationCenter ที่ใช้ SEEN_KEY แต่เป็น array ไม่ใช่ map เพราะไม่มี `updatedAt` ที่ต้อง track)

### First-load pre-seed rule (AC Rules)

ครั้งแรกที่ยังไม่เคยมี `cv-map-delivery-seen` ใน localStorage:
- pre-seed ด้วย **ทุก story id ที่ `statusType === "completed"` ที่มีอยู่ในขณะนั้น**
- ผลลัพธ์: ไม่ dump ประวัติเก่าทั้งหมด; แสดงเฉพาะงานที่ Done **หลังจากการเยี่ยมชมครั้งแรก**

### Pure helpers (no side-effects; testable)

```ts
// ค่าคงที่
export const DELIVERY_SEEN_KEY = "cv-map-delivery-seen";

// อ่าน seen-set จาก localStorage
export function readSeenIds(): Set<string> {
  if (typeof window === "undefined") return new Set();
  try {
    const raw = window.localStorage.getItem(DELIVERY_SEEN_KEY);
    const arr = raw ? (JSON.parse(raw) as string[]) : null;
    return arr ? new Set(arr) : new Set(); // null = ยังไม่มี key (ไม่ใช่ empty set)
  } catch {
    return new Set();
  }
}

// ตรวจว่าเคย initialize แล้วหรือยัง (ใช้ sentinel value)
export function hasInitializedSeen(): boolean {
  if (typeof window === "undefined") return false;
  try {
    return window.localStorage.getItem(DELIVERY_SEEN_KEY) !== null;
  } catch {
    return false;
  }
}

// Pre-seed ด้วย Done ที่มีอยู่ปัจจุบัน (เรียกครั้งเดียวเมื่อ key ไม่มี)
export function preSeedSeen(currentDoneIds: string[]): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(DELIVERY_SEEN_KEY, JSON.stringify(currentDoneIds));
  } catch {
    /* ignore */
  }
}

// เลือก Done stories ที่ยังไม่เคยดู
export function selectUnseenDeliveries(
  epics: MapEpicItem[],
  seenIds: Set<string>
): MapEpicStory[] {
  return epics
    .flatMap((e) =>
      e.stories
        .filter((s) => s.statusType === "completed" && !seenIds.has(s.id))
        .map((s) => ({ ...s, _epicLabel: e.label }))
    );
  // Note: caller ต้องอ่าน _epicLabel สำหรับ modal display
}

// Mark stories ว่าดูแล้ว (เพิ่มเข้า seen-set แล้วเขียนกลับ)
export function markSeen(ids: string[]): void {
  if (typeof window === "undefined") return;
  try {
    const current = readSeenIds();
    ids.forEach((id) => current.add(id));
    window.localStorage.setItem(DELIVERY_SEEN_KEY, JSON.stringify([...current]));
  } catch {
    /* ignore */
  }
}
```

### Hook flow (สำหรับ Frontend)

```ts
// ใน CampsiteScene (หรือ component แยก GiftIndicatorController)
useEffect(() => {
  if (!hasInitializedSeen()) {
    // First visit: pre-seed ด้วย Done ที่มีอยู่แล้ว
    const allDoneIds = epics
      .flatMap((e) => e.stories)
      .filter((s) => s.statusType === "completed")
      .map((s) => s.id);
    preSeedSeen(allDoneIds);
  }
}, []); // mount-once

const seenIds = readSeenIds();  // อ่านใหม่หลัง preSeed
const unseenStories = selectUnseenDeliveries(epics, seenIds);
const unseenCount = unseenStories.length;
```

---

## Error pattern

- ไม่มี network call → ไม่มี `ErrorBanner` pattern จาก `form-patterns.md`
- Error state เดียวคือ malformed data: ถ้า `unseenStories` มีแต่ items ที่ `completedAt === null` หรือ `title === ""` → แสดง `map.delivery.emptyState` text ในตำแหน่งเดียวกับ story list (กลาง modal body)
- ไม่ block indicator: indicator ยังแสดงเพื่อ inform user แต่ modal แสดง fallback text

---

## Reference

- Sound toggle (`.sound-toggle`) ใน `campsite-scene.tsx` — template สำหรับ glass button + focus ring + aria-label + localStorage pattern
- You-alert (`.you-alert`) ใน `campsite-scene.tsx` — template สำหรับ amber color + animation + callout bubble บน agent
- NotificationCenter `SEEN_KEY` pattern ใน `components/NotificationCenter.tsx` — template สำหรับ localStorage seen-map; CAM-171 ใช้ array ไม่ใช่ map (simpler: ไม่ track updatedAt)
- `campfire-keep-out` circle `cx=50 cy=54 r=7` ใน `DebugRoutes` — ใช้ verify ว่า indicator ที่ `top: 44%` อยู่นอก keep-out

---

## Design Gate checklist (Frontend ต้องผ่านทั้งหมดก่อน merge)

- [ ] Token-only: ทุก color/spacing ใน indicator + modal มาจาก scene CSS vars (`--amber`, `--text`, `--muted`, `var(--line)` ฯลฯ) — ไม่มี hardcoded arbitrary hex ที่ไม่ได้มาจาก scene palette; `npm run check:palette` green (scene files exempt แต่ต้องไม่แพร่ hardcode ไป component อื่น)
- [ ] Lucide-only: ใช้ `Gift`, `CheckCircle2`, `X` จาก `lucide-react` — ไม่มี emoji, ไม่มี `@tabler/icons-react`
- [ ] All 8 states ครบ: default / hover / focus / active / loading / error / empty / disabled — ตามตารางข้างต้น
- [ ] a11y: GiftIndicator button มี `aria-label` พร้อม count; modal มี `role="dialog" aria-modal aria-labelledby`; focus trap active ใน modal; Esc ปิดได้; focus กลับมาที่ indicator; close button `44×44px` (Critical fix)
- [ ] No-CLS: indicator เป็น `position: absolute` — ไม่ reflow; modal ผ่าน `createPortal`
- [ ] Campfire keep-out: indicator `top: 44%` อยู่นอก keep-out `cy=54 r=7`; `pointer-events: none` บน wrapper
- [ ] Animation: `transform + opacity` เท่านั้น; duration ≤ 250ms; wrapped ใน `prefers-reduced-motion: no-preference`; static fallback under reduce
- [ ] localStorage seam: ใช้ `cv-map-delivery-seen`; pre-seed on first visit; `markSeen` เรียกเมื่อ modal close; `selectUnseenDeliveries` pure + testable; coverage ≥ 80% บน helper functions
- [ ] Copy: ทุก user-facing string ผ่าน locales key; ไม่มี em-dash; ไม่มี jargon; Thai date format `th-TH` พ.ศ.
- [ ] Anti-slop: gift indicator เป็น tasteful amber glass button — ไม่ใช่ gradient ฉูดฉาด, ไม่มี emoji, animation restrained 2.4s float (ไม่ตีลังกา), modal dark glass สอดคล้อง scene — มี hierarchy ชัด (title + list + close)

---

## Links

- `story.md` (CAM-171) — AC และ Rules ที่ design นี้ trace back ไป
- `app/status/map/campsite-scene.tsx` — scene ที่ indicator ถูก mount เข้าไป
- `app/status/map/campsite-overlays.tsx` — pattern reference สำหรับ HUD_CSS + overlay components
- `components/NotificationCenter.tsx` — localStorage SEEN_KEY pattern ที่ reuse
- `DESIGN.md` — token table, motion rules, a11y checklist (§3), anti-slop (§5)

## Changelog

- v1 (2026-06-25) — created
