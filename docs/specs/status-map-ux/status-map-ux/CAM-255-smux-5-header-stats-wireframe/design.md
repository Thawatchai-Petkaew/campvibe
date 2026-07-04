---
linear: CAM-255
feature: status-map-ux
epic: status-map-ux
persona: Owner (internal — project status view)
artifact: design
owner: ux-designer
status: In Progress
version: v1
updated: 2026-06-28
---
# Design — /status/map Header Rework + Env-Pipeline Stats (CAM-255 SMUX-5)

## Flow

User job (from AC): ผู้ใช้เปิด `/status/map` บน tablet หรือ mobile และต้องการ (a) กด filter ได้สะดวกโดยไม่ให้ top bar แน่นเกิน และ (b) เห็นสถานะ env pipeline ชัดเจนที่ bottom bar

Flow:
1. เปิด `/status/map` บน &lt;1024px → top bar เหลือ logo + 3 icon buttons; filter row ปรากฏใต้ top bar
2. กด filter column (ผู้ใช้งาน / Feature / Epic) → drop-up menu เปิดขึ้นด้านบน
3. เลือก option → menu ปิด, filter row อัปเดต label
4. มองที่ bottom toolbar → เห็น env capsule `Dev 5 ▸ Staging 3 ▸ Ship 2` + 3-seg bar + `45%`
5. tap env capsule → summary popover ขึ้นจาก toolbar แสดง gates / epics / backlog
6. tap นอก popover หรือ tap capsule อีกครั้ง → ปิด popover

Desktop ≥1024: flow ไม่เปลี่ยน — 3-dropdown top row + left/right panels + bottom dock คงเดิม

## States (8)

| Element | default | hover | focus | active | loading | error | empty | disabled |
|---|---|---|---|---|---|---|---|---|
| Icon button (top bar) | glass chip, muted-night icon | border-hi, teal-glow icon | visible ring (night-scene ring) | `scale-95`, border-hi | — | — | — | opacity .45, pointer-events none |
| Filter column | glass, teal-glow label | border-hi, teal-glow stronger | focus ring on trigger | border-hi, bg rgba(teal,.08) | — | — | — | opacity .45 |
| Drop-up item | muted-night text | teal-glow bg-tint | focus ring | — | — | — | — | opacity .45 |
| Env capsule | glass inner, data shown | border-hi on inner | focus ring | opacity .85 | shimmer pulse on inner (data loading) | muted-night text "—" on all lanes | all lanes = 0 → bar full muted | — |
| Summary popover | glass-hi, full data | — | focus ring inside | — | skeleton rows | error text "โหลดไม่สำเร็จ" | — | — |
| ≡ ทีม button | glass chip | border-hi | focus ring | scale-95 | spinner inside | — | — | opacity .45 |
| Board button | glass chip | border-hi | focus ring | scale-95 | — | — | — | opacity .45 |

## Validation UX

ไม่มี form input ใน component นี้ ไม่มี inline error / ErrorBanner  
Error state ของ env capsule: ถ้า `envLanes` undefined → แสดง `—` ใน capsule ทุก slot; summary popover แสดง "โหลดไม่สำเร็จ" (Thai, ไม่ใช้ technical term)

## Components & tokens

### Components (จาก `components/ui/*`)

| Component | ใช้ที่ไหน |
|---|---|
| Radix `Tooltip` | tooltip label บน icon button (hover/focus) — Thai short label |
| shadcn `Popover` (หรือ custom absolute-positioned) | Env capsule expanded summary — ไม่ใช้ Dialog/Sheet เพราะเล็กและ anchored |
| lucide `LayoutDashboard` | icon: ดูผลงานทั้งหมด (→/status) |
| lucide `Gauge` | icon: Env/productivity toggle |
| lucide `Volume2` / `VolumeX` | icon: sound on/off toggle |
| lucide `ChevronRight` | icon: Board button |
| lucide `Users` | icon: ≡ ทีม button |

