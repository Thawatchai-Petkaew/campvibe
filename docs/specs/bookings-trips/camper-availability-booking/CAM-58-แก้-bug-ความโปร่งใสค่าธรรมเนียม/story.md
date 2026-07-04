---
linear: CAM-58
feature: bookings-trips
epic: camper-availability-booking (CAM-23)
persona: camper
artifact: story
owner: product-owner
status: Done
version: v2
updated: 2026-06-23
---
# แก้ bug ความโปร่งใสค่าธรรมเนียม (CAM-58)

## ทำไม

หน้าจองแสดงยอดรวม = ราคาค้างคืน + ค่าทำความสะอาด 20 บาท + ค่าบริการ 35 บาท แต่ระบบบันทึก `Booking.totalPrice` เป็นเฉพาะค่าค้างคืน ทำให้ยอดที่ผู้ใช้เห็นไม่ตรงกับยอดที่ระบบเก็บ กระทบความไว้วางใจและการออกใบเสร็จในอนาคต
**KPI:** อัตราร้องเรียนยอดไม่ตรง = 0 หลัง deploy; ยอดที่บันทึกตรงกับยอดที่ผู้ใช้เห็น 100%

## Story

ในฐานะ **Camper** ฉันต้องการ **เห็นยอดรวมบนหน้าจองตรงกับยอดที่ระบบบันทึกเสมอ** เพื่อ **ไม่สับสนเรื่องค่าใช้จ่ายและตรวจสอบย้อนหลังได้**
ขอบเขต: ค่าทำความสะอาด/ค่าบริการที่แสดงเป็นตัวเลขตายตัวในโค้ด ไม่มีโมเดลค่าธรรมเนียมรองรับ และไม่เคยถูกบันทึก จึง **เอาออก** ให้ยอดที่แสดง = ยอดที่บันทึก = ค่าที่พัก (รวม VAT ตามถิ่น) ผ่านแหล่งคำนวณราคาเดียว (`lib/booking-pricing.ts`) ที่ทั้ง UI และ API ใช้ร่วมกัน ค่าธรรมเนียมจริงจะกลับมาเมื่อมีโมเดลค่าธรรมเนียม (H-5.5)

## AC

| # | Given (สถานะตั้งต้น) | When (ผู้ใช้ทำ) | ผลที่ผู้ใช้เห็น (copy ไทยจริง) | ผลเชิงข้อมูล/ระบบ |
| -- | -- | -- | -- | -- |
| 1 | Camper ล็อกอินอยู่ เลือกเช็กอิน-เช็กเอาท์ 2 คืน ราคาต่อคืน 500 บาท | เปิดวิดเจ็ตจองบนหน้ารายละเอียดลานแคมป์ | แสดง "500 บาท x 2 คืน" และ "ยอดรวม" = 1,000 บาท โดยไม่มีบรรทัดค่าทำความสะอาดและค่าบริการ | ยังไม่มีการบันทึก (แค่แสดงผล) |
| 2 | Camper เห็นยอดรวม 1,000 บาท บนวิดเจ็ต | กดปุ่ม "จอง" | ปรากฏข้อความ "จองสำเร็จแล้ว" | สร้าง Booking โดย totalPrice = 1,000 และ snapshotTotalAmount = 1,000 (ตรงกับยอดที่แสดง) |
| 3 | Camper เข้าหน้า "การจองของฉัน" | ดูรายการจองที่เพิ่งสร้าง | แสดง "ยอดรวม: 1,000 บาท" | ค่าที่ดึงจาก Booking.totalPrice = 1,000 (ตรงกับ UI) |
| 4 | Camper เลือกวันเดียวกัน (checkIn = checkOut) | กดปุ่ม "จอง" | ปุ่มถูกปิดการใช้งาน ไม่มีการส่งคำขอ | ไม่มีการสร้าง Booking |
| 5 | Camper ไม่ได้ล็อกอิน | กดปุ่ม "จอง" | หน้าต่างล็อกอินเปิดขึ้น | ไม่มีการสร้าง Booking |

## Rules

