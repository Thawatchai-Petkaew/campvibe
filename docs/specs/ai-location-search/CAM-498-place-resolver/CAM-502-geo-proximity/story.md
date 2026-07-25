---
artifact: story
feature: ai-location-search
epic: CAM-498 (Place Resolver)
story: geo-proximity (CAM-502, phase P2)
version: 1
class: M (geo feature; owner-approved defaults 2026-07-25)
---

# CAM-502 — P2 Geo proximity: "ใกล้/แถว X" returns camps near a province, sorted by distance

## Story

As a **Camper**, I want "ลานกางเต็นท์ใกล้กรุงเทพ" / "แคมป์แถวโคราช" to return camps NEAR that province (not only exactly in it), sorted nearest-first, so that I can find weekend-trip camps around a city — for any province, from the data we already have (camp lat/lng), no per-province hardcoding.

**Scope:** เพิ่ม `near` param + resolve province centroid (จาก lat/lng ของลานเอง, build-step JSON) + haversine sort; extend Place Resolver ให้แยก "ใกล้/แถว X"(proximity) จาก "ใน X"(exact). **ไม่ทำ landmark** (P3).
**Depends on:** CAM-501 (Place Resolver P1 + hint), lib/geo/distance.ts (haversine), CAM-427 (card select).

Why: "ใกล้กรุงเทพ" ≠ "ในกรุงเทพ" (กรุงเทพ 4 ลาน แต่รอบๆ ~60: นครนายก/กาญจน์/สระบุรี/ราชบุรี...). วันนี้ค้นได้แค่ exact province; proximity ยังไม่มี (distance util มีแต่ไม่ได้ต่อเข้า search). ทุกลานมี lat/lng จริง 475/475.

## AC

| # | Given | When | Then (user sees, Thai verbatim) | System effect | Neg/edge |
|---|---|---|---|---|---|
| AC-1 | user พิมพ์ "ใกล้/แถว + จังหวัด" | "ลานกางเต็นท์ใกล้กรุงเทพ" | เห็นลานรอบกรุงเทพ (นครนายก/กาญจน์/...) **เรียงจากใกล้ไปไกล** + ผู้ช่วยบอกว่าค้นแบบ "ใกล้กรุงเทพ" | searchCampsites ด้วย `near="กรุงเทพ"` → centroid + haversine sort | AC-4 |
| AC-2 | "ใกล้ X" + terrain | "ริมน้ำใกล้โคราช" | ลานริมน้ำรอบโคราช เรียงระยะ | near=โคราช + terrain=RIVE (AND) | AC-4 |
| AC-3 | "ใน X" (exact) — คง P1 | "ในกรุงเทพ" | เฉพาะกรุงเทพ (4) | province="Bangkok" (ไม่ใช่ near) — resolver แยกถูก | — |
| AC-4 | รอบ X ไม่มีลานในรัศมี | proximity ที่ไม่มีผล | บอกตรงๆ ว่าไม่พบลานใกล้ที่นั่น | cards=[] honest (ไม่ mislabel) | AC-4 = fail ถ้า mislabel |

> **default (locked):** "ใกล้X" **รวมลานใน X ด้วย** + เรียงระยะจากน้อยไปมาก · cap รัศมี ~250km (tunable const) กันหลุดไกลเกิน "ใกล้"

## Rules

- **BR-1 (centroid build-step):** script (เช่น `scripts/build-province-centroids.mjs`) คำนวณ centroid ต่อจังหวัด = ค่าเฉลี่ย lat/lng ของลานในจังหวัดนั้น → committed JSON (`prisma/data/province-centroids.json`, key = provinceNameEn). deterministic, regeneratable. **sparse guard:** จังหวัดที่ลาน < 2 → centroid ไม่น่าเชื่อ; mark/skip (fallback: proximity ใช้ไม่ได้กับจังหวัดนั้น → resolver คืน exact หรือ honest).
- **BR-2 (`near` param + geo path):** เพิ่ม `near: z.string().optional()` ใน searchCampsites (ชื่อจังหวัดไทย/อังกฤษ; Thai→English resolve เดิม). ใน executor เมื่อ `near` set:
  - lookup centroid ของ near จาก JSON. ถ้าไม่มี centroid (sparse/unknown) → fallback exact `province` filter + note (ไม่ crash).
  - bbox pre-filter ใน Prisma where (lat/lng ระหว่างช่วงที่คำนวณจากรัศมี) → candidates
  - **haversine sort** (lib/geo/distance.ts) ระยะจาก centroid ↑ + cap รัศมี (drop > MAX_NEAR_KM ~250) → take page-size
  - AND กับ filter อื่น (terrain ฯลฯ) ผ่าน where เดิม (ADR-009 — bbox เป็น where extension ไม่ fork; haversine sort เป็น post-process บน candidate เดียวกัน). cap candidate count ก่อน sort (CAM-344 บทเรียน).
