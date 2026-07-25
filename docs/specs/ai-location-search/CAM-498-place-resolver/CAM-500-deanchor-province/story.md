---
artifact: story
feature: ai-location-search
epic: CAM-498 (Place Resolver)
story: deanchor-province (CAM-500, phase P0)
version: 1
class: spec-lite (owner-approved plan 2026-07-25; prompt/tool-desc change, no schema)
---

# CAM-500 — De-anchor the province param + assistant states its location scope in the answer

## Story

As a **Camper**, I want a terrain/keyword search that doesn't name a province ("ลานกางเต็นท์ริมทะเล", "กางเต็นท์ริมแม่น้ำ") to return the matching camps, so that I stop getting 0 results because the assistant silently injected a province I never asked for.

**Scope:** ลบ example "Chiang Mai"/เชียงใหม่ ออกจาก `province` param description + สั่งโมเดล **ห้าม infer/default จังหวัด** + สั่งให้ผู้ช่วย **บอก scope ที่ใช้ในคำตอบ** (transparency แทน scope-chip ที่ตัดทิ้ง). **ไม่ทำ geo/proximity/landmark** (P1-P3).
**Depends on:** ADR-016 (proposed) + `docs/research/ai-chat/geo-place-resolution-architecture.md` (P0 of the phased plan).

Why (verified vs live dev DB): "ริมทะเล" (CAGD+BEAC) = 24 ที่มีจริง แต่ AI คืน 0 เพราะ tool description ใช้ "Chiang Mai" เป็นตัวอย่าง param `province` → โมเดล over-anchor → ยัด province=Chiang Mai (landlocked) → AND ทับเหลือ 0. เดียวกันกับ "ริมแม่น้ำ"→เติมเชียงใหม่→0 (35 มีจริง).

## AC

| # | Given | When | Then (user sees, Thai verbatim) | System effect | Neg/edge |
|---|---|---|---|---|---|
| AC-1 | user ไม่ระบุจังหวัด ถามพื้นที่/terrain | "หาลานกางเต็นท์ริมทะเล" | เห็นรายการลานริมทะเล (การ์ด) — ไม่ใช่ "ไม่พบ" | searchCampsites ถูกเรียกด้วย terrain=BEAC **โดยไม่มี province** | AC-4 |
| AC-2 | เดียวกัน terrain อื่น | "กางเต็นท์ริมแม่น้ำ" | เห็นลานริมแม่น้ำ | terrain=RIVE, ไม่มี province | AC-4 |
| AC-3 | มีการใช้ location filter จริง | ผู้ช่วยตอบผลค้นหา | ผู้ช่วย **ระบุ scope ที่ใช้ในคำตอบ** (เช่น พูดถึง terrain/จังหวัดที่กรอง) เป็นภาษาธรรมชาติ | — (prompt-level, transparency) | — (ไม่มี UI ใหม่) |
| AC-4 | user **ระบุจังหวัดชัดเจน** | "แคมป์ริมน้ำเชียงใหม่" | ผลเฉพาะเชียงใหม่ | province=Chiang Mai (เพราะ user พิมพ์เอง) ✅ | ยังต้องทำงาน — de-anchor ต้องไม่ทำให้ province ที่ user ระบุหาย |

## Rules

