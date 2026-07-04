---
linear: CAM-77
feature: discovery-search
epic: camper-discover-search (CAM-33)
persona: camper
artifact: test
owner: qa-engineer
status: Done
version: v1
updated: 2026-06-23
---
# Test — กรองจำนวนผู้เข้าพักตาม capacity จริง (CAM-77)

## AC→test matrix
ทั้งหมดเป็น **unit** test บน where-builder `buildCampSiteWhere` (pure function — assert รูปร่าง `Prisma.CampSiteWhereInput` ที่ผลิต, ไม่ต้องต่อ DB) ไฟล์: `__tests__/campsite-capacity-filter.test.ts`.

| AC | สาระ | ที่ test ครอบ | สถานะ |
|---|---|---|---|
| AC-1 | guests=20 → เห็นเฉพาะลาน ≥20 + ลาน null; ลาน 4 หาย | where.AND มี `{ OR: [{maxGuestsPerDay:{gte:20}}, {maxGuestsPerDay:null}] }` (มี gte arm + null arm; 4-cap ไม่ผ่าน gte) | PASS |
| AC-2 | guests=1 (default) → เห็นลานทั้งหมด | guard `> 0` (โค้ดที่ ship) + กลุ่ม guard เคส 0/ติดลบ/NaN/ว่าง = ไม่กรอง | PASS |
| AC-3 | guests=5 + จังหวัด → เห็นเฉพาะในจังหวัดที่รับ ≥5 | capacity clause coexist กับ `where.location.province` (test "combines with province") | PASS |
| AC-4 | ไม่มีลานตรง → empty + "ล้างการค้นหา" | shape-level: capacity clause ถูกต้อง → ผล array ว่างเป็น behavior ของ Prisma/หน้า (empty-state UI = e2e บน Staging) | PASS (shape) |
| AC-5 | กด "ล้างการค้นหา" → ไม่มี guests → ไม่กรอง | guard เคส `guests` undefined/หายจาก params = ไม่มี capacity clause | PASS |
| AC-6 | guests invalid (ตัวอักษร / ≤0) → เห็นทั้งหมด, ไม่ error | guard เคส "abc"/"0"/"-5"/"" = ไม่มี capacity clause, ไม่ throw | PASS |

## DEFECT-01 (Critical) — Prove-It: null exclusion → red → fixed
QA จับ defect: Prisma `{ maxGuestsPerDay: { gte: N } }` เพียวๆ บน PostgreSQL ตัด row ที่ `maxGuestsPerDay IS NULL` ทิ้งเงียบๆ (`NULL >= N` = `NULL` ไม่ใช่ `TRUE`) → ลานที่ operator ยังไม่ได้ตั้งความจุ **หายจากผล** ขัด AC-1. จัดเป็น Critical (สูญเสีย supply เงียบๆ, ผู้ใช้ไม่รู้ตัว).

กลุ่ม test "null-capacity arm (DEFECT-01)" คือ Prove-It guard ถาวร — fail บนรูปแบบเดิม, pass หลังแก้:

| Case | assert | ผล |
|---|---|---|
| guests positive → มี OR ทั้ง 2 arm | `where.AND` มี `{OR:[...]}` ที่มี **2 arm พอดี**: `{maxGuestsPerDay:{gte:20}}` + `{maxGuestsPerDay:null}` | PASS |
| null arm ต้องอยู่เสมอ (guests=10) | orArms contains `{ maxGuestsPerDay: null }` | PASS |
| **ไม่มี** bare top-level (รูปแบบ bug เดิม) | `where.maxGuestsPerDay === undefined` (ถ้า set top-level จะตัด null) | PASS |

## Keyword composition test (where.OR ต้องไม่ถูกทับ)
DEFECT รองที่กันไว้: capacity clause ต้องไม่ overwrite `where.OR` ของ keyword search.

| Case | assert | ผล |
|---|---|---|
| guests=10 + keyword "เชียงใหม่" | `where.OR` (keyword, มี `nameTh`) ยังอยู่ครบ **และ** capacity OR อยู่แยกใน `where.AND` | PASS |
| keyword-only (ไม่มี guests) | `where.OR` อยู่ + ไม่มี capacity clause ใน AND | PASS |
| guests=5 + taxonomy `access=ROAD_PAVED` | ทั้ง `{options:{some}}` (taxonomy) และ capacity OR coexist ใน `where.AND` ไม่ทับกัน | PASS |

## Guards + boundary + parseInt
- **Guard (ไม่กรอง):** undefined · หายจาก params · "0" · "-5" · "abc" (NaN) · "" → ไม่มี capacity clause, `where.maxGuestsPerDay` undefined.
- **gte boundary:** capacity = guests พอดี (4 vs guests=4) → `4 >= 4` = true (ลานเข้า, inclusive); 4 vs guests=20 → false (ออก); 20 vs guests=2 → true.
- **parseInt leading-int (documented intentional):** "4abc" → 4 (apply), "4.5" → 4 (apply), "abc" → NaN (ไม่ apply).
- **Base preserve:** ทุกเคส `where` ยังมี `{ isActive:true, isPublished:true, deletedAt:null }`.
- รวมกับ filter อื่น: ทำงานร่วม province + price range โดยไม่รบกวนกัน.

## Coverage
- ไฟล์ `__tests__/campsite-capacity-filter.test.ts` = **23 `it` cases** ครอบ AC + DEFECT-01 Prove-It + keyword composition + taxonomy coexist + guards + boundary + parseInt.
- Full suite: **1707 green** (รายงานตอน ship). lint 0 error · typecheck (strict) ผ่าน · build ผ่าน.
- โค้ดใหม่ (step 5 capacity branch ใน `buildCampSiteWhere`) ถูก exercise ทุก branch: gte arm · null arm · ไม่ clobber OR · guards (0/neg/NaN/empty/undefined) · parseInt leading-int. coverage ≥80% gate: MET.
- หมายเหตุ runner: tests assert **shape ของ where-input** (ไม่ต่อ DB); ส่วนที่เป็น DOM/empty-state/URL (AC-4, AC-5 ฝั่ง UI) = verify บน real Staging URL ที่ G4.

## Defects found
- **DEFECT-01 (Critical) — แก้แล้ว:** null-capacity rows ถูกตัดทิ้งจาก `{ gte: N }` เพียวๆ. ส่งกลับให้ backend → fix ด้วย AND-wrapped OR null arm → Prove-It test เขียวถาวร. (role flow: backend → qa จับ → backend fix.)

## Links
`story.md` (AC/Rules) · `tech.md` (where-clause shape) · `.claude/rules/qa.md` · `__tests__/campsite-capacity-filter.test.ts`

## Changelog
- v1 (2026-06-23) — created; 23 unit cases (AC-1..6 + DEFECT-01 Prove-It + keyword composition + guards/boundary/parseInt); full suite 1707 green; DEFECT-01 (Critical, null exclusion) บันทึก red→fixed
