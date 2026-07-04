---
artifact: feature
feature: discovery-search (Discovery & Search)
personas: [camper]
status: active
version: v2
updated: 2026-06-23
---
# Discovery & Search

## Overview
ฟีเจอร์กลุ่ม "ค้นหา–ค้นพบแคมป์" สำหรับ **camper** — หน้าแรก grid + category bar, ค้นหาด้วย keyword, และกรองตามจังหวัด/อำเภอ/ราคา/สิ่งอำนวยความสะดวก/กิจกรรม/ภูมิประเทศ/วันที่ว่าง/จำนวนผู้เข้าพัก แล้วเรียงลำดับผลลัพธ์ เป้าหมายคือพา camper จาก "ค้นหา → เจอลานที่ใช่ → เปิดดู detail" ได้เร็วและตรง โดยไม่เจอลานที่จองจริงไม่ได้ ↑ Master-Plan: `docs/project/master-plan.md` (core loop "ค้นหา–ดูรายละเอียด–จอง–รีวิว", pillar Demand/camper) · product-plan item: **C-1 Discover & search**.

## Architecture overview
- Entities (atomic, ลิงก์ด้วย ID):
  - `CampSite` — Set หลักของผลค้นหา; Pixel ที่ใช้กรองในฟีเจอร์นี้ ได้แก่ `isActive` · `isPublished` · `deletedAt` (soft-delete) · `campSiteType` · `priceLow` (Decimal) · **`maxGuestsPerDay: Int?`** (capacity ระดับลาน, set โดย operator).
  - `Location` — `CampSite.locationId → Location` ใช้กรอง `province` / `district`.
  - `MasterData` — taxonomy แบบ data-driven (S4a/ADR-003): accessTypes/facilities/externalFacilities/equipment/activities/terrain normalize เข้า relation `CampSite.options MasterData[]` (กรองด้วย `options: { some: { code } }`).
  - `Spot` + `Booking` — ใช้สำหรับ availability filter เมื่อระบุ `startDate`/`endDate`.
  - `User` (operator) — include เฉพาะ `{ name }` บนหน้าแรก.
- API surface: ไม่มี REST endpoint แยก — หน้าแรกเป็น **Server Component** (`app/page.tsx`, `dynamic = 'force-dynamic'`) อ่าน `searchParams` แล้วเรียก `prisma.campSite.findMany({ where, orderBy, take: 40 })` โดยตรงบน server.
- Buffet/where-builder กลาง: **`lib/campsite-filters.ts` → `buildCampSiteWhere(params)`** สร้าง `Prisma.CampSiteWhereInput` ที่ใช้ร่วมทั้งหน้า listing และ count — เป็นจุดเดียวที่ logic การกรองอยู่ (UI-neutral; consumer ส่ง params, ได้ where กลับ).
- ADRs: ADR-003 (taxonomy → MasterData relation) · schema: `prisma/schema.prisma` (`model CampSite`, index `@@index([isPublished, deletedAt])`).

## Design overview
- Core flow: หน้าแรกแสดง `CampgroundGrid` ของลาน active/published (cap 40) + `CategoryBar` + `FilterSortBar`/`FilterModal` (keyword, จังหวัด, ราคา, สิ่งอำนวย, กิจกรรม, ภูมิประเทศ, วันที่, จำนวนคน) + `SortDropdown` (ราคา/คะแนน) → เมื่อผลว่างแสดง `EmptyState` ("ไม่พบลานแคมป์" + ปุ่ม "ล้างการค้นหา").
- Shared components: `components/CampgroundGrid` · `components/EmptyState` · `components/FilterModal` · `components/SortDropdown`. Tokens → `DESIGN.md`.

## Epics & Stories
| Epic | Stories | สถานะ |
|---|---|---|
| [Camper: discover & search (CAM-33)](camper-discover-search/epic.md) | **CAM-77** กรองจำนวนผู้เข้าพักตาม capacity จริง (C-1.5) | **Done** (staging) |
| ↳ deferred (ยังไม่ทำใน epic นี้) | C-1.4 sort คะแนนรีวิวจริง → **CAM-76** · C-1.7 AI NL search → **CAM-44** | Backlog |

## Key decisions
- **Null-capacity inclusion semantics (CAM-77, DEFECT-01):** เมื่อกรอง capacity ลานที่ `maxGuestsPerDay IS NULL` (operator ยังไม่ได้กรอกความจุ) ต้อง **คงอยู่ในผลเสมอ** — เราเลือกไม่ซ่อนลานที่ความจุไม่ทราบ (false-negative กระทบ supply มากกว่า false-positive). SQL ที่ปล่อยจึงเป็น `WHERE (maxGuestsPerDay >= N OR maxGuestsPerDay IS NULL)` เพราะ Prisma `{ gte: N }` เพียวๆ บน PostgreSQL ตัด NULL ทิ้ง.
- **จุดกรองเดียว:** logic การกรองทั้งหมดอยู่ใน `buildCampSiteWhere` ไม่ใช่กระจายใน component/page — แก้ที่เดียว, test ที่เดียว.
- **Capacity = field ระดับลาน:** ใช้ `CampSite.maxGuestsPerDay` (มีใน schema อยู่แล้ว) ไม่ใช้ผลรวมของ spot — ไม่ต้อง migration.

## Changelog
- v2 (2026-06-23) — เติม overview + architecture/design + epic rollup (CAM-77 C-1.5 Done); บันทึก key decision null-capacity inclusion (DEFECT-01); เดิมเป็น scaffold stub
- v1 (2026-06-22) — feature created (scaffold)