ไม่มีการประกอบ component ใหม่นอก `components/ui/*` — ทุก overlay ใช้ Popover หรือ custom CSS absolute positioned inside the HUD

### Tokens (night-scene scope — ไม่ใช่ OKLCH theme token)

ประกาศใน `SCENE_CSS` ของ `campsite-scene.tsx` ภายใน selector scoped:

| Token | Value | Role |
|---|---|---|
| `--glass` | `rgba(11,30,24,.55)` | button/chip background |
| `--glass-hi` | `rgba(11,30,24,.70)` | popover/summary background |
| `--glass-border` | `rgba(150,240,195,.14)` | border default |
| `--glass-border-hi` | `rgba(91,233,176,.40)` | border active/hover |
| `--teal-glow` | `#5BE9B0` | icon active, filter active, selected |
| `--text-night` | `#F1F6FB` | primary text |
| `--muted-night` | `rgba(223,234,245,.65)` | secondary text |
| `--faint-night` | `rgba(223,234,245,.40)` | tertiary / arrows |
| `--env-dev` | `#60a5fa` (blue-400) | Dev lane |
| `--env-staging` | `#fb923c` (orange-400) | Staging lane |
| `--env-ship` | `#4ade80` (green-400) | Ship (prod/released) lane |

Invariant: tokens เหล่านี้ scoped ภายใน HUD — ไม่ขึ้นกับ `.dark` class ของ CampVibe theme ห้าม refactor เป็น `bg-card`/`bg-background` หรือ OKLCH token

### Sizing rules

| Rule | Value |
|---|---|
| Icon button tap target | `44 × 44px` (w-11 h-11) |
| Filter row min-height | `30px` — ไม่ต่ำกว่านี้ |
| Bottom toolbar min-height | `52px` |
| Capsule min-height | `40px` |
| Filter col layout | `flex: 1` (3 คอลัมน์เท่ากัน) |
| Drop-up border-radius | `10px 10px 0 0` |
| Summary popover border-radius | `14px` |
| Motion duration | `120–250ms` |
| Motion properties | `transform` + `opacity` only |

## A11y

### Icon buttons (3 ปุ่ม top bar)
- `aria-label` ภาษาไทยทุกปุ่ม:
  - Dashboard: `aria-label="ดูผลงานทั้งหมด"`
  - Env toggle: `aria-label="ผลผลิต Scout Team"`
  - Sound toggle: `aria-label="เปิด/ปิดเสียง"` (อัปเดตเมื่อ state เปลี่ยน)
- tap target ≥ 44px (WCAG 2.1 AA)
- visible focus ring บนทุกปุ่ม (custom night-scene ring หรือ `outline-ring/50`)

### Filter row (drop-up)
- trigger: `aria-haspopup="listbox"`, `aria-expanded="true/false"`, `aria-controls="<menu-id>"`
- menu: `role="listbox"`, `id="<menu-id>"`
- item: `role="option"`, `aria-selected="true/false"`
- selected item ใช้สี teal-glow **และ** visual dot — ไม่ใช้สีเป็น signal เดียว
- keyboard: ArrowUp/Down เลื่อน, Enter เลือก, Escape ปิด + focus กลับ trigger
- click-outside dismiss

### Env capsule
- `role="button"`, `aria-expanded="true/false"`, `aria-controls="env-summary"`
- `aria-label` บรรยาย: `"สถานะ Env Pipeline — Dev 5, Staging 3, Ship 2, 45%"` (อัปเดตตาม data)
- min-height ≥ 44px สำหรับ tap target

### Summary popover
- `role="dialog"`, `aria-label="สถานะ Env Pipeline"`
- focus ย้ายเข้า popover เมื่อเปิด, กลับ capsule เมื่อปิด
- Escape ปิด popover
- color-not-only: segment สี + label text + bar position ใช้ร่วมกัน

### การวัด contrast
**Not measured** — Frontend ต้องวัดด้วย axe DevTools ก่อน design gate: `--text-night #F1F6FB` บน `--glass rgba(11,30,24,.55)` และ `--glass-hi rgba(11,30,24,.70)`; ต้องผ่าน 4.5:1 (body text) / 3:1 (large text)

