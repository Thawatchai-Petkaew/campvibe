---
linear: CAM-103
feature: atomic-schema
epic: atomic-schema (—)
persona: —
artifact: story
owner: product-owner
status: Done
version: v1
updated: 2026-06-22
---
# S6 Booking snapshot (crystallization) (CAM-103)

## Story

เพื่อให้บันทึกการจองเป็นเอกสารทางการเงินที่ไม่เปลี่ยนย้อนหลัง เพิ่ม snapshot บน Booking (ตาม ADR-005)

## AC

* เพิ่ม snapshot Pixels: price/tax/currency/campName/cancellationPolicy/checkIn-out/tz + source ids (campSiteId/spotId)
* เขียน snapshot ตอน transition → CONFIRMED/PAID
* host แก้ราคา/รายละเอียด → booking เก่า **ไม่เปลี่ยน** (immutability)
* migrate reset+seed เขียว ; verify immutability บน staging
