---
ticket: CAM-511
epic: CAM-508
title: Concept→filter mapping + equipment filter + drop-unmappable (cycle-1 FIX 2)
class: standard-story
version: 1
---

# CAM-511 — Concept→filter mapping + equipment filter (cycle-1 FIX 2)

## Story

As a **camper**, I want abstract requests ("ลานสำหรับมือใหม่", "ริมธารนั่งชิล") mapped to the campsite data we actually hold, so that I get real results instead of a 0-result the model got by searching my concept word literally.

Scope: an `equipment` filter on `searchCampsites` (over the existing Equipment-for-rent options), a concept-mapping prompt block, and a drop-unmappable rule. Built ON TOP of `feature/cam-510-always-search` (so one eval proves both cycle-1 fixes). NO schema, NO new data — the equipment data already exists.
Depends on: CAM-510 (always-search; this branch includes it).

Why: cycle-1 analysis (real DB, 475 camps) — "มือใหม่" keyword-searched → 0, but `equipment:[TENT,LEDL,POWE]` = 23 discriminating camps (the data exists, the model just can't derive the mapping); "ริมธาร…จิบเบียร์" over-constrained (จิบเบียร์ has no data) when `terrain:RIVE`+`facility:PICN` = 129 camps would answer it.

## AC

| # | Given | When | Then (user sees) | System effect | Neg/edge |
|---|---|---|---|---|---|
| AC-1 | A camper asks for a beginner / no-gear camp ("มือใหม่", "ไม่มีอุปกรณ์") | the assistant searches | `searchCampsites` is called with `equipment` including the essential rental kit (tent + light + power) | a real equipment-filtered result (23 camps in current data), not a keyword search | AC-3 |
| AC-2 | A request mixes mappable + unmappable characteristics ("ริมธาร ตั้งโต๊ะจิบเบียร์") | the assistant searches | It searches the mappable part (terrain=RIVE, facility=PICN) and drops the unmappable term (จิบเบียร์) — never a 0-result dead-end | a real result | AC-3 |
| AC-3 | `searchCampsites` is called with an `equipment` filter | the tool runs | Only camps offering ALL the listed rental equipment are returned | filter applied over the Equipment-for-rent options m2m | EC-1 |

## Rules

- BR-1: `searchCampsites` gains an `equipment` arg — `z.enum(EQUIPMENT_CODES).or(z.array(...)).optional()`, `EQUIPMENT_CODES` = the 11 real `Equipment for rent` codes (TENT/POWE/TFAN/BLKT/LEDL/GDST/SSTV/LSTV/CHAI/FYST/ICBK). An array means the camp must offer ALL listed items (AND, like a "rents the full kit" query) — match the existing multi-facility semantics used in `buildCampSiteWhere`.
- BR-2: **Concept-map prompt block** — teach the model the non-obvious mappings it cannot derive: `มือใหม่ / ไม่มีอุปกรณ์ / มาตัวเปล่า → equipment=[TENT,LEDL,POWE]` (the essential rental kit). Keep it a short, extensible list; this is the inline concept-map (extract to `prisma/data/concept-map.json` + a pre-pass when the list grows past a handful — do NOT build that infra for one entry).
- BR-3: **Drop-unmappable rule** — map every characteristic you CAN to a filter; for a term with no matching filter/data (จิบเบียร์, เด็ก, a mood word), drop it and search the mappable part. Never keyword-search a concept word and never dead-end. (Extends CAM-510's always-search.)
- BR-4: Keep the existing keyword rule (keyword is for specific NAMES only) and CAM-510's always-search intact — this adds mapping, doesn't regress them.

## Edge cases

- EC-1: IF a camp offers only SOME of a multi-item `equipment` array THEN it is excluded (AND semantics) — a partial-kit camp isn't a full "arrive empty-handed" match.
- EC-2: IF a concept has no good existing-data map (proven by the loop) THEN it is NOT forced here — it stays a `data-suggestions.md` entry, not a bad prompt mapping.

## Data

None — `equipment` filters the existing `Equipment for rent` MasterData options already on camps. No schema, no seed change.

## Seams & refs

- `lib/ai/tools/search-campsites.ts` — add `EQUIPMENT_CODES` + the `equipment` arg + the where-clause over the options relation (mirror the facilities filter). Update the tool description so the model knows the arg exists.
- `lib/ai/openrouter-client.ts` `buildSystemPrompt` — the concept-map block (BR-2) + drop-unmappable rule (BR-3), near the keyword/always-search rules.
- `scripts/ai-eval/golden-cases.json` — add cases: "ลานสำหรับมือใหม่" → `searchCampsites` with `equipment` ⊇ [TENT,LEDL,POWE] (subset match); optionally "ริมธารนั่งชิล" → `searchCampsites` terrain RIVE. Update BOTH count ceilings (cam-457 + cam-459 — the two-guards trap).

## Out of scope

- The concept-map.json + resolver pre-pass infra (build when concepts multiply, not for one).
- The comfort/safety/access data gaps (hot shower, host, flat ground) — logged in `data-suggestions.md`, owner-picked later.

## Self-verify

- [ ] `npx tsc --noEmit` clean; `npm run lint` 0 new errors
- [ ] `campSite.count` still shows `equipment:[TENT,LEDL,POWE]` = a discriminating subset (not 0 / not ~all)
- [ ] Both count ceilings updated; `npx vitest run __tests__/cam-457-eval-harness.test.ts __tests__/cam-459-answer-policy-3-zones.test.ts` green
- [ ] (orchestrator runs the combined paid `ai:eval` PROVE across CAM-510 + CAM-511)
