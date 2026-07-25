---
artifact: story
feature: home-search-filters
epic: CAM-487
story: seed-data-diversity (CAM-492)
version: 1
class: M (data/tooling; owner-approved scope "เต็มที่ทุกมิติ" 2026-07-25)
---

# CAM-492 — Seed full campsite data diversity across every filter field

## Story

As a **Camper**, I want Home filters/search to return varied results across provinces, terrain, accommodation, price, and facilities, so that exploring by any filter dimension actually surfaces campsites instead of an empty list.

**Scope:** ขยาย **deterministic mock generator** ให้ข้อมูลหลากหลายครบทุก field ที่ filter ใช้ + regenerate committed data JSON. **ไม่แตะ query/UI** (นั่นคือ CAM-491). **ไม่แตะ schema** (ใช้ field ที่มีอยู่).
**Depends on:** CAM-487 diagnosis (Explore) — root gaps: provinces 10/77, accommodationTypes='TENT' ตายตัว, dead MasterData codes, เพดานราคาต่ำ, หลาย field ว่าง.

Why: filter คืน "ไม่ค่อยมีข้อมูล" ส่วนหนึ่งเพราะ data ไม่หลากหลายพอ — 67 จังหวัดว่าง, ที่พักมีแบบเดียว, filter option หลายตัวไม่มี camp รองรับ.

## AC

| # | Given | When | Then (user sees, Thai verbatim) | System effect | Neg/edge |
|---|---|---|---|---|---|
| AC-1 | ข้อมูล seed ใหม่ | filter จังหวัดใดก็ได้ที่มี camp | เห็นรายการ camp ของจังหวัดนั้น (ไม่ว่าง) | provinces ครอบคลุม **≥60 จาก 77** จังหวัด กระจายทุกภาค (เหนือ/อีสาน/กลาง/ตะวันตก/ตะวันออก/ใต้) | AC-note |
| AC-2 | ข้อมูล seed ใหม่ | filter terrain "beach"/ริมทะเล | เห็น camp ริมทะเลหลายที่ | terrain BEAC ≥25 camps กระจายจังหวัดชายทะเล (กระบี่/ภูเก็ต/ตราด/สุราษฎร์/ชุมพร/ประจวบ/สงขลา ฯลฯ) | AC-note |
| AC-3 | ข้อมูล seed ใหม่ | เลือก filter option ใดก็ได้ที่ UI แสดง (facility/activity/access/equipment/terrain) | ผลลัพธ์ ≥1 camp | **ทุก MasterData code ที่เป็น filter option มี ≥1 camp** (ปิด dead codes: WATE/CART/MIMT/LSTV/OFFR + ตัวที่เหลือ) | AC-3 = code ใดมี 0 = fail |
| AC-4 | ข้อมูล seed ใหม่ | filter ราคาช่วงสูง (เช่น >3,000) | เห็น camp ระดับพรีเมียม | priceLow/priceHigh กระจายจนถึงพรีเมียม (เพดาน ≥ ~15,000 บ้าง) — ไม่กระจุกใต้ 2,350 | AC-note |
| AC-5 | ข้อมูล seed ใหม่ | มองข้อมูล camp/spot | field ที่เคยว่างมีค่า | accommodationTypes หลากหลาย (ไม่ใช่ TENT อย่างเดียว), pricePerSite/cancellationPolicy/extraFee*/externalFacilities/nearFacilities มีค่ากระจาย, minimumAge หลากหลาย | AC-note |

> **AC-note:** deliverable นี้เป็น generator + committed data — ตรวจที่ **diversity counts** (script/self-verify) ไม่ใช่ UI โดยตรง. การเห็นผลบน Home ต้องโหลดข้อมูลเข้า DB (ops step หลัง merge) + CAM-491 (tabs) + CAM-493 (test) เป็นตัวยืนยัน end-to-end.

## Rules

