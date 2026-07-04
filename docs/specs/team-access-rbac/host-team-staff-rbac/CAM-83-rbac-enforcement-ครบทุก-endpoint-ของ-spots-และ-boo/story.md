---
linear: CAM-83
feature: team-access-rbac
epic: host-team-staff-rbac (CAM-38)
persona: host
artifact: story
owner: product-owner
status: Done
version: v1
updated: 2026-06-22
---
# RBAC enforcement ครบทุก endpoint ของ spots และ booking (CAM-83)

## ทำไม

ปัจจุบัน endpoint สำหรับจัดการ spot (สร้าง/แก้ไข/ลบ) ตรวจสิทธิ์แบบ owner-only ทำให้สมาชิกทีมที่มีสิทธิ์ใน permission matrix (เช่น ADMIN ที่มี `CAMPSITE_UPDATE`) ไม่สามารถดำเนินการได้ Host จึงต้องทำเองทุกอย่างและไม่สามารถมอบหมายงานผ่านระบบทีมได้จริง นอกจากนี้ `PATCH /api/bookings/[id]` ใช้ logic permission แบบ inline ซ้ำซ้อนกับ `requireCampSitePermission` ที่มีอยู่แล้ว ทำให้มีความเสี่ยงที่ logic จะ drift ในอนาคต
**KPI:** สมาชิกทีมที่มีสิทธิ์ `CAMPSITE_UPDATE` หรือ `CAMPSITE_DELETE` สามารถจัดการ spot ผ่าน API ได้ (ทดสอบด้วย role ADMIN และ MANAGER) และ 0 endpoint ที่ใช้ inline permission logic ซ้ำซ้อน

## Story

ในฐานะ **Host** ฉันต้องการ **ให้สมาชิกทีมที่มีสิทธิ์ในระดับที่เหมาะสมสามารถจัดการ spot และ booking ได้ตาม permission matrix** เพื่อ **มอบหมายงานให้ทีมได้จริงโดยไม่ต้องใช้บัญชี owner ตลอดเวลา**
ขอบเขต: แก้ไข 3 endpoint ของ spots และ 1 endpoint ของ booking ให้ใช้ `requireCampSitePermission` แทน owner-only check หรือ inline logic

## AC

