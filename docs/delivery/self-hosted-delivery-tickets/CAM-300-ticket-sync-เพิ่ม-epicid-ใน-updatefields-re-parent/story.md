---
linear: CAM-300
feature: self-hosted-delivery-tickets
epic: self-hosted-delivery-tickets (CAM-276)
persona: platform
artifact: story
owner: product-owner
status: Awaiting Gate
version: v1
updated: 2026-07-03
---
# ticket-sync: เพิ่ม epicId ใน updateFields (re-parent ได้) (CAM-300)

## Why
Blueprint v6 ต้อง re-parent story ~20 ใบเข้าโครง epic ใหม่ แต่ verb `updateFields` ของ ticket API ยังแก้ `epicId` ไม่ได้ (ตั้งได้ตอนสร้างเท่านั้น) — การ revise estate ทั้งกระดานติดที่ช่องว่างนี้ช่องเดียว

## Story
ในฐานะ orchestrator (platform) ฉันต้องการย้าย ticket ที่มีอยู่ไปอยู่ใต้ epic อื่นผ่าน API เพื่อ re-map งานเก่าเข้าโครง epic ใหม่โดยคง CAM-id และประวัติทั้งหมด

ขอบเขต: `PATCH /api/tickets/[id]` action `updateFields` รับ `epicId` (CAM-id หรือ null) — ไม่แตะ UI

## AC
| # | Given | When | ผลที่ผู้ใช้เห็น | ผลเชิงข้อมูล |
|---|---|---|---|---|
| 1 | story อยู่ใต้ epic A และมี epic B อยู่จริง | PATCH updateFields epicId = CAM ของ epic B | บอร์ด /status แสดง story ใต้ epic B | epicId ชี้ epic B + TicketEvent บันทึกการแก้ |
| 2 | เป้าหมาย epicId เป็น ticket ที่ไม่ใช่ EPIC | PATCH updateFields ชี้ใบนั้น | ได้ข้อความผิดพลาดชัดเจน | 400 — ข้อมูลไม่ถูกแก้ |
| 3 | ส่ง epicId เป็น null | PATCH updateFields epicId = null | story ไม่อยู่ใต้ epic ใด | epicId = null |
| 4 | epicId เป็น CAM-id ที่ไม่มีจริง | PATCH updateFields | ได้ข้อความผิดพลาดชัดเจน | 404 — ข้อมูลไม่ถูกแก้ |
| 5 | epic ชี้ตัวเอง | PATCH updateFields epicId = ใบเดียวกัน | ได้ข้อความผิดพลาดชัดเจน | 400 — ข้อมูลไม่ถูกแก้ |

## Rules
- `epicId` รับ identifier (CAM-###) แล้ว resolve เป็น id จริงฝั่ง service; รับ null เพื่อถอด parent
- เป้าหมายต้องเป็น type EPIC เท่านั้น และห้ามชี้ตัวเอง
- การแก้ทุกครั้งบันทึก TicketEvent แบบเดียวกับ field อื่นของ updateFields

## Data
ไม่มี migration — ใช้คอลัมน์ `epicId` เดิมใน prisma/delivery

## Out of scope
- CLI subcommand ใหม่ (ใช้ curl PATCH ตรงได้)
- bulk re-parent endpoint

## Self-verify
- vitest: re-parent สำเร็จ / เป้าไม่ใช่ EPIC / ไม่มีจริง / null / self-parent
- npm run lint · typecheck · test เขียว

## Links
แผน Blueprint v6 estate revision (2026-07-04) · ADR-010 self-hosted delivery tickets
