---
linear: CAM-247
feature: loading-ux
epic: loading-ui-standard-and-renovation (CAM-243)
persona: platform
artifact: story
owner: product-owner
status: Todo
version: v1
updated: 2026-06-28
---
# LOAD-3 — section-level skeletons: dashboard, profile, bookings-list, detail (CAM-247)

## Why

route ที่ skeleton ยังไม่ตรง layout: dashboard (full-page spinner ทั้งที่มี DashboardOverviewSkeleton), profile (client fullScreen spinner), bookings-list (client spinner), campgrounds/[slug] detail (ตกไปใช้ root → เดิมคือกริดแคมป์). แก้ให้ section-level + skeleton ตรงหน้าตามมาตรฐาน + ใช้ `useMinimumLoading` (จาก LOAD-2) กับ client-fetch.

## Story

ในฐานะ **ผู้ใช้ (camper/host)** ฉันต้องการ **ทุกหน้าโชว์ chrome ทันที + skeleton เฉพาะ section ที่โหลด และตรง layout จริง** เพื่อ **โหลดดูเป็นธรรมชาติไม่สะดุด**. ขอบเขต: 4 route นี้ (host เป็น static — ข้าม).

## AC

| # | Given | When | ผลที่ผู้ใช้เห็น | ผลเชิงข้อมูล/ระบบ |
| -- | -- | -- | -- | -- |
| 1 | เข้า dashboard | โหลด | nav/header โชว์ทันที + เฉพาะ section stats/table เป็น skeleton ที่เหมือนของจริง | `DashboardOverviewSkeleton` ใน section (ไม่ใช่ full-page spinner) |
| 2 | เข้า profile | โหลด | card chrome โชว์ทันที + skeleton เฉพาะ avatar+form fields | ProfileFormSkeleton ; เลิก fullScreen spinner |
| 3 | เข้า bookings (list) | โหลด | hero/header โชว์ทันที + skeleton เฉพาะรายการ booking-card | BookingListSkeleton ; เลิก client spinner |
| 4 | เข้าหน้ารายละเอียดแคมป์ (cold-load) | โหลด | เห็น skeleton ที่เหมือนหน้า detail (cover+ชื่อ+ราคา+ส่วนข้อมูล) ไม่ใช่กริดแคมป์ | `app/campgrounds/[slug]/loading.tsx` ใหม่ tailored |
| 5 | client-fetch (dashboard/profile/bookings) | เร็ว/ช้า | เร็ว→ไม่แฟลช, ช้า→ไม่กระพริบ | ใช้ `useMinimumLoading` |
| 6 | ทุก skeleton ข้างบน | content โหลดเสร็จ | ไม่กระตุก (CLS=0) + a11y (aria-busy/role=status/label) + reduced-motion | มิติตรงของจริง |

## Rules

* ทำตาม `.claude/rules/loading.md` — section-level (chrome ทันที + skeleton เฉพาะ section async), skeleton-mirrors-layout, a11y, anti-flicker (client-fetch → `useMinimumLoading` จาก LOAD-2)
* reuse: `DashboardOverviewSkeleton` (มีอยู่), `Skeleton` primitive, `CampgroundSkeleton` pattern · new: `ProfileFormSkeleton`, `BookingListSkeleton`, `app/campgrounds/[slug]/loading.tsx`
* เลิก generic `LoadingSpinner` บน data-route เหล่านี้ (เก็บไว้เฉพาะ inline/ปุ่ม) · token-only · check:ds เขียว · design gate (Loading row)
* ถ้า PR ใหญ่เกิน ~400 บรรทัด แจ้ง orchestrator เพื่อ split

## Out of scope

* host (static, no load) · home/wishlist/booking-detail (ตรงอยู่แล้ว) · /status/map (progress, ถูกแล้ว)

## Self-verify

* 4 route: chrome ทันที + skeleton ตรง layout (CLS=0) · client-fetch ไม่แฟลช/ไม่กระพริบ · a11y ครบ · reduced-motion · ไม่มีกริดแคมป์ผิดหน้าแล้ว · lint/typecheck/test/build/check:ds เขียว

## Links

* Epic [CAM-243](https://linear.app/campvibe/issue/CAM-243/loading-ui-standard-and-renovation) · standard [CAM-244](https://linear.app/campvibe/issue/CAM-244/ux-designer-load-std-loading-ui-standard-rulesloadingmd-designmd) · foundation [CAM-246](https://linear.app/campvibe/issue/CAM-246/frontend-engineer-load-2-root-neutral-shell-useminimumloading-hook) (hook + root neutral) · audit: dashboard/profile/bookings/detail mismatches
