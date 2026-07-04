---
linear: CAM-175
feature: ai-workflow
epic: ai-delivery-workflow-the-camper (CAM-138)
persona: platform
artifact: story
owner: product-owner
status: Backlog
version: v1
updated: 2026-06-24
---
# ปรับ board /status/map ลงเลนให้ถูก (QA/Security/รออนุมัติ = ตรวจสอบ) + แก้ข้อมูลล่าช้า + Backlog/To Do (CAM-175)

## ทำไม

หน้า /status/map (Kanban + Status Board) แสดงสถานะไม่ตรงจริง 5 อาการ (ยืนยันจากโค้ด):

1. ข้อมูลล่าช้า ~1 นาที หลัง Telegram แจ้ง — `campsite-scene.tsx` ตก fallback poll 60s เมื่อ SSE ไม่ส่ง
2. งาน QA + Security ค้างที่ "กำลังทำ" ไม่ไป "ตรวจสอบ" — board จัดเลนด้วย `s.status` ดิบ ไม่สน role
3. ที่ควรเป็น: 2 role นี้ = ขั้นรีวิว
4. งานที่รอเจ้าของ approve (`awaiting-you`) ควรอยู่เลน "ตรวจสอบ" (ตอนนี้แค่ติด badge รอคุณ ไม่ย้ายเลน)
5. Backlog กับ To Do ต่างกันไม่ชัด + To Do ว่างตลอด (workflow กระโดด Backlog→กำลังทำ ไม่เคย set unstarted)

**KPI:** เลนตรงความหมาย (QA/Security/รออนุมัติ = ตรวจสอบ), ข้อมูลอัปเดต ≤15 วินาที, To Do มีความหมายและถูกเติม

## Story

ในฐานะ **เจ้าของ (platform)** ฉันต้องการ **board /status/map ที่ลงเลนตามความหมายจริงและอัปเดตเร็ว** เพื่อ **ดูสถานะทีมได้ถูกต้องโดยไม่ต้องรอหรือแปลความเอง**
ขอบเขต: เพิ่ม `boardColumnOf` (derive เลนจาก statusType + role + label) ใช้ร่วมทุกจุดบน board; ลด interval ให้ข้อมูลสด; นิยาม Backlog/To Do ให้ชัด + เติม To Do; ไม่แตะ logic การ fetch/seen เดิม

## AC

| # | Given | When | ผลที่ผู้ใช้เห็น (copy ไทยจริง) | ผลเชิงข้อมูล/ระบบ |
| -- | -- | -- | -- | -- |
| 1 | งานมี role ปัจจุบันเป็น QA หรือ Security | เปิด board | การ์ดอยู่เลน `ตรวจสอบ` ไม่ใช่ `กำลังทำ` | derive จาก role ไม่ใช่ state ดิบ |
| 2 | งานติดป้ายรอเจ้าของอนุมัติ | เปิด board | การ์ดอยู่เลน `ตรวจสอบ` + ยังมีป้าย `รอคุณ` | `awaiting-you` → เลนตรวจสอบ |
| 3 | งานที่ scope แล้วแต่ยังไม่เริ่มทำ | เปิด board | การ์ดอยู่เลน `To Do` | statusType unstarted → To Do |
| 4 | งานยังเป็นแค่ไอเดีย ยังไม่ commit | เปิด board | การ์ดอยู่เลน `Backlog` | statusType backlog → Backlog |
| 5 | มีการเปลี่ยนสถานะงาน (เช่น handoff) | Telegram แจ้งเตือน | board อัปเดตภายใน ~15 วินาที (ปกติ ~1.5 วินาที) ไม่ใช่ ~1 นาที | fallback 15s + SSE poll 1.5s |
| 6 | งานเสร็จ (merged) | เปิด board | การ์ดอยู่เลน `เสร็จ` | statusType completed → Done |

## Rules

* `boardColumnOf(issue)` (ใน `lib/status-derive.ts`) ลำดับ: completed→Done · (มี `awaiting-you` หรือ role∈{qa-engineer,security-reviewer})→In Review · started→In Progress · unstarted→Todo · อื่นๆ→Backlog
* ใช้ `boardColumnOf` ที่ทุก consumer แทนการ match `s.status` ดิบ: Kanban `byCol`, SB_LANES, MINI_LANES (`campsite-overlays.tsx`) + COLS (`app/status/page.tsx`) → /status กับ /status/map ตรงกัน
* คงป้าย `รอคุณ` (awaiting-you) ไว้คู่กับเลนใหม่ · คงเลน/สี/label เดิม (เปลี่ยนแค่การจัดเข้าเลน)
* lag: `FALLBACK_MS` 60000→15000 (`campsite-scene.tsx`) · `STATUS_STREAM_POLL_MS` default 2500→1500 (`status/stream/route.ts`) · ตรวจ token parity ให้ SSE ต่อได้จริง
* Backlog = ยังไม่ commit/parked · To Do = scope แล้ว (ผ่าน G1) ยังไม่เริ่ม · In Progress = role กำลังทำ · ตรวจสอบ = QA/Security หรือรออนุมัติ · เสร็จ = merged+verified
* ไม่แตะ logic fetch/pulse/seen เดิม; Linear ยังเป็น SoT ของ state — board แค่ derive การแสดงผล

## Data

* ไม่มี data/API/migration เปลี่ยน (อ่าน MapModel/StatusIssue เดิม)

## Out of scope

* การ set Linear state เป็น "In Review" จริงตอน handoff (ให้ Linear UI ตรงด้วย) → deferred
* infra ใหม่ (websocket/pubsub) → ไม่ทำ

## Self-verify

- [ ] lint · typecheck · build
- [ ] unit `boardColumnOf` matrix (ครบทุกเคส + precedence)
- [ ] source-inspection: consumers ใช้ boardColumnOf ไม่ใช่ s.status ดิบ
- [ ] check:palette + check:ds ผ่าน (ไม่แตะ visual)
- [ ] security self-check (UI/logic ล้วน ไม่มี data/PII)
- [ ] verify Staging /status/map: QA/Security/awaiting → ตรวจสอบ; เปลี่ยนสถานะ → อัปเดต ≤15s

## Links

ref: lib/status-derive.ts (stageOf/ROLE_STAGE เดิม) · app/status/map/campsite-overlays.tsx · app/status/page.tsx · app/status/map/campsite-scene.tsx · app/api/status/stream/route.ts · .claude/agents/orchestrator.md
