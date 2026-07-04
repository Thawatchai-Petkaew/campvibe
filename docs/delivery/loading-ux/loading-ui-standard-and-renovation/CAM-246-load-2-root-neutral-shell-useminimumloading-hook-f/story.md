---
linear: CAM-246
feature: loading-ux
epic: loading-ui-standard-and-renovation (CAM-243)
persona: platform
artifact: story
owner: product-owner
status: Todo
version: v1
updated: 2026-06-28
---
# LOAD-2 — root neutral shell + useMinimumLoading hook (foundation) (CAM-246)

## Why

ปูพื้นฐาน rollout: (1) root `app/loading.tsx` ตอนนี้เป็น `CampgroundGridSkeleton` → route ที่ไม่มี loading.tsx ของตัวเองเห็นกริดแคมป์ (ผิด) → เปลี่ยนเป็น neutral shell. (2) สร้าง `useMinimumLoading` hook (มาตรฐาน §S4) ให้ client-fetch routes ใช้ทำ delay+min-display.

## Story

ในฐานะ **ผู้เข้าชม** ฉันต้องการ **route ที่ยังไม่ได้ทำ loading เฉพาะ ไม่โชว์กริดแคมป์ผิดๆ** และทีมมี **hook กลางสำหรับ anti-flicker**. ขอบเขต: root loading + hook เท่านั้น (route อื่นคือ LOAD-3).

## AC

| # | Given | When | ผลที่ผู้ใช้เห็น | ผลเชิงข้อมูล/ระบบ |
| -- | -- | -- | -- | -- |
| 1 | นำทางไป route ที่ไม่มี loading.tsx เฉพาะ (cold-load) | กำลังโหลด | เห็น neutral shell (navbar area + แถบ content กลางๆ) ไม่ใช่กริดแคมป์ | `RootShellSkeleton` ใหม่ใน `app/loading.tsx` |
| 2 | client-fetch โหลดเร็ว/ช้า | โหลด | เร็ว→ไม่แฟลช skeleton, ช้า→skeleton ไม่กระพริบ | `useMinimumLoading(isLoading,{delay:300,minDisplay:400})` คืน `showSkeleton` |

## Rules

* ทำตาม `.claude/rules/loading.md` (§S3 root=neutral, §S4 client-fetch hook)
* `app/loading.tsx` → `RootShellSkeleton` (neutral: navbar bar + กล่อง content กลาง bg-muted; **ห้าม** ใช้ CampgroundGridSkeleton) ; Home ยังโชว์กริด skeleton ผ่าน Suspense ใน `app/page.tsx` (ไม่กระทบ — Home มี section-level ของตัวเอง)
* `lib/hooks/use-minimum-loading.ts` — `useMinimumLoading(isLoading, {delay=300, minDisplay=400})` → `showSkeleton:boolean` (delay-before-show + min-display, timer cleanup, SSR-safe)
* token-only · a11y บน RootShellSkeleton (aria-busy/role=status/label) · reduced-motion · check:ds เขียว

## Out of scope

* dashboard/profile/bookings/detail (LOAD-3) · host (static)

## Self-verify

* เข้า route ไม่มี loading.tsx → neutral shell (ไม่ใช่กริดแคมป์) · Home ยังปกติ · hook มี test (เร็ว→ไม่โชว์ก่อน delay, ช้า→hold ครบ minDisplay) · lint/typecheck/test/build/check:ds เขียว

## Links

* Epic [CAM-243](https://linear.app/campvibe/issue/CAM-243/loading-ui-standard-and-renovation) · standard [CAM-244](https://linear.app/campvibe/issue/CAM-244/ux-designer-load-std-loading-ui-standard-rulesloadingmd-designmd) (.claude/rules/loading.md) · app/loading.tsx
