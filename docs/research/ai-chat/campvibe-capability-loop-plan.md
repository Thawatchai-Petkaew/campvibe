# Capability Loop — จาก "ไล่แก้ทีละเรื่อง" สู่ระบบปิด gap แบบ closed-loop

> สถานะ: **PLANNED — owner อนุมัติหลักการ + ตอบ 3 decisions แล้ว (2026-07-25) แต่ยังไม่ build**
> ที่มา: คำถาม owner หลัง Kongfai Wave-1 (CAM-478: F1 weekday dates + F2 markdown strip ขึ้น staging แล้ว)
> เอกสารคู่กัน: `ai-chat-architecture.html` §Capability Loop (ภาพรวม) · เอกสารนี้ = แผนฉบับเต็ม

---

## 1. คำถามของ owner และคำตอบตรงๆ

**คำถาม:** ถ้าเจอ use case ที่ไม่ support จากการใช้งานจริง ต้องไล่แก้ทีละเรื่องแบบนี้ใช่ไหม? มีวิธีดีกว่านี้ไหม — ทั้ง (1) การตอบมุม general knowledge, (2) การดึงข้อมูลที่มีในระบบมาตอบ, (3) กรณี intent แปลงแล้วต้องใช้ข้อมูลที่**ไม่มี** → ต้องมี list ตารางเผื่ออนาคต

**คำตอบ:** วันนี้ "ใช่ ต้องไล่แก้ทีละเรื่อง" — แต่**ไม่ใช่เพราะสถาปัตยกรรมผิด** เป็นเพราะระบบยังตาบอด 3 จุด (ground truth ตรวจจากโค้ดจริง 2026-07-25):

| # | จุดตาบอด | หลักฐานในโค้ด | ผลที่ตามมา |
|---|---|---|---|
| 1 | **มองไม่เห็น (no telemetry)** | authed path เก็บเฉพาะ turn สำเร็จ (`app/api/ai/chat/route.ts:492-535`) · guest path ไม่เก็บอะไรเลย (`route.ts:222-224`) · ไม่มี log ว่า tool ไหนถูกเรียก / ตอบ "ยังไม่มีข้อมูล" กี่ครั้ง | รู้จัก use case ที่พังจาก **screenshot ของ owner เท่านั้น** |
| 2 | **ไม่มีทะเบียน (no registry)** | ช่องว่างข้อมูล 13 ตาราง + 2 pixel clusters รู้แล้วใน `docs/research/` (2026-07-18) แต่กระจัดกระจาย ไม่มี status/demand ต่อ capability | จัดลำดับด้วยการเดา ไม่ใช่ demand จริง |
| 3 | **ไม่มีประตูกัน regress (advisory eval)** | eval 53 เคสดีอยู่แล้ว (CAM-457) แต่ REPORT-mode + กดรันมือ (`.github/workflows/ai-eval.yml` = workflow_dispatch, continue-on-error) · 9 เคส deferred กดเพดานคะแนนรวม | fix แล้วไม่มีอะไรยืนยันว่าไม่ regress อัตโนมัติ |

**วิธีที่ดีกว่า** = สร้าง flywheel มาตรฐานอุตสาหกรรม (error-analysis flywheel ของ Hamel Husain / Shreya Shankar: traces → taxonomy → frequency-ranked fixes → eval gate): **SEE → SORT → FIX → PROVE**. ลงทุนครั้งเดียว ได้ระบบที่เปลี่ยน use case พังทุกอันในอนาคตให้กลายเป็น (a) ticket ที่จัดลำดับด้วย demand จริง หรือ (b) แถวใหม่ใน registry — โดยอัตโนมัติ ไม่ใช่ screenshot + ไล่เดา

### สถานะปัจจุบันที่ verify แล้ว (สำคัญต่อ design)

