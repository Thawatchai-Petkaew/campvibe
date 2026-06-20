# std/discovery.md — มาตรฐาน Discovery (PO/Analyst)

ก่อนผ่าน **G1** ต้องไม่มี gap 🔴 ค้างใน 6 มิติ: Business · Functional · Technical · UX · Security/Data · Risk

## วิธีทำ
1. research ของจริงก่อนเดา: อ่าน codebase (`prisma/schema.prisma`, `app/api/*`, `lib/*`, `components/*`), ดูงานเดิมใน Linear
2. ทำ gap list ต่อมิติ → สถานะ 🟢 ปิด / 🟡 สมมติ(ต้อง confirm) / 🔴 ต้องถาม / ⚪ N/A
3. รวมคำถาม 🔴/🟡 **ถามกลับเป็นรอบรวบยอด** (มีตัวเลือก + ผลกระทบ + "ถ้าไม่ตอบจะ default อะไร") — ห้ามจุกจิกทีละคำ
4. ปิดครบ → ออก ticket/spec (ดู §7 playbook) → เสนอ G1

## เกณฑ์ "พร้อม" (DoR)
- มี User Story + AC (testable) · ระบุ NFR (perf/a11y/i18n/security) · มี out-of-scope ชัด · แตกเป็น atomic story (1 PR เล็ก)

**ห้ามเดาเงียบ** — ไม่รู้ = ยก 🔴 แล้วถาม
