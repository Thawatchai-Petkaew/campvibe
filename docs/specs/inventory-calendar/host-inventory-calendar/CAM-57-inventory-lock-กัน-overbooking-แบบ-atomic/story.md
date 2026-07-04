---
linear: CAM-57
feature: inventory-calendar
epic: host-inventory-calendar (CAM-22)
persona: host
artifact: story
owner: product-owner
status: Backlog
version: v1
updated: 2026-06-23
---
# Inventory lock กัน overbooking แบบ atomic (CAM-57)

## ทำไม

ขณะนี้ `/api/bookings` ตรวจสอบความพร้อมด้วยการ SELECT ธรรมดาหลายรอบ โดยไม่มี database lock ในสถานการณ์ที่มีผู้จองพร้อมกัน (concurrent requests) สองคนสามารถจองวันเดียวกัน spot เดียวกัน หรือทำให้ capacity เกินได้ก่อนที่ระบบจะตรวจพบ ส่งผลให้เกิด overbooking และต้องยกเลิกการจองด้วยมือ
**KPI:** จำนวน overbooking ที่เกิดจาก race condition = 0 หลัง deploy; เวลาตอบสนองของ POST /api/bookings ไม่เกิน 1,000ms (p95) ภายใต้ load 50 concurrent requests

## Story

ในฐานะ **Host** ฉันต้องการ **มั่นใจว่าระบบไม่รับการจองซ้อนในวันเดียวกันหรือเกิน capacity ไม่ว่าจะมีผู้จองกี่คนพร้อมกัน** เพื่อ **ไม่ต้องยกเลิกการจองและขอโทษแขกในภายหลัง**
ขอบเขต: ปรับ POST `/api/bookings` ให้ตรวจสอบ spot-overlap และ daily capacity ภายใน Prisma transaction เดียวพร้อม SELECT FOR UPDATE เพื่อป้องกัน race condition; ไม่เปลี่ยน response contract ที่ client ใช้อยู่

## AC

| # | Given (สถานะตั้งต้น) | When (ผู้ใช้ทำ) | ผลที่ผู้ใช้เห็น (copy ไทยจริง) | ผลเชิงข้อมูล/ระบบ |
| -- | -- | -- | -- | -- |
| 1 | Spot มีการจองอยู่เต็มในวันที่ A (status CONFIRMED) และ Camper สองคนพยายามจอง spot เดียวกันวันเดียวกันพร้อมกัน | ทั้งสองส่งคำขอจองพร้อมกัน | คนแรกได้รับการยืนยัน คนที่สองเห็น "ขออภัย ไม่สามารถจองได้ กรุณาเลือกวันหรือที่พักอื่น" | ระบบสร้าง Booking ให้เพียง 1 รายการ รายการที่สองถูกปฏิเสธด้วย HTTP 409; ไม่มี overbooking ในฐานข้อมูล |
| 2 | แคมป์ไซต์มี maxGuestsPerDay = 10 และมีการจองอยู่ 8 คนแล้ว Camper พยายามจอง 3 คน | Camper submit การจอง | Camper เห็น "ขออภัย วันที่เลือกมีแขกเต็มแล้ว กรุณาเลือกวันอื่น" | ระบบปฏิเสธด้วย HTTP 409; จำนวนแขกในฐานข้อมูลยังคงเป็น 8 ไม่เกิน 10 |
| 3 | แคมป์ไซต์มี maxGuestsPerDay = 10 และมีการจองอยู่ 7 คน Camper สองคนพยายามจอง 4 คนและ 5 คนพร้อมกัน | ทั้งสองส่งคำขอพร้อมกัน | คนที่ได้ lock ก่อนได้รับการยืนยัน คนที่สองเห็น "ขออภัย วันที่เลือกมีแขกเต็มแล้ว กรุณาเลือกวันอื่น" | ระบบสร้าง Booking เพียง 1 รายการ ยอดรวมไม่เกิน maxGuestsPerDay |
| 4 | แคมป์ไซต์มีวันที่ถูกบล็อก (BlockedDate) และ Camper พยายามจองในช่วงวันนั้น | Camper submit การจอง | Camper เห็น "ขออภัย ไม่สามารถจองได้ กรุณาเลือกวันหรือที่พักอื่น" | ระบบตรวจพบ BlockedDate ภายใน transaction เดียวกัน ปฏิเสธด้วย HTTP 409 |
| 5 | Camper จองวันที่ยังว่างอยู่ (ไม่มี overlap ไม่เกิน capacity ไม่มี BlockedDate) | Camper submit การจอง | Camper เห็นหน้ายืนยันการจองสำเร็จ (พฤติกรรมเดิมไม่เปลี่ยน) | ระบบสร้าง Booking ด้วย status PENDING; HTTP 201; response shape เหมือนเดิมทุกฟิลด์ |
| 6 | เกิด error ภายใน transaction (เช่น database timeout) | (ระบบ) | Camper เห็น "เกิดข้อผิดพลาด กรุณาลองใหม่อีกครั้ง" | Transaction rollback สมบูรณ์ ไม่มีข้อมูลบางส่วนค้างในฐานข้อมูล; HTTP 500 |