- **ไม่มี intent-classification layer** — model เลือก tool เองใน bounded agent loop เดียว (4 iterations · 6 tool calls/turn · 40s deadline); Zone A/B/C = ข้อความใน system prompt (`lib/ai/openrouter-client.ts:320`) ไม่ใช่ code branch
- CAM-477 nudges (Themes A/B/C) merge แล้ว (`openrouter-client.ts:313-352`); multi-turn reference ("อันที่ 2") มี shown-results DATA block แล้ว (`openrouter-client.ts:238-267`) แต่**ไม่มี date-context resolver ข้าม turn**
- พิกัดแคมป์มีครบ (lat/lng required บน CampSite) แต่ **distance ไม่ได้ต่อเข้า search** — มีแค่ `distanceFromBangkokKm` ใน detail/compare (`lib/geo/distance.ts` origin ตายตัวกรุงเทพ)
- **ไม่มี field เสียง/quiet-hours ใดๆ ทั้ง schema** (grep quiet|sound|noise|alcohol|deposit = 0) → "เปิดเพลงได้ทั้งคืนไหม" ตอบไม่ได้ทุกแคมป์
- Corpus 53 เคส hand-authored จาก research docs; **P17 (gear) / P18 (region-season) มีใน taxonomy แต่ไม่มีเคสเลย**; ไม่มี pipeline จาก conversation จริง → golden case

---

## 2. The design — 4 ชิ้น (SEE → SORT → FIX → PROVE)

### 2.1 SEE — Turn telemetry (ชิ้นเดียวที่แตะ schema)

Prisma model ใหม่ `AssistantTurnLog` — บันทึก**ทุก turn ทั้ง 3 path** (guest JSON / guest SSE / authed):

```text
path, model, latencyMs, iterations, toolCalls Json (ชื่อ+params สรุป),
zeroResultSearch Bool, noDataAnswer Bool (จับประโยค "ยังไม่มีข้อมูลส่วนนี้"),
guardrailRefusal Bool, errorCode?, conversationId?, utterance (เต็ม — PDPA ข้อ 5),
createdAt (+index), retention 90 วัน (ลบผ่าน cron pattern เดิม ai-chat-retention)
```

- เขียนแบบ **fire-and-forget** ผ่าน `lib/ai/telemetry.ts` ใหม่ — ห้าม block/ทำ turn พัง (try/catch เงียบ + console.error event)
- จุดเรียก: 3 handlers ใน `app/api/ai/chat/route.ts` (หลังจบ turn ทั้งสำเร็จและพัง — ต่างจาก persistence ปัจจุบันที่เก็บเฉพาะสำเร็จ)
- **นี่คือเซนเซอร์ที่ทำให้ "use case ที่ไม่ support" โผล่ในข้อมูล ไม่ใช่ใน screenshot**

### 2.2 SORT — Capability Registry + miner (= "list เผื่อไว้ในอนาคต" ที่ owner ขอ)

**`docs/specs/ai-assistant/capability-registry.md`** (doc-only, files=SoT) — ทะเบียนถาวรหนึ่งเดียว:

| คอลัมน์ | ความหมาย |
|---|---|
| Capability | อิง P1–P18 taxonomy + attribute (เช่น "sound policy", "near me") |
| Zone | A / B / C |
| Status | ✅ supported · 🟡 prompt-gap · 🔴 data-gap · ⏸ deferred-tool |
| Missing data | ชื่อตาราง/pixel ที่ขาด (จาก §3) |
| Demand | ตัวเลขจริงจาก telemetry (miner อัปเดต) |
| Planned story | CAM-id เมื่อคิวแล้ว |

**Miner** `scripts/ai-triage/mine-turns.mjs` — อ่าน TurnLog ที่ flag miss → bucket ด้วย lexicon กติกาง่ายๆ (deterministic, **ไม่ใช้ LLM**) เข้า P-group/attribute → ออก triage report + อัปเดต Demand ใน registry + **เสนอ candidate golden cases** (JSON ให้คน review ก่อน append เข้า `scripts/ai-eval/golden-cases.json`) = open→axial coding แบบกึ่งอัตโนมัติ. Lexicon ตั้งต้น: `docs/research/ai-chat/campvibe-utterance-corpus.md` (~300 utterances)

