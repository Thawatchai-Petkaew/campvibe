---
linear: CAM-187
feature: performance-and-freshness
epic: data-layer-performance-and-freshness (CAM-186)
persona: platform
artifact: story
owner: product-owner
status: In Progress
version: v1
updated: 2026-06-26
---
# MEAS-1 measure baseline (CWV / query / bundle) (CAM-187)

## Why

ต้องมีเลข baseline จริงก่อนแก้ perf (measure-first) — เป็น P0 gate ของทุก optimization. KPI: มีตาราง before/after ที่ทุก cell วัดจริง.

## Story

ในฐานะ platform ฉันต้องการ เครื่องมือวัดความเร็วจริง (โหลดหน้า/เวลา query/ขนาด bundle) + baseline บนชุด 128 ลาน เพื่อ ตัดสิน optimization ด้วยข้อมูลจริงไม่ใช่เดา. ขอบเขต: ติดตั้งเครื่องวัด + ตัวโหลดข้อมูล + เก็บ baseline (ยังไม่แก้ perf จริง).

## AC

| # | Given | When | ผลที่ผู้ใช้เห็น | ผลเชิงข้อมูล |
| -- | -- | -- | -- | -- |
| AC-1 | ผู้ชมเปิดหน้าใดก็ได้ | โหลดหน้าเสร็จ | ไม่เห็นอะไรต่างจากเดิม | ค่าความเร็ว (LCP/INP/CLS) ถูกส่งเก็บในระบบเรา ไม่มีข้อมูลส่วนตัว |
| AC-2 | staging ต้องมีข้อมูลครบ 128 ลาน | รันตัวโหลด | catalog มี 128 ลานจริง | upsert ตาม slug ไม่ลบข้อมูลเดิมทิ้ง |
| AC-3 | เก็บ baseline | รัน Lighthouse + บันทึกเวลา query + แผน query | ได้ตารางเทียบก่อน-หลัง | ทุกช่อง = ตัวเลขที่วัดจริง ห้ามแต่งเลข |

## Rules

telemetry = ตัวฟรีของเราเอง (web-vitals → /api/vitals) ไม่ใช่ Vercel ที่เสียเงิน · บันทึกเวลา query เปิดด้วยสวิตช์ env · ไม่บันทึกข้อมูลส่วนตัว/พารามิเตอร์ · ตัวโหลด idempotent ไม่ลบข้อมูลรวม.

## Data

ไม่มี migration (G2 ตัดสิน: structured JSON log ไม่ใช่ Prisma table — ADR-007).

- schema.prisma diff: none.
- vitals เก็บเป็น structured log (`console.log` JSON → Vercel log drain, 30-day retention) — ไม่มี `WebVital` model.
- loader (`scripts/load-mock-staging.mjs`): upsert 65 hosts by email + 128 camps by `nameThSlug`; ไม่ลบ catalog เดิม.
- ทุก field ใน vitals payload = [Public]; ไม่มี PII/Financial.
- reversible: ไม่มี migration → revert = ลบไฟล์ใหม่ + env var.

## Out of scope

ไม่แก้ perf จริง (= PERF-*/CACHE-1) · ไม่เปิด telemetry แบบเสียเงิน.

## Self-verify

[ ] lint [ ] typecheck [ ] test [ ] build [ ] ตาราง baseline มีเลขวัดจริง

## Links

Research Map §8 · epic [CAM-186](https://linear.app/campvibe/issue/CAM-186/data-layer-performance-and-freshness) · `docs/research/data-layer-architecture.html`
