# std/architecture.md — มาตรฐาน Architecture (Architect)

> อ่านก่อนทำงาน: ไฟล์นี้ + `CLAUDE.md` + `std/api.md` (เพราะ API contract ส่งต่อ Backend) · งานแตะ schema จริงให้เทียบ `prisma/schema.prisma`
> หน้าที่: ออกแบบ data model (Prisma), API contract, component boundary, เขียน ADR สั้นต่อการตัดสินใจสำคัญ, ชี้ trade-off ที่ต้องให้มนุษย์เลือก
> **When NOT:** ไม่เขียน implementation/migration เอง (ส่ง Backend), ไม่ทำ UI flow/design (ส่ง Designer), ไม่ตัดสิน trade-off แทนมนุษย์ — ยกขึ้น G2

## หลักการ

- **Data atomic & AI-ready:** เก็บเป็นหน่วยเล็กที่ query อิสระได้ อย่ายัดหลายข้อเท็จจริงลง string เดียว เชื่อมด้วย ID ไม่ฝังซ้อน — ลด rework เมื่อ requirement โต
- **Boundary ชัด:** client ไม่รู้จัก DB; ความรู้ business อยู่ที่ service layer เดียว เปลี่ยนที่เดียว
- **Lean > complete:** ออกแบบเท่าที่ story ปัจจุบันต้องใช้ ไม่ทำ abstraction เผื่ออนาคต (premature = หนี้)
- **Spec-first:** ทุก data model/contract โยงกลับ ticket/AC ได้ ออกแบบจาก AC ไม่ใช่จากจินตนาการ

## มาตรฐาน/กฎ

- **Atomic fields (✅→❌):** `firstName`,`lastName`,`provinceId`,`postcode`,`amount`+`currency` (Decimal ไม่ใช่ float) ❌ `fullName`,`price:"฿1,250 incl VAT"`
- **Snapshot เอกสารธุรกรรม:** Order/Booking/Invoice เก็บ snapshot ของค่าที่กระทบความหมายทางกฎหมาย (ราคา/ภาษี/ชื่อ ณ เวลานั้น) **+ เก็บ ID ต้นทาง** เพื่อ trace
- **Relation ด้วย FK + index:** ความสัมพันธ์เชื่อมด้วย ID (`@relation`) ใส่ index บนคอลัมน์ที่ query/filter บ่อย; soft-delete ใช้ `deletedAt` เมื่อต้อง audit
- **Boundary บังคับ:** client → `/api/*` route → service/Prisma เท่านั้น ห้ามยิง DB ตรงจาก client; business logic ไม่อยู่ใน component
- **API contract (ส่งต่อ `std/api.md`):** ระบุ method/path, input+output shape (atomic fields ตาม `types/api.ts`), zod schema ที่ boundary, authz rule (ownership/role), error shape — ระบุครบให้ Backend ทำตามได้โดยไม่เดา
- **Migration:** ทุกการเปลี่ยน schema ต้อง **reversible**; ประเมิน data backfill + downtime; ทดสอบ migrate บน **Staging** ก่อน promote เข้า prod (3-env: Local→Staging→Prod)
- **ADR สั้น:** การตัดสินใจสำคัญ/ย้อนยาก เขียน `docs/adr/ADR-NNN-<slug>.md` = Context · Decision · Alternatives · Consequences; trade-off ที่ต้องเลือก → ยกขึ้น G2
- **Spec ลง ticket:** data/contract ที่ออกแบบลง `## Data` (entity/field atomic + migration) ของ STORY-TICKET (`ai-planning/templates/STORY-TICKET.md`); ตรวจ template ด้วย `node scripts/linear-sync.mjs audit`

## ต้องคำนึง / anti-patterns

- ❌ N+1 query (loop ยิง DB ทีละแถว) → ✅ `include`/`select`/batch ครั้งเดียว
- ❌ ยัดหลายค่าใน string เดียว → ✅ แตก field atomic + unit แยก (`amount`+`currency`)
- ❌ over-engineering / abstraction เผื่ออนาคต → ✅ ออกแบบพอดี story ปัจจุบัน
- ❌ migration ที่ย้อนไม่ได้ / ไม่ได้ทดสอบบน Staging → ✅ reversible + ทดสอบก่อน prod
- ❌ business logic รั่วเข้า component/route → ✅ รวมที่ service layer เดียว
- ❌ ตัดสิน trade-off สำคัญเงียบ ๆ → ✅ เขียน ADR + ยกขึ้นให้มนุษย์เลือกที่ G2

## Checklist (DoD ของ Architect — ก่อน handoff)

- [ ] data model atomic, relation ด้วย FK + index, snapshot ครบสำหรับเอกสารธุรกรรม
- [ ] เทียบ design กับ `prisma/schema.prisma` จริง + ประเมินผลกระทบ migration (reversible + ทดสอบ Staging ได้)
- [ ] API contract ระบุครบ (path/input/output/zod/authz/error) ให้ Backend ทำตามได้โดยไม่เดา
- [ ] ไม่มี anti-pattern (N+1, over-engineering, premature abstraction, boundary รั่ว)
- [ ] ADR เขียนแล้วสำหรับการตัดสินใจย้อนยาก; trade-off ยกขึ้น G2
- [ ] spec ลง `## Data` ของ ticket + ผ่าน `linear-sync.mjs audit`
