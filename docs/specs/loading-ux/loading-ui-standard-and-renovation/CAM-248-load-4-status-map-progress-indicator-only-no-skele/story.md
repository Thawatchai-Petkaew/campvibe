---
linear: CAM-248
feature: loading-ux
epic: loading-ui-standard-and-renovation (CAM-243)
persona: platform
artifact: story
owner: product-owner
status: Todo
version: v1
updated: 2026-06-28
---
# LOAD-4 — /status/map: progress indicator only (no skeleton) (CAM-248)

## Why

`/status/map` (แผนที่ delivery) เป็น canvas เต็มจอ — ตามมาตรฐานควรใช้ **progress indicator** ไม่ใช่ skeleton (skeleton ไม่ได้เลียนอะไรที่มีความหมายบนแผนที่). ตอนนี้ scene-loader มี progress bar อยู่แล้ว ([CAM-198](https://linear.app/campvibe/issue/CAM-198/devops-release-statusmap-เปลยน-loading-เปน-progress-indicator-ตดการด)) แต่หน้านี้**ไม่มี** `loading.tsx` **ของตัวเอง** → cold-load/นำทางเข้ามาจะเด้ง root `RootShellSkeleton` (skeleton) ก่อน. เจ้าของต้องการ progress อย่างเดียวเฉพาะหน้านี้.

## Story

ในฐานะ **ผู้ดู Status Map** ฉันต้องการ **เห็นแถบ progress อย่างเดียวตอนโหลด ไม่มี skeleton** เพื่อ **โหลดแผนที่ดูเรียบ ไม่มีโครงเทาๆ ที่ไม่เกี่ยวข้อง**. ขอบเขต: เฉพาะ `/status/map`.

## AC

| # | Given | When | ผลที่ผู้ใช้เห็น | ผลเชิงข้อมูล/ระบบ |
| -- | -- | -- | -- | -- |
| 1 | นำทาง/cold-load ไป `/status/map` | กำลังโหลด | เห็น **แถบ progress** (บน night scene) อย่างเดียว — ไม่มี skeleton/RootShellSkeleton | `app/status/map/loading.tsx` ใหม่ = progress indicator (override root) |
| 2 | scene (client) กำลัง mount | โหลด | progress เดิม (scene-loader) ยังทำงานเหมือนเดิม | reuse progress markup ร่วมกัน |
| 3 | screen reader | โหลด | ประกาศ "กำลังโหลดแผนที่แคมป์" | `role="progressbar"`/`aria-busy` (มีอยู่) |

## Rules

* เพิ่ม `app/status/map/loading.tsx` ที่ render **progress indicator** (แถบ map-progress แบบเดียวกับ scene-loader) — **ห้ามใช้ skeleton/RootShellSkeleton/CampgroundGridSkeleton**
* DRY: แยก progress markup ของ scene-loader (`scene-loader.tsx` loading) เป็น component ใช้ร่วม (เช่น `MapProgress`) ให้ทั้ง loading.tsx + scene-loader ใช้ตัวเดียวกัน (กัน drift)
* คง `force-dynamic` + STATUS_TOKEN gate ของหน้าเดิม · token-only/CSS เดิมของแผนที่ (หน้านี้มี self-contained CSS) · check:ds เขียว
* (ออปชัน) เพิ่ม 1 บรรทัดใน `.claude/rules/loading.md`: full-screen canvas/map module → progress indicator only (ไม่ skeleton); ให้ route มี loading.tsx ที่เป็น progress กัน fallback ไป root skeleton

## Out of scope

* route อื่น (เสร็จใน LOAD-2/3 แล้ว)

## Self-verify

* cold-load `/status/map` → progress อย่างเดียว ไม่มี skeleton · scene-loader ยังทำงาน · a11y progressbar · lint/typecheck/test/build/check:ds เขียว

## Links

* Epic [CAM-243](https://linear.app/campvibe/issue/CAM-243/loading-ui-standard-and-renovation) · standard [CAM-244](https://linear.app/campvibe/issue/CAM-244/ux-designer-load-std-loading-ui-standard-rulesloadingmd-designmd) · scene-loader.tsx ([CAM-198](https://linear.app/campvibe/issue/CAM-198/devops-release-statusmap-เปลยน-loading-เปน-progress-indicator-ตดการด)) · app/status/map/page.tsx · root RootShellSkeleton ([CAM-246](https://linear.app/campvibe/issue/CAM-246/frontend-engineer-load-2-root-neutral-shell-useminimumloading-hook))
