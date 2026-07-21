---
artifact: story
feature: ai-assistant
epic: assistant-answers-real-camper-asks-gap-closure-w1 (CAM-456)
story: assistant-finds-camps-in-all-77-provinces (CAM-458)
status: In Progress — spec (product-owner); G1-wave scope approved 2026-07-21, per-story G1 tap pending
version: v1
updated: 2026-07-21
---

<!--
User-facing chat behavior: the camper talks to น้องกองไฟ. The AC "Then" column carries the Thai the camper actually sees. The zero-result banner `ยังไม่เจอที่ถูกใจเลย ลองบอกเงื่อนไขใหม่ให้น้องกองไฟช่วยหาอีกทีได้นะ` is DETERMINISTIC UI copy (i18n `aiChat.zeroResult`, gated on searchAttempted && cards.length===0) — assert it char-for-char. The card display and the exact "here are camps" sentence are model-phrased; anchor the hard contract at the resolver + tool result. Framework English; EARS applies.
-->

## Story
As a **Camper**, I want น้องกองไฟ to find camps when I name ANY of Thailand's 77 provinces in Thai — including everyday variants of Bangkok (`กทม` / `กรุงเทพฯ` / `บางกอก`) — so that a real ask like "มีลานกางเต็นท์ที่บึงกาฬไหม" returns the camps that exist there instead of a false "ไม่เจอ".
Why: today only ~12 provinces are seeded in `ThailandLocation`, so the CAM-404 resolver `resolveProvinceForSearch` maps a Thai province name to its stored English value for those 12 ONLY — the other 65 fall through to the raw Thai string, which never matches the English `Location.province` column, so the search silently returns nothing even when camps exist. This is a data-completeness gap, not an NLU gap.
Scope: seed all 77 provinces as `ThailandLocation` province-level rows + add one canonical Bangkok-variant alias step to the existing resolver. No schema change, no new API contract, no region derivation (epic KPI = 40-case golden pass-rate; baseline: not measured — CAM-457 establishes it).
Depends on: CAM-404 (Thai→English province resolve — the seam this completes) · CAM-457 (eval harness — the golden suite this is measured against)

## AC
| # | Given | When | Then (user sees, Thai verbatim) | System effect | Neg/edge |
|---|---|---|---|---|---|
| AC-1 | A Thai province among all 77 (incl. one of the 65 newly seeded, e.g. `บึงกาฬ`) that has published camps | The camper asks น้องกองไฟ for camps in that province | The camper sees camp cards for that province (before this story the same ask returned the empty-state banner even though camps existed) | The Thai province name resolves via `ThailandLocation` to the stored English `provinceNameEn`, so the search queries the correct `Location.province` | EC-1 |
| AC-2 | The camper writes a common Bangkok variant `กทม` / `กรุงเทพฯ` / `บางกอก` | The camper asks for camps | The camper sees Bangkok camp cards, identical to writing `กรุงเทพมหานคร` | The variant normalizes to `กรุงเทพมหานคร` → resolves to `Bangkok` before the query runs | EC-2 |
| AC-3 | A resolvable province that genuinely has zero published camps | The camper asks for camps there | The camper sees `ยังไม่เจอที่ถูกใจเลย ลองบอกเงื่อนไขใหม่ให้น้องกองไฟช่วยหาอีกทีได้นะ` and NO camp is named above it | Resolution succeeds; the search truthfully returns 0 cards; the CAM-437 no-invent rule holds (no camp from training data) | EC-3 |
| AC-4 | The camper's word matches no province (a typo or non-province Thai word, e.g. `จังหวัดในฝัน`) | The camper asks for camps | The camper sees the same `ยังไม่เจอที่ถูกใจเลย ลองบอกเงื่อนไขใหม่ให้น้องกองไฟช่วยหาอีกทีได้นะ` banner, never an error message | The resolver returns the raw value unchanged (never throws) → the exact-match query yields 0 rows (CAM-404 fallback preserved) | EC-4 |

