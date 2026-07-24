---
artifact: story
feature: ai-assistant
epic: assistant-answers-real-camper-asks-gap-closure-w1 (CAM-456)
story: search-by-region-six-region-rollup-from-provinces (CAM-463)
status: Draft (Discovery complete — ready for G1)
version: v1
updated: 2026-07-24
class: M — full spec-first (adds a tool arg = contract addition + a province-set where-shape + a 77→6 map; multi-file surface, not spec-lite)
---

<!--
User-facing chat behavior: the camper talks to น้องกองไฟ. The AC "Then" column carries the Thai the camper actually sees. The ONE deterministic UI string is the zero-result banner `ยังไม่เจอที่ถูกใจเลย ลองบอกเงื่อนไขใหม่ให้น้องกองไฟช่วยหาอีกทีได้นะ` (i18n `aiChat.zeroResult`, gated on `searchAttempted && cards.length === 0`, reused from CAM-458) — assert it char-for-char. The camp cards and the "here are camps" sentence are model-phrased; anchor the hard contract at the region resolver + the tool result, not the model's prose. Framework English; EARS applies.

KEY DECISION handed to the architect at G2 (flagged, NOT decided here — see ## Data): region as a DERIVED code lookup (default, no migration) vs a STORED column. The camper-facing AC below is identical either way — this story is region-as-a-search-FILTER only; the aggregate/overview ("ภาคเหนือมีกี่ลาน อากาศเป็นไง") is phase-2 (## Out of scope).
-->

## Story
As a **Camper**, I want น้องกองไฟ to find camps when I ask by ภาค (region) — `ภาคเหนือ`, `อีสาน`, `ภาคใต้` — so that a real ask like "ภาคเหนือมีลานกางเต็นท์ที่ไหนบ้าง" returns camps across every province in that region instead of a false "ไม่เจอ" or camps from one province only.
Why: today `searchCampsites` filters on a SINGLE exact province (`Location.province = <English>`), and `Location.region` is a free-string nullable that no search reads — so a region ask has nowhere to land: the model must guess one province or enumerate 20 อีสาน provinces into a one-province arg, and misses. This is a missing-deterministic-service gap (research §5 เฟส1 item 1-4), not an NLU gap.
Scope: a deterministic region→province-set expansion for the `searchCampsites` tool (region-as-a-FILTER). NO aggregate/count/overview, NO season profile, NO change to the zero-result banner or the CAM-437 no-invent rule.
Depends on: CAM-404/CAM-458 (Thai→English province resolve + all 77 provinces seeded — the seam this extends) · CAM-457 (eval harness — the golden suite this is measured against) · CAM-461 (the `string | string[]` widening pattern `buildCampSiteWhere` reuses for the province set)

## AC
<!-- Then = user-visible (deterministic string = verbatim Thai; card text = model-phrased) · System effect = data outcome, plain language · Neg/edge = failure twin (EC-n). -->
| # | Given | When | Then (user sees, Thai verbatim) | System effect | Neg/edge |
|---|---|---|---|---|---|
| AC-1 | Published camps exist across several northern provinces (`เชียงใหม่`, `เชียงราย`, `น่าน`, …) | The camper asks น้องกองไฟ "ภาคเหนือมีลานกางเต็นท์ที่ไหนบ้าง" | The camper sees camp cards drawn from more than one northern province (not just one), capped at 10 | `ภาคเหนือ` resolves to the canonical set of northern English province names; the search queries `Location.province ∈ that set` | EC-1 |
| AC-2 | The northeastern region has published camps; the camper uses the colloquial `อีสาน` (not the formal name) | The camper asks "อยากไปแคมป์แถวอีสาน" | The camper sees northeastern camp cards, identical to asking with `ภาคตะวันออกเฉียงเหนือ` | `อีสาน` normalizes to the same canonical NORTHEAST region → the same province set | EC-2 |
| AC-3 | The camper names a single province (the CAM-404 path, unchanged) | The camper asks "หาลานที่เชียงใหม่" | The camper sees Chiang Mai camps only, exactly as before this story | The single-province exact-match filter runs unchanged; no region expansion happens | EC-3 |
| AC-4 | The camper names BOTH a region and a province in one ask (`ภาคเหนือ จังหวัดเชียงใหม่`) | The camper asks for camps | The camper sees Chiang Mai camps only (the more specific province wins) | The province filter is applied and the region is dropped — the sets are never intersected into an empty result | EC-4 |
| AC-5 | A recognized region genuinely has zero published camps in every one of its provinces | The camper asks for camps in that region | The camper sees `ยังไม่เจอที่ถูกใจเลย ลองบอกเงื่อนไขใหม่ให้น้องกองไฟช่วยหาอีกทีได้นะ` and NO camp is named above it | Region resolves; the search truthfully returns 0 cards; the CAM-437 no-invent rule holds | EC-5 |
| AC-6 | The camper's word is neither one of the 6 regions nor a province (e.g. `ภาคสวรรค์`) | The camper asks for camps | The camper sees the same `ยังไม่เจอที่ถูกใจเลย ลองบอกเงื่อนไขใหม่ให้น้องกองไฟช่วยหาอีกทีได้นะ` banner, never an error and never a fabricated region | The resolver returns the raw value unchanged (never throws) → the query yields 0 rows (CAM-404/CAM-458 fallback preserved) | EC-6 |

## Rules
- BR-1 Source of truth = Thailand's standard **6-region scheme** (การแบ่ง 6 ภาคของคณะกรรมการภูมิศาสตร์แห่งชาติ): `ภาคเหนือ` NORTH (9 provinces) · `ภาคตะวันออกเฉียงเหนือ` NORTHEAST (20) · `ภาคกลาง` CENTRAL (22) · `ภาคตะวันออก` EAST (7) · `ภาคตะวันตก` WEST (5) · `ภาคใต้` SOUTH (14) — a partition of all 77 provinces (9+20+22+7+5+14 = 77). The exact per-province assignment is a DATA artifact (like CAM-458's 77-province list), authored against this official source; the map's values are the English `provinceNameEn` strings `Location.province` stores (so a resolved region yields the exact English names the query filters on). (proves AC-1)
- BR-2 Region-alias normalization — each region accepts its formal name plus common variants, all mapping to one canonical region: `ภาคเหนือ`/`เหนือ`/`ทางเหนือ`; `ภาคตะวันออกเฉียงเหนือ`/`ภาคอีสาน`/`อีสาน`; `ภาคกลาง`/`กลาง`; `ภาคตะวันออก`/`ตะวันออก`; `ภาคตะวันตก`/`ตะวันตก`; `ภาคใต้`/`ใต้`/`ปักษ์ใต้`. The alias set is additive (a form outside it is not an error — see BR-4). Sub-region forms (`อีสานใต้`, `ล้านนา`) are NOT standard 6-region units → out of scope. (proves AC-2)
- BR-3 Precedence — when a specific province and a region are BOTH present, the province wins (more specific); the region is dropped, never AND-ed against the province set (which would empty the result). A region alone expands to its province set. (proves AC-3/AC-4)
- BR-4 Honest empty / fallback (UNCHANGED from CAM-404/CAM-458) — a recognized region with 0 camps OR a word matching no region and no province both yield 0 cards and the deterministic banner `ยังไม่เจอที่ถูกใจเลย ลองบอกเงื่อนไขใหม่ให้น้องกองไฟช่วยหาอีกทีได้นะ`; the resolver never throws; the CAM-437 no-invent grounding rule stands — น้องกองไฟ must NOT name a camp OR affirm a fake region from training knowledge. (proves AC-5/AC-6)
- BR-5 Region is a FILTER only — it narrows the province set and nothing else; it computes no count/overview/season aggregate (phase-2, out of scope). A region search returns at most `SEARCH_CAMPSITES_MAX_RESULTS` (10) cards — the same cap every search already enforces, unchanged. (bounds AC-1)

