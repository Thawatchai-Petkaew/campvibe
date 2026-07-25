---
artifact: story
feature: ai-assistant
epic: kongfai-reliability-query-understanding
story: seed-multiturn-shownresults (CAM-486)
version: 1
class: spec-lite (owner-approved 2026-07-25 "Option A"; data-only golden fixture, no source/schema change)
---

# CAM-486 — Seed shown-results for multi-turn follow-up golden cases (eval fidelity)

## Story

As the **team running the assistant eval**, I want the multi-turn follow-up golden cases to seed the campsite that was already shown, so that the expected tool (`getCampDetail`/`checkAvailability`) is actually reachable and the eval measures the model's real follow-up behaviour instead of penalising it for a fixture that gives it no `campSiteId` to act on.

**Scope:** เพิ่ม `seededShownResults` ให้ 4 เคส follow-up ใน `scripts/ai-eval/golden-cases.json` (P1-01, P11-27, P14-34, P14-35) เท่านั้น. **ไม่แตะ source code, ไม่แตะ prompt, ไม่แตะ schema, ไม่แตะ scorer.**
**Depends on:** CAM-457 (eval harness), #553 (seededShownResults field + replay wiring — this story USES it), CAM-460 (shown-results block).

Why: ground truth 2026-07-25 — `getCampDetail`/`checkAvailability` บังคับ `campSiteId`; 4 เคสนี้ `seededShownResults` ว่าง + บทสนทนาไม่เคย search → model ไม่มี campId → เรียก tool ที่คาดไว้ไม่ได้ ต้อง searchCampsites ก่อน. เคสจึง "ตั้งโจทย์ที่ทำไม่ได้" (unfair, เหมือน deferred). แก้ให้จำลอง UX จริง: follow-up เกิด**หลัง**แคมป์ถูกโชว์.

## AC

| # | Given | When | Then (user sees, Thai verbatim) | System effect | Neg/edge |
|---|---|---|---|---|---|
| AC-1 | เคส P1-01 (โชว์ 2 แคมป์ แล้ว "เอาอันที่สอง") | รัน replay | (ไม่มี user-facing UI — นี่คือ eval fixture) | เคสมี `seededShownResults` 2 รายการ (ordinal 1,2) campId เป็น uuid-format ตรงชื่อในบทสนทนา → model resolve "อันที่สอง"→campId ได้ | AC-note |
| AC-2 | เคส P11-27 (จะจองลานสนธรรมชาติ เสาร์นี้ → "เปลี่ยนเป็นอาทิตย์") | รัน replay | — | seed ลานสนธรรมชาติ 1 รายการ → model checkAvailability(campId, วันใหม่) ได้ | AC-note |
| AC-3 | เคส P14-34 + P14-35 (ถาม follow-up มัดจำ/ราคา ของแคมป์ที่พูดถึง) | รัน replay | — | seed แคมป์ที่ระบุ 1 รายการต่อเคส → getCampDetail(campId) ได้ | AC-note |
| AC-4 | golden-cases.json ที่แก้แล้ว | `node scripts/ticket-sync.mjs` N/A · รัน schema validate + harness self-test | — | ทุกเคส valid ตาม `goldenCaseSchema`; harness unit test (cam-457) เขียว; จำนวนเคสรวมไม่เปลี่ยน | AC-4 fail = schema invalid |

> **AC-note:** เคสเหล่านี้เป็น eval fixture ไม่มี user-facing "Then". ความถูกต้องพิสูจน์ที่ (1) schema valid, (2) campId ที่ seed = ตัวที่ shown-results block จะยื่นให้ model, (3) expected tool กลายเป็น **reachable**. Story นี้ทำ fixture ให้ **แฟร์** ไม่ได้การันตีว่า model จะ pass — การ pass จริงวัดที่ re-eval (out of scope, มี cost).

## Rules

