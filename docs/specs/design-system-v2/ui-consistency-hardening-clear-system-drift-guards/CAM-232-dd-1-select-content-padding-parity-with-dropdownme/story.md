---
linear: CAM-232
feature: design-system-v2
epic: ui-consistency-hardening-clear-system-drift-guards (CAM-221)
persona: platform
artifact: story
owner: product-owner
status: Todo
version: v1
updated: 2026-06-27
---
# DD-1 — Select content padding parity with DropdownMenu (CAM-232)

## Why

เจ้าของเห็น Sort dropdown (Select) ไฮไลต์ไม่เหมือน Profile menu (DropdownMenu). item class เหมือนกันแล้ว (focus:bg-accent + rounded-xl) แต่ container ต่าง: `DropdownMenuContent` มี `p-1.5` (item inset, pill ลอย) ส่วน `SelectContent` ไม่มี → item ชนขอบ, green pill เต็มแถว มุมชนกรอบ. แก้ให้ parity.

## Story

ในฐานะ **camper/host** ฉันต้องการ **dropdown ทุกชนิดไฮไลต์รายการแบบเดียวกัน (pill ลอย inset)** เพื่อ **UI เป็นตระกูลเดียว**. ขอบเขต: เพิ่ม `p-1.5` ให้ SelectContent + คุม grammar นี้ในเอกสาร.

## AC

| # | Given | When | ผลที่ผู้ใช้เห็น | ผลเชิงข้อมูล/ระบบ |
| -- | -- | -- | -- | -- |
| 1 | เปิด Sort dropdown (และ Select อื่นๆ) | ชี้รายการ | ไฮไลต์เขียวเป็น pill ลอยมีขอบในกรอบ เหมือน Profile menu (ไม่เต็มขอบ) | `SelectContent` มี `p-1.5` เท่ากับ `DropdownMenuContent` |
| 2 | เทียบ Sort กับ Profile menu | ดู | การ inset ของรายการเท่ากัน | grammar parity |

## Rules

* แก้ที่ primitive `components/ui/select.tsx` (systemic) · token-only · ไม่เปลี่ยนพฤติกรรม
* update DESIGN.md §3 dropdown-grammar note ให้รวม "content `p-1.5`" (กัน recurrence — B1 note คุมแค่ item)
* ความต่างที่เหลือ (Select มี check/selected state) = ถูกต้อง ไม่ต้องแก้

## Out of scope

* DropdownMenu/Command (ถูกแล้ว) · item class (A1 ทำแล้ว)

## Self-verify

* SelectContent มี p-1.5 · Sort + Select อื่น inset เหมือน Profile menu · test assert parity · check:ds(blocking)/lint/typecheck/test/build เขียว

## Links

* Epic [CAM-221](https://linear.app/campvibe/issue/CAM-221/ui-consistency-hardening-clear-system-drift-guards-as-governance) · ต่อจาก A1 ([CAM-224](https://linear.app/campvibe/issue/CAM-224/frontend-engineer-a1-dropdown-grammar-fix-calendar-date-cell-breathing)) · select.tsx:72 vs dropdown-menu.tsx:46 · DESIGN.md §3 dropdown grammar
