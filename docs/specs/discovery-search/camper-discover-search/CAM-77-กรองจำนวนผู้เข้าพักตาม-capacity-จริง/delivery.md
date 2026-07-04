---
linear: CAM-77
feature: discovery-search
epic: camper-discover-search (CAM-33)
persona: camper
artifact: delivery
owner: devops-release
status: Done
version: v1
updated: 2026-06-23
---
# Delivery — กรองจำนวนผู้เข้าพักตาม capacity จริง (CAM-77)

## PR & preview
- PR: [#104](https://github.com/Thawatchai-Petkaew/campvibe/pull/104) → base `staging` (merged)
- Preview: Vercel ephemeral preview (auto-comment บน PR)
- Quality-gate (pre-PR): lint 0 error · typecheck (strict) ผ่าน · test **1707 pass** (capacity branch ครอบ ≥80% โค้ดใหม่) · build ผ่าน · `npm audit --omit=dev` 0 high/critical · design gate **N/A** (ไม่มี UI ใหม่ — แก้ที่ where-builder อย่างเดียว)

## Migration
- **None** — `CampSite.maxGuestsPerDay` มีใน schema อยู่แล้ว; การแก้เป็น query-shape ใน `lib/campsite-filters.ts` + ส่ง `guests` ผ่านจาก `app/page.tsx`. ไม่ต้อง `prisma migrate`; staging/prod DB ไม่เปลี่ยน.

## Staging verify (G4) ✅
- Verified บน real Staging URL (`campvibe-staging.vercel.app`): ค้นหาโดยใส่ param `guests` แล้วผลถูกกรองตาม capacity จริง — ลานที่ `maxGuestsPerDay` น้อยกว่าที่ระบุหายจากผล ขณะที่ลานที่ความจุไม่ระบุ (null) ยังคงปรากฏ (ยืนยัน DEFECT-01 fix). CAM-77 state → **Done**.
- ส่วน DOM/UI ที่เหลือ (empty-state "ไม่พบลานแคมป์" + ปุ่ม "ล้างการค้นหา" ของ AC-4/AC-5) = สังเกตบน Staging URL; logic การกรองครอบด้วย unit test แล้ว.

## Release (G5)
- **pending** — promote `staging`→`main` หลัง G5 approval (release train รวมกับ story อื่นที่ Done ได้).
- Rollback plan: ไม่มี migration → **rollback = revert PR #104** (กลับ where-builder + การส่ง guests). ปลอดภัย, ไม่มี data change ให้ย้อน.
- Tag + changelog: ออกตอน promote prod (ยังไม่ทำ).

## Error watch
- pending — เฝ้า Sentry ตาม watch window หลัง promote prod (ยังไม่ถึง G5).

## Links
`story.md` (AC/Rules) · `tech.md` (where-clause shape, DEFECT-01) · `test.md` (Prove-It) · `.claude/rules/ops.md` · `lib/campsite-filters.ts` · `app/page.tsx`

## Changelog
- v1 (2026-06-23) — created; PR #104 → staging merged, gate green (1707 tests), no migration, G4 verified บน Staging (Done), G5 pending (rollback = revert PR)
