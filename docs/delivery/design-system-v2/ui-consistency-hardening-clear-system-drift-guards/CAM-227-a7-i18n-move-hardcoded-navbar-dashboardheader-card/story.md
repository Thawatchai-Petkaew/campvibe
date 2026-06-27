---
linear: CAM-227
feature: design-system-v2
epic: ui-consistency-hardening-clear-system-drift-guards (CAM-221)
persona: platform
artifact: story
owner: product-owner
status: Todo
version: v1
updated: 2026-06-27
---
# A7 — i18n: move hardcoded Navbar/DashboardHeader/Card strings to locale (CAM-227)

## Why

เมนูโปรไฟล์ (Navbar) + DashboardHeader + Badge "New" ใช้สตริงอังกฤษ hardcode ไม่ผ่าน i18n → สลับภาษาไม่ได้ + ผิด code.md (copy ต้องอยู่ locale). เก็บกวาดให้ครบ.

## Story

ในฐานะ **camper/host** ฉันต้องการ **เมนูและป้ายทุกที่สลับภาษา TH/EN ได้** เพื่อ **ใช้งานภาษาไทยได้ครบ**. ขอบเขต: ย้าย hardcoded user string → `locales/` + `t.*`.

## AC

| # | Given | When | ผลที่ผู้ใช้เห็น | ผลเชิงข้อมูล/ระบบ |
| -- | -- | -- | -- | -- |
| 1 | สลับเป็นภาษาไทย | เปิดเมนูโปรไฟล์ (Navbar) | "โปรไฟล์ของฉัน / การจองของฉัน / ออกจากระบบ" ฯลฯ เป็นไทย | ใช้ `t.*` ไม่ hardcode |
| 2 | สลับภาษา | ดู DashboardHeader | "โปรไฟล์ของฉัน / ออกจากระบบ" ตามภาษา | `t.*` |
| 3 | สลับภาษา | ดูการ์ดแคมป์ใหม่ | ป้าย "ใหม่/New" ตามภาษา | `t.*` |

## Rules

* reuse key ที่มีอยู่ก่อน (เช่น `t.auth.login`/`t.auth.register` ถ้ามี) → เพิ่มเฉพาะที่ขาด
* Thai copy: plain ไม่มี jargon/em-dash (DESIGN.md §4 / ux.md) · en + th ครบทั้งคู่
* ไม่แตะ /preview (demo) · ไม่แตะ /status/map (internal)

## Out of scope

* string ใน /preview + /status/map · component อื่น

## Self-verify

* เมนู Navbar/DashboardHeader/Badge สลับ TH/EN ถูก · ไม่มี hardcoded user string เหลือในไฟล์เหล่านี้ · lint/typecheck/test/build เขียว · key มีครบ en+th

## Links

* Epic [CAM-221](https://linear.app/campvibe/issue/CAM-221/ui-consistency-hardening-clear-system-drift-guards-as-governance) · code.md i18n rule · sweep i18n list (Navbar 11 + DashboardHeader 2 + CampgroundCard "New")
