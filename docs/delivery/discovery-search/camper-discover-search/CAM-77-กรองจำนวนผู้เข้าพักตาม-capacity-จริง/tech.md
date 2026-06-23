---
linear: CAM-77
feature: discovery-search
epic: camper-discover-search (CAM-33)
persona: camper
artifact: tech
owner: architect
status: Done
version: v1
updated: 2026-06-23
---
# Tech — กรองจำนวนผู้เข้าพักตาม capacity จริง (CAM-77)

## Field chosen
- **`CampSite.maxGuestsPerDay: Int?`** (`prisma/schema.prisma` `model CampSite`, ฟิลด์ "จำนวนผู้เข้าพักสูงสุดต่อวัน") — capacity ระดับลานที่ operator กรอก = แหล่งความจริงเดียวของ "ลานนี้รับได้กี่คน".
- ทำไมไม่ใช้ผลรวม `Spot` / `maxTentsPerDay`: scope ของ story คือ "ลานรับกลุ่มขนาดนี้ได้ไหม" ซึ่งเป็น attribute ระดับลานโดยตรง; การ aggregate จาก spot เป็นคนละ semantic (availability ราย slot, ดู C-3.1) และจะทำให้ where-clause ซับซ้อนเกินจำเป็น.
- ฟิลด์เป็น **nullable** เพราะ operator จำนวนหนึ่งยังไม่ได้กรอกความจุ → ขับ key decision เรื่อง null arm ด้านล่าง.

## Where-clause shape (the fix)
ใน `lib/campsite-filters.ts` → `buildCampSiteWhere(params)` (step 5). guard: ใช้ filter เฉพาะเมื่อ `parseInt(guests, 10)` เป็นจำนวนเต็มบวก (`!isNaN && > 0`).

เมื่อ apply จะ push clause หนึ่งตัวเข้า **`where.AND`** (ไม่ใช่ set ที่ top level):

```ts
where.AND = [
  ...,
  { OR: [ { maxGuestsPerDay: { gte: guestsNum } }, { maxGuestsPerDay: null } ] },
]
```

SQL ที่ปล่อย: `WHERE (maxGuestsPerDay >= N OR maxGuestsPerDay IS NULL)`.

เหตุผลเชิงโครงสร้าง 2 ข้อ:

1. **AND-wrapped OR null arm (DEFECT-01 — Critical):** Prisma `{ maxGuestsPerDay: { gte: N } }` เพียวๆ บน PostgreSQL ประเมิน `NULL >= N` เป็น `NULL` (ไม่ใช่ `TRUE`) → row ที่ `maxGuestsPerDay IS NULL` ถูก **ตัดทิ้งเงียบๆ** ขัดกับ AC-1 (ลานที่ความจุไม่ระบุต้องคงอยู่). แก้โดยห่อด้วย `OR [ gte, null ]` เพื่อให้ null row ผ่านเสมอ. รายละเอียดการพิสูจน์อยู่ใน `test.md` (Prove-It).
2. **ใส่ใน `where.AND` ไม่ใช่ top-level เพื่อไม่ทับ `where.OR`:** step 2 (keyword search) ใช้ `where.OR` แล้ว. ถ้าวาง capacity OR ที่ top-level `where.OR` จะถูก overwrite (keyword search หาย) หรือถ้ารวมเข้า array เดิมจะกลายเป็น OR-mix ที่ผิด semantic. การ push เป็น clause แยกใน `where.AND` ทำให้ capacity เป็น **AND** กับ filter อื่นทั้งหมดถูกต้อง และ coexist กับ taxonomy filter (`addOptionFilter` ที่ก็ใช้ `where.AND` เช่นกัน) โดยไม่ชนกัน.

## Guard semantics
- ค่า `guests` ที่ valid = parse เป็น integer ได้ **และ > 0** → apply filter.
- `undefined` / `"0"` / ค่าติดลบ / `NaN` ("abc") / `""` → **ไม่ apply** (silent, ไม่มี error ถึง user; ผลเหมือนไม่ได้กรอง).
- `parseInt` leading-integer: `"4abc"` → 4, `"4.5"` → 4 (parseInt หยุดที่อักขระแรกที่ไม่ใช่เลข) → ถือว่ามี leading integer จึง apply filter ด้วยค่านั้น. เป็นพฤติกรรม intentional (client ควรส่ง integer string ล้วน) และมี test กำกับ.
- หมายเหตุ: `story.md ## Rules` ตอนร่างระบุ "guests ≥ 2 ถึงกรอง (1 = default)". โค้ดที่ ship ใช้ guard ที่กว้างกว่า/ตรงไปตรงมากว่าคือ **> 0** (guests=1 จะ apply `gte: 1` ซึ่งกรองออกเฉพาะลานที่ `maxGuestsPerDay` เป็น 0 — ในทางปฏิบัติแทบไม่มี และ null คงอยู่). ผลลัพธ์ที่ผู้ใช้เห็นใน AC-2 (guests=1 เห็นลานทั้งหมด) ยังคงเป็นจริง.

## Data model / migration
- **ไม่มี migration** — `maxGuestsPerDay` มีใน schema อยู่แล้ว; การแก้ทั้งหมดเป็น query-shape ใน `lib/campsite-filters.ts` (pure function สร้าง where) + การส่ง `guests` ผ่านจาก `app/page.tsx` เข้า `buildCampSiteWhere`. staging/prod DB ไม่เปลี่ยน.
- ไม่มี endpoint ใหม่: หน้าแรกเป็น Server Component อ่าน `searchParams` โดยตรง (ไม่ผ่าน REST). input `guests` เป็น string จาก URL searchParams, parse ด้วย `parseInt` ก่อนใช้ใน Prisma where (ไม่ inject string ดิบ → ปลอดภัยจาก injection, query เป็น parameterized).

## ADRs
— (ไม่มี ADR ใหม่; ใช้ ADR-003 ที่มีอยู่สำหรับ taxonomy → MasterData ซึ่งอยู่ใน where-builder เดียวกัน)

## Links
`../../feature.md` (## Architecture overview) · `prisma/schema.prisma` (`model CampSite.maxGuestsPerDay`) · `lib/campsite-filters.ts` · `app/page.tsx` · `story.md`

## Changelog
- v1 (2026-06-23) — created; บันทึก field choice (maxGuestsPerDay), where-clause shape (AND→OR null arm, DEFECT-01), guard semantics, no migration
