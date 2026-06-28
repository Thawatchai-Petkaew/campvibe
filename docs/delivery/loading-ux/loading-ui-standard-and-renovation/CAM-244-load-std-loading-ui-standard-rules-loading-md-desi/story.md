---
linear: CAM-244
feature: loading-ux
epic: loading-ui-standard-and-renovation (CAM-243)
persona: platform
artifact: story
owner: product-owner
status: Todo
version: v1
updated: 2026-06-28
---
# LOAD-STD — Loading UI standard (rules/loading.md) + DESIGN.md Design-Gate row (CAM-244)

## Why

ไม่มีมาตรฐาน loading เป็นเอกสาร → แต่ละหน้าเลือกกันเอง, skeleton ไม่ตรง layout. ต้องมีมาตรฐานที่ Scout agents อ่านก่อนทำ UI + บังคับที่ Design Gate กันหน้าใหม่พลาดซ้ำ.

## Story

ในฐานะ **ทีมพัฒนา/designer** ฉันต้องการ **มาตรฐาน Loading UI ที่ชัดเจน + บังคับที่ Design Gate** เพื่อ **ทุกหน้า (เดิม+ใหม่) มี loading ที่ตรง layout และเลือก loader ถูกตามบริบท**. ขอบเขต: เขียน rule + DESIGN.md row (ยังไม่แตะโค้ด route — นั่นคือ S2–S4).

## AC

| # | Given | When | ผลที่ผู้ใช้เห็น | ผลเชิงข้อมูล/ระบบ |
| -- | -- | -- | -- | -- |
| 1 | ทีมจะออกแบบ loading | เปิด `.claude/rules/loading.md` | เห็น decision matrix (เวลารอ→loader) + กฎ skeleton-mirrors-layout + full-page vs section-level + a11y + anti-flicker + 8 anti-patterns พร้อมอ้างอิงแหล่ง | rule ใหม่ committed |
| 2 | ออกแบบหน้าใหม่ที่มี loading | ทำ design gate | มีแถว "Loading" ที่บอกให้เลือก loader ตาม matrix + (ถ้า skeleton) ต้อง mirror layout + section-level เมื่อเหมาะ + a11y | DESIGN.md §States/Design Gate เพิ่มแถว Loading (block PR) |
| 3 | อ้างอิง | เปิด DESIGN.md Component Index | มี pointer ไป rules/loading.md + รายการ skeleton primitives | pointer + entries |

## Rules

* `.claude/rules/loading.md` ตาม house style (`.claude/SKILL-AUTHORING.md` floor ถ้าเป็น rule format) — Overview/When/Standards(matrix+กฎ)/Anti-patterns/Verify; ทุก claim อ้างอิง (NN/g, Nielsen response-time, Next.js docs, web.dev, a11y sources)
* **full-page vs section-level**: default section-level (shell ทันที + Suspense รอบ section); full-page เฉพาะ cold-load
* **forward-looking**: เป็นข้อบังคับ Design Gate สำหรับหน้าใหม่ — skeleton สร้างโดยสลับ content→`<Skeleton/>` ใน shell จริง (กัน drift)
* DESIGN.md §5 States: เพิ่ม "Loading" row ที่ block PR เมื่อไม่ตรง matrix/layout/a11y
* ไม่แตะ route code (S2–S4) — เอกสาร/rule เท่านั้น

## Out of scope

* การแก้ route/skeleton จริง (S2–S4) · guard อัตโนมัติใน check:ds (follow-up)

## Self-verify

* rule มีครบ: matrix + mirrors-layout + section-level + a11y + anti-flicker + anti-patterns + sources · DESIGN.md มี Loading row + pointer · markdown สะอาด · เสนอ G2 ให้ owner

## Links

* Epic [CAM-243](https://linear.app/campvibe/issue/CAM-243/loading-ui-standard-and-renovation) · research synthesis (NN/g/Next.js) · audit: root loading.tsx grid-everywhere · DESIGN.md §5/§3.2
