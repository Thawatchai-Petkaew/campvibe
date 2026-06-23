---
linear: CAM-152
feature: ai-workflow
epic: campsite-delivery-map (CAM-150)
persona: platform
artifact: story
owner: frontend
status: In Progress
version: v1
updated: 2026-06-24
---
# S2 /status/map — ฉากนิ่ง + ตัวละครจากข้อมูลจริง + สกัด sprite (CAM-152)

## Why

S1 วาง shell ไว้แล้ว. S2 ทำให้ `/status/map` แสดงฉากแคมป์กลางคืนจริง: ตัวละคร 7 role + You ยืนตามจุดบนแผนที่ โดย state (กำลังทำงาน/พัก) มาจาก workload จริง (`buildModel`). ยังเป็นภาพนิ่ง (ยังไม่เดิน — เป็นงาน S3). พร้อมสกัด sprite จาก mockup ออกเป็นไฟล์ใน /public (กันงบ JS bundle).

## Story

ในฐานะ **เจ้าของ (platform)** ฉันต้องการ **เห็นฉากแคมป์ที่มีตัวละครแต่ละ role ยืนอยู่ และรู้ว่าใครกำลังทำงาน/ใครว่าง + มีกี่งานรออนุมัติ** เพื่อ **อ่านสถานะทีมได้ในแวบเดียว** — ขอบเขต: ฉากนิ่ง + ตัวละครผูกข้อมูลจริง เท่านั้น.

## AC

| # | Given | When | ผลที่ผู้ใช้เห็น | ผลเชิงข้อมูล/ระบบ |
| -- | -- | -- | -- | -- |
| 1 | มี token ถูกต้อง | เปิด `/status/map` | ฉากกลางคืน + ตัวละคร 7 role + You วางตามจุด (ท่าพัก) | ตัวละคร map จาก role ใน `buildModel` (workload) |
| 2 | role กำลังทำงาน | ดูตัวละครนั้น | เรืองแสง + ป้ายชื่อบอกงานที่ทำ | `rmap[role].active > 0`; งาน = story `isActive` ของ role |
| 3 | role ว่าง | ดูตัวละครนั้น | ท่าพัก ไม่เรืองแสง | `rmap[role].active === 0` |
| 4 | มีงานรออนุมัติ N งาน | ดูตัว You | ป้าย `⚑N` (ซ่อนเมื่อ N=0) | N = `gates.length` |
| 5 | โหลดหน้า | ดู network | ภาพตัวละครมาจาก `/public/status-map/sprites/` ไม่ใช่ base64 ใน bundle | แต่ละไฟล์ < 200KB |

## Rules

* 7 role-station คงที่ + You (port `NODES`/ตำแหน่ง/สี จาก `design/campvibe-campsite.html`)
* role→agent: architect→Architect, ux-designer→Designer, backend-engineer→Backend, frontend-engineer→Frontend, devops-release→DevOps, qa-engineer→QA, security-reviewer→Security, human→You
* sprite สกัดจาก base64 ใน mockup → WebP (ถ้าทำได้) ไม่งั้น PNG, ทุกไฟล์ < 200KB
* ทุกตัวเลข/สถานะ derive จากข้อมูลจริง (anti-slop) — ห้าม hardcode
* ยังไม่มีแอนิเมชัน (S3); reduced-motion ตอนนี้ = นิ่งอยู่แล้ว

## Data

* ไฟล์ใหม่: `public/status-map/sprites/*.webp`; ขยาย `MapModel` (เพิ่ม per-role workload + current task + agent list)

## Out of scope

* แอนิเมชันเดิน/พัก/wander (S3), overlay (S4–S5), real-time/ลิงก์ (S6)

## Self-verify

* `npm run lint` · `npm run typecheck` · `npm run build` เขียว
* sprite ทุกไฟล์ < 200KB, โหลดจาก /public
* ตัวละคร/สถานะตรงกับ workload บน `/status` ของข้อมูลชุดเดียวกัน

## Links

* Parent epic: [CAM-150](https://linear.app/campvibe/issue/CAM-150/campsite-delivery-map-statusmap) · ก่อนหน้า: [CAM-151](https://linear.app/campvibe/issue/CAM-151/frontend-engineer-s1-statusmap-แยก-shared-model-scaffold-route-shell) (S1) · `../feature.md`
* Mockup engine: `design/campvibe-campsite.html` (SPR sprites, NODES/ADJ, AGENTS config)

## Changelog

- v1 (2026-06-24) — story artifact authored from the CAM-152 ticket; S2 built + self-verified on `feature/cam-151-status-map-shared-model`.
