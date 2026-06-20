# std/qa.md — มาตรฐาน QA/Test (QA)

## หลักการ
test คือ **หลักฐานว่า AC เป็นจริง** ไม่ใช่พิธีกรรม coverage — ทุก test ต้อง assert พฤติกรรมที่ผู้ใช้/ระบบสัญญาไว้ใน ticket "ผ่าน suite" ไม่เท่ากับ "Done"; **Done = verify AC บน Staging URL จริง** ด้วย (test เขียวเป็นเงื่อนไขจำเป็น ไม่ใช่เพียงพอ) lean = ไม่มี test ที่ไม่ป้องกัน regression จริง

## มาตรฐาน/กฎ
**อ่านก่อนเขียน:** `std/qa.md` (ไฟล์นี้) + ticket ที่จะ test (ตาราง AC = source of truth ของ case)
- **Stack:** Vitest (unit/integration) + Playwright (e2e) — ถ้าโปรเจกต์ยังไม่มี runner: งานแรกคือ setup Vitest+Playwright + เพิ่ม script `test` (+ `test:coverage`) ก่อนเขียน case แรก
- **ครอบทุก AC:** ทุกแถวในตาราง AC ของ ticket = อย่างน้อย 1 test (happy + boundary + error/validation ตาม Rules); copy ไทย verbatim ที่ AC ระบุ ต้อง assert ตรงตัวอักษร
- **Coverage ≥ 80% บนโค้ดใหม่** (วัด diff ไม่ใช่ทั้ง repo); เลือก level ให้ตรงงาน: unit = logic/validation/zod, integration = API route + DB (Prisma), e2e = user flow ตาม AC ฝั่ง "ผลที่ผู้ใช้เห็น"
- **Test ID convention:** `<type>--<module>-<detail>` เช่น `btn--wishlist-toggle`, `input--login-phone`, `page--wishlist`
  type ที่ใช้: `page modal section form btn input select checkbox radio table row cell toast alert`
- **Defect** = report เป็น **ticket ย่อยกลับเข้า loop** พร้อม repro steps + AC ที่ fail (อ้าง #) + expected/actual; อย่าแก้โค้ดเอง — ส่งกลับ owner role
- **Server-authoritative:** validation/authz ต้องมี test ฝั่ง server (client validation = UX ไม่นับ); ห้าม mock เลเยอร์ที่กำลังจะ assert

## ต้องคำนึง / anti-patterns
- ❌ test ที่ไม่ assert จริง (render แล้วจบ) → ✅ assert ผล (DOM/return/DB row/copy)
- ❌ mock เกินจำเป็นจน test ผ่านแต่ของจริงพัง → ✅ mock แค่ boundary นอก (network/clock), เก็บ logic จริงไว้
- ❌ flaky (พึ่ง timing/order/`sleep`) → ✅ รอ condition จริง (`findBy*`/`waitFor`), test เป็นอิสระจากลำดับ
- ❌ ปั๊ม coverage ด้วย test ไร้ค่า → ✅ test ที่จะ fail เมื่อ behavior พัง
- ❌ ปิดงานเพราะ "test เขียว local" → ✅ ยังไม่ Done จนกว่า verify AC บน Staging URL จริง (ดู `std/ops.md`)

## Checklist (DoD ของ domain)
- [ ] ทุกแถว AC มี test ครอบ (happy + boundary + error) + copy ไทย verbatim ตรง
- [ ] รัน suite จริง เขียว 100% ไม่มี flaky/skip ค้าง
- [ ] coverage ≥ 80% บนโค้ดใหม่ (วัด diff)
- [ ] test ผ่าน CI (`.github/workflows/ci.yml`) ฝั่ง server บน PR base `staging`
- [ ] defect ที่พบ → เปิด ticket ย่อยพร้อม repro + AC ที่ fail
- [ ] **verify AC บน Staging URL จริงหลัง merge** → story พร้อมเข้า Linear state `Done` (≠ Released; Released = promote `staging`→`main`, ดู `std/ops.md`)
