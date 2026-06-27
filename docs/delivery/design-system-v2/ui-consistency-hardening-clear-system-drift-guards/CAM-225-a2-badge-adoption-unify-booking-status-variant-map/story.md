---
linear: CAM-225
feature: design-system-v2
epic: ui-consistency-hardening-clear-system-drift-guards (CAM-221)
persona: platform
artifact: story
owner: product-owner
status: Todo
version: v1
updated: 2026-06-27
---
# A2 — Badge adoption + unify booking-status variant mapping (CAM-225)

## Why

Badge adoption ~87% — เหลือ raw `<span>` ที่ควรเป็น Badge + **บั๊กจริง:** booking status map 2 ฟังก์ชันให้สีไม่ตรงกัน (CANCELLED = muted ฝั่ง camper / destructive ฝั่ง dashboard) → ผู้ใช้เห็นสีสถานะเดียวกันต่างกันคนละหน้า.

## Story

ในฐานะ **camper/host** ฉันต้องการ **ป้ายสถานะ (Badge) สีเดียวกันทุกหน้า + ป้ายทั้งหมดใช้ component เดียว** เพื่อ **ไม่สับสนเรื่องสถานะการจอง**. ขอบเขต: รวม booking-status→variant เป็น helper เดียว + แปลง raw span เป็น Badge.

## AC

| # | Given | When | ผลที่ผู้ใช้เห็น | ผลเชิงข้อมูล/ระบบ |
| -- | -- | -- | -- | -- |
| 1 | การจองสถานะ "ยกเลิก" (CANCELLED) | ดูทั้งหน้า bookings (camper) และ dashboard | สีป้ายเหมือนกันทั้งสองหน้า | ใช้ helper เดียว (`getBookingStatusMeta`) — เลิก `bookingStatusVariant` ใน dashboard |
| 2 | ป้าย tag/Coming Soon/inline ที่เคยเป็น raw span | ดู | เป็น Badge มาตรฐาน (radius/สไตล์เดียวกัน) | `<span>`→`<Badge variant>` ที่ CampgroundForm, dashboard/settings, FilterModal, CampgroundDetailClient |
| 3 | สถานะการจองทุกค่า (PENDING/CONFIRMED/CANCELLED/COMPLETED) | ดู | สีสื่อความหมายคงเส้นคงวา | mapping เดียว |

## Rules

* canonical mapping = ฝั่ง camper (`getBookingStatusMeta`: PENDING→warning, CONFIRMED→success, CANCELLED→muted, COMPLETED→info) เป็น source เดียว; dashboard import มาใช้
* Badge ใช้ variant ไม่ override สีด้วย className (polish เช่น ring/shadow คงได้)
* token-only

## Out of scope

* Badge ที่มี className polish (ring/shadow) ถ้าไม่ override สี — ไม่ต้องแตะ · color/variant ของ component อื่น (= A4)

## Self-verify

* CANCELLED สีตรงกัน camper+dashboard · ไม่มี raw status span เหลือ (check:ds raw-status-span = 0) · npm test เขียว · lint/typecheck/build/check:ds เขียว

## Links

* Epic [CAM-221](https://linear.app/campvibe/issue/CAM-221/ui-consistency-hardening-clear-system-drift-guards-as-governance) · DS-4 Badge taxonomy ([CAM-124](https://linear.app/campvibe/issue/CAM-124/qa-engineer-ds-4-badge-taxonomy-auth-page-grammar-cleanup)) · getBookingStatusMeta vs bookingStatusVariant