- **BR-1:** แก้เฉพาะ `scripts/ai-eval/golden-cases.json`. เพิ่ม key `seededShownResults` (array ของ `{ordinal, campId, name, priceLow?}` ตาม `shownResultSchema`) ให้ 4 เคส: **P1-01, P11-27, P14-34, P14-35**. ห้ามแตะเคสอื่น, ห้ามเปลี่ยน `expected`/`utterance`/`zone`/`group` ของเคสใดๆ, ห้ามเพิ่ม/ลบเคส (จำนวนรวมคงเดิม).
- **BR-2 (corrected 2026-07-25 to repo reality):** `campId` ต้อง**ใช้ slug id เดิมที่ไฟล์นี้ตั้งไว้แล้วสำหรับแคมป์นั้น** — ลานสนธรรมชาติ = `eval-camp-pine`, ริมธารแคมป์ = `eval-camp-river` (ใช้อยู่ 6+ เคสในไฟล์เดียวกัน). **ห้ามสร้าง id ใหม่** (uuid หรืออื่นๆ) ให้แคมป์ที่มี slug อยู่แล้ว — จะได้ id ซ้อนสองตัวต่อแคมป์เดียว ขัด BR-4. `goldenCaseSchema` ต้องการแค่ `z.string().min(1)` และ dispatch ถูก mock → format ไม่มีผล functional; consistency สำคัญกว่า. `name` = ชื่อแคมป์ verbatim จากบทสนทนา; `ordinal` เริ่ม 1. `priceLow` ใส่เมื่อบทสนทนาระบุราคา (P1-01: 500/800; P14-35: 750) มิฉะนั้นละไว้.
- **BR-3 (P1-01 known-ambiguity — บันทึกไว้ ไม่แก้ในสตอรี่นี้):** "เอาอันที่สอง" → shown-block อนุญาต getCampDetail *หรือ* checkAvailability; golden คาด getCampDetail. หลัง seed ถ้า model เลือก checkAvailability เคสนี้ยัง fail ได้ — นั่นเป็นสัญญาณจริงของ prompt-ambiguity ที่จะตัดสินแยก (ทางเลือก accept-either / prompt-tweak) **ไม่ใช่ scope นี้**. อย่าเปลี่ยน expected ของ P1-01 เพื่อ "ทำให้ผ่าน".
- **BR-4:** JSON คง format เดิม (indent, key order สม่ำเสมอกับเคสข้างเคียง); ต้อง `JSON.parse` ผ่าน + `goldenCaseSchema` (scripts/ai-eval/case-schema.ts) validate ผ่านทุกเคส.

## Edge cases

- **EC-1:** IF ชื่อแคมป์ใน utterance ไม่ตรงกับที่ assistant turn โชว์ THEN ใช้ชื่อที่ผู้ใช้อ้างถึงใน follow-up (ตัวที่ต้อง resolve) — อ่านเคสจริงก่อน seed.
- **EC-2:** IF เคสมี assistant turn ที่ลิสต์แคมป์เป็นข้อความ (P1-01) THEN ordinal ใน seededShownResults ต้องตรงลำดับในข้อความนั้น (1=ตัวแรกที่โชว์).
- **EC-3:** IF schema ไม่รองรับ field ใด THEN หยุด + รายงาน (อย่าดัดแปลง schema — นั่นคืออีก scope).

## Data

ไม่มี DB / migration. แก้ fixture JSON อย่างเดียว. ใช้ field `seededShownResults` ที่มีอยู่แล้ว (#553).

## Seams & refs

- `scripts/ai-eval/golden-cases.json` — ไฟล์เดียวที่แก้.
- `scripts/ai-eval/case-schema.ts` — `shownResultSchema` (ordinal/campId/name/priceLow?) + `goldenCaseSchema` (อ่านเพื่อให้ตรง shape, ห้ามแก้).
- `scripts/ai-eval/replay-case.ts` — ยืนยันว่า `kase.seededShownResults` ถูกส่งเป็น arg ที่ 3 ของ `runAssistantTurnFromMessages` (reuse, ห้ามแก้).
- อ่าน 4 เคสจริงใน golden-cases.json ก่อน seed (ชื่อ/ราคา/ลำดับ verbatim).

## Out of scope

- ไม่รัน re-eval (มี cost — owner go แยก; นั่นคือขั้นพิสูจน์ผล).
- ไม่แตะ prompt/openrouter-client (นั่นคือถ้าจะแก้ P1-01 ambiguity = ticket แยก).
- ไม่แตะ scorer / split-scoring core-vs-deferred (นั่นคือ S4 ใน Capability Loop plan).
- ไม่เพิ่ม accept-either-tool ใน schema.

## Self-verify

- [ ] `node -e "const g=require('./scripts/ai-eval/golden-cases.json'); ['P1-01','P11-27','P14-34','P14-35'].forEach(id=>{const c=(g.cases||g).find(x=>x.id===id); if(!c.seededShownResults) throw new Error(id+' missing seed'); console.log(id, c.seededShownResults.length)})"` → ทั้ง 4 มี seed
- [ ] schema validate: รัน harness ที่ parse golden ผ่าน `goldenCaseSchema` (หรือ `npx vitest run __tests__/cam-457-eval-harness.test.ts`) → เขียว
- [ ] จำนวนเคสรวมเท่าเดิม (ไม่เพิ่ม/ลบ)
- [ ] เคสอื่นๆ diff = 0 (แก้เฉพาะ 4 เคส) — `git diff` แสดงเฉพาะ 4 บล็อก
- [ ] campId ทุกตัว uuid-format; name ตรง verbatim กับบทสนทนา