* ยอดที่แสดงและยอดที่บันทึกต้องมาจากฟังก์ชันเดียวกันใน `lib/booking-pricing.ts` เสมอ (`resolveUnitPrice` + `computeBookingPrice`)
* `totalAmount === subtotalAmount = unitPrice x nights` เสมอ — ไม่มีค่าธรรมเนียมบวกเพิ่ม (invariant)
* `unitPrice` = ราคาสปอตที่เลือก ถ้าไม่ได้เลือกสปอตใช้ `priceLow` (fallback 50) — ตรงกันทั้ง UI และ API
* VAT คิดแบบรวมในราคา (VAT-inclusive) เมื่อ `Country.vatRate > 0` (สกัดออกจากยอด ไม่บวกเพิ่ม)
* จำนวนคืน (nights) ต้องมากกว่า 0 ถึงจะกดจองได้; checkOut ต้องหลัง checkIn
* authz: Booking สร้างได้เฉพาะ user ที่ล็อกอิน; userId ดึงจาก session ไม่ใช่จาก request body

## Data

* **ไม่มี migration** — ไม่เพิ่มคอลัมน์ค่าธรรมเนียมใด ๆ (ค่าธรรมเนียม placeholder ถูกเอาออก ไม่ใช่เพิ่ม)
* `lib/booking-pricing.ts` (ใหม่) = แหล่งคำนวณราคาเดียว (pure, ไม่มี side-effect)
* `POST /api/bookings` ใช้โมดูลนี้คำนวณ `totalPrice` + snapshot fields เดิม (`snapshotUnitAmount`/`snapshotSubtotalAmount`/`snapshotTaxRate`/`snapshotTaxAmount`/`snapshotVatInclusive`/`snapshotTotalAmount`) — behavior ฝั่ง server เดิม (ไม่เคยรวม fees อยู่แล้ว) แค่รวมศูนย์การคำนวณ
* `components/CampgroundDetailClient.tsx` ใช้โมดูลเดียวกันแสดงผล และเอาบรรทัดค่าทำความสะอาด/ค่าบริการออก

## Out of scope

* ค่าธรรมเนียมจริง (platform/cleaning/service fee) แบบมีโมเดล + config + VAT handling → **H-5.5** (platform fee config) — `lib/booking-pricing.ts` คือจุดต่อขยาย
* ค่าธรรมเนียมแบบ per-campsite (Host กำหนดเอง) → H-5.5 / Host epic
* การคืนเงิน/ปรับยอดเมื่อยกเลิก → C-4.3 (ต้องมี payment ก่อน)
* atomic lock กัน overbooking → CAM-68
* UI redesign วิดเจ็ตจอง → designer

## Self-verify

- [x] lint (0 error)
- [x] typecheck (clean)
- [x] test coverage ≥80% (lib/booking-pricing.ts 100%; full suite 1686 pass; รวม adversarial guards บน breakdown/feeInfo)
- [x] a11y (ลบ 2 แถว ไม่มี UI ใหม่)
- [x] design (token-only; check:palette + check:ds ผ่าน)
- [x] security (userId จาก session เท่านั้น; ไม่มี authz/secret เปลี่ยน)
- [ ] verify Staging URL (interactive booking-flow e2e) — follow-up (jsdom ไม่มีใน unit runner; logic cover ด้วย unit แล้ว)

## Links

spec: tech.md · test.md · delivery.md · PR: [#103](https://github.com/Thawatchai-Petkaew/campvibe/pull/103) · preview: campvibe-staging.vercel.app · design: DESIGN.md

## Changelog

* v2 (2026-06-23) — **เปลี่ยนวิธีแก้ตอน delivery** (ตัดสินใจโดย orchestrator ภายใต้สิทธิ์ autonomy): จากเดิม "บันทึกค่าธรรมเนียม + เพิ่มคอลัมน์ cleaningFee/serviceFee/basePrice + migration" → เป็น **เอาค่าธรรมเนียม placeholder ออก** (ตัวเลขตายตัว ไม่มีโมเดล ไม่เคย charge) ให้ยอดที่แสดง = ยอดที่บันทึก = ค่าที่พัก ผ่าน `lib/booking-pricing.ts` (ไม่มี migration) เหตุผล: Lean + trust-correct + เลี่ยงการบันทึกค่าธรรมเนียมปลอม; ค่าธรรมเนียมจริงเลื่อนไป H-5.5 ยอดตัวอย่างใน AC เปลี่ยนจาก 1,055 → 1,000
* v1 (2026-06-22) — story scoped (วิธีเดิม: persist fees)