### 2.3 FIX — 4 เลนถาวร (กติกา routing ไม่ใช่ infra ใหม่) — ตอบ 3 กรณีของ owner ตรงๆ

| เลน | กรณีของ owner | วิธีแก้ | schema? |
|---|---|---|---|
| **L1 prompt/tool-desc** (🟡) | ดึงข้อมูลที่**มี**แต่ route พลาด | multi-turn follow-up cluster (4 เคสจาก bake-off) + chaining nudges + turn-hint pre-pass | ❌ |
| **L2 knowledge packs** | **general knowledge** (Zone A) | GearItem + RegionSeasonProfile เป็น **JSON ใน repo + read tool** (`getGearAdvice`/`getSeasonInfo`) — ปิด P17/P18 โดย**ไม่ต้องมี migration** | ❌ |
| **L3 data tables** (🔴) | intent→ข้อมูลที่**ไม่มี** | ระหว่างรอ: ตอบ honest "ยังไม่มีข้อมูลส่วนนี้" + miss-beacon นับเข้า registry → สร้างตารางตาม **Demand rank** (ไม่ใช่เดา) — Policy Pixels คาดว่านำ | ✅ spec-first G1/G2 |
| **L4 deferred tools** (⏸) | ฟีเจอร์ใหญ่ (setWatch / planTrip / getUserContext / getPriceHistory) | registry สะสม demand → สร้างเมื่อคุ้ม | ✅ |

**คำแนะนำเรื่อง intent layer (คำถามค้างของ owner): ไม่สร้าง classifier แยก.**
หลักฐานจาก model bake-off (2026-07-25): เคสที่พังคือ "หยุดเร็ว/ไม่ chain" กับ multi-turn — **ไม่ใช่จับ intent ผิด**; classifier แยก = +1 model call (latency+cost) + จุดพังใหม่ และ tool schemas ก็คือ intent layer ของ function-calling อยู่แล้ว. สิ่งที่ทำแทน: **deterministic turn-hint pre-pass** — โค้ด regex/lexicon ถูกๆ ตรวจข้อความก่อนเข้า loop (เจอวลีวันที่ → hint · เจอ "ใกล้/แถว" → geo hint · เจอชื่อแคมป์ที่รู้จัก → named-camp hint) ฉีดเป็น system-prompt block เดียว — pattern เดียวกับ shown-results block ที่พิสูจน์แล้ว, ทดสอบได้ด้วย unit test, latency ศูนย์

### 2.4 PROVE — eval hardening

- **แยก denominator**: `scripts/ai-eval/score.ts` + `report.ts` รายงาน core (tools ที่สร้างแล้ว) แยกจาก deferred → verdict ตัดสินบน core เท่านั้น (วันนี้ 9 เคส deferred กดเพดานคะแนน: 64.7% raw = 79.5% บนสิ่งที่สร้างแล้ว)
- **Guardrail subset → BLOCKING ใน CI** เฉพาะ PR ที่แตะ `lib/ai/**` (guardrails ผ่าน 100% ทุกรุ่น = backlog 0 ตามกติกา ops.md ก่อน flip เป็น blocking) — cost <$0.01/run
- golden set โตจาก miner (เคสจาก production จริง) = flywheel ครบวง

---

## 3. Registry seed — รายการข้อมูลที่ยังไม่มีจริง (verify กับ schema 2026-07-25)

ทุกตัวด้านล่าง **grep กับ `prisma/schema.prisma` แล้ว = ไม่มีจริง**:

