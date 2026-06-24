---
linear: CAM-59
feature: bookings-trips
epic: camper-availability-booking (CAM-23)
persona: camper
artifact: story
owner: product-owner
status: Backlog
version: v1
updated: 2026-06-23
---
# หน้ายืนยันการจองและรหัสการจอง (CAM-59)

## ทำไม

ปัจจุบันเมื่อจองสำเร็จ ระบบแสดง toast แล้ว redirect ไป /bookings ใน 1.5 วินาทีโดยไม่มีหน้ายืนยัน Camper จึงไม่มีหลักฐานการจองที่ชัดเจน ไม่รู้รหัสการจองของตัวเอง และไม่สามารถแชร์หรืออ้างอิงได้ทันที
**KPI:** อัตรา Camper ที่กดดูรายละเอียดการจองจากหน้า confirmation ≥ 40% (ภายใน 30 วันหลัง launch); จำนวน support ticket เรื่อง "ไม่รู้รหัสจอง" ลดลง

## Story

ในฐานะ **Camper** ฉันต้องการ **เห็นหน้ายืนยันการจองพร้อมรหัสอ้างอิงทันทีหลังจองสำเร็จ** เพื่อ **มีหลักฐานและรหัสจองไว้ติดต่อสถานที่แคมป์หรือตรวจสอบย้อนหลัง**
ขอบเขต: สร้างหน้า /bookings/[id]/confirmation แสดงรายละเอียดการจองและรหัสอ้างอิง แล้วเปลี่ยน redirect หลังจองสำเร็จให้ชี้ไปหน้านี้แทน

## AC

| # | Given (สถานะตั้งต้น) | When (ผู้ใช้ทำ) | ผลที่ผู้ใช้เห็น (copy ไทยจริง) | ผลเชิงข้อมูล/ระบบ |
| -- | -- | -- | -- | -- |
| 1 | Camper ล็อกอินอยู่ กรอกวันและจำนวนผู้เข้าพักครบ | กดปุ่ม "จอง" | หน้าเปลี่ยนไปยังหน้ายืนยัน แสดงหัวข้อ "การจองสำเร็จแล้ว" พร้อมไอคอนเครื่องหมายถูก | ระบบ redirect ไปที่ /bookings/{bookingId}/confirmation |
| 2 | Camper อยู่บนหน้ายืนยัน | โหลดหน้า | แสดงข้อมูล: ชื่อลานแคมป์, วันเช็กอิน, วันเช็กเอาท์, จำนวนผู้เข้าพัก, ยอดรวม และ "รหัสการจอง: CAMP-XXXXXX" | ข้อมูลดึงจาก Booking ที่มี id ตรงกับ URL |
| 3 | Camper อยู่บนหน้ายืนยัน | กดปุ่ม "ดูการจองทั้งหมด" | ระบบพาไปหน้า /bookings | ไม่มีการเปลี่ยนแปลงข้อมูล |
| 4 | Camper อยู่บนหน้ายืนยัน | กดปุ่ม "กลับไปดูลานแคมป์" | ระบบพาไปหน้ารายละเอียดลานแคมป์ที่จองไว้ | ไม่มีการเปลี่ยนแปลงข้อมูล |
| 5 | Camper B พยายามเข้า /bookings/{bookingId}/confirmation ที่เป็นของ Camper A | โหลดหน้า | แสดงหน้า "ไม่พบข้อมูลการจอง" | ระบบส่ง HTTP 404 (ไม่เปิดเผยว่า booking ใดมีอยู่จริง) |
| 6 | Camper ไม่ได้ล็อกอิน | เข้า URL /bookings/{bookingId}/confirmation โดยตรง | ระบบพาไปหน้าล็อกอิน | ไม่มีการแสดงข้อมูลการจอง |
| 7 | Camper เข้า /bookings/{id}/confirmation ด้วย id ที่ไม่มีอยู่ใน DB | โหลดหน้า | แสดงหน้า "ไม่พบข้อมูลการจอง" | ระบบส่ง HTTP 404 |

## Rules

* รหัสการจองที่แสดง (booking reference) ต้องมาจาก [Booking.id](<http://Booking.id>) (UUID) โดย format สำหรับแสดงผล = นำ 8 ตัวอักษรแรกของ UUID มาแสดงเป็น "CAMP-XXXXXXXX" (uppercase) — สมมติ 🟡 ถ้าต้องการ format อื่นให้ระบุก่อน build
* หน้า confirmation เข้าได้เฉพาะเจ้าของ booking เท่านั้น (userId ใน Booking ต้องตรงกับ [session.user.id](<http://session.user.id>))
* ไม่มีการ auto-redirect จาก toast อีกต่อไปหลังแก้ใบนี้; ใช้ router.push ไปหน้า confirmation แทน
* ชื่อลานแคมป์บนหน้า confirmation แสดงภาษาตามการตั้งค่าภาษาของผู้ใช้ (th/en)
* หน้า confirmation ต้องโหลด server-side (ไม่ใช่ client-only) เพื่อ SEO และ share-ability
* ข้อความที่แสดงเมื่อไม่พบหรือไม่มีสิทธิ์: "ไม่พบข้อมูลการจอง"

## Data

* ไม่มี field ใหม่ใน `prisma/schema.prisma` (ใช้ [Booking.id](<http://Booking.id>), Booking.checkInDate, Booking.checkOutDate, Booking.guests, Booking.totalPrice, Booking.campSiteId, Booking.userId ที่มีอยู่แล้ว)
* ต้อง include relation campSite (nameTh, nameEn, nameThSlug) และ user (id) ตอน fetch สำหรับหน้า confirmation
* ไม่ต้อง migrate DB

## Out of scope

* การส่ง email/SMS ยืนยันการจอง → ticket แยกต่างหาก (notification epic)
* การแสดง QR code รหัสจอง → Phase 2
* การพิมพ์/download ใบยืนยัน → Phase 2
* การแสดงรายละเอียด spot (ถ้าจอง spot เฉพาะ) → C-3.x หรือ ticket ย่อยของ spot flow
* Redesign หน้า /bookings (รายการจอง) → ticket แยก

## Self-verify

- [ ] lint
- [ ] typecheck
- [ ] test coverage ≥80% (unit: authz ปฏิเสธ user อื่น; integration: GET /bookings/[id]/confirmation 200 vs 404)
- [ ] a11y (heading hierarchy ถูกต้อง, ปุ่ม accessible label)
- [ ] design (token-only, ไม่มี hardcoded color)
- [ ] security (authz check userId === [session.user.id](<http://session.user.id>) ก่อน return data; 404 ไม่ใช่ 403 เพื่อไม่ leak)
- [ ] verify Staging URL: จองจริงบน campvibe-staging.vercel.app แล้วตรวจ redirect ไป /bookings/{id}/confirmation ถูกต้อง

## Links

spec: — · PR: — · preview: campvibe-staging.vercel.app · design: DESIGN.md
