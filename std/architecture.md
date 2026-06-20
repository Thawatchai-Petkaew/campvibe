# std/architecture.md — มาตรฐาน Architecture (Architect)

> อ่านก่อนทำงาน: ไฟล์นี้ + `CLAUDE.md` + `std/api.md` (เพราะ API contract ส่งต่อ Backend) · งานแตะ schema จริงให้เทียบ `prisma/schema.prisma`
> หน้าที่: ออกแบบ data model (Prisma), API contract, component boundary, เขียน ADR สั้นต่อการตัดสินใจสำคัญ, ชี้ trade-off ที่ต้องให้มนุษย์เลือก
> **When NOT:** ไม่เขียน implementation/migration เอง (ส่ง Backend), ไม่ทำ UI flow/design (ส่ง Designer), ไม่ตัดสิน trade-off แทนมนุษย์ — ยกขึ้น G2

## หลักการ

- **Data atomic & AI-ready:** เก็บเป็นหน่วยเล็กที่ query อิสระได้ อย่ายัดหลายข้อเท็จจริงลง string เดียว เชื่อมด้วย ID ไม่ฝังซ้อน — ลด rework เมื่อ requirement โต · กรอบบังคับใช้เต็มรูปดู **Atomic Data Framework (Pixel · Set · Buffet)** ด้านล่าง
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

## Atomic Data Framework (Pixel · Set · Buffet)

> แรงบันดาลใจ: ตารางธาตุ — ข้อมูลประกอบจาก "อะตอม → โมเลกุล → สภาพแวดล้อม" ไม่ใช่จากตารางก้อนใหญ่ที่ปั้นมาให้พอดีหน้าจอเดียว เป้าหมาย: ทุก field ที่ออกแบบ AI agent/ระบบอื่นอ่านและใช้ต่อได้โดยไม่ต้อง pre-process

- **3 ชั้น:**
  - **Pixel** = field อะตอมมิก typed ที่ query/filter/sort อิสระได้ — หน่วยเล็กที่สุดที่แตกต่อไม่ได้แล้ว เก็บที่ความละเอียดสูงสุดเสมอ เช่น `priceAmount:Decimal` + `currency`, `latitude`, `longitude`, `provinceId`, `checkInDate`, `checkOutDate`
  - **Set** = entity ที่อธิบายตัวเองได้ (self-describing) ประกอบจาก Pixel + carry metadata เช่น Camp, Booking, Host, Review — แต่ละตัวมี `id`/`version`/`source`/`classification`/`updatedAt` พอให้ agent ที่ไม่เคยเห็นเข้าใจได้โดยไม่ต้องเปิด doc นอก; Set เชื่อมกันด้วย **ID** ไม่ฝัง JSON ซ้อน
  - **Buffet** = ชั้น read/access ที่ **"UI-neutral"** — service function / API view ที่ประกอบ Pixel เป็นรูปที่ client ใช้ โดยไม่ผูก schema กับหน้าจอ/รายงานใดหน้าจอหนึ่ง · **client เรียก Buffet ไม่เรียก raw table array** (UI เป็นแค่ผู้บริโภครายหนึ่งเท่ากับ AI agent)
- **Resolution Boundary test** (ก่อนตัดสินว่าจะแตก field ต่อไหม — atomicity ถูกต้องเพราะ "query อิสระได้" ไม่ใช่เพราะ "มีโครงสร้างย่อย") ถาม 4 ข้อ:
  1. มี use-case ที่ **query/filter/sort** ด้วยส่วนนี้เดี่ยว ๆ ไหม
  2. มัน **unit/ความหมาย** ต่างจากเพื่อนใน field เดียวกันไหม
  3. มันจะถูก **แก้แยกกัน** (คนละ ownership/ความถี่) ไหม
  4. ระบบอื่น/AI ต้อง **อ่านมันแยก** (คนละ classification/access control) ไหม
  → ถ้า "ใช่" ข้อใดข้อหนึ่ง = แตกเป็น Pixel แยก; ถ้า "ไม่" ทั้ง 4 = ยุบเป็น free-text Pixel เดียว (เช่น `addressDetail` ที่ไม่มีใคร filter "ชั้น 12") — แต่ส่วน geo-coded (`provinceId`,`districtId`,`postcode`) แตกแยกเสมอ
