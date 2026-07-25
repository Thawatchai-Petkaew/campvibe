---
artifact: story
feature: ai-location-search
epic: CAM-498 (Place Resolver)
story: landmark (CAM-503, phase P3 — closes the epic)
version: 1
class: M (curated gazetteer + geo reuse; owner-approved plan 2026-07-25)
---

# CAM-503 — P3 Landmark search: parks/areas (เขาใหญ่/ปาย) → curated gazetteer + geo radius

## Story

As a **Camper**, I want "ลานกางเต็นท์เขาใหญ่" / "แคมป์ปาย" to return camps around that famous spot, so that I can search by the place name people actually use — even though เขาใหญ่ is a national park (spanning 4 provinces), not a province and not a camp name.

**Scope:** curated landmark gazetteer (ชื่อ→พิกัด+รัศมี) + resolver ตรวจชื่อ landmark → reuse near-path (P2) ด้วยพิกัด landmark + keyword fallback สำหรับที่ไม่รู้จัก. **ปิด epic CAM-498.**
**Depends on:** CAM-502 (P2 near-path: haversine sort + MAX_NEAR_KM + bbox), CAM-501 (resolver + guard), keyword param (มีอยู่).

Why: "เขาใหญ่" keyword เจอแค่ 5 ลาน (ที่ tag คำนี้) — ลานรอบเขาใหญ่จริง (ปากช่อง/สระบุรี/ปราจีน/นครนายก) ที่ไม่ได้พิมพ์ "เขาใหญ่" หลุด. landmark = พื้นที่ ไม่ใช่จังหวัด → ต้อง gazetteer (พิกัด) + geo radius.

## AC

| # | Given | When | Then (user sees, Thai verbatim) | System effect | Neg/edge |
|---|---|---|---|---|---|
| AC-1 | user พิมพ์ชื่อ landmark ใน gazetteer | "ลานกางเต็นท์เขาใหญ่" | ลานรอบเขาใหญ่ (นครราชสีมา/สระบุรี/ปราจีน/นครนายก) เรียงจากใกล้ landmark | searchCampsites `near="เขาใหญ่"` → gazetteer พิกัด + landmark radius (~40km) → haversine sort | AC-4 |
| AC-2 | landmark + terrain | "ริมน้ำเขาใหญ่" | ลานริมน้ำรอบเขาใหญ่ | near=เขาใหญ่ + terrain=RIVE (AND) | AC-4 |
| AC-3 | landmark ที่**ไม่มี**ใน gazetteer | "แคมป์ดอยม่อนล้าน" (สมมติไม่มี) | keyword fallback (เจอลานที่ tag/ชื่อมีคำนั้น) หรือ honest ถ้าไม่เจอ | keyword search (ไม่ crash, ไม่ mislabel) | AC-4 |
| AC-4 | รอบ landmark ไม่มีลานในรัศมี | proximity landmark 0 ผล | บอกตรงๆ ว่าไม่พบลานแถวนั้น | cards=[] honest | AC-4 = fail ถ้า mislabel |

## Rules

- **BR-1 (gazetteer):** สร้าง `prisma/data/landmark-gazetteer.json` — curated **~20-30 จุดแคมป์ยอดนิยมไทย** (เขาใหญ่, ปาย, เขาค้อ, ดอยอินทนนท์, ภูทับเบิก, ปางอุ๋ง, เขาสก, ดอยอ่างขาง, ภูชี้ฟ้า, สวนผึ้ง, วังน้ำเขียว, ...). แต่ละ entry: `{ id, nameTh, aliases[], lat, lng, radiusKm, kind(park|mountain|town|area) }`. พิกัด curate ให้สมเหตุสมผล (เขาใหญ่ ~14.44,101.37 ฯลฯ). radius ตาม kind (park/mountain ~40, town ~25). validate: lat/lng อยู่ในกรอบไทย, ไม่มี id ซ้ำ.
- **BR-2 (resolver landmark detection):** ขยาย `resolvePlace`/hint ให้ match ชื่อ landmark + aliases จาก gazetteer (reuse DEF-1 boundary guard — ชื่อ landmark ที่สั้น/ชนคำต้อง guard เหมือนจังหวัด) → mode **landmark** → hint บอกโมเดล set `near`=<landmark name>. proximity marker (ใกล้/แถว) ไม่บังคับ (ชื่อ landmark เอง = intent พื้นที่).
- **BR-3 (near-path reuse):** ใน executor การ resolve `near` ลอง **(1) landmark gazetteer ก่อน** (→ พิกัด+รัศมี landmark) **(2) province centroid** (P2 เดิม, →centroid+250km). ใช้ near-path เดิม (bbox+haversine sort+cap+honest empty) — แค่ origin/radius มาจาก gazetteer เมื่อเป็น landmark. ไม่ fork.
- **BR-4 (keyword fallback):** landmark ที่ไม่อยู่ใน gazetteer → โมเดล fallback `keyword` (มี param อยู่แล้ว) — hint/description แนะให้ใช้ keyword เมื่อไม่ใช่จังหวัด/ภาค/landmark ที่รู้จัก. honest ถ้าไม่เจอ.
- **BR-5:** ไม่ PostGIS/external geocoding/dependency · ไม่แตะ Home UI · reuse P2 near-path + P1 guard.

