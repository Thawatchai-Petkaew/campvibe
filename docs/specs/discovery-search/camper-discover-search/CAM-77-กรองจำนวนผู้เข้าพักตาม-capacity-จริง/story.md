---
linear: CAM-77
feature: discovery-search
epic: camper-discover-search (CAM-33)
persona: camper
artifact: story
owner: product-owner
status: Done
version: v1
updated: 2026-06-22
---
# กรองจำนวนผู้เข้าพักตาม capacity จริง (CAM-77)

## ทำไม

เมื่อ Camper ระบุจำนวนคนในการค้นหา param `guests` ถูกส่งถึง server แต่ `buildCampSiteWhere` ไม่นำไปกรองเลย ทำให้กลุ่ม 20 คนเห็นลานที่รับได้แค่ 4 คน (`maxGuestsPerDay = 4`) ปรากฏในผล และอาจจองไม่ได้หรือเข้าไปไม่ได้จริง
**KPI:** ผลค้นหาที่ใส่จำนวนคน ≥1 ต้องไม่มีลานที่ maxGuestsPerDay น้อยกว่าจำนวนที่ระบุปรากฏเลย (verified บน Staging)

## Story

ในฐานะ **Camper** ฉันต้องการ **ระบุจำนวนผู้เข้าพักและเห็นเฉพาะลานที่รองรับกลุ่มของฉันได้จริง** เพื่อ **ไม่เสียเวลาเปิดลานที่รับคนไม่พอ**
ขอบเขต: แก้ `buildCampSiteWhere` ใน `lib/campsite-filters.ts` ให้กรองด้วย `maxGuestsPerDay >= guests` เมื่อมีค่า guests; ไม่รวมหน้า booking หรือ availability calendar

## AC

| # | Given (สถานะตั้งต้น) | When (ผู้ใช้ทำ) | ผลที่ผู้ใช้เห็น (copy ไทยจริง) | ผลเชิงข้อมูล/ระบบ |
| -- | -- | -- | -- | -- |
| 1 | มีลานในระบบ: ลาน A (maxGuestsPerDay=4), ลาน B (maxGuestsPerDay=20), ลาน C (maxGuestsPerDay=null) | ผู้ใช้ค้นหาโดยใส่ "20 คน" | แสดงเฉพาะลาน B และลาน C; ลาน A ไม่ปรากฏในผลลัพธ์ | where clause มี `maxGuestsPerDay: { gte: 20 }` OR `maxGuestsPerDay: null` |
| 2 | ผู้ใช้ค้นหาด้วย guests=1 (default) | ผู้ใช้ไม่แก้ไขจำนวนคน แล้วกด ค้นหา | แสดงลานทั้งหมดที่ active/published (รวมทุก maxGuestsPerDay) | ไม่กรองด้วย maxGuestsPerDay เพราะ guests=1 ถือว่าไม่ได้ filter |
| 3 | ผู้ใช้ค้นหาด้วย guests=5 ร่วมกับ filter จังหวัด "เชียงใหม่" | ผู้ใช้กดค้นหา | แสดงเฉพาะลานในเชียงใหม่ที่รับได้ ≥5 คน | where ใช้ทั้ง location.province = "เชียงใหม่" และ maxGuestsPerDay ≥ 5 (หรือ null) |
| 4 | ผู้ใช้ใส่จำนวนคนแล้วไม่มีลานที่ตรงเลย | ผู้ใช้กดค้นหา | แสดงข้อความ "ไม่พบลานแคมป์" พร้อมปุ่ม "ล้างการค้นหา" | response คืน array ว่าง |
| 5 | ผู้ใช้ใส่จำนวนคน แล้วกดปุ่ม "ล้างการค้นหา" | ผู้ใช้คลิก "ล้างการค้นหา" | รายการลานแสดงทั้งหมดอีกครั้ง โดยไม่กรองจำนวนคน | URL ไม่มี param guests; ไม่กรองด้วย maxGuestsPerDay |
| 6 | ผู้ใช้พิมพ์ค่า guests ที่ไม่ใช่ตัวเลข (เช่น ตัวอักษร) หรือ ≤ 0 เข้า URL โดยตรง | เพจโหลด | แสดงลานทั้งหมดเหมือนไม่ได้ filter (ไม่มี error message) | server parse guests ไม่ได้ค่าที่ valid (parseInt <= 0 หรือ NaN) ให้ไม่กรอง; ไม่ return error |

