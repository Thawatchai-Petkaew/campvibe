---
linear: CAM-223
feature: design-system-v2
epic: ui-consistency-hardening-clear-system-drift-guards (CAM-221)
persona: platform
artifact: story
owner: product-owner
status: Todo
version: v1
updated: 2026-06-27
---
# B2 — consistency guards (report mode) for all drift categories + generalize modal test (CAM-223)

## Why

grep guard เดิม (check-ds/check-palette) จับ "string ต้องห้าม" แต่ไม่จับ "role/structural drift" (radius นอก role, shadow tier, ปุ่มสี override, hand-rolled แทน reuse) → drift ~100 จุดหลุดมาได้. ทำ guard ครอบทุกหมวด = กลไกหลักกัน recurrence (research: machine check > prose). เริ่ม report mode เพื่อให้ Phase A เคลียร์ก่อน แล้วค่อย flip blocking.

## Story

ในฐานะ **platform** ฉันต้องการ **guard อัตโนมัติที่จับ consistency drift ทุกหมวด** เพื่อ **drift ใหม่ถูกจับใน CI ไม่หลุดไป prod (กัน recurrence ถาวร)**. ขอบเขต: ขยาย check-ds.mjs (report mode) + generalize modal test.

## AC

| # | Given | When | ผลที่ผู้ใช้เห็น | ผลเชิงข้อมูล/ระบบ |
| -- | -- | -- | -- | -- |
| 1 | มี drift หมวดต่างๆ ใน consumer (radius นอก role, shadow-xl, text-[Npx], focus ring hardcode, ปุ่มสี override, raw status span, inline h บนปุ่ม, DialogContent ไม่ใช้ modal-shell) | รัน check:ds | (CLI) | รายงานทุกหมวด + count แต่ exit 0 (report mode) |
| 2 | เพิ่ม modal ตัวใหม่ที่ไม่ใช้ modal-shell | รัน test | (CLI) | modal test (scan ทั้ง dir) fail — ไม่ผูกกับ list ตายตัว |
| 3 | guard เดิม (tabler/!h-/rounded-[Npx]) | รัน | (CLI) | ยัง blocking เหมือนเดิม |

## Rules

* หมวดใหม่ = **report mode** (warn + count, exit 0) จนกว่า Phase A เคลียร์หมด แล้วค่อย flip blocking (story แยก)
* ไม่รวม i18n-string guard (false-positive สูง — A7 แก้ของจริง + reuse rule/review คุม)
* exclude `app/status/map/**` + `components/ui/**` (primitive internals) + `/preview` ตามเดิม
* ไม่แตะ component code (งานนี้ tooling/test)

## Data

ไม่มี migration · แก้ scripts/check-ds.mjs + test file

## Out of scope

* flip blocking (= story แยกหลัง Phase A) · การแก้ drift จริง (= Phase A)

## Self-verify

* check:ds รันได้ report ทุกหมวด + count ตรงกับ sweep (~radius 25, color/variant 33, ฯลฯ) · exit 0 · guard เดิมยัง fail เมื่อเจอ tabler/!h- · modal test scan ทั้ง dir · npm test เขียว

## Links

* Epic [CAM-221](https://linear.app/campvibe/issue/CAM-221/ui-consistency-hardening-clear-system-drift-guards-as-governance) · sweep inventory · scripts/check-ds.mjs (DS-6/[CAM-126](https://linear.app/campvibe/issue/CAM-126/devops-release-ds-6-consistency-ci-guard-lock-in-ds-grammar)) · [CAM-220](https://linear.app/campvibe/issue/CAM-220/frontend-engineer-modal-1-unify-modal-header-into-one-shared-shell) modal test
