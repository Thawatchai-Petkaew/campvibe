---
linear: CAM-61
feature: bookings-trips
epic: camper-pre-trip-my-bookings (CAM-24)
persona: camper
artifact: story
owner: product-owner
status: Backlog
version: v1
updated: 2026-06-23
---
# หน้ารายละเอียดการจอง /bookings/ (CAM-61)

## ทำไม

หน้า "การจองของฉัน" (/bookings) แสดงรายการรวมแต่ไม่มีหน้าดูรายละเอียดแยกต่างหาก Camper จึงไม่สามารถดูข้อมูลครบถ้วน (เช็คอิน/เช็คเอาท์/ลาน/จำนวนคืน/ราคา/สถานะ) และยกเลิกการจองจากหน้านั้นได้โดยตรง ส่งผลให้ประสบการณ์ก่อนเดินทางไม่ครบ
**KPI:** ลด support request เรื่อง "ดูรายละเอียดการจองได้ที่ไหน" ลง + Camper สามารถยืนยันข้อมูลก่อนออกเดินทางจาก URL `/bookings/[id]` ได้โดยไม่ต้องติดต่อทีมงาน

## Story

ในฐานะ **Camper** ฉันต้องการ **ดูรายละเอียดครบของการจองแต่ละครั้งในหน้าเฉพาะ** เพื่อ **ตรวจสอบข้อมูลก่อนเดินทางและยกเลิกการจองได้หากต้องการ**
ขอบเขต: สร้างหน้า `/bookings/[id]` (Server-side fetch + client cancel) แสดงข้อมูล booking เต็ม เฉพาะ Camper เจ้าของ booking เท่านั้น รองรับ loading/not-found/forbidden state และปุ่มยกเลิก (เฉพาะสถานะที่ยกเลิกได้)

## AC

| # | Given (สถานะตั้งต้น) | When (ผู้ใช้ทำ) | ผลที่ผู้ใช้เห็น (copy ไทยจริง) | ผลเชิงข้อมูล/ระบบ |
| -- | -- | -- | -- | -- |
| 1 | Camper ล็อกอินอยู่ เป็นเจ้าของ booking นั้น `status = 'CONFIRMED'` | เปิด /bookings/[id] | เห็นหน้าแสดง: ชื่อลาน, วันเช็คอิน/เช็คเอาท์, จำนวนคืน, จำนวนผู้เข้าพัก, ชื่อ spot (ถ้ามี), ยอดรวม, สถานะ **"ยืนยันแล้ว"** และปุ่ม **"ยกเลิกการจอง"** | ดึงข้อมูลจาก `Booking` ที่ผูกกับ `userId` ของ session |
| 2 | Camper ล็อกอินอยู่ เป็นเจ้าของ booking นั้น `status = 'PENDING'` | เปิด /bookings/[id] | เห็นสถานะ **"รอยืนยัน"** และปุ่ม **"ยกเลิกการจอง"** | เช่นเดียวกับ AC1 |
| 3 | Camper ล็อกอินอยู่ เป็นเจ้าของ booking นั้น `status = 'CANCELLED'` | เปิด /bookings/[id] | เห็นสถานะ **"ยกเลิกแล้ว"** ไม่มีปุ่มยกเลิก |  |
| 4 | Camper ล็อกอินอยู่ เป็นเจ้าของ booking นั้น `status = 'COMPLETED'` | เปิด /bookings/[id] | เห็นสถานะ **"เข้าพักแล้ว"** ไม่มีปุ่มยกเลิก |  |
| 5 | Camper ล็อกอินอยู่ เป็นเจ้าของ booking กด **"ยกเลิกการจอง"** | กดปุ่มยืนยันการยกเลิก | ข้อความ **"ยกเลิกการจองสำเร็จ"** ปรากฏ และสถานะบนหน้าเปลี่ยนเป็น **"ยกเลิกแล้ว"** ปุ่มยกเลิกหายไป | `Booking.status` อัปเดตเป็น `CANCELLED` ผ่าน `PATCH /api/bookings/[id]` |
| 6 | Camper ล็อกอินอยู่ เป็นเจ้าของ booking กด **"ยกเลิกการจอง"** แต่ API ตอบ error | กดปุ่มยืนยัน | ข้อความ **"เกิดข้อผิดพลาด กรุณาลองอีกครั้ง"** ปรากฏ สถานะไม่เปลี่ยน | `Booking.status` ไม่เปลี่ยนแปลง |
| 7 | Camper ล็อกอินอยู่ แต่ booking นั้นเป็นของคนอื่น | เปิด /bookings/[id] | หน้าแสดง **"ไม่พบข้อมูลการจอง หรือคุณไม่มีสิทธิ์เข้าถึง"** | API คืน 403/404 |
| 8 | ไม่ได้ล็อกอิน | เปิด /bookings/[id] | ถูกนำไปยังหน้าเข้าสู่ระบบ |  |
| 9 | กำลังโหลดข้อมูล | เปิด /bookings/[id] | เห็น loading skeleton หรือตัวบ่งชี้การโหลด |  |
| 10 | booking id ไม่มีในระบบ | เปิด /bookings/[id] | หน้าแสดง **"ไม่พบข้อมูลการจอง"** พร้อมปุ่ม **"กลับไปยังการจองของฉัน"** | API คืน 404 |
| 11 | Camper เปิดหน้า detail (ภาษาไทย) | ดูส่วนวันที่ | วันเช็คอินและเช็คเอาท์แสดงในรูปแบบ **"5 ม.ค. 2568"** (พ.ศ. th-TH locale) |  |