- **BR-1:** ขยาย generator เดิม `scripts/gen-mock-data.mjs` (deterministic mulberry32 — คง reproducibility, ห้ามใช้ Math.random). เพิ่มจำนวน/ความหลากหลาย camps ให้ครอบคลุมเป้าใน AC. Regenerate committed JSON (`prisma/data/mock-staging.json` + re-merge เป็น `mock-staging-all.json` ผ่าน `scripts/merge-mock-data.mjs`). อ่าน mechanic การ merge ก่อน (80-set source อาจไม่ committed — ถ้าเป็นเช่นนั้น ให้ generator ตัวเดียวครอบคลุมเป้าทั้งหมด แล้ว document การ regenerate).
- **BR-2 (provinces):** ใช้ `prisma/data/thailand-locations.json` (77 จังหวัด verified) + `lib/thai-regions.ts` (6-ภาค rollup) ขยาย PROV map (ปัจจุบัน 10) ให้ครอบคลุม **≥60 จังหวัด ทุกภาค** — terrain/tags สมจริงต่อภาค (ใต้→beach, เหนือ→ภูเขา/หมอก, อีสาน→ที่ราบสูง, กลาง/ตะวันตก→แม่น้ำ/เขื่อน/ป่า).
- **BR-3 (every filter option backed):** อ่าน MasterData codes ที่เป็น filter option จาก `prisma/seed.ts` (groups: Campground type, Terrain, Internal/External facility, Equipment for rent, Activity, Access type). **ทุก code ต้องมี ≥1 camp** — ปิด dead codes ที่ diagnosis ระบุ (WATE, CART, MIMT, LSTV, OFFR) และตัวอื่นที่ยัง 0.
- **BR-4 (accommodation + price):** accommodationTypes หลากหลาย (อ่าน code จริงจาก MasterData/schema — ไม่ hard-code 'TENT' ตัวเดียว). ราคา: กระจาย priceLow/priceHigh/spot pricePerNight/pricePerSite จนถึงระดับพรีเมียม (glamping/rimtalay หรูมีจริง) — เพดานสูงขึ้นชัดเจน.
- **BR-5 (fill empty fields):** populate field ที่ generator เคยเว้น — `pricePerSite` (Spot), `cancellationPolicy`, `extraFeeAmount`+`extraFeeLabel`, `externalFacilities` (เติมให้ครบ ไม่เว้น 44%), `nearFacilities` (ขยายเกิน 4 codes), `minimumAge` (หลากหลายไม่กระจุก 0). ใช้ค่าที่สมเหตุสมผล + deterministic.
- **BR-6 (no regression):** ห้ามลด diversity เดิม (beach/tags/petFriendly ต้องคงหรือดีขึ้น). ข้อมูลยัง idempotent-loadable ผ่าน `scripts/load-mock-staging.mjs` (upsert, no deleteMany). ห้ามแตะ `campsite-filters.ts`/UI/schema/prisma migration.

## Edge cases

- **EC-1:** IF 80-set source (`mock-staging-80.json`) ไม่ committed THEN อย่าพึ่งมัน — generator หลัก (48-curated) ต้องขยายให้ครอบคลุมเป้าเอง; document วิธี regenerate ใน commit/spec.
- **EC-2:** IF MasterData code ใดไม่มีใน `seed.ts` THEN อย่าอ้างอิง code ที่ไม่มีจริง (filter option มาจาก MasterData ที่ seed ไว้).
- **EC-3:** IF re-run generator THEN ผลเหมือนเดิมทุกครั้ง (seeded PRNG) — counts เท่ากัน.
- **EC-4:** IF จังหวัด/ภาคใดไม่มีใน thailand-locations.json THEN ข้าม (ใช้เฉพาะ 77 ที่ verified).

## Data

ไม่มี migration. ใช้ field เดิมของ `CampSite`/`Spot`/`Location` + MasterData relation. Regenerate committed JSON เท่านั้น.

## Seams & refs

- `scripts/gen-mock-data.mjs` — generator หลัก (PROV map ~L29-40, themes, hard-coded 'TENT' ~L287, nearFacilities facBase ~L257) — ขยาย.
- `scripts/merge-mock-data.mjs` · `scripts/load-mock-staging.mjs` (loader → staging, upsert) — reuse/regenerate path.
- `prisma/data/thailand-locations.json` (77 provinces) · `lib/thai-regions.ts` (region rollup) — province source.
- `prisma/seed.ts` — MasterData codes + groups (source of truth ของ filter options; อ่านเพื่อ back ทุก code).
- `prisma/schema.prisma` — CampSite/Spot/Location field shapes (accommodationTypes, pricePerSite, cancellationPolicy, extraFee*, nearFacilities, minimumAge).
- diagnosis: Explore agent 3 (field-by-field coverage table) — เป้าหมาย gap.

## Out of scope

- ไม่แตะ query builder / UI / tabs (CAM-491) · ไม่เขียน filter-coverage test (CAM-493 — QA) · ไม่ load เข้า live DB (ops step หลัง merge) · ไม่แตะ schema.

## Self-verify

- [ ] `node scripts/gen-mock-data.mjs` + merge → regenerate สำเร็จ, deterministic (rerun → counts เท่ากัน)
- [ ] province count script → **≥60** distinct provinces, ทุกภาค non-empty
- [ ] terrain BEAC ≥25 camps; ทุก MasterData filter code มี ≥1 camp (list code→count, ไม่มี 0)
- [ ] accommodationTypes distinct ≥3; priceHigh max ≥ ~15,000; pricePerSite ไม่ null; externalFacilities ไม่มี blank; nearFacilities distinct >4; minimumAge distinct ≥4
- [ ] `mock-staging-all.json` parse ผ่าน + โครงสร้างตรง loader expectation (spot check โหลด dry-run ถ้าทำได้โดยไม่แตะ DB จริง)
- [ ] ไม่มี diff นอก `scripts/*` + `prisma/data/*.json` (+ this story.md)
