---
artifact: story
feature: ai-assistant
epic: kongfai-reliability-query-understanding
story: availability-cards (CAM-485)
version: 1
class: spec-lite (owner-approved scope in chat 2026-07-25; 3-file cohesive fix, additive tool-result field, no schema/migration)
---

# CAM-485 — คำตอบเรื่องความว่างต้อง render เป็นการ์ดกดได้

## Story

As a **Camper**, I want the camps returned by an availability question ("เสาร์หน้ามีลานไหนว่าง") to appear as tappable cards, so that I can open a camp and continue — not just read names in text.

**Scope:** `bulkAvailability` และ `checkAvailability` ต้อง emit `cards[]` ระดับบนสุด (top-level) ให้ engine เก็บได้ + dedup การ์ดซ้ำใน engine. ไม่แตะ schema/wire/UI.
**Depends on:** CAM-465 (bulkAvailability), CAM-469 (checkAvailability), CAM-427 (aiCampCardSelect + remaining attach), CAM-430 (card collector).

Why: production test (staging) — "เสาร์หน้า" ตอบถูกแล้ว (CAM-479) แต่ผลออกเป็น text ล้วน กดต่อไม่ได้ เพราะ engine collector อ่านเฉพาะ key `cards` ([openrouter-client.ts collectCardsFromToolData]) ขณะที่ bulkAvailability คืนใต้ key `camps` และ checkAvailability ไม่คืนข้อมูลการ์ดเลย → การ์ดที่ query มาแล้วถูกทิ้งกลางทาง.

## AC

| # | Given | When | Then (user sees, Thai verbatim) | System effect | Neg/edge |
|---|---|---|---|---|---|
| AC-1 | มีแคมป์ว่าง ≥1 ที่ในช่วงที่ถาม | ผู้ใช้ถาม "เสาร์หน้ามีลานไหนว่าง" (→ bulkAvailability) | การ์ดแคมป์ที่ว่างโผล่เป็น carousel กดเข้าดูรายละเอียดได้ + คำตอบสั้น เช่น `เจอลานที่ว่างให้แล้ว ดูการ์ดด้านล่างได้เลยค่ะ` | engine เก็บ `cards[]` จาก bulkAvailability; แต่ละการ์ดมี id/ชื่อ/รูป/ราคา | EC-1 |
| AC-2 | ถามความว่างลานเดียวที่ระบุชื่อ | ผู้ใช้ถาม "ลานสนธรรมชาติ เสาร์หน้าว่างไหม" (→ checkAvailability) | การ์ดของลานนั้น 1 ใบ โผล่ให้กดต่อ + คำตอบบอกสถานะว่าง | checkAvailability คืน `cards:[card]` เฉพาะเมื่อแคมป์ visible + มีผล | EC-2, EC-3 |
| AC-3 | เทิร์นเดียวเรียกทั้ง searchCampsites และ bulk/checkAvailability | โมเดล chain 2 tools แคมป์ทับกัน | การ์ดแต่ละแคมป์แสดง **ครั้งเดียว** ไม่ซ้ำ | engine dedup การ์ดตาม `id` (คงลำดับแรกที่เจอ) | EC-4 |
| AC-4 | ไม่มีแคมป์ว่างเลยในช่วงที่ถาม | ผู้ใช้ถามความว่าง แต่ทุกที่เต็ม/ไม่มีข้อมูล | ไม่มีการ์ด + คำตอบบอกตรงๆ ว่ายังไม่มีลานว่าง (ไม่แต่งการ์ดปลอม) | `cards` = [] (ไม่มี key ปลอม) | EC-1 |

## Rules

- **BR-1 (bulkAvailability):** เพิ่ม `cards: AiCampCard[]` ระดับบนสุด = แคมป์ที่มี cell สถานะ `free` อย่างน้อย 1 ช่วง (แคมป์ที่เต็ม/unknown ทุกช่วง ไม่ใส่ใน `cards`). สร้างจากข้อมูลที่ query อยู่แล้ว (`aiCampCardSelect` + `toAiCampCard`, ไม่ query เพิ่ม). คง key `camps` (พร้อม `cells`) ไว้เหมือนเดิมให้โมเดลใช้เหตุผล — เพิ่ม field ไม่ลบของเดิม. `remaining` บนการ์ด: ถ้าช่วงเดียว = remaining ของ cell นั้น; ถ้าหลายช่วง = remaining ของ cell `free` ตัวแรก (deterministic), ไม่มี free เลย = ไม่ใส่การ์ด.
- **BR-2 (checkAvailability):** เมื่อแคมป์ visible และได้ผล (ไม่ใช่ NO_DATA / RANGE_TOO_WIDE) → query การ์ดของ campSiteId นั้น (`aiCampCardSelect` + `toAiCampCard`) แล้วคืน `cards:[card]` โดย `remaining` = ผลจริงที่คำนวณได้. NO_DATA_RESULT / RANGE_TOO_WIDE → **ไม่มี** `cards` (คงพฤติกรรม honest/no-oracle เดิม).
- **BR-3 (engine dedup):** `collectCardsFromToolData` (ตัวที่ทั้ง non-stream + streaming ใช้ร่วมกัน) ต้องไม่ push การ์ดที่ `id` ซ้ำกับที่มีใน accumulator แล้ว — คงลำดับแรกที่เจอ. (การ์ดไม่มี `id` ที่อ่านได้ = push ตามปกติ, ไม่ throw.)
- **BR-4 (no contract break):** ไม่ลบ/เปลี่ยนชื่อ key เดิม (`camps`, `ranges`, capacity numbers). `cards` เป็น field เสริม → mock/fixture เดิมที่ไม่ได้อ้าง `cards` ยังผ่าน. `toWireCards` + carousel รองรับ `AiCampCard` shape อยู่แล้ว = ไม่แตะ.