## Rules

* การตรวจสอบทั้งหมด (spot overlap, daily capacity, BlockedDate) ต้องเกิดภายใน Prisma transaction เดียวพร้อม row-level lock เพื่อป้องกัน race condition (implementation: Architect กำหนด เช่น `prisma.$transaction` + raw SQL `SELECT ... FOR UPDATE` หรือ serializable isolation)
* Response HTTP status codes ไม่เปลี่ยน: 201 สร้างสำเร็จ, 409 conflict (overlap/capacity/blocked), 400 validation error, 401 ไม่ได้ล็อกอิน, 403 forbidden, 500 server error
* Response body shape ไม่เปลี่ยน (backward compatible): client ที่ใช้อยู่ต้องไม่พัง
* ไม่เพิ่ม timeout เกิน 10 วินาทีต่อ request
* ห้ามแก้ไข bookingSchema ใน `lib/validations/booking.ts` (validation เดิมยังใช้)
* ข้อความ error ที่ Camper เห็นบนหน้าจอมาจาก frontend (ไม่ได้เปลี่ยน error message จาก API); API ยังคืน error detail เหมือนเดิม ("Dates not available", "Capacity exceeded")

## Data

* ไม่มี migration ใหม่
* แตะ model: `Booking` (อ่าน/เขียน), `CampSite` (อ่าน maxGuestsPerDay, maxTentsPerDay), `Spot` (อ่าน), `BlockedDate` (อ่าน ถ้า H-3.3 deploy แล้ว)
* ไฟล์ที่แก้: `app/api/bookings/route.ts` (POST handler), `lib/campsite-availability.ts` (อาจต้องปรับให้รองรับการรันภายใน transaction)
* Dependency: BlockedDate check ใน H-3.5 ทำได้หลัง H-3.3 merge เท่านั้น (conditional check: ถ้า BlockedDate model ยังไม่มีให้ skip)

## Out of scope

* การปรับ PATCH `/api/bookings/[id]` (status update) ให้มี lock → backlog (priority ต่ำกว่า)
* Queue/job สำหรับ booking ภายใต้ traffic สูงมาก → backlog (infrastructure)
* Optimistic locking / versioning บน Booking record → backlog
* การเปลี่ยน booking flow (เช่น เพิ่ม payment hold) → epic payment
* การแก้ race condition บน GET requests → N/A (read-only ไม่มีผลต่อ data integrity)

## Self-verify

- [ ] lint
- [ ] typecheck
- [ ] test coverage ≥80% (unit: transaction rollback เมื่อ capacity เต็ม; integration: concurrent requests 2 คนจอง spot เดียวกัน ต้องสร้าง Booking ได้แค่ 1; integration: BlockedDate blocking ภายใน transaction)
- [ ] a11y: ไม่มี UI ใหม่ในใบนี้ (N/A)
- [ ] design: ไม่มี UI ใหม่ในใบนี้ (N/A)
- [ ] security: ทดสอบ request ที่ไม่มี session ถูก reject ด้วย 401; ทดสอบ campSiteId ที่ไม่ตรงกับ session user ยังคง reject ตาม logic เดิม
- [ ] perf: p95 latency POST /api/bookings ไม่เกิน 1,000ms ที่ 50 concurrent requests บน Staging
- [ ] verify Staging URL: campvibe-staging.vercel.app ทดสอบ concurrent booking ด้วย script หรือ tool แล้วยืนยันว่าไม่มี overbooking

## Links

spec: — · PR: — · preview: campvibe-staging.vercel.app · design: DESIGN.md (N/A)
