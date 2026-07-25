---
artifact: story
feature: ai-location-search
epic: CAM-498 (Place Resolver)
story: place-resolver-p1 (CAM-501)
version: 1
class: M (deterministic pre-pass; owner-approved plan 2026-07-25)
---

# CAM-501 — P1 Place Resolver: deterministic province/region parse + mandatory hint + honest scope

## Story

As a **Camper**, I want the assistant to always search the province OR region I explicitly named ("แคมป์ริมน้ำเชียงใหม่", "ริมน้ำภาคเหนือ"), so that I get results actually from that place — or an honest "ไม่มีในที่นั้น" — never camps from a different place mislabeled as mine.

**Scope:** deterministic resolver ที่ parse "ชื่อจังหวัด/ชื่อภาค" จากข้อความ user → hint บังคับให้โมเดลเซ็ต `province`/`region` ให้ถูก (เอาการเดาออกจาก LLM) + BR-3 honest scope. **ไม่ทำ proximity/landmark** (P2/P3).
**Depends on:** CAM-500 (P0 de-anchor — this fixes P0's over-correction), CAM-463 (region param + resolveRegionForSearch), thailand-locations.json (77-province gazetteer).

Why (production regression, verified): หลัง P0 ผู้ใช้พิมพ์ "แคมป์ริมน้ำเชียงใหม่" → โมเดล**ทิ้ง province=เชียงใหม่** (over-correct จากคำสั่ง non-infer) → ดึง RIVE จากทั่วประเทศ (นราธิวาส/ยะลา/ปัตตานี) **แต่พูดว่า "ในเชียงใหม่"** = ผิด + hallucinate. เชียงใหม่+RIVE = 0 จริง → คำตอบที่ถูกคือ "ไม่มีริมน้ำในเชียงใหม่". การให้โมเดลตัดสิน "อันนี้จังหวัด/ภาค/terrain?" เปราะ — ต้อง deterministic.

## AC

| # | Given | When | Then (user sees, Thai verbatim) | System effect | Neg/edge |
|---|---|---|---|---|---|
| AC-1 | user พิมพ์ชื่อจังหวัด + terrain | "แคมป์ริมน้ำเชียงใหม่" | ผลเฉพาะเชียงใหม่ หรือถ้าไม่มี → "ไม่มีลานริมน้ำในเชียงใหม่ค่ะ" (อาจเสนอที่อื่น แต่บอกชัดว่าที่อื่น) | searchCampsites ถูกเรียกด้วย **province=Chiang Mai + terrain=RIVE** (province ที่ user ระบุ **ไม่ถูกทิ้ง**) | AC-4 |
| AC-2 | user พิมพ์ชื่อภาค + terrain | "ริมน้ำภาคเหนือ" | ผลลานริมน้ำในภาคเหนือ | searchCampsites ด้วย **region=<ภาคเหนือ> + terrain=RIVE** (ไม่ยัด province เดา) | AC-4 |
| AC-3 | มี location filter จริง (province/region) | ผู้ช่วยตอบ | ผู้ช่วยบอก scope ที่ **ค้นจริง**เท่านั้น; ถ้า 0 ผลบอกตรงๆ "ไม่มี...ในX" — **ห้ามอ้างว่าผลอยู่ใน X ถ้าไม่ได้ filter X** | honest scope | AC-3 = hallucinate scope = fail |
| AC-4 | user พิมพ์ terrain อย่างเดียว | "หาลานริมทะเล" | ผลริมทะเลทั่วประเทศ | **ไม่**เซ็ต province/region (terrain ไม่ใช่สถานที่) — คง P0 | — |

## Rules

- **BR-1 (resolver):** สร้าง `lib/ai/place-resolver.ts` — `resolvePlace(text: string): { province?: string; region?: string }` deterministic:
  - match **ชื่อจังหวัดไทย 77 + อังกฤษ** (จาก `prisma/data/thailand-locations.json` / reuse `resolveProvinceForSearch` lookup) → `province` = ค่า English canonical ที่ DB เก็บ.
  - match **6 ภาค** (ภาคเหนือ, ภาคอีสาน/ภาคตะวันออกเฉียงเหนือ, ภาคกลาง, ภาคตะวันออก, ภาคตะวันตก, ภาคใต้ + alias เหนือ/อีสาน/ใต้ ระวัง false-match ตามคอมเมนต์ thai-regions.ts:55) → `region`.
  - **province ชนะ region** ถ้าเจอทั้งคู่ (ตรงกับกฎ tool "province wins"). terrain/facility word ไม่ถือเป็นสถานที่ (ห้าม match "ริมน้ำ"→จังหวัด).
  - pure function, ไม่แตะ DB ตอน parse (ใช้ gazetteer ที่ load แล้ว/static). reuse ตัวที่มี — ห้ามเขียน province list ใหม่.
- **BR-2 (mandatory hint — เอาการเดาออกจาก LLM):** pre-pass รัน `resolvePlace` กับ **ข้อความ user ล่าสุด**; ถ้าเจอสถานที่ → inject hint block บังคับใน system prompt (pattern เดียวกับ shown-results block): "ผู้ใช้ระบุ [จังหวัด X / ภาค Y] ในข้อความล่าสุด — เมื่อค้นหา **ต้อง**เซ็ต `province`=X (หรือ `region`=Y) เสมอ; ห้ามละ/เปลี่ยน/ทิ้ง. คำ terrain (ริมน้ำ/ริมทะเล) ไม่ใช่สถานที่." wiring: เพิ่ม param เข้า `buildSystemPrompt` (openrouter-client.ts) resolved จาก latest user message — reuse จุดที่ shownResults ถูกส่งเข้าไป.
- **BR-3 (honest scope — แก้ hallucination):** refine คำสั่ง state-scope (CAM-500 BR-3): ผู้ช่วยระบุ scope **ที่ apply จริงในการค้นนี้**เท่านั้น (จังหวัด/ภาค/terrain ที่ส่งเข้า tool). ถ้าค้นด้วยสถานที่ที่ user ขอแล้ว **0 ผล** → พูดตรงๆ ว่าไม่มีในที่นั้น (เสนอ terrain/พื้นที่อื่นได้ แต่ต้องบอกชัดว่าเป็น "ที่อื่น"). **ห้าม**พูดว่าผลอยู่ในสถานที่ที่ไม่ได้ filter.
- **BR-4:** ไม่แตะ `buildCampSiteWhere`/geo/proximity/landmark (P2/P3). resolver + hint + prompt เท่านั้น + tool descriptions ถ้าจำเป็นเพื่อความชัด (แต่ตรรกะจริงอยู่ที่ hint deterministic ไม่ใช่ description).

## Edge cases

- **EC-1:** IF เชียงใหม่+RIVE = 0 (จริง) THEN honest "ไม่มีลานริมน้ำในเชียงใหม่ค่ะ" — ไม่ silently drop province + ไม่ mislabel.
- **EC-2:** IF alias กำกวม (เช่น "ใต้" อาจอยู่ในคำอื่น) THEN ระวัง false-match ตามคอมเมนต์ thai-regions.ts:55 — resolver ต้องไม่ resolve region จาก substring ที่ไม่ใช่ภาค.
- **EC-3:** IF user พิมพ์ทั้งจังหวัดและภาค THEN province ชนะ.
- **EC-4:** IF ข้อความมีชื่อจังหวัดในบริบทที่ไม่ใช่ filter (เช่นชื่อลานมีคำว่าจังหวัด) — MVP: match ตรงๆ ยอมรับ over-match เล็กน้อยได้ (hint เป็น guide; ถ้าเป็นปัญหาจริงค่อย refine).

## Data

ไม่มี schema/migration. ใช้ thailand-locations.json (77) + REGION_TO_PROVINCES (thai-regions.ts) ที่มีอยู่.

## Seams & refs

- **ใหม่:** `lib/ai/place-resolver.ts` + `__tests__/cam-501-place-resolver.test.ts`.
- `lib/thai-regions.ts` — `resolveRegionForSearch`, `REGION_TO_PROVINCES`, region alias handling (reuse; อ่านคอมเมนต์ L55 false-match).
- `prisma/data/thailand-locations.json` — 77 provinces (Thai+English) gazetteer.
- `lib/ai/openrouter-client.ts` — `buildSystemPrompt` (~L291, เพิ่ม placeHint param) + จุดที่ resolve latest-user-message + ส่ง shownResults (reuse pattern) + CAM-500 BR-3 block (~L395, refine to honest).
- `lib/ai/tools/search-campsites.ts` — province/region param (reference contract; ค่าที่ hint บอกต้องตรงกับที่ tool คาด).
- reference: resolveDates deterministic-pre-pass pattern (แนวเดียวกันทั้ง epic).

## Out of scope

- P2 proximity (ใกล้X/centroid) · P3 landmark (เขาใหญ่/gazetteer) · scope-chip/persistent-state (ตัดแล้ว).

## Self-verify

- [ ] `npx vitest run __tests__/cam-501-place-resolver.test.ts` → resolvePlace: จังหวัดไทย/อังกฤษ→province · ภาค→region · terrain word→ไม่ match · both→province wins · false-match guard (EC-2)
- [ ] hint block ถูก inject เมื่อ latest user message มีสถานที่ (unit/integration บน buildSystemPrompt)
- [ ] golden cases (behavioral, strict): "แคมป์ริมน้ำเชียงใหม่"→`searchCampsites{province:"Chiang Mai",terrain:"RIVE"}` · "ริมน้ำภาคเหนือ"→`searchCampsites{region:<ค่าที่ tool คาด>,terrain:"RIVE"}` — เพิ่มใน golden-cases.json + **อัปเดต golden-count ceilings ทั้ง cam-457 และ cam-459** (two-ceilings trap)
- [ ] existing tests เดิมไม่พัง (cam-457/cam-459/cam-416/cam-463) ; typecheck + lint clean
- [ ] **behavioral verify (orchestrator, cost):** reproduction "แคมป์ริมน้ำเชียงใหม่" → province set + honest 0-result ไม่ mislabel; "ริมน้ำภาคเหนือ" → region set + มีผล
