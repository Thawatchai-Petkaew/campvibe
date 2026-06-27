---
linear: CAM-226
feature: design-system-v2
epic: ui-consistency-hardening-clear-system-drift-guards (CAM-221)
persona: platform
artifact: story
owner: product-owner
status: Todo
version: v1
updated: 2026-06-27
---
# A3 — mechanical scale/token/variant drift cleanup (CAM-226)

## Why

guard (B2) flag drift class-level จำนวนมากที่เป็น mechanical fix: radius นอก role, shadow tier, font-[Npx], focus-ring hardcode, ปุ่ม/Badge override สี, inline height. เคลียร์ทีเดียวให้ตรง DESIGN.md scale/variant → guard count ลดเข้าใกล้ 0.

## Story

ในฐานะ **platform** ฉันต้องการ **UI ทุกหน้าตรง token/scale/variant ของ DESIGN.md** เพื่อ **ดูเป็นระบบเดียว + ลด drift**. ขอบเขต: แก้ drift mechanical ที่ guard ฟ้อง (ยกเว้นที่เป็นงาน A6/A8).

## AC

| # | Given | When | ผลที่ผู้ใช้เห็น | ผลเชิงข้อมูล/ระบบ |
| -- | -- | -- | -- | -- |
| 1 | element ที่ใช้ radius นอก role (`rounded-lg/md/sm`) ที่ไม่ใช่ card div | ดู | มุมโค้งตรง role (inner=`rounded-xl`, control=`rounded-full`) | guard R1 ลด (เหลือเฉพาะ card 2xl ที่เป็นงาน A6) |
| 2 | dropdown/popover ที่ใช้ `shadow-xl` + modal primitive | ดู | เงาตรง tier (dropdown=`shadow-lg`, modal=`shadow-2xl`) | guard R2 = 0 |
| 3 | ข้อความ `text-[10px/11px]` | ดู | ใช้ `text-xs` | guard R3 = 0 |
| 4 | input ที่ hardcode `focus-visible:ring-primary/30` | โฟกัส | ใช้ focus ring มาตรฐาน (`ring-ring`) | guard R4 = 0 |
| 5 | Button/Badge ที่ override สีด้วย className (`bg-foreground`/`bg-primary`) | ดู | สีมาจาก `variant` | guard R5 ลด |
| 6 | ปุ่มที่ inline `h-10`/`w-10`/`h-8` | ดู | ใช้ `size` prop | guard inline-h ลด |

## Rules

* token/scale/variant ตาม DESIGN.md §2/§3 · ไม่เปลี่ยนพฤติกรรม แค่ class
* **ยกเว้น (ไม่แตะในงานนี้):** card div `rounded-2xl`→Card primitive = A6 · textarea radius + opacity tint + checkbox = A8 (designer judgment)
* ใช้ `npm run check:ds` ดึง list file:line แต่ละหมวด แล้วแก้ตามนั้น

## Out of scope

* cards→Card (A6) · i18n (A7) · judgment items (A8)

## Self-verify

* `check:ds` report: R2/R3/R4 = 0, R1/R5/inline-h ลดเหลือเฉพาะที่เป็น A6/A8 · ทุกหน้าที่แตะ dark mode อ่านได้ · lint/typecheck/test/build เขียว · ไม่มี behavior เปลี่ยน

## Links

* Epic [CAM-221](https://linear.app/campvibe/issue/CAM-221/ui-consistency-hardening-clear-system-drift-guards-as-governance) · B2 guard report · DESIGN.md §2 (radius/shadow/size) §3 (button/badge)
