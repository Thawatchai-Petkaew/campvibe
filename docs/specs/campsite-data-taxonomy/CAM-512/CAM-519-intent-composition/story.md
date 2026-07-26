---
ticket: CAM-519
epic: CAM-512
title: Intent→taxonomy composition — map camper intents to the completed data (S7, payoff)
class: standard-story
version: 1
---

# CAM-519 — Intent→taxonomy composition (S7, the payoff)

## Story

As a **camper**, I want my intent words (มือใหม่, จิบเบียร์, ริมทะเล, สายลุย, วิวสวย, น้ำตก) mapped to the campsite data we now actually hold, so that the assistant returns the right camps by composing the completed taxonomy — instead of the thin cycle-1 map that "หยิบไปแค่ไม่กี่เรื่อง" (equipment[3] only).

Scope: an AI-only change — upgrade the concept-map/prompt in `buildSystemPrompt` (`lib/ai/openrouter-client.ts`) to map intents to the S1-S6 taxonomy, + composite golden cases. NO product schema/data change (S1-S6 already added the data). This is the epic's payoff; PROVE via `ai:eval`.
Depends on: S1-S6 (the taxonomy the map now targets).

Why: after completing the data, an intent must map to the STRONGEST now-available signal, not the one thing that existed before. "มือใหม่" is best served by `camperStyle=CHIC` (host-declared สบาย) — far more accurate than equipment[TENT,LEDL,POWE]. The derived beginner facet (S6) then supplies the "why" in the answer.

## AC

| # | Given | When | Then (user sees) | System effect | Neg/edge |
|---|---|---|---|---|---|
| AC-1 | Camper asks "ลานสำหรับมือใหม่ / สายสบาย / สายคุณหนู" | assistant searches | Sets `camperStyle=CHIC` (primary), optionally `type=GLAMP` or the gear-kit — a real result | searchCampsites w/ the composed filter | AC-6 |
| AC-2 | "ลานจิบเบียร์ได้ / ก่อไฟได้" | searches | `annotatedFeatures=ALCO` / `FIRE` | real result (was 0 in cycle-1) | — |
| AC-3 | "ลานริมทะเล / มีน้ำตก / แอ่งเล่นน้ำ / ทุ่ง" | searches | `terrain=SEA / WATF / SWMH / FILD` | real result | — |
| AC-4 | "ลานสายลุย / ทรหด" · "ลานวิวสวย" · "ลานมีน้ำอุ่น" | searches | `camperStyle=IDMT/DIFT` · `type=VIEW` · `facilities=HOTW` | real result | — |
| AC-5 | Camper asks "ลานนี้เหมาะกับมือใหม่ไหม" for a named camp | assistant answers | Uses the derived beginner/camper_type facet (S6) evidence to explain why | getCampDetail facet | — |
| AC-6 | An intent maps to MANY attributes | searches | The assistant picks the strongest 1-2 filters, NOT a strict AND of all (which would return 0) | never over-narrow to 0 | AC-1 |

## Rules

- BR-1: **Replace/upgrade the cycle-1 มือใหม่ concept-map block** in `buildSystemPrompt`. New mapping (teach the model): `มือใหม่ / สายสบาย / สายคุณหนู / ไม่มีอุปกรณ์ → camperStyle=CHIC` as the primary; may ALSO use `type=GLAMP` (แกลมปิ้ง = พร้อมกาง) or `equipment=[TENT,LEDL,POWE]` (เช่าอุปกรณ์) or `facilities=HOTW` — but as ALTERNATIVES/at most a 2-filter combo, never a strict AND of all (BR-4).
- BR-2: **Add the new-taxonomy intent mappings** (one concise block): จิบเบียร์/ดื่มเบียร์/แอลกอฮอล์→`annotatedFeatures=ALCO` · ก่อไฟ→`FIRE` · ผู้พิการ/wheelchair→`ADAA` · ริมทะเล/ทะเล→`terrain=SEA` · น้ำตก→`WATF` · แอ่งน้ำ/เล่นน้ำ→`SWMH` · ทุ่ง/ทุ่งดอกไม้→`FILD` · สายลุย/ทรหด/ลำบาก→`camperStyle=IDMT` or `DIFT` · วิวสวย→`type=VIEW` · น้ำอุ่น→`facilities=HOTW`. Keep it terse (these mostly already work via the jsonSchema descriptions added in S1-S5; this is a reinforcing concept-map, not a duplicate).
- BR-3: **Answer uses the facet (S6)** — for "เหมาะกับมือใหม่ไหม" about a named/shown camp, the model calls getCampDetail and grounds the answer in the returned beginner/camper_type facet evidence (already wired by S6; the prompt should nudge it to cite the facet).
- BR-4: **Never over-narrow** — an intent maps to the strongest 1-2 filters; do NOT AND together 5+ groups (no camp has all → 0). If unsure, one anchor filter + let the result stand. (This is the correctness guard on "composition".)
- BR-5: Do NOT regress the always-search (CAM-510), drop-unmappable (CAM-511), place-resolver, availability-chaining, or guardrail behaviors.

## Edge cases

- EC-1: an intent word with no taxonomy home (still) → drop it + search the mappable part (CAM-511 rule), never dead-end.
- EC-2: a composite that would return 0 → prefer the single strongest filter over the AND (BR-4).

## Data

None — AI prompt + golden cases only. The taxonomy data is from S1-S6.

## Seams & refs

- `lib/ai/openrouter-client.ts` `buildSystemPrompt` — the cycle-1 concept-map block (added in CAM-511) is the thing to upgrade; keep it near the keyword/always-search/drop-unmappable rules.
- `scripts/ai-eval/golden-cases.json` — add composite cases: มือใหม่→searchCampsites{camperStyle:['CHIC']} (subset — accept camperStyle present); จิบเบียร์→{annotatedFeatures:['ALCO']}; ริมทะเล→{terrain:['SEA']} (or 'SEA' string); วิวสวย→{type:'VIEW'}; น้ำอุ่น→{facilities:['HOTW']}. Use subset match (not strict) — the point is the RIGHT group/code is set. Update BOTH count ceilings.
- PROVE: the orchestrator runs `npm run ai:eval` (paid ~$0.05) after build.

## Out of scope

- Facet-ranked search ordering (searchCampsites sorting by the beginner facet) — a later enhancement; this slice maps intent→filter + cites the facet in answers.
- S8 metadata groups.

## Self-verify

- [ ] `npx tsc --noEmit` + `npm run lint` clean; `npx vitest run __tests__/cam-457-eval-harness.test.ts __tests__/cam-459-*.test.ts` green (count ceilings updated)
- [ ] The new golden cases parse + are in the fixture; concept-map block upgraded (no strict multi-AND)
- [ ] (orchestrator) `ai:eval`: the composite cases pass, guardrail 100%, no regression vs the pre-S7 baseline
