---
linear: CAM-230
feature: design-system-v2
epic: ui-consistency-hardening-clear-system-drift-guards (CAM-221)
persona: platform
artifact: story
owner: product-owner
status: Todo
version: v1
updated: 2026-06-27
---
# B4 — Playwright visual regression (/preview) + axe a11y CI (advisory) (CAM-230)

## Why

grep guard จับ structural drift ไม่ได้ทุกอย่าง — visual/spacing drift ข้าม session ต้องมี "mechanical reviewer". เพิ่ม Playwright visual snapshot บน /preview + axe a11y = ด่านสุดท้ายของกลไก consistency (research). non-blocking ก่อน (route diff ไป review ไม่ hard-fail ทุก pixel).

## Story

ในฐานะ **platform** ฉันต้องการ **ระบบจับ visual/a11y drift อัตโนมัติ** เพื่อ **ความเปลี่ยนแปลงหน้าตา/a11y ถูกเห็นก่อน merge**. ขอบเขต: ตั้ง Playwright + axe + CI job (advisory).

## AC

| # | Given | When | ผลที่ผู้ใช้เห็น | ผลเชิงข้อมูล/ระบบ |
| -- | -- | -- | -- | -- |
| 1 | หน้า /preview (kitchen-sink) | รัน visual test | (CI artifact) | Playwright `toHaveScreenshot` มี baseline; diff = artifact |
| 2 | /preview | รัน axe | (CI) | `@axe-core/playwright` รายงาน a11y violations |
| 3 | เปิด PR | CI | (checks) | job e2e/visual = **advisory (non-blocking)** ไม่ทำ merge gate พัง |

## Rules

* dev dep ฟรี: `@playwright/test` + `@axe-core/playwright` (ไม่มีค่าเงิน) · `playwright.config.ts` + tests ใน `e2e/`
* CI job ใหม่ `continue-on-error: true` (advisory) — build+start app, รัน, upload report/diff เป็น artifact; **อย่าให้ pixel diff ข้าม-OS ทำ quality-gate พัง**
* baseline: generate + document วิธี update (`--update-snapshots`); ถ้า cross-OS ยุ่งยากเกินไป → visual local-only + axe ใน CI + document (รายงานตรงๆ)
* ไม่แตะ app/component code (infra/test เท่านั้น) · check:ds ต้องเขียว (e2e/ ไม่อยู่ใน scan)

## Out of scope

* ทำ visual blocking (อนาคต เมื่อ baseline เสถียร) · หน้าอื่นนอก /preview (เริ่มที่ /preview ก่อน)

## Self-verify

* `npx playwright test` รันได้ local (visual + axe) · CI job advisory ไม่บล็อก merge · check:ds/lint/typecheck/build/test เดิมเขียว · npm audit ไม่มี high/critical จาก dep ใหม่

## Links

* Epic [CAM-221](https://linear.app/campvibe/issue/CAM-221/ui-consistency-hardening-clear-system-drift-guards-as-governance) · research best-practice (VRT + axe, non-blocking) · /preview kitchen-sink
