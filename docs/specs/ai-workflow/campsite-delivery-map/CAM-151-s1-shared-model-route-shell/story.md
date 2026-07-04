---
linear: CAM-151
feature: ai-workflow
epic: campsite-delivery-map (CAM-150)
persona: platform
artifact: story
owner: frontend
status: In Progress
version: v1
updated: 2026-06-24
---
# S1 /status/map — แยก shared model + scaffold route shell (CAM-151)

## Why

ทั้ง `/status` และหน้าใหม่ `/status/map` ต้องใช้ `buildModel` + types เดียวกัน. วันนี้ `buildModel` เป็น local function ใน `app/status/page.tsx` (export ไม่ได้). S1 แยกมันออกเป็น `lib/status-model.ts` ที่ import ได้ทั้งสองหน้า แล้ว scaffold route shell ของ `/status/map` (ยังไม่มีฉาก/overlay) เพื่อปลดบล็อก S2–S7. เป็นด่านฐานราก (refactor ปลอดภัย + โครงว่าง).

## Story

ในฐานะ **เจ้าของ (platform)** ฉันต้องการ **route** `/status/map` **ที่เปิดได้ด้วย token เดียวกับ** `/status` **และ** `/status` **ยังทำงานเหมือนเดิมทุกอย่าง** เพื่อ **มีฐานให้สร้างฉากแคมป์ต่อโดยไม่กระทบหน้าเดิม** — ขอบเขต: แยก model ร่วม + โครง route เปล่า เท่านั้น.

## AC

| # | Given | When | ผลที่ผู้ใช้เห็น | ผลเชิงข้อมูล/ระบบ |
| -- | -- | -- | -- | -- |
| 1 | มี token ที่ถูกต้อง | เปิด `/status` | หน้าเหมือนเดิมทุกอย่าง ไม่มีอะไรเปลี่ยน | `buildModel` ย้ายไป `lib/status-model.ts`; `page.tsx` import แทน; output เดิมไม่เปลี่ยน |
| 2 | มี token ที่ถูกต้อง | เปิด `/status/map?token=...` | เห็นพื้นหลังฉากกลางคืน + ข้อความกำลังโหลด (โครงเปล่า) ไม่มี error | route ใหม่ตอบ 200; ดึงข้อมูลด้วย `fetchStatusIssues`+`buildModel` ฝั่ง server |
| 3 | ไม่มี token หรือ token ผิด | เปิด `/status/map` | ถูกปฏิเสธเหมือนหน้า `/status` | token gate parity กับ `/status` |

## Rules

* `lib/status-model.ts` = pure move ของ `buildModel`/`Model`/`EpicNode`/`groupBy` + helpers (`epicOf`/`personaOf`/`featureOf`/`isActive`/`isDone`/`hasAwait`) จาก `page.tsx` บรรทัด 16–187 — ห้ามเปลี่ยน logic
* `/status` ต้อง render เหมือนเดิมเป๊ะ (pure-move regression)
* token gate ใช้ `STATUS_TOKEN` เหมือน `page.tsx` (บรรทัด ~464–469)
* scene component mount แบบ `next/dynamic({ ssr:false })` (ยังเป็น stub)
* หน้านี้เป็น internal ops dashboard — exempt จาก public OKLCH token เหมือน `/status` (CSS อยู่ใน `campsite-assets.ts`)

## Data

* ไม่มี schema/migration. ไฟล์ใหม่: `lib/status-model.ts`, `app/status/map/page.tsx`, `app/status/map/campsite-assets.ts`, `app/status/map/scene-loader.tsx`, `app/status/map/campsite-scene.tsx` (stub)

## Out of scope

* ฉาก/ตัวละคร/แอนิเมชัน (S2–S3), overlay (S4–S5), real-time/ลิงก์ (S6), a11y/perf gate (S7)

## Self-verify

* `npm run lint` · `npm run typecheck` · `npm run build` เขียว
* `/status` render เหมือนเดิม (เทียบ HTML diff = ว่าง)
* `/status/map?token=` = 200 + shell; ไม่มี token = ปฏิเสธ

## Links

* Parent epic: [CAM-150](https://linear.app/campvibe/issue/CAM-150/campsite-delivery-map-statusmap) · `../feature.md`
* Plan: `~/.claude/plans/status-delightful-map.md`
* Reuse: `app/status/page.tsx` (buildModel, token gate) · `lib/status-derive.ts` · `lib/linear.ts`

## Changelog

- v1 (2026-06-24) — story artifact authored from the CAM-151 ticket; S1 built + self-verified on `feature/cam-151-status-map-shared-model`.
