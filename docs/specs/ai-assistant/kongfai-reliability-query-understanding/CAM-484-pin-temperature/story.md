---
artifact: story
feature: ai-assistant
epic: kongfai-reliability-query-understanding
story: pin-temperature (CAM-484)
version: 1
class: spec-lite (owner-approved 2026-07-25; single source file + one test flip, no schema)
---

# CAM-484 — Pin model temperature = 0.2 for deterministic tool routing

## Story

As a **Camper**, I want the assistant's tool routing to be as consistent as possible run-to-run, so that the same question reliably reaches the same tool instead of varying with the provider's default sampling temperature.

**Scope:** ส่ง `temperature: 0.2` ในทุก model call (non-streaming + streaming) แทนการปล่อยให้ OpenRouter/โมเดลใช้ default. Reverses the previous BR-8 decision ("temperature deliberately not pinned").
**Depends on:** CAM-416 (agent loop), CAM-457 (eval harness — BR-8 lives in its test).

Why: bake-off + fail-analysis (2026-07-25) ชี้ว่าเคสที่พังคือ "route ไม่นิ่ง / ไม่ chain"; อุณหภูมิต่ำลด variance ของการเลือก tool. Owner เลือกค่า 0.2 (นิ่งพอ + เสียง persona ยังเป็นธรรมชาติ, ไม่ใช่ 0 ที่แข็งเกินไป).

## AC

| # | Given | When | Then (user sees, Thai verbatim) | System effect | Neg/edge |
|---|---|---|---|---|---|
| AC-1 | ผู้ใช้ถามอะไรก็ได้ (non-streaming path) | ระบบเรียกโมเดล | คำตอบเหมือนเดิมทุกประการต่อผู้ใช้ (ไม่มีการเปลี่ยน UX) | outgoing request body มี `temperature: 0.2` | — (ไม่มี user-facing failure; เป็น config) |
| AC-2 | ผู้ใช้ถามใน streaming path | ระบบเรียกโมเดลแบบ stream | คำตอบไหลเหมือนเดิม | outgoing stream request body มี `temperature: 0.2` | — |

> `—` ใน Neg/edge: story นี้เป็น config-only ไม่มี user-facing branch ที่ fail; ความถูกต้องพิสูจน์ที่ payload ไม่ใช่ที่ UI.

## Rules

- **BR-1:** นิยาม `export const TEMPERATURE = 0.2;` ไว้ข้างๆ `MAX_TOKENS` (`lib/ai/openrouter-client.ts` ~L123) — ค่าเดียว ใช้ร่วมทั้งสอง payload builder (single source, ห้าม hard-code ซ้ำ).
- **BR-2:** ใส่ `temperature: TEMPERATURE` ใน body ของ **ทั้งสอง** จุด: non-streaming (~L591) และ streaming (~L1234). ไม่แตะ field อื่น (model/messages/tools/max_tokens/tool_choice/stream คงเดิม).
- **BR-3 (reverses old BR-8):** BR-8 เดิม ("body carries no temperature key") **ยกเลิก**. อัปเดต test `__tests__/cam-457-eval-harness.test.ts` (~L785-793) จาก `expect(body).not.toHaveProperty('temperature')` → assert `body.temperature === 0.2` ทั้ง non-stream และ (ถ้ามี) stream path. อัปเดต comment BR-8 ที่หัวไฟล์ (~L21) ให้สะท้อนการ pin.
- **BR-4:** ไม่เปลี่ยน default model, MAX_TOKENS, หรือ agent-loop constant ใดๆ. Fallback model call ก็ต้องได้ temperature เดียวกัน (ถ้า fallback ใช้ payload builder เดียวกันอยู่แล้ว = ได้ฟรี; ยืนยัน).

## Edge cases

- **EC-1:** IF OPENROUTER_MODEL override ถูกตั้ง (eval/bake-off) THEN temperature ยังส่ง 0.2 เท่าเดิม (ค่าไม่ผูกกับ model id).
- **EC-2:** IF fetch body ถูก mock ใน test THEN ทั้ง non-stream และ stream body สะท้อน temperature (ครอบ BR-2 สองจุด).

## Data

ไม่มี schema / migration / persisted field. เป็นค่าคงที่ใน request payload.

## Seams & refs

- `lib/ai/openrouter-client.ts` — const block (~L123 ใกล้ MAX_TOKENS) · non-stream body (~L591) · stream body (~L1234) · file-head BR comment (~L8/L21).
- `__tests__/cam-457-eval-harness.test.ts` (~L785) — the BR-8 test to flip.
- reuse const pattern ของ `MAX_TOKENS` (export const, อ้างในทั้งสอง builder).

## Out of scope

- ไม่วัด "temperature ช่วย routing ขึ้นจริงเท่าไร" ในสตอรี่นี้ — นั่นคือ re-eval (มี cost, owner go แยก). สตอรี่นี้พิสูจน์แค่ว่า **ส่งค่าออกไปถูกต้อง**.
- ไม่ทำ temperature แบบ per-call/dynamic (ค่าเดียวคงที่).

## Self-verify

- [ ] `grep -n "TEMPERATURE" lib/ai/openrouter-client.ts` → const 1 จุด + ใช้ 2 จุด
- [ ] `npx vitest run __tests__/cam-457-eval-harness.test.ts` → เขียว (BR-8 flipped)
- [ ] `npx vitest run __tests__/cam-416*` → agent-loop regression เขียว (body change ไม่พังการ chain)
- [ ] `npm run typecheck` + `npm run lint` clean
- [ ] ยืนยัน fallback call ก็ได้ temperature 0.2 (อ่าน code path)
