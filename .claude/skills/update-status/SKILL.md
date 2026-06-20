---
name: update-status
description: อัปเดตสถานะ ticket ใน Linear (team Campvibe) แบบ atomic — เปลี่ยน status/label, ติด awaiting-you เมื่อถึง gate มนุษย์, log การตัดสินใจ
---
# update-status
ทุก transition เรียก skill นี้:
- map สถานะ → Linear: backlog/Todo/In Progress/In Review/Done
- ถึง gate ที่ต้องมนุษย์ (G1-G5) → ติด label `awaiting-you` + โพสต์ Gate Review Packet เป็น comment
- มนุษย์ approve → เอา label ออก, เลื่อน status, agent เดินต่อ
- gate fail → เปิด Linear ticket ใหม่ + link
