---
name: discover
description: รัน Discovery & gap-closure loop — research codebase + ค้นข้อมูล, สร้าง gap list 6 มิติ, รวมคำถามถามมนุษย์เป็นรอบ จนปิด gap แล้วออก ticket/spec ก่อน G1. ใช้ตอนเริ่มงานจาก requirement ใหม่/คลุมเครือก่อนแตะโค้ด. ห้ามใช้ตอน spec/ticket ปิด gap แล้ว (ข้ามไป build) หรือแค่แก้ bug ที่มี AC ชัดอยู่แล้ว
---
# discover — research + ปิด gap 6 มิติ แล้วออก ticket/spec ก่อน G1
อ่านก่อน: `std/discovery.md` (DoR + วิธีถามกลับ), `CLAUDE.md` (กฎเหล็ก + 3-env)

## Input / preconditions
- requirement จากมนุษย์ (อาจคลุมเครือ) — ยังไม่มี ticket/spec ที่ปิด gap
- เข้าถึง codebase จริง + Linear team Campvibe ได้
- งานยังอยู่ก่อน G1 (Spec) — ห้าม discover ซ้ำถ้า gap ปิดแล้ว

## วิธีทำ
1. research ของจริงก่อนเดา: อ่าน `prisma/schema.prisma`, `app/api/*`, `lib/*`, `components/*` + ดูงาน/issue เดิมใน Linear
2. ทำ gap list ต่อมิติ ครบ 6: Business · Functional · Technical · UX · Security/Data · Risk → ติดสถานะ 🟢 ปิด / 🟡 สมมติ(ต้อง confirm) / 🔴 ต้องถาม / ⚪ N/A
3. รวมคำถาม 🔴/🟡 → **ถามมนุษย์รอบรวบยอดเดียว** แต่ละข้อใส่ ตัวเลือก + ผลกระทบ + "ถ้าไม่ตอบ default อะไร" — ห้ามจุกจิกถามทีละคำ
4. ปิดครบ (ไม่มี 🔴) → เขียน ticket จาก `ai-planning/templates/STORY-TICKET.md` (story+AC เต็ม ลง issue ระดับ story; role-task = sub-issue) → เสนอ G1

## ต้องคำนึง
- **ห้ามเดาเงียบ** — ไม่รู้ = ยก 🔴 แล้วถาม
- AC ใช้รูปแบบ `Given | When | ผลที่ผู้ใช้เห็น (copy ไทย verbatim) | ผลเชิงข้อมูล/ระบบ`; **ห้ามใส่ event-code/ชื่อ class/ตัวแปร/testid ใน AC** (พวกนั้นอยู่ใน spec เทคนิค)
- copy ไทยใน AC: ห้าม em-dash (—) เป็นตัวคั่น, ห้ามศัพท์เทคนิคในข้อความผู้ใช้
- 1 atomic story = 1 PR เล็ก; gap ใหญ่ → แตกหลาย story อย่ายัดใบเดียว
- Done = merge เข้า staging + verify AC บน Staging URL; Released = promote staging→main — discovery ไม่แตะ flow นี้ แต่เขียน AC ให้ verify ได้บน staging จริง

## Output / postconditions
- gap list 6 มิติ ไม่มี 🔴 ค้าง (🟡 ต้องถูก confirm ก่อน)
- issue ระดับ story ใน Linear มีครบ DoR: User Story + AC testable + NFR (perf/a11y/i18n/security) + out-of-scope ชัด
- สถานะ: รอมนุษย์อนุมัติ G1 Scope (ติด label `awaiting-you`)

## Verify
- รัน `node scripts/linear-sync.mjs audit` ผ่าน (issue ต้องมีอย่างน้อย `## Story` + `## AC`)
- เช็ค: ไม่มี gap 🔴, ทุก 🟡 ได้คำตอบ/มี default ที่มนุษย์รับ, AC แต่ละข้อ testable + แตกเป็น atomic story แล้ว