## Edge cases
<!-- covers: invalid · empty/zero · region+province conflict · unrecognized · boundary. loading/forbidden = inherited from the existing chat shell (searchCampsites is guest-tier, no auth) — not this story's surface. -->
- EC-1 IF a recognized region has published camps in ≥1 of its provinces THEN cards from across those provinces appear (capped at 10); IF none THEN the honest banner (EC-5) — no silent resolution miss either way (BR-1).
- EC-2 IF the camper uses a region variant outside the alias set but clearly a region (an unforeseen form) THEN it falls through to the BR-4 fallback (0 rows + banner), never an error — the alias set is additive, not a gate (BR-2/BR-4).
- EC-3 IF the camper names a province (not a region) THEN the CAM-404 single-province exact-match path runs unchanged — no region expansion, no regression (BR-3).
- EC-4 IF both a province AND a region are supplied THEN the province wins and the region is dropped; the province set is never intersected with the single province into an empty result (BR-3).
- EC-5 IF a recognized region genuinely has zero published camps THEN 0 cards + the deterministic banner, no camp named (BR-4).
- EC-6 IF the word matches neither a region nor a province (typo/nonsense) THEN the resolver returns the raw value unchanged (never throws), the query yields 0 rows, and the banner shows — no crash, no invented region or camp (BR-4).