### prefers-reduced-motion
- ปิด shimmer/sweep animation ทั้งหมดใน `@media (prefers-reduced-motion: reduce)`
- capsule toggle ใช้ opacity snap แทน animation

### iOS safe area
- toolbar padding-bottom รองรับ `env(safe-area-inset-bottom)`

## Copy (locales)

ไม่มี copy string ใหม่ในส่วน layout ที่เปลี่ยน — label เป็น data-driven ("ผู้ใช้งาน", "Feature", "Epic") จากค่าที่มีอยู่แล้ว  
Label ใหม่ที่ต้องเพิ่มใน `locales/`:

| key | TH | EN |
|---|---|---|
| `statusMap.envPipeline.dev` | Dev | Dev |
| `statusMap.envPipeline.staging` | Staging | Staging |
| `statusMap.envPipeline.ship` | Ship | Ship |
| `statusMap.envPipeline.capsuleAriaLabel` | สถานะ Env Pipeline — Dev {dev}, Staging {stg}, Ship {ship}, {pct}% | Env Pipeline — Dev {dev}, Staging {stg}, Ship {ship}, {pct}% |
| `statusMap.envPipeline.summaryTitle` | สถานะโปรเจกต์ | Project Status |
| `statusMap.envPipeline.gates` | Gates | Gates |
| `statusMap.envPipeline.epics` | Epics | Epics |
| `statusMap.envPipeline.backlog` | Backlog | Backlog |
| `statusMap.topBar.viewAll` | ดูผลงานทั้งหมด | View all work |
| `statusMap.topBar.productivity` | ผลผลิต Scout Team | Scout Team productivity |
| `statusMap.topBar.sound` | เปิด/ปิดเสียง | Toggle sound |

Thai copy rules: ไม่มี em-dash เป็น separator, ไม่มี technical term (Prod → Ship, env pipeline ใช้ภาษาที่เข้าใจ)

## Data mapping — Env Pipeline Capsule

| UI label | Source | หมายเหตุ |
|---|---|---|
| Dev `n` | `MapModel.envLanes.dev.length` | stories ที่ env = dev |
| Staging `n` | `MapModel.envLanes.staging.length` | stories ที่ env = staging |
| Ship `n` | `MapModel.envLanes.prod.length` | stories ที่มี label `released` (ดู `status-derive.ts:306 envOf()`) |
| `%` | `MapModel.projectPct` | overall project % |
| 3-seg widths | proportional: `lane/(dev+stg+prod) × 100%` | ถ้าทุก lane = 0 → full muted bar |
| Gates | `MapModel.gates` count + open count | — |
| Epics | `MapModel.epicsActive / totalEpics` | — |
| Backlog | `sum(agents[].queued)` | — |

## Error pattern

ไม่มี form — ไม่ใช้ `ErrorBanner`  
Env capsule error state: ถ้า data unavailable → แสดง `—` ใน capsule text (ไม่ crash, ไม่ hidden)  
Summary popover error state: แสดง "โหลดไม่สำเร็จ" (Thai, no technical term) + dismiss button

## Links

- Wireframe: `docs/design/status-map-header-stats.html`
- Plan (approved G1): `/Users/tawatchaipetkaew/.claude/plans/hover-stage-of-imperative-stearns.md`
- DESIGN.md — design system tokens + anti-slop rules
- Prior wireframe: `docs/design/status-map-responsive.html` (SMUX-1)
- Implementation files: `app/status/map/campsite-scene.tsx`, `app/status/map/campsite-overlays.tsx`
- Data source: `app/status/map/campsite-assets.ts` → `MapModel.envLanes`, `projectPct`

## Changelog

- v1 (2026-06-28) — created; SMUX-5 G2 wireframe + Design Brief for icon-only top bar, bottom filter row (drop-up), transparent toolbar, Env-pipeline capsule
