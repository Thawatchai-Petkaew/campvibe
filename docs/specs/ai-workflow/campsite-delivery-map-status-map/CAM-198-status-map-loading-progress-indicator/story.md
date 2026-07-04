---
linear: CAM-198
feature: ai-workflow
epic: campsite-delivery-map-status-map (CAM-150)
persona: platform
artifact: story
owner: product-owner
status: Backlog
version: v1
updated: 2026-06-26
---
# /status/map: เปลี่ยน loading เป็น progress indicator (ตัดการ์ด placeholder + spinner) (CAM-198)

## ทำไม

ตอนโหลดหน้า /status/map ปัจจุบันแสดงการ์ด glass `.map-placeholder` (ข้อความ "กำลังโหลดแผนที่แคมป์…") เป็น loading state · เจ้าของอยากให้ใช้ **progress indicator (แถบความคืบหน้า)** แทน — ตัดการ์ด (และ spinner) ออก ให้ดู clean/เบาขึ้น
(หมายเหตุ: ตรวจแล้วไม่มี page-load spinner ในโค้ด — มีแต่การ์ด; spinner `animate-spin` ที่มีคือปุ่ม approve ใน modal ของ [CAM-184](https://linear.app/campvibe/issue/CAM-184/qa-engineer-approvereject-งานจากหนา-statusmap-ไดจรง-detail-view-ปรบ-ui) ซึ่งเป็น action คนละเรื่อง ไม่แตะ)

## Story

ในฐานะ **เจ้าของ (platform)** ฉันต้องการ **เห็นแถบความคืบหน้าเรียบๆ ตอนหน้าแผนที่กำลังโหลด** เพื่อ **รู้ว่ากำลังโหลดโดยไม่มีการ์ด/กล่องบังฉาก**
ขอบเขต: แทน loading fallback ของ scene (การ์ด `.map-placeholder`) ด้วย progress indicator; คงพื้นหลัง scene กลางคืน; ไม่แตะ spinner ของปุ่ม approve ใน modal

## AC

| # | Given | When | ผลที่ผู้ใช้เห็น (copy ไทย) | ผลเชิงข้อมูล/ระบบ |
| -- | -- | -- | -- | -- |
| 1 | เปิด /status/map ระหว่าง scene กำลังโหลด | ดูหน้า | เห็น **แถบความคืบหน้า** บนพื้น scene กลางคืน · ไม่มีการ์ด placeholder/กล่องข้อความ · ไม่มี spinner | แทน loading fallback ใน scene-loader |
| 2 | scene โหลดเสร็จ | *  | แถบหาย แผนที่แสดงปกติ | dynamic import เดิม |
| 3 | เครื่องตั้ง reduced-motion | ดู | แถบไม่วิ่ง/กระพริบถี่ (ลดหรือคงที่) | prefers-reduced-motion |
| 4 | screen reader | โหลด | ประกาศสถานะกำลังโหลด | role=progressbar/status + aria-label |

## Rules

* แทน `loading:` fallback ใน `app/status/map/scene-loader.tsx` (การ์ด `.map-placeholder`) ด้วย progress indicator (แถบ indeterminate) — คง `.map-wrap`/พื้น SCENE กลางคืนไว้
* progress bar ใช้ scene token (amber/`--amber`) + CSS animation (ไม่ใช่ JS) · เคารพ prefers-reduced-motion · ไม่มี emoji · a11y (role + aria-label ไทย, ผ่าน i18n ถ้ามี)
* **ไม่แตะ** spinner ปุ่ม approve/approve-all ใน modal (campsite-overlays.tsx, [CAM-184](https://linear.app/campvibe/issue/CAM-184/qa-engineer-approvereject-งานจากหนา-statusmap-ไดจรง-detail-view-ปรบ-ui) action) · ไม่แตะ scene/engine/logic อื่น
* error state ของ page (`.map-placeholder` error card) คงไว้ (คนละ state)

## Data

* ไม่มี data/migration (UI loading state ล้วน)

## Out of scope

* spinner ของ action ในmodal · loading skeleton หน้า Home (นั่น [CAM-197](https://linear.app/campvibe/issue/CAM-197/frontend-engineer-load-1-home-catalog-loading-skeletons-empty-state))

## Self-verify

- [ ] lint · typecheck · test · build · check:palette · check:ds
- [ ] a11y: role/aria-label, reduced-motion
- [ ] verify staging /status/map: ตอนโหลดเห็น progress bar ไม่มีการ์ด/spinner

## Links

ref: app/status/map/scene-loader.tsx (loading fallback) · .map-placeholder (campsite-assets.ts) · DESIGN.md (motion/a11y)