| # | Given (สถานะตั้งต้น) | When (ผู้ใช้ทำ) | ผลที่ผู้ใช้เห็น (copy ไทยจริง) | ผลเชิงข้อมูล/ระบบ |
| -- | -- | -- | -- | -- |
| 1 | สมาชิกทีม role ADMIN (มีสิทธิ์ `CAMPSITE_UPDATE` ตาม default) ล็อกอินอยู่ และ campsite นั้นไม่ใช่ของตน | ส่งคำขอสร้าง spot ใหม่ให้กับ campsite ที่ตนเป็นสมาชิก | ระบบตอบกลับสำเร็จ ไม่มีข้อความแจ้งปฏิเสธ | Spot ถูกสร้างในฐานข้อมูลโดยผูกกับ campsite ที่ถูกต้อง |
| 2 | สมาชิกทีม role ADMIN ล็อกอินอยู่ | ส่งคำขอแก้ไขข้อมูล spot ที่อยู่ใน campsite ที่ตนเป็นสมาชิก | ระบบตอบกลับสำเร็จ ไม่มีข้อความแจ้งปฏิเสธ | ข้อมูล spot ในฐานข้อมูลถูกอัปเดตตามที่ส่งมา |
| 3 | สมาชิกทีม role ADMIN ล็อกอินอยู่ | ส่งคำขอลบ spot ที่อยู่ใน campsite ที่ตนเป็นสมาชิก | ระบบตอบกลับสำเร็จ ไม่มีข้อความแจ้งปฏิเสธ | Spot ถูกลบออกจากฐานข้อมูล |
| 4 | สมาชิกทีม role MANAGER (มีสิทธิ์ `BOOKING_VIEW` และ `BOOKING_UPDATE` ตาม default แต่ไม่มี `CAMPSITE_UPDATE`) ล็อกอินอยู่ | ส่งคำขอสร้าง spot ใหม่ | ระบบปฏิเสธ "คุณไม่มีสิทธิ์ดำเนินการนี้" | ระบบคืน HTTP 403 ไม่มีการสร้าง spot |
| 5 | สมาชิกทีม role MANAGER (มีสิทธิ์ `BOOKING_UPDATE`) ล็อกอินอยู่ | ส่งคำขออัปเดตสถานะ booking ของ campsite ที่ตนเป็นสมาชิก | ระบบตอบกลับสำเร็จ ไม่มีข้อความแจ้งปฏิเสธ | สถานะ booking ในฐานข้อมูลถูกอัปเดต |
| 6 | สมาชิกทีม role STAFF (มีสิทธิ์ `BOOKING_VIEW` และ `BOOKING_UPDATE` แต่ไม่มี `CAMPSITE_UPDATE` หรือ `CAMPSITE_DELETE`) ล็อกอินอยู่ | ส่งคำขอแก้ไขหรือลบ spot | ระบบปฏิเสธ "คุณไม่มีสิทธิ์ดำเนินการนี้" | ระบบคืน HTTP 403 |
| 7 | ผู้ใช้ไม่ได้ล็อกอิน | ส่งคำขอสร้าง/แก้ไข/ลบ spot หรืออัปเดตสถานะ booking | ระบบปฏิเสธ "กรุณาล็อกอินก่อนใช้งาน" | ระบบคืน HTTP 401 |
| 8 | สมาชิกทีมของ campsite A (มีสิทธิ์ `CAMPSITE_UPDATE`) ล็อกอินอยู่ | ส่งคำขอสร้าง/แก้ไข/ลบ spot ของ campsite B ที่ตนไม่ได้เป็นสมาชิก | ระบบปฏิเสธ "คุณไม่มีสิทธิ์ดำเนินการนี้" | ระบบคืน HTTP 403 ไม่มีการเปลี่ยนแปลงข้อมูลของ campsite B |
| 9 | Owner ของ campsite ล็อกอินอยู่ | ส่งคำขอสร้าง/แก้ไข/ลบ spot หรืออัปเดตสถานะ booking ของ campsite ตนเอง | ระบบตอบกลับสำเร็จ ไม่มีข้อความแจ้งปฏิเสธ | ดำเนินการสำเร็จตามปกติ (owner ยังคงผ่านได้เสมอ) |

## Rules

* `POST /api/campsites/[id]/spots` ต้องตรวจสิทธิ์ด้วย `requireCampSitePermission(campSiteId, "CAMPSITE_UPDATE")` แทน `requireCampSiteOwnership`
* `PUT /api/campsites/[id]/spots/[spotId]` ต้องตรวจสิทธิ์ด้วย `requireCampSitePermission(campSiteId, "CAMPSITE_UPDATE")` แทน `requireCampSiteOwnership`
* `DELETE /api/campsites/[id]/spots/[spotId]` ต้องตรวจสิทธิ์ด้วย `requireCampSitePermission(campSiteId, "CAMPSITE_DELETE")` แทน `requireCampSiteOwnership`
* `PATCH /api/bookings/[id]` ต้องตรวจสิทธิ์ฝั่ง host ด้วย `requireCampSitePermission(booking.campSiteId, "BOOKING_UPDATE")` แทน inline logic ที่สร้างซ้ำเอง (camper cancel path ยังคงแยกไว้ตามเดิม)
* ลำดับการตรวจสิทธิ์ที่ถูกต้อง: (1) platform ADMIN ผ่านเสมอ (2) campsite operator (owner) ผ่านเสมอ (3) team member ต้องมี permission ที่ถูกต้องใน effective permissions (role default หรือ explicit override)
* Cross-campsite IDOR: spot ต้องผูกกับ campsite ที่ระบุใน URL เสมอ (ตรรกะนี้มีอยู่แล้ว ห้ามลบออก)
* ข้อความ error เมื่อปฏิเสธสิทธิ์: `"Forbidden"` (HTTP 403)
* ข้อความ error เมื่อไม่ได้ล็อกอิน: `"Unauthorized"` (HTTP 401)
* สิทธิ์ตาม `ROLE_DEFAULT_PERMISSIONS` ใน `lib/team-permissions.ts`: OWNER = ทุกสิทธิ์, ADMIN = มี `CAMPSITE_UPDATE` (ไม่มี `CAMPSITE_DELETE`), MANAGER/STAFF/VIEWER = ไม่มี `CAMPSITE_UPDATE` หรือ `CAMPSITE_DELETE`
* หาก team member มี explicit `permissions` array ที่ไม่ว่างเปล่า ให้ใช้ค่านั้นแทน role default (logic นี้มีอยู่แล้วใน `getEffectivePermissions`)