## Edge cases

- **EC-1:** IF landmark คร่อมหลายจังหวัด (เขาใหญ่=4 จว.) THEN geo radius จับข้ามจังหวัดได้ (นี่คือจุดที่ province filter ทำไม่ได้) — sort by distance จากพิกัด landmark.
- **EC-2:** IF ชื่อ landmark ชนคำธรรมดา (เช่น "ปาย" อาจอยู่ในคำอื่น) THEN reuse DEF-1 guard / ต้องเป็น match ที่มั่นใจ (aliases + boundary).
- **EC-3:** IF ทั้ง landmark และ terrain THEN AND.
- **EC-4:** IF gazetteer มี alias ทับกับจังหวัด THEN นิยาม precedence (แนะนำ landmark เมื่อ match ชื่อเฉพาะ; ระวัง "เขาค้อ" ไม่ใช่จังหวัดอยู่แล้ว).

## Data

ไม่มี schema/migration. ใหม่: `prisma/data/landmark-gazetteer.json` (curated). reuse province-centroids + haversine + keyword.

## Seams & refs

- ใหม่: `prisma/data/landmark-gazetteer.json` + `__tests__/cam-503-landmark.test.ts` (+ optional validator).
- `lib/ai/tools/search-campsites.ts` — near resolution: landmark-first then province-centroid; reuse bbox+haversine near-path (P2).
- `lib/ai/place-resolver.ts` — landmark detection + guard (reuse DEF-1).
- `lib/ai/openrouter-client.ts` — landmark hint + keyword-fallback guidance + honest scope (reuse).
- `lib/geo/distance.ts` — haversine (reuse).

## Out of scope

- "ใกล้ฉัน"(GPS) · scope-chip · pgvector · auto-mining landmark list from data (curated ก่อน; miner ทีหลังตาม registry).

## Self-verify

- [x] `node scripts/validate-landmark-gazetteer.mjs` — validate landmark-gazetteer.json: 25 entries (≥20), lat/lng ในกรอบไทย, ไม่มี id ซ้ำ, radiusKm > 0 → "OK — 25 entries, 0 violations"
- [x] `npx vitest run __tests__/cam-503-landmark.test.ts` → 23/23 pass. resolver: เขาใหญ่/ปาย/aliases→landmark near (nearIsLandmark=true) · ไม่รู้จัก→ไม่ false-match (guard, curated ambiguous "ปาย" bare-name skip) · EC-4 precedence over an incidental province mention · executor: near=landmark→พิกัด gazetteer+radius(40km), haversine sort, radius cap, AND terrain, honest empty, unknown→fallback to province-centroid path (EC-2, unaffected)
- [x] golden case: "ลานกางเต็นท์เขาใหญ่"→`searchCampsites{near:"เขาใหญ่"}` (GEO-3) — golden ceilings updated in BOTH cam-457 (58→59) + cam-459 (58→59)
- [x] existing tests เดิมไม่พัง — `npx vitest run __tests__/cam-503-landmark.test.ts __tests__/cam-501* __tests__/cam-502* __tests__/cam-457-eval-harness.test.ts __tests__/cam-459-answer-policy-3-zones.test.ts __tests__/cam-416* __tests__/cam-463*` → 244/244 pass · `npm run typecheck` clean (only a pre-existing, unrelated missing-generated-module error in `lib/delivery/*` — env artifact, not on this story's surface) · `npm run lint` → 0 errors (pre-existing warnings only, none in new code) · `git diff origin/dev --stat` = only the allowed surface
- [ ] **behavioral (orchestrator, cost):** reproduction "ลานกางเต็นท์เขาใหญ่" → ลานรอบเขาใหญ่ (ข้ามจังหวัด) เรียงระยะ + honest — deferred to the orchestrator (real AI call, out of Backend's self-verify budget)