- **BR-1:** ลบตัวอย่างจังหวัดที่เป็นรูปธรรม ("Chiang Mai" / "เชียงใหม่") ออกจาก description ของ param `province` ใน **ทั้ง** `lib/ai/tools/search-campsites.ts` (~L198) และ `lib/ai/tools/bulk-availability.ts` (~L148). ใช้คำอธิบายที่ไม่ anchor จังหวัดใดจังหวัดหนึ่ง (ยังคงบอกได้ว่า "province name in English; Thai names accepted & resolved server-side" แต่ **ไม่มีชื่อจังหวัดตัวอย่าง** — ถ้าจำเป็นต้องมีตัวอย่าง format ใช้ placeholder กลางๆ ที่ไม่ใช่จังหวัดจริง หรือระบุ format โดยไม่ยกจังหวัด).
- **BR-2 (non-inference — หัวใจ):** เพิ่มคำสั่งเด็ดขาด (ใน tool description ของ `province` + ย้ำใน system prompt): **province เป็น OPTIONAL — ใส่เฉพาะเมื่อผู้ใช้ระบุจังหวัดชัดเจนในข้อความนี้ หรือได้ระบุไว้ก่อนหน้าในบทสนทนานี้; ห้าม infer / เดา / default จังหวัดเองเด็ดขาด.** (เดียวกันกับ region ถ้ามี example anchor — ตรวจแล้วลบด้วย.)
- **BR-3 (state-scope-in-answer — แทน scope-chip):** ใน system prompt (`buildSystemPrompt`) เพิ่มคำสั่งให้ผู้ช่วย **ระบุขอบเขตที่ค้น (จังหวัด/terrain/พื้นที่) ในคำตอบ** เป็นภาษาธรรมชาติเมื่อมีการใช้ filter สถานที่ — เพื่อให้ผู้ใช้เห็นว่ากำลังค้นในบริบทไหน (transparency; ไม่มี UI ใหม่). Copy เป็นไทย, ไม่ใส่ em-dash/jargon.
- **BR-4 (no over-reach):** ห้ามแตะ geo/distance, proximity, landmark, scope-state, หรือ UI ใดๆ (นั่นคือ P1-P3). ห้ามเปลี่ยน where-logic/`buildCampSiteWhere`. เปลี่ยนเฉพาะ description + system-prompt text.

## Edge cases

- **EC-1:** IF user ระบุจังหวัด (AC-4) THEN province ยังถูกเซ็ต (de-anchor ต้องไม่ทำ province ที่ user ต้องการหาย) — Thai→English resolve เดิม (CAM-404) ยังทำงาน.
- **EC-2:** IF user ระบุ "ภาคเหนือ" (region) THEN ใช้ region ไม่ใช่จังหวัด (ไม่ยัดจังหวัดเดา) — ยืนยันว่า de-anchor ไม่กระทบ region.
- **EC-3:** IF ไม่มีผลจริง (เช่น terrain ที่ไม่มีข้อมูล) THEN ตอบ honest "ไม่พบ" — de-anchor ต้องไม่ทำให้เกิด false-empty จาก province ผีอีก.

## Data

ไม่มี schema/migration. เปลี่ยน string ใน tool descriptions + system prompt เท่านั้น.

## Seams & refs

- `lib/ai/tools/search-campsites.ts` (~L198 province description; ~L65 province param) · `lib/ai/tools/bulk-availability.ts` (~L148).
- `lib/ai/openrouter-client.ts` — `buildSystemPrompt` (~L291) เพิ่ม BR-2 non-infer + BR-3 state-scope block (pattern เดียวกับ block อื่นๆ ในนั้น).
- `docs/research/ai-chat/geo-place-resolution-architecture.md` — P0 ในแผน (อยู่ใน worktree แล้ว, commit คู่กัน).
- reference: resolveDates de-LLM pattern (CAM-479) เป็นแนวเดียวกันของทั้ง epic.

## Out of scope

- P1 Place Resolver pre-pass · P2 geo proximity (centroid) · P3 landmark gazetteer · scope-chip UI · persistent scope-state (ตัดทิ้ง/defer ตาม owner 2026-07-25).

## Self-verify

- [ ] `grep -niE "chiang mai|เชียงใหม่" lib/ai/tools/search-campsites.ts lib/ai/tools/bulk-availability.ts` → **ไม่เหลือ** ใน province description (ตัวอย่างจังหวัด)
- [ ] system prompt มีคำสั่ง non-infer province + state-scope (grep คำสั่ง)
- [ ] เพิ่ม golden case regression: "หาแคมป์ริมทะเล" → expected `searchCampsites` params `{terrain:"BEAC"}` **`strictParams:true`** (จับกรณีโมเดลยัด province เกิน — subset match จะไม่จับ ต้อง strict); ถ้ามีเคสคล้ายอยู่แล้วอัปเดต
- [ ] existing golden/unit tests เดิมไม่พัง (`npx vitest run __tests__/cam-457* __tests__/cam-416*`)
- [ ] typecheck + lint clean
- [ ] **behavioral verify (cost, owner-authorized):** reproduction 4 query จริงผ่าน agent loop → ไม่มี province ผี, ริมทะเล→คืนผล, ริมแม่น้ำ→คืนผล (orchestrator รันตอน verify)
