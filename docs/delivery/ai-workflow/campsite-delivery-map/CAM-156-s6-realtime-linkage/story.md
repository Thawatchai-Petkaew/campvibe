# CAM-156 (S6) — Real-time + Dashboard|Map linkage

> Status SoT = Linear CAM-156. Content SoT = this folder. Parent epic: [CAM-150](../feature.md).

## Why

S1–S5 deliver the animated scene, all overlays, and Epic scope. S6 closes the last two gaps: (1) the map updates in real-time from the SSE pulse without remounting the scene or resetting character positions, and (2) a segmented toggle lets the owner switch between the /status dashboard and /status/map without losing their current epic/group/filter context.

## Story

ในฐานะ **เจ้าของ (platform)** ฉันต้องการ **ดูแผนที่อัปเดตแบบ real-time และสลับไปแดชบอร์ดโดยยังคงกรองค่าเดิม** เพื่อ **ไม่ต้องรีโหลดหรือเลือก epic/group ใหม่ทุกครั้งที่เปลี่ยนมุมมอง**

**ขอบเขต:** JSON data endpoint + SSE reconcile (ไม่ remount rAF loop) + Dashboard|Map segmented toggle ทั้งสองหน้า + guard test skip-lists. ไม่รวม walking animation เมื่อ agent status เปลี่ยน (S7).

## AC

| # | Given | When | ผลที่ผู้ใช้เห็น | ผลเชิงข้อมูล/ระบบ |
|---|---|---|---|---|
| 1 | `/status/map` เปิดอยู่ | Linear webhook bump pulse | ตัวเลขใน overlay อัปเดต (agents/gates/pct); ตัวละครไม่ reset ไม่ blink | SSE event → fetch `/status/map/data` → `setLiveModel` + engine reconcile; rAF loop ยังวิ่ง |
| 2 | `/status/map/data?token=T` | GET request (token ถูก) | JSON `MapModel` | 200 + `Content-Type: application/json` |
| 3 | `/status/map/data` (ไม่มี token) | GET request (STATUS_TOKEN ตั้งอยู่) | 401 | ปฏิเสธ |
| 4 | SSE stream ขาด (hard fail / 401) | retry | backoff 5s × guard (max 5 ครั้ง); 60s interval ยังทำงาน | เหมือน dashboard-client.tsx |
| 5 | `prefers-reduced-motion` = reduce | pulse event | overlay data อัปเดต | `setLiveModel` ถูกเรียก; ไม่มี `triggerWalk` |
| 6 | อยู่ที่ `/status/map` | เห็น toggle | เห็น segmented control `แดชบอร์ด | แผนที่` (แผนที่ active); ≥44px tap | `role="tablist"` + `aria-selected` |
| 7 | อยู่ที่ `/status/map?scope=epic&epic=X&group=persona&efilter=prog&token=T` | กด `แดชบอร์ด` | ไปที่ `/status?tab=epic&epic=X&group=persona&efilter=prog&token=T` | param ทุกตัว carry ครบ |
| 8 | อยู่ที่ `/status` (tab=overview) | เห็น toggle | เห็น `แดชบอร์ด | แผนที่` ใน topBar; แดชบอร์ด active | |
| 9 | อยู่ที่ `/status?tab=epic&epic=X&token=T` | กด `แผนที่` | ไปที่ `/status/map?scope=epic&epic=X&token=T` | param mapping ถูกต้อง |
| 10 | `/status` ยกเว้น link | render | หน้าแสดงเหมือนเดิมทุกอย่าง | topBar ได้รับ tab/epic/group/efilter/tq params |

## Rules

- `setLiveModel` เรียก React setState — overlay re-renders ด้วย data ใหม่
- rAF loop ไม่ restart ไม่ remount; `engine.triggerWalk` ทำให้ตัวละครเดิน (ถ้าไม่ reduced-motion)
- `/status/map/data` ใช้ token gate เหมือน `/api/status/stream` (STATUS_TOKEN parity)
- `/status/map/data` รับประโยชน์จาก 60s pulse-keyed cache ใน `fetchStatusIssues` — ไม่เพิ่ม Linear load
- ทั้ง page.tsx และ data route ใช้ `toMapModel(buildModel(issues))` ผ่าน `lib/status-map-model.ts` — ไม่มี drift
- Toggle link ทำงาน without JS (real `<a>` anchor); map toggle เป็น `<span aria-selected>` (active, ไม่ navigate)
- Thai copy: no em-dash, no jargon

## Data

ไม่เพิ่ม field ใน MapModel (S5 ครบแล้ว). เพิ่ม:

- `lib/status-map-model.ts` — `toMapModel(m: Model): MapModel` + `buildMapModel(issues): MapModel`
- `app/status/map/data/route.ts` — GET endpoint ที่ token-gate + คืน MapModel JSON

## Out of scope

- Walking animation เมื่อ agent ไม่ active → active (S7)
- Walk trigger per-role diff (ใน reconcile ปัจจุบัน `triggerWalk` ถูกเรียกสำหรับทุก agent ทุก reconcile — S7 จะ refine เป็น diff-based)