| ลำดับคาด (ROI/effort) | ตาราง / pixels | ปลดล็อกคำถามจริง |
|---|---|---|
| 1 | **Policy Pixels** บน CampSite: `quietHoursStart/End`, `amplifiedSound`, `alcoholPolicy`, `campfirePolicy`, `depositAmount/Type`, `weatherRefund`, `childFreeUnderAge/childPriceAmount`, `petFeeAmount/petMaxSizeKg/petLeashRequired/petZoneOnly` | "เปิดเพลงได้ทั้งคืนไหม" · "มัดจำเท่าไหร่" · "หมาตัวใหญ่ไปได้ไหม" · "เด็กฟรีถึงกี่ขวบ" (P14 + segments) |
| 2 | `EquipmentRental` (MasterData มีโค้ด 12 ตัวแล้ว **แต่ไม่มีราคา**) | "เช่าเต็นท์เท่าไหร่" |
| 3 | `CancellationTier` (ตอนนี้มีแค่ enum 4 ค่า) | เปอร์เซ็นต์ refund ตามจำนวนวัน (P14) |
| 4 | `CampSeasonCondition` (ยุง/ทาก/หนาว/หมอก/ลม ราย season) | "ยุงเยอะไหม" · "หนาวไหม" (หมวด C, P17) |
| 5 | `RegionSeasonProfile` (6 ภาค × 12 เดือน) | "ภาคใต้ช่วงนี้ฝนไหม" (P18) — เริ่มเป็น JSON ใน L2 ได้ก่อน |
| 6 | `ReviewAspect` → `CampFacetScore` (stored) | "ทำไมแนะนำอันนี้" evidence (P13) · facet quiet/photo/privacy/clean |
| 7 | `ConceptMapping` / lexicon | mood→facet, slang→code (P7) |
| 8 | `GearItem` KB | "มือใหม่ต้องเตรียมอะไร" (P17) — เริ่มเป็น JSON ใน L2 ได้ก่อน |
| 9 | **Party Pixels** บน Booking: `adultsCount/childrenCount/infantsCount/petsCount/vehicleType` | "6 คน เด็ก 2 หมา 1 ขับเก๋ง" (P8) |
| 10 | `Watch` | "ถ้ามีคนยกเลิกบอกด้วย" (P9) |
| 11 | `UserPreference` | "แบบที่เราชอบ" (P10) — PDPA/consent |
| 12 | `BookingAmendment` (+ สถานะ RESCHEDULED) | "เลื่อนไปอีกอาทิตย์" (P11) |
| 13 | `ChatConversation.state` (Json) | back-reference ข้าม turn แบบ stateful (P1/P11/P16) |

**หมายเหตุ "shipped-differently" 2 ข้อ** (registry ต้องบันทึกกันสับสน):

1. Facets มีแล้วแบบ **compute-on-read 3 ตัว** (`lib/facet-scores.ts`: family/beginner/road_access, rules-only) — ไม่ใช่ตาราง `CampFacetScore`; ตารางค่อยมาเมื่อทำ review-derived
2. Distance มีแล้ว (`lib/geo/distance.ts` haversine) แต่ **Bangkok-origin เท่านั้น + ไม่อยู่ใน search** — "ใกล้ฉัน" ต้องต่อ origin param เข้า searchCampsites (Phase 2 S6)

---

## 4. Build roadmap (owner อนุมัติ scope: Phase 1 + 2 พร้อมกัน — ยังไม่เริ่ม)

**Phase 1 — สร้าง loop (4 stories):**

1. **S1** registry doc seeded จาก §3 (XS, doc-only)
2. **S2** `AssistantTurnLog` + telemetry writes + retention (S, **schema → G1**)
3. **S3** miner script + triage report แรก (S)
4. **S4** eval split-scoring + guardrail-blocking CI (S)

**Phase 2 — cluster ที่รู้แล้วจาก bake-off (ไม่ต้องรอ loop):**

1. **S5** multi-turn follow-up prompt block + turn-hint pre-pass (S) → re-eval วัดผล (เป้า: P1-01, P11-27, P14-34/35 เขียว)
2. **S6** geo "ใกล้ฉัน/แถวนี้": ต่อ `lib/geo/distance.ts` เข้า `searchCampsites` (origin param + sort by distance) (M)
3. **S7** knowledge packs P17/P18 (JSON + tool, ไม่มี migration) (S)
4. CAM-483 zero-result relaxation (spec พร้อมแล้ว รอคิว)

