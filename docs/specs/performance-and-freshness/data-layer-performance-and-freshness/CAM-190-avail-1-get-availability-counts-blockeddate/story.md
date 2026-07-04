---
linear: CAM-190
feature: performance-and-freshness
epic: data-layer-performance-and-freshness (CAM-186)
persona: platform
artifact: story
owner: product-owner
status: In Progress
version: v1
updated: 2026-06-26
---
# AVAIL-1 GET availability counts BlockedDate (CAM-190)

## Why

ฝั่งจอง (write) กันชนเสร็จแล้ว ([CAM-57](https://linear.app/campvibe/issue/CAM-57/devops-release-inventory-lock-กน-overbooking-แบบ-atomic)) แต่ปฏิทินที่ guest เห็น (GET) ยังไม่นับวันที่ host บล็อก → guest เห็นวันว่างผิด แล้วกดจองโดนปฏิเสธ. เริ่มได้เลย (ไม่ติด MEAS-1).

## Story

ในฐานะ platform ฉันต้องการ ปฏิทินที่ guest เห็นนับวันที่ host บล็อกด้วย + แสดงสดเสมอ เพื่อ ไม่ให้ guest เห็นวันว่างที่จองจริงไม่ได้. ขอบเขต: เติมการนับวันบล็อกใน GET availability + ตั้งให้ไม่ถูก cache + ยืนยันการกันชนบน staging.

## AC

| # | Given | When | ผลที่ผู้ใช้เห็น | ผลเชิงข้อมูล |
| -- | -- | -- | -- | -- |
| AC-1 | host บล็อกวันที่ X | guest เปิดปฏิทิน | วันที่ X แสดงว่าไม่ว่าง | GET availability นับวันบล็อกด้วย |
| AC-2 | สองคนจองช่องเต็มพร้อมกัน | กดจองพร้อมกัน | คนหนึ่งสำเร็จ อีกคนเห็นว่าเต็มแล้ว | ฐานข้อมูลมี booking เดียว (ยืนยันบน staging) |

## Rules

availability ต้องสดเสมอ ห้าม cache (ตั้ง no-store ชัดเจน) · เงื่อนไขนับวันบล็อกตรงกับฝั่ง booking write.

## Data

ไม่มี migration (โมเดล BlockedDate มีแล้วใน `prisma/schema.prisma` บรรทัด 647–664).

**เปลี่ยนแปลงในโค้ด (ไม่ใช่ schema):**

- `lib/campsite-availability.ts` — เพิ่มฟังก์ชัน `getBlockedDatesForRange` (query `prisma.blockedDate.findMany`) + ขยาย map ใน `getCampSiteDailyAvailability` ให้มีฟิลด์ `blocked: boolean` + `blockedReason: string | null`
- predicate ที่ใช้ต้องตรงกับ `app/api/bookings/route.ts` บรรทัด 93–104 ทุกประการ (campSiteId + deletedAt:null + OR[spotId:null, spotId] + AND[startDate:{lte}, endDate:{gte}])
- `app/api/campsites/[id]/availability/route.ts` — เพิ่ม `export const dynamic = 'force-dynamic'` + header `Cache-Control: no-store`; output `AvailabilityDay` เพิ่ม `blockedByHost: boolean` + `blockedReason: string | null`
- `app/api/campgrounds/[id]/availability/route.ts` — เหมือนกันทุกอย่าง
- `available: false` เมื่อ capacity เต็ม หรือ `blocked === true` (รวมทั้งสองเงื่อนไข)
- reversibility: n/a (ไม่มี schema change)

## Out of scope

ฝั่งจอง write (เสร็จแล้ว [CAM-57](https://linear.app/campvibe/issue/CAM-57/devops-release-inventory-lock-กน-overbooking-แบบ-atomic)).

## Self-verify

[ ] lint [ ] typecheck [ ] test (GET นับ BlockedDate) [ ] verify concurrency บน staging

## Links

Research Map §11 AVAIL-1 · ADR-015 · epic [CAM-186](https://linear.app/campvibe/issue/CAM-186/data-layer-performance-and-freshness)
