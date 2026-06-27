---
linear: CAM-229
feature: design-system-v2
epic: ui-consistency-hardening-clear-system-drift-guards (CAM-221)
persona: platform
artifact: story
owner: product-owner
status: Todo
version: v1
updated: 2026-06-27
---
# B3 — ConfirmDialog primitive + migrate hand-rolled confirms (CAM-229)

## Why

destructive confirm (ลบ/ยกเลิก) hand-roll AlertDialog ซ้ำหลายที่ (CampgroundForm, bookings, dashboard/campsites, TeamManagement) → ไม่สม่ำเสมอ + drift เสี่ยง. สร้าง `ConfirmDialog` primitive (catalog B1 mark planned ไว้แล้ว) ให้ reuse.

## Story

ในฐานะ **camper/host** ฉันต้องการ **กล่องยืนยันการลบ/ยกเลิกหน้าตาเหมือนกันทุกที่** เพื่อ **คุ้นมือ ไม่งง**. ขอบเขต: สร้าง ConfirmDialog + migrate ทุกที่ที่ hand-roll AlertDialog confirm.

## AC

| # | Given | When | ผลที่ผู้ใช้เห็น | ผลเชิงข้อมูล/ระบบ |
| -- | -- | -- | -- | -- |
| 1 | กดลบ/ยกเลิกที่ไหนก็ได้ | กล่องยืนยันเปิด | หัวข้อ+คำอธิบาย+ปุ่มยืนยัน/ยกเลิก เลย์เอาต์เดียวกันทุกที่ | ทุกที่ render ผ่าน `ConfirmDialog` (ไม่ hand-roll AlertDialog) |
| 2 | ยืนยันการลบ (destructive) | ดูปุ่มยืนยัน | ปุ่มสื่อว่าเป็นการลบ (destructive) | `ConfirmDialog` รับ prop destructive/variant |
| 3 | ระหว่างกำลังประมวลผล | กดยืนยัน | ปุ่มแสดงสถานะกำลังทำ (disabled/loading) | รับ `isLoading` |

## Rules

* `components/ui/confirm-dialog.tsx` ห่อ AlertDialog ตาม grammar DESIGN.md §3; props: open/onOpenChange/title/description/confirmLabel/cancelLabel/onConfirm/isLoading/destructive · copy ผ่าน i18n (caller ส่ง) · token-only
* migrate: CampgroundForm, bookings/page, BookingDetailClient, dashboard/campsites, TeamManagement (หาให้ครบด้วย grep AlertDialogContent)
* อัปเดต DESIGN.md catalog: ConfirmDialog จาก "(planned)" → มีจริง · guard ต้องไม่ขึ้น violation ใหม่ (blocking แล้ว)

## Out of scope

* AlertDialog ที่ไม่ใช่ confirm (ถ้ามี) · component อื่น

## Self-verify

* ทุก confirm ใช้ ConfirmDialog · ลบ/ยกเลิกทำงานเหมือนเดิม · check:ds เขียว (blocking) · lint/typecheck/test (≥80% บน confirm-dialog)/build เขียว

## Links

* Epic [CAM-221](https://linear.app/campvibe/issue/CAM-221/ui-consistency-hardening-clear-system-drift-guards-as-governance) · B1 catalog (ConfirmDialog planned) · DESIGN.md §3 AlertDialog grammar