## Rules
- BR-1 Source of truth = the official 77 provinces of Thailand per กรมการปกครอง (Department of Provincial Administration, Ministry of Interior) — the 2-digit `provinceCode` scheme the seed already uses (Bangkok = `10`, Bueng Kan = `38`), aligned with ISO 3166-2:TH / TIS 1099-2548. Seed each as a `ThailandLocation` province-level row: `provinceCode` = the official 2-digit code, `districtCode` = `""` (the province row the existing loop creates), `provinceName` = the official Thai name, `provinceNameEn` = the standard RTGS English spelling `Location.province` uses (e.g. บึงกาฬ → `Bueng Kan`). (proves AC-1)
- BR-2 Idempotent seed: rows upsert on the existing `@@unique([provinceCode, districtCode])` key, so re-running `prisma db seed` never duplicates or throws — this reuses the existing upsert loop (`prisma/seed.ts` step 2), NO migration is added (`provinceName`/`provinceNameEn` columns already exist). (proves EC-5)
- BR-3 Bangkok-variant normalization: a small canonical alias map runs BEFORE the `ThailandLocation` lookup and maps common non-substring Bangkok variants to the official name — `กทม`, `กทม.`, `กรุงเทพฯ`, `บางกอก` → `กรุงเทพมหานคร`. Substring variants (e.g. `กรุงเทพ`, `อยุธยา`) already resolve through the existing `contains` lookup and need no map entry. Scope = Bangkok's high-frequency variants only; provincial nicknames/slang (`โคราช`, `เมืองคอน`, `หาดใหญ่`) are OUT (→ phase-2 lexicon). (proves AC-2)
- BR-4 Fallback UNCHANGED from CAM-404: a Thai word matching no province row (typo/non-province) OR a lookup error returns the raw value unchanged and never throws → the exact-match query yields 0 rows → the deterministic zero-result banner; English input still passes straight through with no DB round-trip. (proves EC-3/EC-4)
- BR-5 Honest empty (no hallucination): when the search returns 0 cards, the camper sees the deterministic banner `ยังไม่เจอที่ถูกใจเลย ลองบอกเงื่อนไขใหม่ให้น้องกองไฟช่วยหาอีกทีได้นะ` (i18n `aiChat.zeroResult`, gated on `searchAttempted && cards.length === 0`) and the CAM-437 no-invent grounding rule stands — the assistant must NOT name a camp from training knowledge. (proves AC-3)

## Edge cases
- EC-1 IF a resolved province has published camps THEN they appear as cards (the pre-fix false-empty is gone); IF it has none THEN the honest banner shows (EC-3) — no silent resolution miss either way (BR-1).
- EC-2 IF the camper writes a Bangkok variant not in the alias map AND not a substring of `กรุงเทพมหานคร` (an unforeseen form) THEN it falls through to the CAM-404 fallback (0 rows + banner), never an error — the map is additive, not a gate (BR-3/BR-4).
- EC-3 IF a resolvable province genuinely has zero published camps THEN the search returns 0 cards, the assistant shows `ยังไม่เจอที่ถูกใจเลย ลองบอกเงื่อนไขใหม่ให้น้องกองไฟช่วยหาอีกทีได้นะ`, and names no camp (BR-5).
- EC-4 IF the camper's word matches no province row (typo/non-province) THEN the resolver returns the raw value unchanged (never throws), the query yields 0 rows, and the banner shows — no crash, no hallucinated camp (BR-4).
- EC-5 IF `prisma db seed` is re-run THEN every province row upserts idempotently (unique on `provinceCode` + `districtCode=""`) — no duplicates, no throw (BR-2).