## Data

* ไม่มีการเปลี่ยนแปลง schema (ไม่ต้องมี migration)
* entity ที่เกี่ยวข้อง: `Spot` (campSiteId, id), `Booking` (campSiteId, id, status), `CampSiteTeamMember` (userId, campSiteId, role, permissions, isActive)
* `lib/auth-utils.ts`: ฟังก์ชัน `requireCampSitePermission` และ `requireCampSiteOwnership` มีอยู่แล้ว ไม่ต้องสร้างใหม่
* `lib/team-permissions.ts`: `ROLE_DEFAULT_PERMISSIONS`, `getEffectivePermissions`, `hasPermission` มีอยู่แล้ว ไม่ต้องสร้างใหม่

## Out of scope

* การแก้ไข `GET /api/team/members`, `POST /api/team/members`, `PATCH /api/team/members/[id]`, `DELETE /api/team/members/[id]` ซึ่งใช้ owner-only check และมี TODO comment ว่า "will add permission check later" — รับช่วงโดย CAM-38 (team management RBAC story แยก)
* การเพิ่ม `isHostRegistered` check ใน `POST /api/campsites` — รับช่วงโดย story KYC/Host registration
* การเพิ่ม permission `CAMPSITE_DELETE` ให้ role ADMIN ใน default matrix — เป็นการเปลี่ยน business rule ต้องผ่าน product decision ก่อน
* การเปลี่ยน UI ที่แสดงปุ่ม/เมนูจัดการ spot และ booking ตาม permission — รับช่วงโดย story UX/Frontend
* `GET /api/campsites/[id]/spots` และ `GET /api/campsites/[id]/spots/[spotId]` เปิดสาธารณะโดยเจตนา (public read) ไม่ต้องแก้

## Self-verify

- [ ] lint (`npm run lint` ผ่าน)
- [ ] typecheck (`npm run typecheck` ผ่าน)
- [ ] test coverage ≥80% สำหรับโค้ดใหม่ (unit test ครอบ happy path + 403 + 401 ของแต่ละ endpoint ที่แก้ไข)
- [ ] a11y (ไม่มี UI เปลี่ยน ข้ามได้)
- [ ] design (ไม่มี UI เปลี่ยน ข้ามได้)
- [ ] security: ตรวจว่าไม่มี endpoint ที่ผ่านการตรวจสิทธิ์แบบ owner-only เหลืออยู่ใน `/api/campsites/[id]/*` และ `/api/bookings/[id]`
- [ ] verify Staging URL: ทดสอบด้วย token ของ team member role ADMIN และ MANAGER บน campvibe-staging.vercel.app จริง

## Links

spec: ai-planning/docs/specs/ · PR: (ยังไม่มี) · preview: campvibe-staging.vercel.app · design: DESIGN.md
