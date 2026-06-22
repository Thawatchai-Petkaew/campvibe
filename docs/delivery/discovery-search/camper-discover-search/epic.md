---
artifact: epic
feature: discovery-search
epic: camper-discover-search (CAM-33)
status: Done
version: v2
updated: 2026-06-23
---
# Camper: discover & search (CAM-33)

## Why
ให้ camper ค้นหาและกรองลานแคมป์จนเจอลานที่ "ใช่และจองได้จริง" — ลดแรงเสียดทานช่วงต้น funnel (ค้นหา→ดู→จอง). **KPI:** conversion ค้นหา→เปิด detail สูงขึ้น และผลค้นหาที่ระบุจำนวนคนต้องไม่มีลานที่ความจุน้อยกว่าที่ระบุปรากฏ (verified บน Staging).

## Scope
- In: กรองผลค้นหาตาม **จำนวนผู้เข้าพักจริง (capacity)** — `CampSite.maxGuestsPerDay` (CAM-77, C-1.5). ทำงานเป็น AND ร่วมกับ filter อื่นที่มีอยู่ (keyword/จังหวัด/ราคา/taxonomy/วันที่) ใน `buildCampSiteWhere`.
- Out:
  - Sort ตามคะแนนรีวิวจริง (ตอนนี้ branch `rating` fallback เป็น `createdAt`) → **CAM-76** (C-1.4).
  - AI NL search ("ริมน้ำ เงียบ หมาเข้าได้") → **CAM-44** (C-1.7, ต้อง F-3 + pgvector).
  - Map-based search (C-1.6) · save search/alerts (C-1.8) → backlog.

## Stories
| CAM-id | story | role (เริ่ม→จบ) | สถานะ |
|---|---|---|---|
| [CAM-77](CAM-77-กรองจำนวนผู้เข้าพักตาม-capacity-จริง/story.md) | กรองจำนวนผู้เข้าพักตาม capacity จริง (C-1.5) | backend → qa → backend (fix DEFECT-01) | **Done** (staging) |

## Links
`../feature.md` · Master-Plan item (`docs/project/master-plan.md` — C-1 Discover & search) · product-plan `docs/project/product-plan.md` (C-1.5) · ADRs: ADR-003 (taxonomy → MasterData)

## Changelog
- v2 (2026-06-23) — เติม Why+KPI, Scope (in: capacity filter · out: CAM-76 sort-rating, CAM-44 NL search), Stories rollup (CAM-77 Done); เดิมเป็น scaffold stub
- v1 (2026-06-22) — epic scoped (scaffold)
