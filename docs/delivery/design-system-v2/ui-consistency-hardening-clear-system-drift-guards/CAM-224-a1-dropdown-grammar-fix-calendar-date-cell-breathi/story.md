---
linear: CAM-224
feature: design-system-v2
epic: ui-consistency-hardening-clear-system-drift-guards (CAM-221)
persona: platform
artifact: story
owner: product-owner
status: Todo
version: v1
updated: 2026-06-27
---
# A1 — dropdown grammar fix + calendar date-cell breathing room (CAM-224)

## Why

2 ข้อที่เจ้าของชี้: (1) profile dropdown hover ไม่ตรงกับ dropdown อื่น (Navbar override `focus:bg-primary/10` แทน canonical `focus:bg-accent`); (2) calendar วันที่ hover/selected ชิดเลขเกินไป (cell 32px + radius ~26px). แก้ให้ตรง grammar + มีช่องว่าง.

## Story

ในฐานะ **camper/host** ฉันต้องการ **dropdown ทุกตัว hover เหมือนกัน + ปฏิทินเลือกวันอ่านสบายตา** เพื่อ **UI สม่ำเสมอ ใช้ง่าย**. ขอบเขต: ถอด Navbar dropdown override + ปรับ calendar cell.

## AC

| # | Given | When | ผลที่ผู้ใช้เห็น | ผลเชิงข้อมูล/ระบบ |
| -- | -- | -- | -- | -- |
| 1 | เปิดเมนูโปรไฟล์ (Navbar) | ชี้รายการ "Host Dashboard" | ไฮไลต์ hover เหมือนรายการอื่นและเหมือน dropdown จัดเรียง (สีเดียวกัน) | item รับ `focus:bg-accent` จาก primitive (ถอด `focus:bg-primary/10 focus:text-foreground` ที่ Navbar.tsx) |
| 2 | เลือกวันในปฏิทิน (search/booking) | ดูวันที่เลือก/วันนี้ | วงไฮไลต์มีช่องว่างรอบตัวเลข ไม่ชิดจนแน่น | calendar `--cell-size` ใหญ่ขึ้น (~44px ได้ tap target) + radius พอดี |
| 3 | dropdown อื่นทั้งแอป | ชี้รายการ | hover เป็นตระกูลเดียวกัน | ไม่มี consumer override focus state |

## Rules

* ตาม DESIGN.md §3 dropdown grammar (B1) + calendar cell ≥44px tap target (§2) · token-only
* guard report category "raw status/focus" ไม่ควรเพิ่มจากงานนี้

## Out of scope

* focus-ring ของ input (= A4) · component อื่น

## Self-verify

* เปิด Navbar/Sort/calendar บน staging: hover ตรง + ปฏิทินมีช่องว่าง; dark mode; lint/typecheck/test/build/check:ds เขียว; check:ds report ไม่เพิ่ม

## Links

* Epic [CAM-221](https://linear.app/campvibe/issue/CAM-221/ui-consistency-hardening-clear-system-drift-guards-as-governance) · DESIGN.md §3 (B1 dropdown grammar) · Navbar.tsx:226 · calendar.tsx:34