- **Typing + classification:** ทุก Pixel ต้องรู้ **type** + ป้าย **ชั้นข้อมูล** (PII / Financial / Geo / Public) + sensitivity ห้าม `string` ดิบไม่มีป้าย · โยง PII → `std/security.md` (masking/access) และ `std/ux.md` (PDPA/consent) · ตัวอย่าง CampVibe: `nationalId`=PII · `payoutAccountNo`=Financial+PII · `latitude`/`longitude`=Geo · `campName`/`amenityList`=Public
- **Compute-on-the-fly ไม่ cache เป็นต้นฉบับเดียว:** ค่า aggregate เช่น `camp.ratingAverage`, `camp.isAvailable(dateRange)`, `host.responseRate` ต้อง **คำนวณจาก Pixel ได้เสมอ** (จาก Review/Booking ต้นทาง) — เก็บ cache เพื่อ performance ได้ แต่ต้อง (ก) มี derivation ที่บอกได้ว่ามาจาก Pixel ตัวไหน (ข) reproduce จาก Buffet ได้ทุกเมื่อ (ค) ไม่ใช่ที่เดียวที่ข้อเท็จจริงนั้นอยู่ — ถ้าชี้ Pixel ต้นทางไม่ได้ = ออกแบบผิด
- **Crystallization/snapshot สำหรับธุรกรรม** (ต่อยอดกฎ "Snapshot เอกสารธุรกรรม" ด้านบน): ตอน Booking transition เข้าสถานะผูกพัน (`CONFIRMED`/`PAID`) → snapshot **ทุก Pixel ที่ถ้าเปลี่ยนแล้วความหมายทาง legal/financial เปลี่ยน** ลง Booking ณ เวลานั้น = `priceAmount`+`currency`, `taxRate`/`vatIncluded`, `campName`, `cancellationPolicy`, ช่วงวันที่จอง **+ เก็บ `campId` ต้นทาง** เพื่อ trace · ราคา/นโยบายที่ host แก้ทีหลังต้อง **ไม่กระทบ Booking เก่า** · snapshot Pixel ยัง atomic อยู่ (ไม่ใช่ string ต่อกัน) — แนะนำ prefix `snapshot…` หรือ sub-object ชัด ๆ · ค่าที่ไม่อยู่บนเอกสาร (เช่น สถานะ host ปัจจุบัน) = **link อย่างเดียว** query สด
- **No UI-shaped columns:** ออกแบบเสมือนไม่มี UI · ❌ `profileCardLine2`, `displayPriceText:"฿1,250/คืน"`, ตารางที่ปั้นมาเพื่อรายงานเดียว → ✅ เก็บเป็น Pixel (`priceAmount`+`currency`) แล้วให้ Buffet / `Intl.NumberFormat('th-TH',{style:'currency',currency})` ประกอบข้อความตอน render
- **Before-add-field checklist (กดผ่านทุกข้อก่อนเขียน migration/contract/form):** แตกต่อได้อีกไหม → แตก · มี classification (PII/Financial/Geo/Public) ไหม · มี type/unit/enum ระบุไหม · อยู่ใน Set ที่ระบุได้ไหม · เชื่อมด้วย ID ไม่ใช่ nesting ใช่ไหม · ชื่อ UI-neutral ใช่ไหม · พรุ่งนี้ AI agent อื่นใช้ field นี้ได้โดยไม่ต้องถามคนใช่ไหม — มีข้อ "ไม่" แม้ข้อเดียว = redesign ก่อน

## ต้องคำนึง / anti-patterns

- ❌ N+1 query (loop ยิง DB ทีละแถว) → ✅ `include`/`select`/batch ครั้งเดียว
- ❌ ยัดหลายค่าใน string เดียว → ✅ แตก field atomic + unit แยก (`amount`+`currency`)
- ❌ over-engineering / abstraction เผื่ออนาคต → ✅ ออกแบบพอดี story ปัจจุบัน
- ❌ migration ที่ย้อนไม่ได้ / ไม่ได้ทดสอบบน Staging → ✅ reversible + ทดสอบก่อน prod
- ❌ business logic รั่วเข้า component/route → ✅ รวมที่ service layer เดียว
- ❌ ตัดสิน trade-off สำคัญเงียบ ๆ → ✅ เขียน ADR + ยกขึ้นให้มนุษย์เลือกที่ G2
- ❌ UI-shaped column ตั้งชื่อ/ปั้นรูปตามหน้าจอ (`profileCardLine2`, `displayPriceText`) → ✅ เก็บ Pixel แล้วให้ Buffet/`Intl.NumberFormat` ประกอบตอน render
- ❌ ค่า aggregate ที่ cache ไว้เป็น source of truth เดียว (`ratingAverage` ที่ derive จาก Pixel ต้นทางไม่ได้) → ✅ compute-on-the-fly จาก Pixel; cache เป็นแค่ cache มี derivation trail

## Checklist (DoD ของ Architect — ก่อน handoff)

- [ ] data model atomic, relation ด้วย FK + index, snapshot ครบสำหรับเอกสารธุรกรรม
- [ ] เทียบ design กับ `prisma/schema.prisma` จริง + ประเมินผลกระทบ migration (reversible + ทดสอบ Staging ได้)
- [ ] API contract ระบุครบ (path/input/output/zod/authz/error) ให้ Backend ทำตามได้โดยไม่เดา
- [ ] ทุก field ผ่าน Resolution Boundary test + มี classification tag (PII/Financial/Geo/Public); aggregate compute-on-the-fly ได้; client ผูกกับ Buffet ไม่ใช่ raw table
- [ ] ไม่มี anti-pattern (N+1, over-engineering, premature abstraction, boundary รั่ว, UI-shaped column, cached-aggregate-as-source)
- [ ] ADR เขียนแล้วสำหรับการตัดสินใจย้อนยาก; trade-off ยกขึ้น G2
- [ ] spec ลง `## Data` ของ ticket + ผ่าน `linear-sync.mjs audit`
