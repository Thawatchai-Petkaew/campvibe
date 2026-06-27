---
linear: CAM-228
feature: design-system-v2
epic: ui-consistency-hardening-clear-system-drift-guards (CAM-221)
persona: platform
artifact: story
owner: product-owner
status: Todo
version: v1
updated: 2026-06-27
---
# A8 — resolve designer-judgment drift (variants/tokens/accept) to reach guard 0 (CAM-228)

## Why

8 guard instance ที่เหลือ + บางจุดที่ A3 deferred = ต้องการการตัดสินใจ DS (เพิ่ม variant / tokenize / ยอมรับเป็น pattern). ตัดสิน + แก้ให้ guard → ~0 เพื่อ flip blocking ได้สะอาด.

## Story

ในฐานะ **platform** ฉันต้องการ **resolve drift ที่เหลือให้เป็นมาตรฐานชัด (ไม่ใช่ ad-hoc)** เพื่อ **guard เป็น 0 + flip blocking ได้**. ขอบเขต: ตัดสิน + แก้ 5 กลุ่ม.

## AC

| # | Given | When | ผลที่ผู้ใช้เห็น | ผลเชิงข้อมูล/ระบบ |
| -- | -- | -- | -- | -- |
| 1 | ปุ่ม Close แบบ inverse (AmenitiesModal `bg-foreground text-background`) | ดู | ปุ่มเหมือนเดิม/ดีขึ้น แต่มาจาก variant | ใช้ Button variant (เพิ่ม variant หรือใช้ตัวที่มี) ไม่ hardcode สี |
| 2 | ปุ่ม ghost-primary (`text-primary hover:bg-primary/5`) | ดู | hover คงเดิม | resolve เป็น variant หรือ token (เลิก ad-hoc) |
| 3 | icon highlight `bg-primary/10`, `bg-success/10` | ดู | เหมือนเดิม | tokenize เป็น semantic token หรือ accept + allowlist ใน guard |
| 4 | textarea radius / checkbox `rounded-[5px]` / tabs | ดู | เหมือนเดิม | ตัดสิน accept (เป็น intentional ของ primitive) + allowlist |
| 5 | guard | รัน check:ds | report = 0 (หรือเฉพาะ allowlisted) | flip blocking ได้ |

## Rules

* เพิ่ม variant/token เฉพาะที่ DESIGN.md รองรับ + ลง [DESIGN.md/globals.css](<http://DESIGN.md/globals.css>) · ตัวที่ "intentional ของ primitive" → allowlist ใน check-ds.mjs (อย่าบังคับเปลี่ยนถ้าถูกแล้ว)
* เป้า: หลัง A8 + flip, check:ds = 0 violation จริง

## Out of scope

* cards→Card (A6) · component ใหม่

## Self-verify

* check:ds = 0 (หรือ allowlisted ชัดเจน) · ทุกจุดที่แตะ look เดิม + dark mode · lint/typecheck/test/build เขียว

## Links

* Epic [CAM-221](https://linear.app/campvibe/issue/CAM-221/ui-consistency-hardening-clear-system-drift-guards-as-governance) · A3 deferred R5a/R5b · DESIGN.md §2/§3 · DESIGN.md §5 anti-patterns