## Data
- `ThailandLocation` — add the 65 missing province-level rows (province row = `districtCode ""`) to reach all 77; fields `provinceCode` / `provinceName` (Thai) / `provinceNameEn` (English) are all EXISTING columns. Source list lives in `prisma/data/thailand-locations.json` (the seed's input). migration: none (data + seed only; no schema change).
- Districts for the 65 new provinces are NOT added (province-level rows only) — see Out of scope.
- No `region` column exists on `ThailandLocation` (`Location.region` is the only region field, set per camp-location); region derivation is CAM-463 — no region data is written here.

## Seams & refs
- Reuse: `resolveProvinceForSearch` in `lib/ai/tools/search-campsites.ts` (the CAM-404 resolver — EXTEND it with the alias step; do NOT fork a parallel resolver) · the existing upsert loop in `prisma/seed.ts` step 2 driven by `prisma/data/thailand-locations.json` (add rows; do not change the loop shape) · the deterministic banner `aiChat.zeroResult` + `searchAttempted` gate in `components/ai-chat/conversation.ts` / `components/ai-chat/AiChatMessageList.tsx` (unchanged) · the CAM-437 no-invent system-prompt rule (unchanged). Refs: CAM-404, CAM-437, gap-closure research §5 เฟส1 item 1-4 (pointers, not implementation).
- Reader/writer sweep of `ThailandLocation` province rows / `provinceNameEn` (grep: `thailandLocation`, `provinceNameEn`, `provinceName`): `resolveProvinceForSearch` = **NOW** (behavior: alias + full 77 coverage) · `prisma/data/thailand-locations.json` + seed loop = **NOW** (data) · `app/api/locations/search/route.ts` autocomplete + `components/LocationPicker.tsx` + `components/CampgroundForm.tsx` = **NO-CHANGE** (data-only benefit — the new provinces simply become selectable) · `app/dashboard/campsites/page.tsx` display + `app/api/location/route.ts` reverse-lookup = **NO-CHANGE** · the seed camp→location matcher (`prisma/seed.ts` ~L636, hardcoded to the 12 mock camps) = **NO-CHANGE**. The change is purely ADDITIVE (more rows + one alias step); no field shape changes, so every consumer stays non-breaking — one seam invariant: a Thai province name (or a mapped alias) resolves to exactly one stored `provinceNameEn`, and an unmapped word falls back to the raw value unchanged.

## Out of scope
- Region normalize / six-ภาค rollup (`Location.region` fill, any region column) → CAM-463.
- District-level rows for the 65 new provinces (host LocationPicker district selection for them) → follow-up if a real need appears; province-level resolution does not require districts.
- Provincial nicknames/slang → province resolution (`โคราช`→Nakhon Ratchasima, `เมืองคอน`→Nakhon Si Thammarat) → phase-2 lexicon/ConceptMapping (research §5 เฟส2 item 2-5).
- Any change to the zero-result banner copy or the CAM-437 no-invent rule → owned by CAM-437 / the frontend; unchanged here.

## Self-verify
- AC-1 → unit: `resolveProvinceForSearch` returns the correct `provinceNameEn` for ALL 77 Thai province names (table-driven, mirrors `__tests__/cam-404-search-campsites-province-resolve.test.ts`), and the built `where.location.province` equals the expected English value. Card display for a new-province camp = owner-verify (needs a camp seeded in a new province).
- AC-2 → unit: `กทม` / `กทม.` / `กรุงเทพฯ` / `บางกอก` each resolve to `Bangkok`.
- AC-3 / EC-3 → integration + owner-verify: a resolvable province with 0 camps returns `{ cards: [] }`; the chat shows `aiChat.zeroResult` verbatim with no camp named (CAM-437 prompt test already guards no-invent).
- AC-4 / EC-4 → unit: a non-province word returns the raw value unchanged and `executeSearchCampsites` resolves without throwing (CAM-404 fallback regression).
- EC-5 → integration: running the seed twice leaves exactly 77 province-level rows (idempotent upsert).
- Story-specific: assert province-level row count = 77 · assert no new migration file (no schema change) · English passthrough still fires zero DB lookups (CAM-404 regression) · the golden eval (CAM-457) is re-run and does not regress.
- Gate = /quality-gate · Done = every AC verified on localhost (dev DB) before merge; AC-1 card display is owner-verify on the real chat with a camp seeded in a new province; G4 re-verifies on the real Staging URL.

## Changelog
- v1 (2026-07-21) — created; Discovery (6-dimension) run against the real schema/seed/resolver; Business+Functional gaps closed. No 🔴: `provinceName`/`provinceNameEn` columns already exist, so this is data + one alias step, no schema change. 🟡 (defaulted): district rows for the 65 = province-level only; region column = N/A (none exists → CAM-463 owns it); alias mechanism (map-in-code vs seed alias rows) = architect's G2 detail. Ready for G1 tap.