**Phase 3 — L3 tables ตาม Demand rank จริงจาก registry** (คาด: Policy Pixels → EquipmentRental price → CancellationTier → SeasonCondition → ReviewAspect/FacetScore) — แต่ละตัว = story แยก มี G1/G2 เพราะแตะ schema

## 5. Owner decisions (ตอบแล้ว 2026-07-25)

| ข้อ | คำถาม | คำตอบ |
|---|---|---|
| PDPA | เก็บ utterance ใน TurnLog แบบไหน | ✅ **เก็บเต็ม + ลบอัตโนมัติ 90 วัน** (ผ่าน retention cron เดิม) · ไม่ export ออกนอกระบบ |
| Scope | เริ่ม build แค่ไหน | ✅ **Phase 1 + 2 พร้อมกัน** (7 stories + CAM-483) — *แต่เลื่อน execution ไปรอบหน้า (เอกสารนี้คือบันทึกการอนุมัติหลักการ)* |
| Cost CI | guardrail eval blocking ใน CI | ✅ **เอา** — เฉพาะ PR ที่แตะ `lib/ai/**` (<$0.01/run, backlog=0 แล้ว) |

## 6. Files ที่จะแตะเมื่อ execute (บันทึกไว้ล่วงหน้า)

- **ใหม่**: `prisma/schema.prisma` model `AssistantTurnLog` (+migration reversible) · `lib/ai/telemetry.ts` · `scripts/ai-triage/mine-turns.mjs` · `docs/specs/ai-assistant/capability-registry.md`
- **แก้**: `app/api/ai/chat/route.ts` (3 จุดเรียก log) · `scripts/ai-eval/score.ts` + `report.ts` (split) · `.github/workflows/ai-eval.yml` (blocking subset) · `lib/ai/openrouter-client.ts` (hint block)
- **Reuse (ห้ามเขียนใหม่)**: retention cron pattern (`app/api/cron/ai-chat-retention`) · shown-results block pattern (`openrouter-client.ts:238-267`) · deterministic-resolver pattern (resolveDates) · เอกสาร gap 2 ฉบับใน `docs/research/` เป็น seed ของ registry · utterance corpus เป็น lexicon ตั้งต้นของ miner

## 7. Verification plan (เมื่อ execute)

- S2: ยิง chat บน localhost ทั้ง guest+authed → แถว TurnLog ครบ, turn ที่ error ก็ log, การ log พังไม่ทำ chat พัง (mock ให้ throw)
- S3: miner รันบน log จริง → triage report + demand counts ใน registry ขยับ
- S4: `npm run ai:eval` แสดง core vs deferred แยก; PR แตะ `lib/ai` ติด guardrail check
- S5/S6: re-run golden eval → multi-turn cluster เขียว; "ใกล้" query คืนผลเรียงระยะ
- Loop ครบวง: use case พังใหม่ 1 อัน → โผล่ใน TurnLog → miner จัดเข้า bucket → เห็นใน registry พร้อม demand → กลายเป็น story/แถวตาราง **โดยไม่ต้องมี screenshot**

## 8. Out of scope

- pgvector/semantic (infra-gated ตามเดิม) — พิจารณาเฉพาะ P7 mood ภายหลัง
- write/booking tools (Zone C ยังคง refuse-by-design)
- intent-classifier model แยก (ตัดสินใจ**ไม่ทำ** — เหตุผล §2.3)
- LLM-as-judge answer-quality eval — รอบหน้า หลัง loop นิ่ง

## อ้างอิง

- Hamel Husain — [Your AI Product Needs Evals](https://hamel.dev/blog/posts/evals/) · [LLM Evals FAQ](https://hamel.dev/blog/posts/evals-faq/) (error-analysis flywheel: open coding → axial coding → frequency → prioritize)
- Ground truth ภายใน: `docs/research/ai-chat/campvibe-schema-gap-analysis.md` · `docs/research/campvibe-ai-gap-closure-data-layer.md` · `docs/research/ai-chat/campvibe-conversation-to-booking-research.md` (P1–P18) · bake-off report (CAM-457 eval, 4 models, 2026-07-25)
