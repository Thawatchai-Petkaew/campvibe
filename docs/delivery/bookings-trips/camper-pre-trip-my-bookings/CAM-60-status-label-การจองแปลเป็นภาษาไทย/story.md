---
linear: CAM-60
feature: bookings-trips
epic: camper-pre-trip-my-bookings (CAM-24)
persona: camper
artifact: story
owner: product-owner
status: Backlog
version: v1
updated: 2026-06-23
---
# Status label การจองแปลเป็นภาษาไทย (CAM-60)

## ทำไม

ปัจจุบันหน้า "การจองของฉัน" แสดงสถานะเป็น raw string ภาษาอังกฤษ (PENDING/CONFIRMED/CANCELLED/COMPLETED) ทำให้ Camper ชาวไทยเข้าใจสถานะของตัวเองได้ยาก ซึ่งเพิ่ม confusion และลด trust ในแพลตฟอร์ม
**KPI:** อัตราการติดต่อ support เรื่อง "ไม่รู้ว่าการจองอยู่ในสถานะอะไร" ลดลง + ผ่าน i18n audit ครบ 4 สถานะ ทั้ง th/en

## Story

ในฐานะ **Camper** ฉันต้องการ **เห็นสถานะการจองเป็นภาษาไทยที่เข้าใจง่าย** เพื่อ **ทราบสถานะของการจองของตัวเองได้ทันทีโดยไม่ต้องเดา**
ขอบเขต: แปลและแสดง label สถานะ 4 ค่า (PENDING/CONFIRMED/CANCELLED/COMPLETED) บนหน้ารายการการจอง `/bookings` และ badge ด้านบนรูปการ์ด โดยอ่านค่าภาษาจาก `locales/translations.json` (th/en) ไม่แก้ data model

## AC

| # | Given (สถานะตั้งต้น) | When (ผู้ใช้ทำ) | ผลที่ผู้ใช้เห็น (copy ไทยจริง) | ผลเชิงข้อมูล/ระบบ |
| -- | -- | -- | -- | -- |
| 1 | Camper ล็อกอินอยู่ มีการจองที่ `status = 'PENDING'` | เปิดหน้า /bookings (ภาษาไทย) | badge แสดง **"รอยืนยัน"** พื้นหลังสีเหลือง | `Booking.status` ยังคง `PENDING` ในฐานข้อมูล ไม่มีการเปลี่ยนแปลง |
| 2 | Camper ล็อกอินอยู่ มีการจองที่ `status = 'CONFIRMED'` | เปิดหน้า /bookings (ภาษาไทย) | badge แสดง **"ยืนยันแล้ว"** พื้นหลังสีเขียว | `Booking.status` ยังคง `CONFIRMED` |
| 3 | Camper ล็อกอินอยู่ มีการจองที่ `status = 'CANCELLED'` | เปิดหน้า /bookings (ภาษาไทย) | badge แสดง **"ยกเลิกแล้ว"** พื้นหลังสีเทา | `Booking.status` ยังคง `CANCELLED` |
| 4 | Camper ล็อกอินอยู่ มีการจองที่ `status = 'COMPLETED'` | เปิดหน้า /bookings (ภาษาไทย) | badge แสดง **"เข้าพักแล้ว"** พื้นหลังสีน้ำเงิน | `Booking.status` ยังคง `COMPLETED` |
| 5 | Camper ล็อกอินอยู่ มีการจองที่ `status = 'PENDING'` | เปิดหน้า /bookings (ภาษาอังกฤษ) | badge แสดง **"Pending"** | ไม่มีการเปลี่ยนแปลงข้อมูล |
| 6 | Camper ล็อกอินอยู่ มีการจองที่ `status = 'CONFIRMED'` | เปิดหน้า /bookings (ภาษาอังกฤษ) | badge แสดง **"Confirmed"** | ไม่มีการเปลี่ยนแปลงข้อมูล |
| 7 | Camper ล็อกอินอยู่ มีการจองที่ `status = 'CANCELLED'` | เปิดหน้า /bookings (ภาษาอังกฤษ) | badge แสดง **"Cancelled"** | ไม่มีการเปลี่ยนแปลงข้อมูล |
| 8 | Camper ล็อกอินอยู่ มีการจองที่ `status = 'COMPLETED'` | เปิดหน้า /bookings (ภาษาอังกฤษ) | badge แสดง **"Completed"** | ไม่มีการเปลี่ยนแปลงข้อมูล |
| 9 | มี `status` ค่าที่ไม่รู้จัก (edge case future) | เปิดหน้า /bookings | badge แสดงค่า raw ดั้งเดิม (ไม่ crash) | ไม่มีการเปลี่ยนแปลงข้อมูล |

## Rules

* การแปลสถานะอ่านจาก `locales/translations.json` ภายใต้ key ที่เหมาะสม (ต้องเพิ่ม key สำหรับสถานะการจอง 4 ค่าใน section `bookings` ทั้ง `en` และ `th`)
* ค่า mapping ที่ใช้ (th): PENDING = "รอยืนยัน", CONFIRMED = "ยืนยันแล้ว", CANCELLED = "ยกเลิกแล้ว", COMPLETED = "เข้าพักแล้ว"
* ค่า mapping ที่ใช้ (en): PENDING = "Pending", CONFIRMED = "Confirmed", CANCELLED = "Cancelled", COMPLETED = "Completed"
* สีของ badge ต้องสอดคล้องกับ design token (ไม่ hardcode hex): PENDING = warning/yellow, CONFIRMED = success/green, CANCELLED = muted/gray, COMPLETED = info/blue
* ห้ามแก้ `Booking.status` field หรือ enum ใด ๆ ในฐานข้อมูล (read-only transform)
* ถ้า `status` ไม่อยู่ใน 4 ค่าที่รู้จัก ให้แสดง raw string (fallback) ไม่ใช่ error

## Data

* ไม่มีการเปลี่ยน Prisma schema (`Booking.status` เป็น `String` อยู่แล้ว)
* เพิ่ม translation keys ใหม่ใน `locales/translations.json` section `bookings` (ทั้ง `en` และ `th`) สำหรับ key: `statusPending`, `statusConfirmed`, `statusCancelled`, `statusCompleted`
* ไม่ต้อง migration

## Out of scope

* แปล status label บนหน้า Host dashboard (`/dashboard/bookings`) → ไม่ใช่ Camper persona (H-4.x)
* แปล status ในหน้า booking detail `/bookings/[id]` → C-5.4 (จะสืบทอด translation key ชุดเดียวกันโดยอัตโนมัติ)
* เพิ่ม status ค่าใหม่เช่น NO_SHOW → H-4.5
* เปลี่ยน logic การคำนวณหรืออัปเดต status → เป็น story อื่น

## Self-verify

- [ ] lint
- [ ] typecheck
- [ ] test coverage ≥80% (unit test ฟังก์ชัน map status → label ครบ 4 ค่า + fallback)
- [ ] a11y (badge มี accessible text ที่อ่านสถานะได้ ไม่ใช่แค่สี)
- [ ] design (token-only, ไม่มี hardcode color)
- [ ] security (ไม่มี impact, display-only)
- [ ] verify Staging URL: เปิด /bookings บน campvibe-staging.vercel.app ด้วยภาษา th และ en แล้ว badge แสดงค่าถูกต้องทั้ง 4 สถานะ

## Links

spec: — · PR: — · preview: [https://campvibe-staging.vercel.app/bookings](<https://campvibe-staging.vercel.app/bookings>) · design: DESIGN.md
