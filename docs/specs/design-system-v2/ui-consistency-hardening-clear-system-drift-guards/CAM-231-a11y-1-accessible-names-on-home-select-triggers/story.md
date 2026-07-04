---
linear: CAM-231
feature: design-system-v2
epic: ui-consistency-hardening-clear-system-drift-guards (CAM-221)
persona: platform
artifact: story
owner: product-owner
status: Todo
version: v1
updated: 2026-06-27
---
# A11Y-1 — accessible names on home Select triggers (CAM-231)

## Why

B4 mechanical reviewer (axe) เจอบั๊กจริงบนหน้าแรก: Select trigger (combobox button) ไม่มี accessible name → axe `button-name` critical (WCAG 2.1 AA fail) → screen reader อ่านปุ่มไม่รู้ว่าคืออะไร. แก้โดยใส่ aria-label.

## Story

ในฐานะ **ผู้ใช้ screen reader** ฉันต้องการ **ปุ่มเลือก (sort/filter) บนหน้าแรกมีชื่อที่อ่านออก** เพื่อ **รู้ว่าปุ่มทำอะไร**. ขอบเขต: ใส่ aria-label ให้ Select trigger ที่ขาดบนหน้า `/`.

## AC

| # | Given | When | ผลที่ผู้ใช้เห็น | ผลเชิงข้อมูล/ระบบ |
| -- | -- | -- | -- | -- |
| 1 | ผู้ใช้ screen reader บนหน้าแรก | โฟกัสปุ่มจัดเรียง/ตัวเลือก | อ่านชื่อปุ่มได้ (เช่น "จัดเรียงตาม") | SelectTrigger มี `aria-label` (จาก i18n) |
| 2 | axe scan หน้า `/` | รัน | ไม่มี `button-name`/`select-name` critical | 0 critical/serious |

## Rules

* aria-label จาก i18n (`t.*`) ไม่ hardcode · ครอบ Select trigger ที่ขาดทั้งหมดบน home/search surface (SortDropdown + อื่นๆ ถ้ามี)
* ไม่เปลี่ยน visual

## Out of scope

* Select ในหน้าอื่น (ถ้า axe ไม่ flag) · B4 advisory polish (DB env/baseline)

## Self-verify

* SortDropdown + home selects มี aria-label · (ถ้ารันได้) e2e a11y `/` ไม่มี critical · lint/typecheck/test/build/check:ds เขียว

## Links

* Epic [CAM-221](https://linear.app/campvibe/issue/CAM-221/ui-consistency-hardening-clear-system-drift-guards-as-governance) · B4 axe finding (button-name on `.bg-input/50` combobox) · [ux.md/DESIGN.md](<http://ux.md/DESIGN.md>) a11y
