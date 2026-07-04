---
linear: CAM-301
feature: m1-2-hostos
epic: m1-2-hostos-leads-quotes-os1-os5-os17 (CAM-289)
persona: platform
artifact: story
owner: product-owner
status: Awaiting Gate
version: v1
updated: 2026-07-03
---
# ADR-012 โมเดลข้อมูล HostOS (Lead/Quote/Hold/Deposit/Stay) — G2 (CAM-301)

## Why

M1.2 HostOS เป็น greenfield schema ทั้งชุด (Lead/Quote/QuoteLine/InternalHold/DepositRecord/Stay) ห้ามเขียน migration ก่อนผ่าน G2 มิฉะนั้นเสี่ยงต้องรื้อ schema กลางทางเมื่อ story ถัดไปเริ่ม build จริง. KPI: ไม่มีการ rework schema ของ HostOS หลัง G2 (not measured, ตรวจย้อนหลังตอน retro).

## Story

ในฐานะทีมพัฒนา ฉันต้องการ ADR-012 ที่ owner อ่านและอนุมัติแล้ว เพื่อเริ่ม build ฟังก์ชัน HostOS (Batch B/C ของ wave-1) ได้โดยไม่ต้องรื้อ schema ภายหลัง
Scope: เขียน ADR ตัดสินโมเดลข้อมูล Lead, Quote/QuoteLine, InternalHold, DepositRecord และ Stay (รวมทางเลือกที่ค้างของ CAM-290: ManualStay ใหม่ vs reuse Booking(source=MANUAL)) พร้อมเหตุผลและผลกระทบต่อ availability calculation เดิม. ไม่เขียน migration/code ใดๆ ในใบนี้.

## AC

| # | Given | When | ผลที่ผู้ใช้เห็น | ผลเชิงข้อมูล |
|---|---|---|---|---|
| AC-1 | ADR-012 เปิดเป็น PR รอตรวจอยู่ พร้อมตัวเลือกที่ชัดเจนสำหรับแต่ละโมเดล | owner อ่านและกด approve ใน G2 | PR ถูก merge เข้า docs/adr และ story ticket นี้ผ่าน gate | สถานะ ADR เปลี่ยนเป็น accepted ในไฟล์ docs/adr/ADR-012*.md |

## Rules

- BR-1 ห้าม merge PR ก่อน owner กด approve ใน G2 (ไม่มี auto-approve สำหรับ ADR)
- BR-2 ADR ต้องตัดสินทางเลือกที่ค้างของ CAM-290 (ManualStay ใหม่ vs Booking(source=MANUAL)) อย่างชัดเจน ไม่ปล่อยเป็น TBD
- BR-3 ADR ต้องระบุว่าโมเดลใหม่ทั้งหมดเชื่อมกับการคำนวณที่ว่างเดิม (`lib/campsite-availability.ts`) อย่างไร ไม่ให้เกิด logic คำนวณคู่ขนาน

## Data

- ไม่มี migration/code ในใบนี้ ผลลัพธ์คือเอกสาร ADR เท่านั้น การสร้างโมเดลจริงเกิดในสตอรี่ downstream (Batch B/C) หลัง G2 ผ่านเท่านั้น

## Out of scope

- การ implement schema/migration จริงทุกโมเดล → สตอรี่ backend ที่ระบุ "build หลัง ADR-012 ผ่าน G2" ใน CAM-22, CAM-289, CAM-290, CAM-291, CAM-292

## Self-verify

- [ ] lint N/A (เอกสาร) - [ ] typecheck N/A - [ ] test N/A - [ ] a11y N/A - [ ] design N/A - [ ] security: ยืนยันว่าโมเดลที่เสนอไม่เก็บ PII เกินจำเป็นและสอดคล้อง `.claude/rules/security.md`

## Links

spec: CAM-289 · ADR-012 (ฉบับร่าง) · docs/project/platform-blueprint.md §M1.2 · siblings: `design.md` · `tech.md`

## Changelog

- v1 (2026-07-04) — created
