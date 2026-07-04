# CAM-154 (S4) — overlay ระดับ Project (Delivery/Crew/Env/Backlog) + `<Overlay>` primitive

> Status SoT = Linear CAM-154. Content SoT = this folder. Parent epic: [CAM-150](../feature.md).

## Why

S1–S3 ทำให้ฉากมีชีวิตและตัวละครเดินได้แล้ว แต่ข้อมูลสถานะโปรเจกต์ยังไม่มีทางดูแบบ on-demand ระดับรายละเอียด. S4 เพิ่ม glass chip ติดขอบจอ 4 จุด (Delivery/Crew/Env/Backlog) และแผง You → Gates ที่ขยายเป็น full panel เมื่อกด — ทุกตัวเลข derive จาก `MapModel`/`status-derive` ไม่มีค่าปลอม, เปิดทีละอัน, Esc/คลิกนอกยุบ, a11y ครบ.

## Story

ในฐานะ **เจ้าของ (platform)** ฉันต้องการ **glass chip ติดขอบจอที่กดแล้วขยายเป็น full panel รายละเอียด** เพื่อ **ดูสถานะรวม → เจาะลึกได้ทีละจุดโดยไม่ต้องออกจากฉาก**.

**ขอบเขต:** overlay ระดับ Project (`scope=all`) เท่านั้น — 4 chip + You/Gates. ไม่รวม Epic overlay, Scope switcher list, Board/Kanban (ทั้งหมดเป็น S5).

## AC

| # | Given | When | ผลที่ผู้ใช้เห็น | ผลเชิงข้อมูล/ระบบ |
|---|---|---|---|---|
| 1 | อยู่ที่ `/status/map` | เปิดหน้า | เห็น chip 4 จุดติดขอบจอ (Delivery บนขวา, Crew ขวากลาง, Env ล่างขวา, Backlog ล่างซ้าย) | chip render, panel ซ่อน |
| 2 | chip ใด chip หนึ่งปิดอยู่ | กด chip | panel ขยายออก, chip เดิมหาย, จอหรี่ลงเล็กน้อย | `openOverlay` state = id นั้น |
| 3 | panel หนึ่งเปิดอยู่ | กด chip อื่น | panel เดิมปิด, panel ใหม่เปิด (เปิดทีละอัน) | state swap |
| 4 | panel เปิดอยู่ | กด Esc | panel ปิด, focus กลับ chip ที่เปิด | state null, focus returned |
| 5 | panel เปิดอยู่ | คลิกนอก panel | panel ปิด | state null |
| 6 | panel เปิดอยู่ | Tab ภายใน panel | focus วน loop ภายใน panel (focus trap) | ไม่หลุดออกนอก dialog |
| 7 | Delivery panel เปิด | ดูข้อมูล | เห็น 4 orb: % เสร็จ / gate รอ / Epic ที่กำลังทำ / Backlog + progress bar | ตัวเลขตรงกับ `m.projectPct`, `m.gates.length`, `m.epicsActive`, `m.totalEpics`, `m.backlogItems.length` |
| 8 | Crew panel เปิด | ดูข้อมูล | เห็นแถว You (gate count) ก่อน แล้วบาร์ราย role (done/active/queued) | derive จาก agents[].done/.activeCount/.queued |
| 9 | Env panel เปิด | ดูข้อมูล | 3 คอลัมน์ Dev/Staging/Prod + RELEASE tag บน Staging เมื่อมีของ; คอลัมน์ว่าง = — | derive จาก `m.byEnv` |
| 10 | Backlog panel เปิด | ดูข้อมูล | รายการ backlog จัดกลุ่ม role; ว่าง = `— ไม่มี story ใน backlog` | derive จาก `m.backlog` |
| 11 | กด ⚑N บน You character | คลิก | แผง `รออนุมัติจากคุณ (N)` เปิด, แต่ละ gate มีปุ่ม `ตรวจและอนุมัติ →` ลิงก์ Linear | derive จาก `m.gates` |
| 12 | ไม่มี gate รอ | ดู You panel | `✓ ไม่มีงานรออนุมัติจากคุณตอนนี้` | empty state |
| 13 | ไม่มีสตอรีในโปรเจกต์ | ดู Delivery panel | `ยังไม่มีสตอรีในโปรเจกต์` | empty state |
| 14 | reduced-motion เปิด | ดูฉาก | chip ยังใช้งานได้ (ไม่มี transform animation บน chip hover) | motion rules respected |

## Rules

- เปิดทีละ 1 panel เท่านั้น (`openOverlay: string | null` state)
- Esc / click-outside → ปิด + return focus to chip
- Full panel = `role="dialog"` `aria-modal="true"` + focus trap
- Chip = `<button>` `aria-expanded` `aria-controls`
- Tap target ≥ 44px (min-height enforced via CSS)
- motion transform/opacity เท่านั้น, 120–250ms; `.ovl-chip:hover` ภายใน `@media (prefers-reduced-motion: no-preference)` เท่านั้น
- ทุกตัวเลข derive จาก `MapModel` / `status-derive` ไม่มีค่า hardcode
- Thai copy: no em-dash separator, no technical jargon
- ไม่มี `console.log` / debug dump

## Data

`MapModel` ขยายจาก S1–S3:

```ts
// เพิ่มใน campsite-scene.tsx
interface MapGate     { id; title; url; epicKey; priority }
interface MapBacklogItem { id; title; role; epicKey }
interface MapEnvItem  { id; title; role }

MapModel += {
  epicsActive: number
  totalEpics: number
  backlogItems: MapBacklogItem[]
  envLanes: { dev: MapEnvItem[]; staging: MapEnvItem[]; prod: MapEnvItem[] }
}
```

Projection ใน `page.tsx` (server-side) — derive จาก `m.epicsActive`, `m.epicNodes.length`, `m.backlog`, `m.byEnv`.

## Out of scope

- Epic overlay (Progress/Up-next/Board) → S5
- Scope switcher full list → S5
- Scope switcher chip rendered → minimal placeholder ไม่ build list จริง → S5
- Real-time refetch → S6
- Dashboard ⇄ Map link → S6
