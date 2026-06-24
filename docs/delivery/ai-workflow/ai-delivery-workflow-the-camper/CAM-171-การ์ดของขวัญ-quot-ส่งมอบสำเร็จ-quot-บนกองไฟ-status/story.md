---
linear: CAM-171
feature: ai-workflow
epic: ai-delivery-workflow-the-camper (CAM-138)
persona: platform
artifact: story
owner: product-owner
status: Backlog
version: v1
updated: 2026-06-24
---
# การ์ดของขวัญ &quot;ส่งมอบสำเร็จ&quot; บนกองไฟ /status/map (กดดูครั้งเดียว) (CAM-171)

## ทำไม

หน้า /status/map แสดงความคืบหน้าการส่งมอบแบบ real-time แต่ "การส่งมอบงานสำเร็จ" (ticket ถึง Done) ไม่มีจุดเฉลิมฉลอง/แจ้งให้เจ้าของรู้สึกว่า "มีของส่งมอบมาแล้ว" เจ้าของต้องไล่ดูเอง การมีการ์ดของขวัญเด่นๆ บนกองไฟช่วยสื่อสารความสำเร็จทันทีและน่าติดตาม
**KPI:** เมื่อมี story ถึง Done ใหม่ เจ้าของเห็นสัญญาณบนกองไฟภายในรอบ refresh และกดดูรายละเอียดได้; การ์ดหายหลังกดดู (ไม่รบกวนซ้ำ)

## Story

ในฐานะ **เจ้าของ (platform)** ฉันต้องการ **เห็นการ์ดของขวัญเด่นๆ บนกองไฟเมื่อมีงานส่งมอบสำเร็จ และกดดูได้ครั้งเดียว** เพื่อ **รับรู้และฉลองการส่งมอบโดยไม่ต้องไล่หาเอง**
ขอบเขต: เพิ่ม indicator (ของขวัญ) บนกองไฟใน `/status/map` เมื่อมี story ที่ Done และยังไม่เคยดู; กดเปิด modal แสดงรายการ ticket ที่ Done; หลังดูแล้วทำเครื่องหมายว่าเห็นแล้ว (localStorage) และ indicator หายไป; ไม่แตะ backend/schema

## AC

| # | Given (สถานะตั้งต้น) | When (ผู้ใช้ทำ) | ผลที่ผู้ใช้เห็น (copy ไทยจริง) | ผลเชิงข้อมูล/ระบบ |
| -- | -- | -- | -- | -- |
| 1 | มี story อย่างน้อย 1 อันที่ Done และยังไม่เคยถูกดู | เปิด /status/map | บนกองไฟมีการ์ดของขวัญเด่นสะดุดตา (สีสื่อความสำเร็จ) พร้อม badge จำนวนที่ส่งมอบใหม่ | อ่านจาก MapModel (statusType = completed) เทียบกับชุด "เคยดูแล้ว" ใน localStorage |
| 2 | มีการ์ดของขวัญแสดงอยู่ | กดที่การ์ดของขวัญ | เปิด modal หัวข้อ "ส่งมอบสำเร็จ" แสดงรายการ ticket ที่ Done: ชื่อเรื่อง, epic, วันที่ส่งมอบ (วันที่ไทย) | ไม่มีการเขียนข้อมูล (อ่านอย่างเดียว) |
| 3 | ดู modal แล้ว | ปิด modal | การ์ดของขวัญบนกองไฟหายไป | id ของ ticket ที่ดูแล้วถูกบันทึกในชุด "เคยดูแล้ว" (localStorage) |
| 4 | ดูแล้ว reload หน้า โดยไม่มี Done ใหม่ | เปิด /status/map | ไม่มีการ์ดของขวัญ (เพราะดูครบแล้ว) | ชุด "เคยดูแล้ว" คงอยู่ข้าม reload |
| 5 | ไม่มี story ที่ Done ที่ยังไม่ได้ดูเลย | เปิด /status/map | ไม่มีการ์ดของขวัญบนกองไฟ (กองไฟปกติ) | ไม่แสดง indicator |
| 6 | มี story Done ใหม่เกิดขึ้นหลังจากเคยดูไปแล้วรอบก่อน | story ใหม่ถึง Done แล้ว refresh | การ์ดของขวัญกลับมาแสดงเฉพาะของใหม่ + badge นับเฉพาะที่ยังไม่ดู | เทียบ id ใหม่กับ localStorage |

## Rules

* "ส่งมอบสำเร็จ" = `MapEpicStory.statusType === &quot;completed&quot;` (มี `completedAt`)
* การ์ดแสดงเฉพาะเมื่อมี Done ที่ id ยังไม่อยู่ในชุด "เคยดูแล้ว" (seen-set) ใน localStorage
* ครั้งแรกสุดที่ยังไม่เคยมี seen-set: pre-seed ด้วย Done ที่มีอยู่ปัจจุบัน เพื่อไม่ให้ dump ประวัติเก่าทั้งหมด (แสดงเฉพาะที่ส่งมอบ "หลังจากนี้") — 🟡 default นี้ ถ้าต้องการให้โชว์ย้อนหลังด้วยให้ระบุ
* persist ด้วย **localStorage** (reuse pattern เดียวกับ NotificationCenter SEEN_KEY) — ไม่มี backend/DB/migration
* token-only, dark-safe, ใช้ lucide icon (เช่น Gift) ไม่มีอีโมจิ; ปุ่ม/การ์ดมี aria-label
* ไม่ทำให้ scene อื่นเลื่อน (no CLS) และไม่ขวาง route ของ agent (campfire keep-out)

## Data

* อ่านจาก `MapModel` ที่ scene มีอยู่แล้ว (`epics[].stories[]` → `id/title/status/statusType/completedAt`) — ไม่เพิ่ม query/endpoint
* seen-set: localStorage key (เช่น `cv-map-delivery-seen`) เก็บ array ของ story id
* ไม่มี migration, ไม่มี API ใหม่

## Out of scope

* แจ้งเตือนข้าม device / server-side seen-state → Phase 2 (ตอนนี้ per-browser พอ)
* เสียง/เอฟเฟกต์เพิ่มบนกองไฟ (มี ambience อยู่แล้ว) → ไม่รวม
* การ์ดบนหน้า /status (board) ปกติ → story นี้เฉพาะ /status/map
* แสดง "released (prod)" แยกจาก "Done (staging)" → ใช้ Done เป็นเกณฑ์ส่งมอบในใบนี้

## Self-verify

- [ ] lint · typecheck
- [ ] test coverage ≥80% โค้ดใหม่ (logic: เลือก Done-ที่ยังไม่ดู, mark seen, pre-seed ครั้งแรก)
- [ ] a11y (การ์ด/ปุ่มมี aria-label, modal โฟกัสจัดการถูก, อ่าน "ส่งมอบสำเร็จ" ได้)
- [ ] design (token-only, dark-safe, ไม่มี CLS, ไม่มีอีโมจิ, lucide)
- [ ] security (อ่านอย่างเดียว, ไม่มี PII, localStorage ไม่มีข้อมูลอ่อนไหว)
- [ ] verify Staging URL: เปิด campvibe-staging.vercel.app/status/map → มี Done ที่ยังไม่ดู → เห็นของขวัญ → กดดู → หาย → reload ยังหาย

## Links

spec: epic [CAM-138](https://linear.app/campvibe/issue/CAM-138/ai-delivery-workflow-the-camper) (AI delivery workflow) · scene: app/status/map/campsite-scene.tsx · pattern: components/NotificationCenter.tsx (localStorage SEEN_KEY) · preview: campvibe-staging.vercel.app/status/map · design: DESIGN.md
