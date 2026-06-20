---
name: update-status
description: อัปเดตสถานะ ticket ใน Linear (team Campvibe) แบบ atomic — เปลี่ยน status/label, ติด awaiting-you เมื่อถึง gate มนุษย์, log การตัดสินใจ
---
# update-status
Linear = single source of truth · สถาปัตยกรรมเต็ม: `ai-planning/SYNC-ARCHITECTURE.md`
ทุก transition **ต้องลงด้วยคำสั่งจริง** (executable) ผ่าน `scripts/linear-sync.mjs` ไม่ใช่แค่จำ:

- เริ่มงาน → `node scripts/linear-sync.mjs set <CAM-id> --state "In Progress"`
- เสร็จ (**Done** = merge เข้า `staging` + verify AC บน Staging URL จริง) → `... set <CAM-id> --state Done` (หรือให้ PR merge→`staging` ทำผ่าน Linear↔GitHub integration)
- ปล่อยขึ้น prod (**Released** = promote `staging`→`main` + tag) → `node scripts/linear-sync.mjs release <CAM-id>` (state Done + label `released`)
- ถึง gate มนุษย์ (G1-G5) → `... set <gate> --add-label awaiting-you` + โพสต์ Gate Review Packet เป็น comment
- เช็คว่ามนุษย์ approve หรือยัง → `npm run status:gates` (exit 10 = มี gate cleared → ไปต่อ)
- มนุษย์ approve (ถอด `awaiting-you` ใน Linear) → `... set <gate> --state Done` แล้ว spawn stage ถัดไป
- gate fail → เปิด Linear issue ใหม่ + link
- map สถานะ: backlog/Todo/In Progress/In Review/Done + label `released` (= ขึ้น prod แล้ว) · "Done"(staging) แยกจาก "Released"(prod) — ดู `ai-planning/SYNC-ARCHITECTURE.md` §Definition of Done

> watcher อัตโนมัติ: `/loop 10m npm run status:gates` หรือ `/schedule` ให้ orchestrator เดินต่อเองเมื่อ gate cleared
