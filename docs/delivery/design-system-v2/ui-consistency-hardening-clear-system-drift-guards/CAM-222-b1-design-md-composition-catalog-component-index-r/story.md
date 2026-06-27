---
linear: CAM-222
feature: design-system-v2
epic: ui-consistency-hardening-clear-system-drift-guards (CAM-221)
persona: platform
artifact: story
owner: product-owner
status: Todo
version: v1
updated: 2026-06-27
---
# B1 — DESIGN.md Composition catalog + component index + reuse-before-create rule (CAM-222)

## Why

DESIGN.md §3 "Composition catalog" stale (ไม่ลิสต์ ModalHeader/EmptyState/ErrorState) → agent หา primitive ไม่เจอ เลยสร้างใหม่ = ต้นเหตุ drift. ทำให้ "ของถูกหยิบง่าย" + บังคับ "เช็คก่อนสร้าง" = ฐานของกลไก consistency.

## Story

ในฐานะ **platform** ฉันต้องการ **ให้ AI agent ค้นเจอ primitive ที่มีอยู่ก่อนสร้างใหม่** เพื่อ **reuse แทน re-implement (ลด drift ตั้งแต่ต้นทาง)**. ขอบเขต: refresh DESIGN.md Composition catalog + สร้าง component index + เพิ่ม reuse-before-create rule.

## AC

| # | Given | When | ผลที่ผู้ใช้เห็น | ผลเชิงข้อมูล/ระบบ |
| -- | -- | -- | -- | -- |
| 1 | agent อ่าน DESIGN.md §3 | หา wrapper ที่ reuse ได้ | (ไม่มีผลหน้าจอ — เอกสาร) | catalog ลิสต์ ModalHeader/ModalContent/EmptyState/ErrorState/ConfirmDialog + dropdown grammar note ครบ |
| 2 | agent เริ่มงาน UI | เปิด component index | (เอกสาร) | มี index ของทุก primitive ใน components/ui/ + ใช้เมื่อไหร่ |
| 3 | agent จะสร้าง component ใหม่ | อ่าน code.md | (เอกสาร) | มี rule "reuse-before-create" บังคับเช็ค components/ui/ + catalog ก่อน |

## Rules

* DESIGN.md = SoT ของ catalog · component index sync กับ components/ui/ จริง · code.md rule อ้าง DESIGN.md §3
* ไม่แตะ component code (งานนี้ docs/rules ล้วน)

## Out of scope

* guard อัตโนมัติ (= B2) · การ migrate component (= Phase A)

## Self-verify

* catalog ครบ + ไม่ stale · index ตรงกับไฟล์จริงใน components/ui/ · code.md มี rule · lint/build เขียว (markdown ไม่พัง)

## Links

* Epic [CAM-221](https://linear.app/campvibe/issue/CAM-221/ui-consistency-hardening-clear-system-drift-guards-as-governance) · DESIGN.md §3 · research best-practice (component discoverability for AI agents)
