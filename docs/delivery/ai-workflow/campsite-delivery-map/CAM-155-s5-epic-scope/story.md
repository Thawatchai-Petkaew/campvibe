# CAM-155 (S5) — Epic scope: switcher + Progress/Up-next/Board overlays

> Status SoT = Linear CAM-155. Content SoT = this folder. Parent epic: [CAM-150](../feature.md).

## Why

S1–S4 deliver the animated scene and all Overview-level overlays (Delivery/Crew/Env/Backlog). S5 adds the second scope dimension: selecting an epic narrows the scene to that epic's agents, switches the visual path to the 5-stage Trail, and swaps the right-side overlays for three Epic-specific ones (Progress/Up-next/Board). A Scope Switcher chip at top-left toggles between scopes. URL params persist the chosen scope so deep-linking and S6 Dashboard-Map linkage work correctly.

## Story

ในฐานะ **เจ้าของ (platform)** ฉันต้องการ **เจาะลึกราย epic บนแผนที่ได้โดยไม่ต้องรีโหลดหรือออกจากหน้า** เพื่อ **ดูความคืบหน้า Trail/Board/ในคิวของ epic นั้นแยกจากภาพรวมโปรเจกต์**

**ขอบเขต:** Scope switcher + Epic scope overlays (Progress/Up-next/Board) + URL state ที่ persist ข้าม refresh และสอดคล้องกับ `/status` สำหรับ S6 deep-link. ไม่รวม real-time / Dashboard-Map link (S6).

## AC

| # | Given | When | ผลที่ผู้ใช้เห็น | ผลเชิงข้อมูล/ระบบ |
|---|---|---|---|---|
| 1 | อยู่ที่ `/status/map` (Overview) | เปิดหน้า | เห็น chip `ทุก delivery ▾` ซ้ายบน | `scope=all` ใน URL |
| 2 | chip switcher Overview | กด | panel เลือกขอบเขต เปิด: ปุ่ม `ทั้งหมด`, segmented Feature/Persona, filter 4 ตัว, รายการ epic | panel แสดง ScopeSwitcherPanel |
| 3 | รายการ epic ใน switcher | กด epic | ฉากแคบลง: role ที่ไม่เกี่ยว epic นั้นจางลง (opacity 0.18); chip ซ้ายบนเปลี่ยนเป็น `‹ Overview · {epicName} ▾` | `scope=epic&epic={key}` ใน URL; `engine.setScope("epic", roles)` ถูกเรียก — rAF loop ไม่ restart |
| 4 | Epic scope | เห็นฉาก | เส้นทางเป็น Trail 5 สเตจ (via Progress overlay); role อื่น opacity 0.18 | CSS opacity เท่านั้น — ไม่มี remount |
| 5 | chip `‹ Overview · {epicName} ▾` | กด `‹ Overview` | กลับ Overview scope; ทุก agent กลับ opacity เต็ม | `scope=all` ใน URL; `engine.setScope("all", [])` |
| 6 | Epic scope | กด chip Progress (ขวาบน) | panel: Trail 5 สเตจ + 4 orbs (กำลังทำ/รอคุณ/ในคิว/ส่งแล้ว) | ตัวเลขตรงกับ `buildTrail(epicStories)` |
| 7 | ไม่มีสตอรีใน epic | เปิด Progress panel | `ยังไม่มีสตอรีใน epic นี้` | empty state |
| 8 | Epic scope | กด chip ในคิว (ขวา) | panel: รายการสตอรีในคิว เรียงตาม column | queued = ไม่ active, ไม่ done, ไม่ awaiting |
| 9 | ไม่มีสตอรีในคิว | เปิด Up Next panel | `— คิวว่าง` | empty state |
| 10 | Epic scope | กด chip Board (ล่าง) | panel: Kanban 5 คอลัมน์; active card border เขียว; awaiting card ป้าย `รอคุณ` + legend | ตรงกับ `COLS` ของ `/status` |
| 11 | URL `?scope=epic&epic=X` | เปิดหน้า | restore ตรงเข้า epic scope + epic นั้น | `initialScope/initialEpic` ส่งจาก page.tsx |
| 12 | เปลี่ยน scope/epic | ดู URL | URL อัปเดตทันที ไม่ navigate | `history.replaceState` |
| 13 | segmented Feature/Persona ใน switcher | กด | กลุ่มรายการเปลี่ยน + `?group=feature/persona` ใน URL | |
| 14 | filter กำลังทำ/เสร็จแล้ว/ยังไม่เริ่ม | กด | รายการ epic กรองตาม `epicBucket()` | |
| 15 | ทุก overlay (switcher/Progress/Up-next/Board) | กด Esc / คลิกนอก | ปิด panel; focus กลับ chip | ตาม Overlay primitive (S4 AC) |

## Rules

- เปลี่ยน scope ไม่ remount scene / ไม่ restart rAF loop — ใช้ `engine.setScope()` เท่านั้น
- Trail/Board numbers ต้องตรงกับ `/status` สำหรับ epic เดียวกัน — derive จาก `buildTrail`/`stageOf`/`hasAwait` ที่ import จาก `lib/status-derive.ts` (client-safe)
- URL params `scope`, `epic`, `group`, `efilter` ต้องใช้ `history.replaceState` (ไม่ navigate); ต้องสอดคล้องกับ `/status` param semantics สำหรับ S6 deep-link
- `scope=all` ↔ `/status?tab=overview`, `scope=epic` ↔ `/status?tab=epic`, `epic`/`group`/`efilter` เหมือนกันทั้งสองหน้า
- Thai copy: no em-dash separator, no technical jargon
- ไม่มี `console.log` / debug dump / hardcoded strings

## Data

`MapModel` ขยายจาก S4:

```ts
// เพิ่มใน campsite-scene.tsx
export interface MapEpicStory {
  id: string; title: string; status: string; statusType: string;
  labels: string[]; role: string; url: string; startedAt: string | null;
}
export interface MapEpicItem {
  key: string; label: string; feature: string; persona: string;
  bucket: "prog" | "done" | "todo"; stories: MapEpicStory[];
}
MapModel += { epics: MapEpicItem[] }
```

Projection ใน `page.tsx` (server-side) — derive จาก `m.epicNodes` + `epicBucket()` + `cleanTitle()` + `canonRole()`.

Client-side derive ใน `campsite-overlays.tsx` — `buildTrail(stories.map(storyAsIssue))`, `stageOf()`, `hasAwait()` จาก `lib/status-derive.ts`.

## Out of scope

- Real-time update จาก SSE → S6
- Dashboard ⇄ Map deep-link ปุ่มสลับ → S6
- Trail visual animation / walking on scope change → S7
