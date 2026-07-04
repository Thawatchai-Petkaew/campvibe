---
linear: CAM-71
feature: notifications-messaging
epic: foundation-notifications-infra (CAM-31)
persona: platform
artifact: story
owner: product-owner
status: Done
version: v1
updated: 2026-06-22
---
# Email infra (Resend) + templates การแจ้งเตือนการจอง/KYC (CAM-71)

## ทำไม

ปัจจุบัน CampVibe ไม่มี email infra เลย ทำให้ Camper ไม่ได้รับการยืนยันการจอง และ Host ไม่รู้เมื่อมีการจองใหม่/ยกเลิก ส่งผลให้เกิดความสับสน ลดความเชื่อมั่นในแพลตฟอร์ม และ Host ต้องตรวจ dashboard ตลอด
**KPI:** อัตราการเปิดอีเมลยืนยันการจอง (booking confirmation) ≥ 40% ภายใน 7 วันหลัง launch; Camper complaint เรื่อง "ไม่รู้ว่าจองสำเร็จหรือเปล่า" ลดเป็น 0 บน Staging

## Story

ในฐานะ **Host** ฉันต้องการ **รับอีเมลแจ้งเตือนเมื่อมีการจองใหม่ ยกเลิก หรือยืนยัน** เพื่อ **ติดตามสถานะลานแคมป์ได้โดยไม่ต้องเฝ้า dashboard ตลอดเวลา**
ขอบเขต: วางระบบส่ง email ผ่าน Resend พร้อม 4 templates (จองใหม่/ยืนยัน/ยกเลิก/ผล KYC) ทริกเกอร์จาก booking status change และ kycStatus change เท่านั้น ไม่รวม marketing email หรือ in-app notification center

## AC

| # | Given (สถานะตั้งต้น) | When (ผู้ใช้ทำ) | ผลที่ผู้ใช้เห็น (copy ไทยจริง) | ผลเชิงข้อมูล/ระบบ |
| -- | -- | -- | -- | -- |
| 1 | Camper ล็อกอินแล้วกด "จองเลย" บนลานแคมป์ ฟอร์มจองถูกต้องครบถ้วน | ระบบสร้าง Booking สำเร็จ (status = PENDING) | Camper ได้รับอีเมลหัวข้อ "ยืนยันการส่งคำขอจอง — [ชื่อลาน]" ภายใน 1 นาที มีเนื้อหา: ชื่อลาน, วันเช็คอิน/เช็คเอาท์, จำนวนผู้เข้าพัก, ยอดรวม, และข้อความ "กรุณารอ Host ยืนยันการจอง" | ระบบส่ง email ไปที่ User.email ของ Camper ผู้จอง |
| 2 | Host หรือ team member ที่มีสิทธิ์ BOOKING_UPDATE กด "ยืนยันการจอง" ใน dashboard | Booking.status เปลี่ยนเป็น CONFIRMED | Host ได้รับอีเมลหัวข้อ "มีการจองใหม่ที่ได้รับการยืนยัน — [ชื่อลาน]" พร้อมชื่อผู้จอง วันที่ และยอดรวม; Camper ได้รับอีเมลหัวข้อ "การจองของคุณได้รับการยืนยันแล้ว — [ชื่อลาน]" พร้อมรายละเอียดการจองครบถ้วน | ระบบส่ง email 2 ฉบับพร้อมกัน: ฉบับแรกไปที่ CampSite.operator.email, ฉบับที่สองไปที่ Booking.user.email |
| 3 | มีการจองที่ status = PENDING หรือ CONFIRMED | Camper หรือ Host ยกเลิกการจอง (Booking.status = CANCELLED) | Camper ได้รับอีเมลหัวข้อ "การจองของคุณถูกยกเลิกแล้ว — [ชื่อลาน]" พร้อมระบุว่าใครยกเลิก (ตัวเอง หรือ Host); Host ได้รับอีเมลแจ้งด้วยหัวข้อ "การจองถูกยกเลิก — [ชื่อลาน]" | ระบบส่ง email ให้ทั้ง Camper และ Host |
| 4 | Host ส่งเอกสาร KYC เรียบร้อย และ Admin เปลี่ยน User.kycStatus เป็น APPROVED | kycStatus อัปเดตสำเร็จ | Host ได้รับอีเมลหัวข้อ "ยินดีด้วย! บัญชี Host ของคุณผ่านการตรวจสอบแล้ว" พร้อมลิงก์ไปหน้า dashboard | ระบบส่ง email ไปที่ User.email ของ Host |
| 5 | Admin เปลี่ยน User.kycStatus เป็น REJECTED พร้อม kycRejectionReason | kycStatus อัปเดตสำเร็จ | Host ได้รับอีเมลหัวข้อ "เอกสาร KYC ของคุณไม่ผ่านการตรวจสอบ" พร้อมเหตุผลจาก kycRejectionReason และคำแนะนำว่า "กรุณาส่งเอกสารใหม่อีกครั้ง" | ระบบส่ง email ไปที่ User.email ของ Host |
| 6 | RESEND_API_KEY ไม่ถูกตั้งค่าในสภาพแวดล้อม | ระบบพยายามส่ง email | ผู้ใช้ไม่เห็นอะไร (ระบบทำงานต่อ ไม่หยุด) | ระบบ log คำเตือน "Resend not configured" แต่ flow หลัก (สร้าง booking / update status) ไม่ fail |
| 7 | email ที่ผู้ใช้ลงทะเบียนไม่ valid หรือ Resend ตอบกลับ error | ระบบพยายามส่ง email | ผู้ใช้ไม่เห็นอะไร (ระบบทำงานต่อ) | ระบบ log error ของ Resend แต่ API response ของ booking/status endpoint ยังคืน 200/201 ตามปกติ |