## Rules

* Authorization: เฉพาะ Camper ที่เป็นเจ้าของ booking (`Booking.userId === session.user.id`) เท่านั้นที่เข้าถึงได้ คนอื่นได้รับ 403/404 (ไม่เปิดเผยว่า booking นั้นมีอยู่จริงหรือไม่)
* ปุ่ม "ยกเลิกการจอง" แสดงเฉพาะเมื่อ `Booking.status` เป็น `PENDING` หรือ `CONFIRMED` เท่านั้น
* ก่อนยกเลิกต้องขอยืนยันจากผู้ใช้ (dialog/confirm) พร้อมข้อความ **"คุณแน่ใจหรือไม่ว่าต้องการยกเลิกการจองนี้?"**
* การยกเลิกใช้ endpoint `PATCH /api/bookings/[id]` ที่มีอยู่แล้ว (ส่ง `{ status: 'CANCELLED' }`)
* API GET สำหรับ `/api/bookings/[id]` ยังไม่มี ต้องสร้างใหม่ (เฉพาะเจ้าของ booking เท่านั้น)
* การแสดงวันที่ใช้ locale ตาม language context (th-TH สำหรับภาษาไทย, en-US สำหรับภาษาอังกฤษ)
* สถานะการจองแสดงด้วย label แปลแบบเดียวกับ C-5.3
* รูปปกของลาน (รูปแรกจาก `CampSite.images` CSV) แสดงได้ถ้ามี ถ้าไม่มีให้ใช้ placeholder

## Data

* `Booking`: อ่านฟิลด์ `id`, `checkInDate`, `checkOutDate`, `guests`, `totalPrice`, `status`, `createdAt`, `userId`
* Relation ที่ต้องดึงเพิ่ม: `campSite` (nameTh, nameEn, images, location.province, checkInTime, checkOutTime, phone, lineId), `spot` (name, zone)
* ต้องสร้าง GET handler ใน `app/api/bookings/[id]/route.ts` (ปัจจุบันมีแค่ PATCH)
* ไม่ต้อง migration ฐานข้อมูล

## Out of scope

* Special requests / notes บน booking → C-3.6 (ต้อง migration เพิ่ม field ก่อน)
* QR code สำหรับเช็คอิน → C-5.7
* Filter / tab upcoming/past บนหน้ารายการ → C-5.5
* หน้า booking detail ฝั่ง Host → H-4.4
* การแสดงข้อมูลการชำระเงิน → C-4.x (ยังไม่มี payment infra)

## Self-verify

- [ ] lint
- [ ] typecheck
- [ ] test coverage ≥80% (unit: GET handler auth/ownership check + 404 case; integration: render detail + cancel flow)
- [ ] a11y (heading hierarchy, ปุ่ม accessible label)
- [ ] design (token-only, responsive mobile)
- [ ] security (GET handler ตรวจ `userId === session.user.id` ก่อน return data, ไม่ leak data คนอื่น)
- [ ] verify Staging URL: เปิด /bookings/[id] บน campvibe-staging.vercel.app ด้วย booking ของตัวเอง เห็นข้อมูลครบ + กด cancel สำเร็จ + เข้าด้วย booking คนอื่นได้รับ error

## Links

spec: — · PR: — · preview: [https://campvibe-staging.vercel.app/bookings](<https://campvibe-staging.vercel.app/bookings>) · design: DESIGN.md
