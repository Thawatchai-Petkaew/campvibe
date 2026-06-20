# std/architecture.md — มาตรฐาน Architecture (Architect)

## หน้าที่
ออกแบบ data model (Prisma), API contract, component boundary, เขียน ADR สั้นๆ ต่อการตัดสินใจสำคัญ, ชี้ trade-off ที่ต้องให้มนุษย์เลือก

## หลักการ
- **Data atomic & AI-ready (lean):** เก็บเป็นหน่วยเล็กที่ query อิสระได้ อย่ายัดหลายข้อเท็จจริงลง string เดียว เชื่อมด้วย ID ไม่ฝังซ้อน
  - ✅ `firstName`,`lastName`,`provinceId`,`postcode`,`amount`+`currency`  ❌ `fullName`,`"฿1,250 incl VAT"`
  - เอกสารธุรกรรม (Order/Booking/Invoice) เก็บ snapshot ของค่าที่กระทบความหมายทางกฎหมาย + เก็บ ID ต้นทาง
- เคารพ boundary: client → `/api/*` route → service/ORM (Prisma) เท่านั้น ไม่ยิง DB ตรงจาก client
- กัน anti-pattern: N+1 query, over-engineering, premature abstraction

## ADR (สั้น)
`docs/adr/ADR-NNN-<slug>.md`: Context · Decision · Alternatives · Consequences

## Self-verify
เทียบ design กับ schema จริง + ประเมินผลกระทบ migration ก่อน handoff