## Rules

* ส่ง email แบบ fire-and-forget (no-throw): ถ้า Resend ล้มเหลว ต้อง log แต่ห้าม throw ให้ booking/status flow พัง
* email ต้องส่งจาก address ที่กำหนดใน `EMAIL_FROM` env (ค่า default: `noreply@campvibe.app`) subject และ body ต้องเป็นภาษาไทย
* ห้าม expose [User.id](<http://User.id>), [Booking.id](<http://Booking.id>) (UUID) ใน email body ในรูปแบบที่เป็น technical jargon — ใช้ booking reference แบบ human-readable (เช่น 6 ตัวสุดท้ายของ UUID) แทน
* สิทธิ์ส่ง email ต้องตรงกับ permission ที่ trigger event: Host email ส่งได้เฉพาะเมื่อเป็น CampSite.operatorId (เจ้าของลาน) ไม่ส่งให้ team member ทุกคน
* template KYC result: ส่งเฉพาะเมื่อ kycStatus เปลี่ยนเป็น APPROVED หรือ REJECTED เท่านั้น ไม่ส่งเมื่อเปลี่ยนเป็น PENDING หรือ SUBMITTED
* ขนาด email HTML ต้องไม่เกิน 100 KB ต่อฉบับ (Resend limit)
* ไม่มี unsubscribe link สำหรับ transactional email ใน Phase 1 (ปฏิบัติตาม PDPA มาตรา 24(4) ประมวลผลตามสัญญา) อ้างอิงใน footer: "อีเมลนี้เป็นส่วนหนึ่งของบริการ CampVibe"

## Data

* ใช้ schema ปัจจุบันโดยไม่ต้องสร้าง model ใหม่ ดึงข้อมูลจาก: `Booking` (id, checkInDate, checkOutDate, guests, totalPrice, status, userId, campSiteId), `User` (email, name), `CampSite` (nameTh, operatorId), `User` (operator email ผ่าน operatorId)
* ต้องเพิ่ม migration: ไม่ต้องเพิ่ม field ใน schema (email เป็น fire-and-forget service layer ไม่เก็บ log ใน DB ใน phase นี้)
* env ที่ต้องเพิ่ม: `RESEND_API_KEY` (required, server-only), `EMAIL_FROM` (optional, default `noreply@campvibe.app`)
* lib ที่ต้องสร้างใหม่: `lib/email.ts` (no-throw wrapper รอบ Resend SDK) + `lib/email-templates/` (4 template functions returning HTML string)
* trigger points ในโค้ดที่มีอยู่: `app/api/bookings/route.ts` POST (จองใหม่ → ส่งให้ Camper), `app/api/bookings/[id]/route.ts` PATCH (status change → ส่งตาม status ใหม่), Admin KYC endpoint (เมื่อสร้างในอนาคต → ส่ง KYC result)

## Out of scope

* Marketing / promotional email และ newsletter → ไม่อยู่ใน backlog Phase 1
* In-app notification center (persistent read/unread) → F-2.3
* Email unsubscribe management และ preference center → Phase 2
* Admin KYC review UI และ endpoint สำหรับ trigger KYC email → A-1.2 / A-1.3 (เมื่อสร้าง endpoint นั้นค่อยเชื่อม)
* LINE notification → F-2.2
* Email log/audit trail ใน DB → Phase 2 (F-2.3 หรือ F-4)
* RESUBMIT kycStatus email → ออกแบบร่วมกับ A-1.3
* ตัวอย่าง email preview UI สำหรับ admin → A-10.2

## Self-verify

- [ ] lint
- [ ] typecheck
- [ ] test + coverage ≥80% สำหรับ `lib/email.ts` (unit: mock Resend SDK, ทดสอบ no-throw ทุก branch)
- [ ] a11y (HTML email: alt text ครบ, contrast ผ่าน)
- [ ] design (token-only, ใช้ font/color ตาม DESIGN.md)
- [ ] security (RESEND_API_KEY เป็น server-only, ไม่รั่ว client bundle; ไม่ expose [User.id/UUID](<http://User.id/UUID>) ใน email body)
- [ ] verify Staging URL: สร้าง booking บน campvibe-staging.vercel.app แล้วตรวจว่า Camper inbox ได้รับ email ภายใน 1 นาที

## Links

spec: tech.md · test.md · delivery.md · PR: [#106](https://github.com/Thawatchai-Petkaew/campvibe/pull/106) · preview: campvibe-staging.vercel.app · design: DESIGN.md

## Changelog

* v2 (2026-06-23) — delivered. Ship เป็น **facade แบบ fetch ไปยัง Resend REST** (ไม่ใช่ Resend SDK) จึง **ไม่เพิ่ม npm dependency**; เป็น **infra + templates เท่านั้น** (`lib/email/client.ts` + `lib/email/templates.ts`) ส่วนการต่อเข้า flow จอง/KYC เลื่อนไป CAM-62/CAM-74; `server-only`, guarded no-op เมื่อไม่มี `RESEND_API_KEY`; env ใหม่ `RESEND_API_KEY` + `EMAIL_FROM` (DevOps ตั้งใน Vercel staging+prod). PR #106, merged staging
* v1 (2026-06-22) — story scoped (ร่างเดิมสมมติใช้ SDK + wiring + `lib/email.ts`)
