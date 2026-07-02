---
linear: CAM-273
feature: loading-ux
epic: loading-ui-standard-and-renovation (CAM-243)
persona: platform
artifact: story
owner: product-owner
status: Done
version: v1
updated: 2026-07-02
---
# LOAD-5 root fallback เปลี่ยนเป็น delayed spinner (แก้ skeleton แปลกแว๊บแรกตอนเปลี่ยนหน้า) (CAM-273)

## Why

Owner รายงาน: ตอนเปลี่ยนหน้า เห็น skeleton กลาง ๆ "แปลก ๆ" แว๊บแรกก่อน แล้วค่อยเป็น skeleton ตาม layout. ต้นเหตุ = root `app/loading.tsx` ใช้ `RootShellSkeleton` (LOAD-2) ซึ่งเป็น shell generic ที่ไม่ตรง layout ของหน้าไหนเลย. ตาม `.claude/rules/loading.md` decision matrix เคส "รอสั้น layout ไม่รู้" = **delayed spinner (\~300ms)** ไม่ใช่ skeleton. KPI: ไม่มี generic-skeleton flash ระหว่าง navigation.

## Story

ในฐานะผู้เข้าชม ฉันต้องการเห็นตัวหมุนโหลดสั้น ๆ ระหว่างเปลี่ยนหน้า แล้วต่อด้วยโครงหน้าจริงของหน้านั้น เพื่อไม่สับสนกับโครงหน้าที่ไม่ตรงกับเนื้อหา. (ขอบเขต: root `app/loading.tsx` เท่านั้น; loading ของ route เฉพาะ (bookings/dashboard/profile/wishlist/campgrounds/[slug]/status-map) คงเดิม)

## AC

| # | Given | When | ผลที่ผู้ใช้เห็น | ผลเชิงข้อมูล |
| -- | -- | -- | -- | -- |
| 1 | เปลี่ยนหน้าไป route ที่ไม่มี loading เฉพาะ และโหลดช้ากว่า ~0.3 วินาที | กำลังโหลด | ตัวหมุนกลางจอ (ไม่มีแถบ skeleton กลาง ๆ) แล้วค่อยเห็นหน้า/โครงหน้าจริง | root fallback = spinner + delay 300ms |
| 2 | เปลี่ยนหน้าแล้วโหลดเร็ว (ต่ำกว่า ~0.3 วินาที) | กำลังโหลด | ไม่เห็นตัวโหลดใด ๆ แว๊บ | delay ป้องกัน flash |
| 3 | เข้า route ที่มี loading เฉพาะ (เช่น รายการจอง, dashboard, แผนที่สถานะ) | กำลังโหลด | โครงหน้า/แถบโหลดเฉพาะของหน้านั้นเหมือนเดิม | route-level loading.tsx ไม่ถูกแตะ |

## Rules

* reuse `LoadingSpinner` + CSS utility `.skeleton-delay-show` (300ms delay, reduced-motion = โชว์ทันที) — ไม่สร้าง primitive ใหม่.
* a11y: `role="status"` + `aria-busy` + `aria-live="polite"` + sr-only `กำลังโหลด…` (i18n key `common.loading_sr` เดิม); spinner ปิดหมุนใต้ prefers-reduced-motion (`motion-reduce:animate-none`).
* ลบ `RootShellSkeleton` (dead code หลังเปลี่ยน) + อัปเดต guard tests ([CAM-246](https://linear.app/campvibe/issue/CAM-246/frontend-engineer-load-2-root-neutral-shell-useminimumloading-hook) AC-A, [CAM-197](https://linear.app/campvibe/issue/CAM-197/devops-release-load-1-home-catalog-loading-skeletons-empty-state-svg) AC-6) ให้ล็อกพฤติกรรมใหม่.

## Data

* ไม่มี migration / ไม่แตะ DB.

## Out of scope

* ปรับ skeleton ของ route เฉพาะ · min-display บน Suspense (มาตรฐานระบุ N/A).

## Self-verify

* test: root loading ใช้ spinner + delay class + a11y, ไม่มี RootShellSkeleton เหลือ · lint/typecheck/test/build เขียว · เช็คบน staging URL จริง.

## Links

* Epic [CAM-243](https://linear.app/campvibe/issue/CAM-243/loading-ui-standard-and-renovation) · standard `.claude/rules/loading.md` · supersedes ส่วน root ของ [CAM-246](https://linear.app/campvibe/issue/CAM-246/frontend-engineer-load-2-root-neutral-shell-useminimumloading-hook) (LOAD-2) · แนวเดียวกับ [CAM-248](https://linear.app/campvibe/issue/CAM-248/frontend-engineer-load-4-statusmap-progress-indicator-only-no-skeleton) (LOAD-4 map ไม่ใช้ skeleton)