- **BR-3 (Place Resolver extension):** ขยาย `resolvePlace`/hint (CAM-501) ให้ตรวจ **preposition proximity** (ใกล้/แถว/รอบๆ/ย่าน/บริเวณ + ชื่อจังหวัด) → mode **proximity** → hint บอกโมเดล "ผู้ใช้ต้องการลาน**ใกล้** X — เซ็ต `near`=X (ไม่ใช่ province)". "ใน X"/"X เฉยๆ" → exact `province` (คงเดิม). ระวัง false-match เดียวกับ DEF-1 (ใช้ guard เดิม).
- **BR-4 (honest scope):** ผู้ช่วยบอกว่าค้นแบบ proximity ("ใกล้กรุงเทพ") ในคำตอบ; 0 ผล → honest. (ต่อยอด CAM-501 BR-3.)
- **BR-5:** ไม่แตะ landmark (P3) · ไม่เพิ่ม PostGIS/external geocoding/dependency (haversine ในแอปเท่านั้น) · ไม่แตะ Home UI.

## Edge cases

- **EC-1:** IF near จังหวัดที่มี centroid THEN sort by distance; รวมลานในจังหวัดนั้น (distance เล็ก → ขึ้นก่อน).
- **EC-2:** IF near จังหวัด sparse/ไม่มี centroid THEN fallback exact province หรือ honest — ไม่ crash, ไม่คืนมั่ว.
- **EC-3:** IF ทั้ง near และ province ถูกส่ง THEN นิยาม precedence ชัด (แนะนำ near ชนะเมื่อ proximity intent) — document.
- **EC-4:** IF candidate เยอะ THEN cap ก่อน haversine (perf, CAM-344) — bbox จำกัดแล้ว + hard cap.
- **EC-5:** IF "ใกล้ฉัน/แถวนี้" (ไม่มีจังหวัด, ต้องพิกัด user) THEN out of scope P2 (ไม่มี IP-geo) — resolver ไม่ set near, ตอบขอจังหวัด.

## Data

ไม่มี schema/migration. ใหม่: `prisma/data/province-centroids.json` (derived). ใช้ CampSite.latitude/longitude (มีครบ 475/475) + haversine util.

## Seams & refs

- ใหม่: `scripts/build-province-centroids.mjs` + `prisma/data/province-centroids.json` + `__tests__/cam-502-geo-proximity.test.ts`.
- `lib/ai/tools/search-campsites.ts` — เพิ่ม `near` param + executor geo path (bbox where + haversine sort). reuse `resolveProvinceForSearch`, `buildCampSiteWhere`, card select.
- `lib/geo/distance.ts` — `haversineDistanceKm` (reuse; BANGKOK_ORIGIN เป็น constant เดิม แต่ centroid มาจาก JSON ต่อจังหวัด ไม่ hardcode Bangkok).
- `lib/ai/place-resolver.ts` (CAM-501) — extend proximity detection + hint.
- `lib/ai/openrouter-client.ts` — hint block (proximity) + honest scope (reuse P1).
- MAX_NEAR_KM + NEAR bbox math = const ใหม่ (tunable).

## Out of scope

- P3 landmark (เขาใหญ่/ปาย/gazetteer) · "ใกล้ฉัน" (IP/GPS) · scope-chip · pgvector.

## Self-verify

- [ ] `node scripts/build-province-centroids.mjs` → JSON centroids (deterministic rerun เท่ากัน) + sparse guard ทำงาน
- [ ] `npx vitest run __tests__/cam-502-geo-proximity.test.ts` → executor near-path: centroid lookup, bbox, haversine sort ascending, cap radius, fallback sparse, AND terrain; resolver proximity-vs-exact (ใกล้กรุงเทพ→near · ในกรุงเทพ→province)
- [ ] golden cases: "ลานกางเต็นท์ใกล้กรุงเทพ"→`searchCampsites{near:"กรุงเทพ"}` · "ในกรุงเทพ"→`{province:"Bangkok"}` (แยก mode) — + อัปเดต golden ceilings ทั้ง cam-457 + cam-459
- [ ] existing tests เดิมไม่พัง (cam-501/457/459/416/463) · typecheck + lint clean · diff เฉพาะ allowed files
- [ ] **behavioral (orchestrator, cost):** reproduction "ลานกางเต็นท์ใกล้กรุงเทพ" → คืนลานรอบกรุงเทพเรียงระยะ + honest scope