## Edge cases

- **EC-1:** IF bulkAvailability ไม่มีแคมป์ว่างสักช่วง THEN `cards` = `[]` (ไม่ใช่ absent-key ปลอม, ไม่ throw) — คำตอบ text บอก "ยังไม่มีลานว่าง".
- **EC-2:** IF checkAvailability เจอ NO_DATA (แคมป์ไม่ visible / id มั่ว) THEN ไม่คืน `cards` เลย (ไม่รั่ว existence oracle).
- **EC-3:** IF checkAvailability เจอ RANGE_TOO_WIDE THEN คง `{ok:false, code:'RANGE_TOO_WIDE'}` เดิม ไม่มี `cards`.
- **EC-4:** IF เทิร์นเดียว search คืน card A,B และ bulk คืน card B,C THEN engine เก็บ A,B,C (B ครั้งเดียว, ตามลำดับที่เจอ).
- **EC-5:** IF card ไม่มี property `id` (ผิดรูปหลุด type) THEN dedup ข้ามการเช็ค push ปกติ ไม่ throw.

## Data

ไม่มี migration / ไม่มี field ใหม่ใน DB. ใช้ `aiCampCardSelect` (lib/read-models/ai-camp-card.ts) + `toAiCampCard` เดิม. `AiCampCard.remaining?: number|null` มีอยู่แล้วในเส้นทาง searchCampsites (CAM-427).

## Seams & refs

- `lib/ai/tools/bulk-availability.ts` — return object (เพิ่ม `cards`); ข้อมูล card สร้างที่ `rows.map(toAiCampCard)` อยู่แล้ว (บรรทัด ~233), reuse.
- `lib/ai/tools/check-availability.ts` — success path (หลังผ่าน visibleCamp gate + getRemainingCapacity) เพิ่ม card fetch.
- `lib/ai/openrouter-client.ts` — `collectCardsFromToolData` (~682) เพิ่ม dedup-by-id; ทั้ง `runTurnFromBaseMessages` และ streaming twin ใช้ผ่าน `executeToolCalls` → แก้จุดเดียวครอบทั้ง 3 paths.
- `lib/read-models/ai-camp-card.ts` — `aiCampCardSelect`, `toAiCampCard`, type `AiCampCard` (reuse, ห้ามแก้).
- reference remaining-attach pattern: `search-campsites.ts` (dates → `getRemainingCapacityForCamps` → `remaining` per card).

## Out of scope

- ไม่ขยาย `searchAttempted` semantics / zero-result banner (banner ผูกกับ searchCampsites เท่านั้น — คงเดิม). ถ้าจะให้ availability zero มี banner = ticket แยก.
- ไม่แตะ UI/wire/carousel (รองรับอยู่แล้ว).
- ไม่ทำ multi-range remaining chip แบบละเอียด (แสดง free-cell แรก, พอสำหรับ MVP).

## Self-verify

- [ ] `npx vitest run __tests__/cam-485-*.test.ts` → เขียวทุกเคส (AC-1..4 + EC-1..5)
- [ ] `grep -n "cards" lib/ai/tools/bulk-availability.ts` → มี top-level `cards` ใน return
- [ ] `grep -n "cards" lib/ai/tools/check-availability.ts` → คืน `cards` ใน success path เท่านั้น
- [ ] existing eval/tool tests เดิมไม่พัง (`npx vitest run __tests__/cam-465* __tests__/cam-469* __tests__/cam-430*`)
- [ ] `npm run typecheck` + `npm run lint` clean
- [ ] regression check: bulkAvailability `camps` key + checkAvailability capacity numbers ยังคงรูปเดิม (BR-4)