## Data
- Default (DERIVED) approach → **no new app entity/field, no migration**: the province→region relation is a code lookup table (canonical region → English `provinceNameEn[]`), NOT a DB column. `searchCampsites` gains ONE optional `region` arg (string); `buildCampSiteWhere` gains province-SET matching (`location.province ∈ set`) as a backward-compatible widening (the single-province path stays byte-identical). migration: none.
- KEY DECISION for the architect at G2 (flag, do NOT decide here): **DERIVED lookup** (province→region map in code, no migration — research §5 เฟส1 item 1-4, the default above) vs **STORED column** (add a `region` to `ThailandLocation`, or backfill `Location.region` to a canonical 6-value enum). DERIVED = lower risk, no migration, fully satisfies region-as-a-filter (this story's whole scope). STORED = unlocks the phase-2 aggregate rollup ("ภาคเหนือมีกี่ลาน") without re-deriving, but needs a reversible migration + a backfill of today's inconsistent free-string `Location.region`. Both hand off to the architect; the camper-facing AC of THIS story is identical either way.
- Schema reality (diffed against `prisma/schema.prisma`): `Location.region` is `String?` free-string today, written per-camp and read only for display (`get-camp-detail.ts`); `ThailandLocation` has provinceCode/provinceName/provinceNameEn but NO region column; `AdminArea.level` is PROVINCE/DISTRICT/SUBDISTRICT with no region level. So a stored region is genuinely absent today — the derived map introduces it in code without touching any of these.

## Seams & refs
- Reuse: `resolveProvinceForSearch` in `lib/ai/tools/search-campsites.ts` (the CAM-404/CAM-458 resolver — add a SIBLING region-resolve step, do NOT fork a parallel search path) · `buildCampSiteWhere` in `lib/campsite-filters.ts` (extend the location filter to accept a province SET via the same additive `string | string[]` widening CAM-461 used for taxonomy — do not fork the where-builder) · the deterministic banner `aiChat.zeroResult` + `searchAttempted` gate (unchanged, CAM-458 seam) · the CAM-437 no-invent system-prompt rule (unchanged) · the golden eval `scripts/ai-eval/golden-cases.json` + `scripts/ai-eval/case-schema.ts` (add P18 region cases — the expected-param KEY is pinned once G2 picks the tool mechanism; same additive/soft dependency CAM-460 has on CAM-457, `DEFAULT_MAX_EVAL_CASES=500`, fixture well under the cap — no ceiling lift). Refs: CAM-404, CAM-458, CAM-461, CAM-437, gap-closure research §5 เฟส1 item 1-4 + §2 P18 (pointers, not implementation).
- Reader/writer sweep (grep: `resolveProvinceForSearch`, `buildCampSiteWhere`, `location.province`, `Location.region`): `executeSearchCampsites` (search-campsites.ts) = **NOW** (new region arg + resolve) · `buildCampSiteWhere` = **NOW** (province-set match) · every OTHER `buildCampSiteWhere` caller — catalog grid, counts (`app/`, catalog cursor) = **NO-CHANGE** (the region arg is AI-tool-only + optional; the single-province path is byte-identical) · `get-camp-detail.ts` region read (reads `Location.region` free-string for display) = **NO-CHANGE** (this story never writes `Location.region` under the derived default) · `Location.region` writers (host `CampgroundForm` / `lib/validations/location.ts`) = **NO-CHANGE** under the derived default. One seam invariant: a region word (or alias) resolves to exactly ONE canonical 6-region set of English province names, an unrecognized word falls back to the raw value unchanged (the CAM-458 invariant, extended from a single province to a province set). IF G2 picks the STORED approach, the sweep expands to every `Location.region` reader/writer plus a backfill — flagged now.

## Out of scope
- Region-level AGGREGATE / overview ("ภาคเหนือมีกี่ลาน", "ภาคอีสานอากาศเป็นไง") + `RegionSeasonProfile` (6-region × 12-month season table) → phase-2 (research §5 เฟส2 item 2-2/2-3) → follow-up CAM-id TBD. This story is region-as-a-search-FILTER only.
- Backfilling / normalizing the free-string `Location.region` column to the 6-value enum → only if G2 picks the STORED approach (owned by architect/backend then) → else N/A (derived default writes nothing).
- Provincial nicknames/slang province resolution (`โคราช`→Nakhon Ratchasima, `หาดใหญ่`→a district) → phase-2 lexicon (CAM-458 out-of-scope, unchanged here).
- Sub-region / cultural granularity (`อีสานใต้`, `ล้านนา`, `สามจังหวัดชายแดนใต้`) → not standard 6-region units → phase-2 lexicon if a real need appears.
- Growing the golden suite beyond the P18 region smoke cases this story adds → CAM-457 owns corpus growth.

## Self-verify
- AC-1/AC-2 → unit: the region resolver expands each of the 6 region names + every BR-2 alias to the correct English province set (table-driven, mirrors `__tests__/cam-404-*`/`cam-458-*`); the built `where.location.province` `in`-set equals the expected list. Cross-province card display = owner-verify (needs camps seeded in ≥2 provinces of one region) + eval (P18 golden case: a region utterance → `searchCampsites` with region-scoped params).
- AC-3 → unit: a province-only utterance still produces the single-province `where.location.province = <English>` (CAM-404 regression — no region expansion).
- AC-4 → unit: province+region input yields the single-province where (province wins); the region is dropped.
- AC-5/AC-6 → integration + owner-verify: a recognized-but-empty region AND an unrecognized word each return `{ cards: [] }`; the chat shows `aiChat.zeroResult` verbatim with no camp named (CAM-437 no-invent guard already exists).
- Story-specific: assert the region map is a PARTITION of exactly 77 provinces across 6 regions — no province in two regions, none missing (completeness/partition test) · assert every OTHER `buildCampSiteWhere` caller is byte-identical for a single-province call (regression) · the resolver never throws on any input · re-run the golden eval (CAM-457) — no regression + the new P18 case passes.
- Gate = /quality-gate · Done = every AC verified on localhost (dev DB) before merge; AC-1 cross-province display is owner-verify on the real chat; G4 re-verifies on the real Staging URL.

## Changelog
- v1 (2026-07-24) — created; Discovery (6-dimension) run against the real schema/resolver/where-builder. Business+Functional gaps closed. No 🔴. 🟡 (defaulted): stored-vs-derived region data = DERIVED code-map (research §5-aligned, no migration) → architect ratifies at G2; exact 77→6 assignment = official 6-region scheme, data artifact for backend (like CAM-458's province list); tool mechanism (new `region` arg vs region-detection inside the province arg) = G2 detail; P18 eval expected-param key = pinned once G2 picks the mechanism. Ready for G1 tap.