## Rules

* `guests` filter ใช้เมื่อ: parse เป็น integer ได้ และค่า ≥ 2 (guests=1 = default ถือว่าไม่ได้กรอง)
* เงื่อนไขกรอง: `maxGuestsPerDay >= guests` **หรือ** `maxGuestsPerDay IS NULL` (ลานที่ไม่ได้ระบุ capacity ให้ผ่านเสมอ เพราะ Host อาจยังไม่ได้กรอกข้อมูล)
* ค่า guests ที่ valid: integer ≥ 2; ค่า 1, NaN, ≤0 ให้ treat เป็น "ไม่กรอง"
* ไม่มี error message แสดงกับ user สำหรับค่า guests ที่ invalid (silent fallback)
* ลำดับ filter: `guests` ทำงานเป็น AND ร่วมกับ filter อื่น (keyword, province, facilities ฯลฯ)
* การแสดง guests input ใน SearchModal ยังคงเป็น number input ตั้งแต่ 1 ขึ้นไป — ไม่เปลี่ยน UI ใน ticket นี้

## Data

* Field ที่ใช้กรอง: `CampSite.maxGuestsPerDay: Int?` (มีอยู่แล้วใน schema)
* ไม่ต้องมี migration schema ใหม่
* `lib/campsite-filters.ts` `CampSiteFilterParams` มี `guests?: string` อยู่แล้ว แต่ `buildCampSiteWhere` ไม่ใช้ค่านี้ — ต้องแก้ให้อ่านและ apply filter
* Field ที่แตะ: `CampSite.maxGuestsPerDay`, `CampSiteFilterParams.guests`

## Out of scope

* การแสดง maxGuestsPerDay บนการ์ดหรือหน้า detail → C-2.1 หรือ C-2.5
* Validation จำนวนผู้เข้าพักใน booking flow (ตอนสร้าง booking จริง) → C-3.3 (มีอยู่แล้วบาง logic)
* Filter จำนวนเต็นท์ (maxTentsPerDay) → ไม่อยู่ใน story นี้ ชี้ไปที่ backlog C-1.x
* Availability check จากการจองที่มีอยู่ (capacity เหลือ วันนั้นๆ) → C-3.1 (มีอยู่แล้ว)
* ปรับ UI ช่อง "จำนวนคน" ใน SearchModal (เช่น เพิ่ม stepper, ป้องกัน ≤0) → C-1.2 / UX ticket

## Self-verify

- [ ] lint (`npm run lint` ผ่านไม่มี error)
- [ ] typecheck (`npm run typecheck` ผ่าน strict mode)
- [ ] test ครอบ: guests=20 กรองออกลานที่ maxGuestsPerDay < 20, guests=20 คง null ไว้, guests=1 ไม่กรอง, guests invalid ไม่กรอง, guests ร่วมกับ filter อื่น; coverage ≥80% โค้ดใหม่
- [ ] a11y: ไม่มี UI ใหม่ ไม่ต้องตรวจ
- [ ] design: ไม่มี UI ใหม่ ไม่ต้อง design gate
- [ ] security: guests param ถูก parseInt ก่อนใช้ใน query (ไม่ inject string ดิบลง Prisma where)
- [ ] verify Staging URL: ค้นหาบน campvibe-staging.vercel.app ด้วย guests=20 แล้วตรวจว่าลานที่ maxGuestsPerDay=4 หายไปจากผล

## Links

spec: tech.md · test.md · delivery.md · PR: [#104](https://github.com/Thawatchai-Petkaew/campvibe/pull/104) · preview: campvibe-staging.vercel.app · design: DESIGN.md · แก้ไขที่: `lib/campsite-filters.ts`, `app/page.tsx`

## Changelog

* v2 (2026-06-23) — delivered. Guard ที่ ship จริงคือ `guests > 0` (ไม่ใช่ ≥ 2 ตามร่างเดิม); **DEFECT-01 (QA จับได้)**: Prisma `{ gte: N }` ตัดแถวที่ `maxGuestsPerDay IS NULL` ออกใน PostgreSQL ทำให้ลานที่ยังไม่ตั้ง capacity หาย แก้ด้วย AND→OR null arm (`WHERE maxGuestsPerDay >= N OR maxGuestsPerDay IS NULL`) โดยไม่ทับ keyword `where.OR`. PR #104, merged staging
* v1 (2026-06-22) — story scoped
