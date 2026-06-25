---
linear: CAM-184
feature: ai-workflow
epic: campsite-delivery-map-status-map (CAM-150)
persona: platform
artifact: story
owner: product-owner
status: Backlog
version: v1
updated: 2026-06-25
---
# Approve/Reject งานจากหน้า /status/map ได้จริง + detail view + ปรับ UI (notification/การ์ด) (CAM-184)

## ทำไม

[CAM-182](https://linear.app/campvibe/issue/CAM-182/devops-release-ปรบ-ui-ปายแจงเตอน-การดรออนมต-บน-statusmap) ทำ notification + การ์ดรออนุมัติให้สวยขึ้น แต่ยัง **กดแล้วไม่เกิดอะไร** (display-only). เจ้าของอยากกด **อนุมัติ/ส่งกลับ** จากหน้า /status/map ได้จริง → อัปเดต Linear → AI เดินงานต่อ · พร้อมแก้ UI ที่ค้าง (popover ซ้อน, notification ใหญ่ไป, เส้นเขียว, การ์ดสีไม่เข้าธีม)
**คุมต้นทุน:** ทุก action บน map = Linear GraphQL ผ่าน LINEAR_API_KEY (ฟรี) + Telegram (ฟรี) → **0 Anthropic token** (เปลือง token เฉพาะตอน AI แก้งานจริงหลัง reject)

## Story

ในฐานะ **เจ้าของ (platform)** ฉันต้องการ **อนุมัติ/ส่งกลับงานที่รอ และดูรายละเอียดจาก /status/map ได้ในที่เดียว** เพื่อ **คุมเกตได้เร็วโดยไม่ต้องเปิด Linear/Telegram และให้ AI เดินงานต่อทันที**
ขอบเขต: เพิ่ม endpoint approve/reject/detail (token-gated) + ทำการ์ด/notification ให้ interactive + ปรับ UI ตาม wireframe ที่อนุมัติ; ไม่แตะ engine/data model อื่น

## AC

| # | Given | When | ผลที่ผู้ใช้เห็น (copy ไทย) | ผลเชิงข้อมูล/ระบบ |
| -- | -- | -- | -- | -- |
| 1 | มีงานรออนุมัติ | กดการ์ดงานในการ์ดรออนุมัติ | เปิด modal รายละเอียด (ชื่อ/สถานะ/บทบาท/คำอธิบายจาก Linear) | GET /api/status/issue/[id] (token-gated) |
| 2 | อยู่ใน modal รายละเอียด | กด `อนุมัติ` → ยืนยัน | งานหายจากคิวภายในไม่กี่วินาที | POST /approve → removeAwaitingYou → webhook "approved" → AI เดินต่อ |
| 3 | อยู่ใน modal | พิมพ์เหตุผล (ถ้ามี) → กด `ส่งกลับ` | งานถูกส่งกลับ (ออกจากคิวรออนุมัติ) | POST /reject → addComment(เหตุผล) + ลบ awaiting-you + เพิ่ม `changes-requested` → AI อ่าน comment + แก้ |
| 4 | การ์ดรออนุมัติ | ดู | พื้นหลังเป็น amber โปร่งใส, หัวข้อสีสะดุดตา, ไม่มี priority badge, ปุ่ม `อนุมัติทั้งหมด` | ตัด badge; อ่าน gates เดิม |
| 5 | มี gate + hover ตัวละคร | ดู | notification เล็กลง ไม่มีเส้นเขียว และ **popover ไม่โผล่ทับ** (ซ่อนตอนมี gate) | suppress .popover เมื่อ has-gate |
| 6 | ไม่มี token / token ผิด | เรียก approve/reject/detail | ไม่ทำงาน (401) | authorized() STATUS_TOKEN |

## Rules

* endpoint ใหม่ทั้ง 3 ใช้ `authorized()` (STATUS_TOKEN, ?token=) + validate id `^[A-Z]+-\d+$` + rate-limit + ไม่ leak secret · LINEAR_API_KEY ฝั่ง server เท่านั้น
* approve = `removeAwaitingYou(id)` (มีขั้นยืนยันก่อนยิง) · reject = `addComment(id, reason)` + `removeAwaitingYou` + เพิ่ม `changes-requested` (ต้องมี helper `addLabel` + สร้าง label `changes-requested`)
* webhook: `looksApproved = awaiting-you ออก AND ไม่มี changes-requested` · เพิ่ม `looksRejected = changes-requested เข้า` → Telegram "rejected" + ไม่ยิง proceed-dispatch
* orchestrator.md: poll เจอ awaiting-you หาย → ถ้ามี changes-requested = ส่งกลับ (อ่าน comment ผ่าน Linear MCP → แก้ → re-raise) ไม่งั้น = อนุมัติ (เดินต่อ)
* UI: ใช้ scene tokens + lucide เท่านั้น ไม่มี emoji · ปุ่ม 44px, focus-visible, prefers-reduced-motion · ไม่แตะ engine/modal เดิม/logic การ fetch
* detail modal ใช้ scene-glass (เหมือน KanbanModal) · การ์ด bg amber โปร่งใส

## Data

* ไม่มี DB/migration · เพิ่ม Linear label `changes-requested` (สร้างครั้งเดียว) · อ่าน description ผ่าน fetchStatusIssues เดิม

## Out of scope

* จัด/เรียง priority (ตัดออก) · prod deploy (ถือไว้) · server-side persistence ของ reject reason (ใช้ Linear comment)

## Self-verify

- [ ] lint · typecheck · test · build · check:palette · check:ds
- [ ] endpoint tests: 401 ไม่มี token, 400 id ผิด, approve→removeAwaitingYou, reject→addComment+label, detail→issue/404
- [ ] security: 6-area audit บน 2 mutating routes (authz/validate/rate-limit/no-secret)
- [ ] a11y: 44px, focus, reduced-motion, lucide, no-emoji
- [ ] verify staging: กดอนุมัติ → awaiting-you หายใน Linear + Telegram "approved" (0 token) · ส่งกลับ → comment ลง Linear + changes-requested

## Links

plan+wireframe: docs/delivery (CAM-184 design.md) · reuse: lib/linear-actions.ts (removeAwaitingYou/addComment), authorized() pattern, app/api/linear-webhook · UI: campsite-overlays.tsx (ApprovalCard) + campsite-scene.tsx (.you-alert)
