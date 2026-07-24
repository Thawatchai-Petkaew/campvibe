---
linear: CAM-463
feature: ai-assistant
epic: assistant-answers-real-camper-asks-gap-closure-w1 (CAM-456)
persona: Camper
artifact: tech
owner: architect
status: G2 Design (Technical) — architect handoff, ready for build
version: v1
updated: 2026-07-24
---
# Tech — Search by region: 6-region rollup from provinces (CAM-463)

> Rich contract artifact for a **DERIVED** region-as-a-search-filter. NO schema change, NO
> migration. Everything below is additive to the existing `searchCampsites` tool + the shared
> `buildCampSiteWhere`. The camper-facing contract is `story.md ## AC`; this file pins the 6
> architectural decisions the build (backend + qa) needs so nothing is guessed.

## Scope of this contract

`searchCampsites` is an **internal AI tool**, not an HTTP `/api/*` endpoint — its "API contract" is
the zod args schema + `jsonSchema` at the `tool-registry` boundary (`lib/ai/tools/search-campsites.ts`),
the same place CAM-408/427/461 recorded their arg additions. So there is **no `schema/api-schema.json`
change** (that file catalogues HTTP routes; this tool is dispatched in-process). Authz: the tool is
`tier: 'guest'` (no session, no ownership) — unchanged; a region filter adds no new authz surface.

---

## Decision 1 — DERIVED code map, not a STORED column

**Decision.** The province→region relation is a **pure code constant**, NOT a DB column. Home: a new
module **`lib/thai-regions.ts`** exporting (a) the canonical region type, (b) the region→English-province
map, (c) the Thai-word alias map (Decision 3). Region "search" = expand the region to its list of English
`provinceNameEn` strings and reuse the province filter path. **No entity, no field, no migration.**

- **Vocabulary — one shared identifier.** The map's values are the exact **English `provinceNameEn`**
  strings `Location.province` stores and `resolveProvinceForSearch` (CAM-404/458) returns (e.g. `"Chiang Mai"`,
  `"Nakhon Ratchasima"`). Region-expansion and single-province filtering therefore speak **one vocabulary** —
  a resolved region yields the exact English names the `where` already filters on. Source of the spelling =
  `prisma/data/thailand-locations.json` `nameEn` (the SoT the seed loads into `ThailandLocation.provinceNameEn`).
- **Rationale.** DERIVED fully satisfies region-as-a-FILTER (this story's whole scope), carries zero
  migration/backfill risk, and needs nothing that does not exist today. It aligns with the gap-analysis
  research's own top-priority ranking — "D1 … ไม่แตะ schema เลย" (§4, don't touch schema at all).
- **Rejected — STORED `region` column** (add to `ThailandLocation`, or backfill `Location.region`'s free
  string to a 6-value enum): needs a reversible migration + a backfill of today's inconsistent free-string
  `Location.region`, and only pays off for the **phase-2 aggregate rollup** ("ภาคเหนือมีกี่ลาน") which is
  out of scope here. Deferred to the phase-2 follow-up; the derived map is forward-compatible with it
  (the same partition can seed a future column).

**Confirmation.** A partition test (`__tests__/cam-463-thai-regions.test.ts`) asserts the flattened 6-region
map == the exact set of `provinceNameEn` values in `prisma/data/thailand-locations.json` (77, no dup, none
missing) — so the map can never silently drift from the seeded vocabulary. `grep -r "region" prisma/migrations`
finds nothing new (proves no migration).

### The authoritative 6-region partition (BR-1)

Scheme = Thailand's standard **6-region geographic partition** (การแบ่ง 6 ภาคของคณะกรรมการภูมิศาสตร์แห่งชาติ /
NESDB geographic regions). A partition of all 77 provinces: 9+20+22+7+5+14 = 77. Spellings below are the exact
`provinceNameEn` from the seed (data artifact for backend — copy verbatim):

| Region (canonical) | ภาค | n | `provinceNameEn` members |
|---|---|---|---|
| `NORTH` | ภาคเหนือ | 9 | Chiang Mai, Lamphun, Lampang, Uttaradit, Phrae, Nan, Phayao, Chiang Rai, Mae Hong Son |
| `NORTHEAST` | ภาคตะวันออกเฉียงเหนือ | 20 | Nakhon Ratchasima, Buri Ram, Surin, Si Sa Ket, Ubon Ratchathani, Yasothon, Chaiyaphum, Amnat Charoen, Bueng Kan, Nong Bua Lam Phu, Khon Kaen, Udon Thani, Loei, Nong Khai, Maha Sarakham, Roi Et, Kalasin, Sakon Nakhon, Nakhon Phanom, Mukdahan |
| `CENTRAL` | ภาคกลาง | 22 | Bangkok, Samut Prakan, Nonthaburi, Pathum Thani, Phra Nakhon Si Ayutthaya, Ang Thong, Lop Buri, Sing Buri, Chai Nat, Saraburi, Nakhon Nayok, Nakhon Sawan, Uthai Thani, Kamphaeng Phet, Sukhothai, Phitsanulok, Phichit, Phetchabun, Suphan Buri, Nakhon Pathom, Samut Sakhon, Samut Songkhram |
| `EAST` | ภาคตะวันออก | 7 | Chon Buri, Rayong, Chanthaburi, Trat, Chachoengsao, Prachin Buri, Sa Kaeo |
| `WEST` | ภาคตะวันตก | 5 | Tak, Kanchanaburi, Ratchaburi, Phetchaburi, Prachuap Khiri Khan |
| `SOUTH` | ภาคใต้ | 14 | Nakhon Si Thammarat, Krabi, Phang Nga, Phuket, Surat Thani, Ranong, Chumphon, Songkhla, Satun, Trang, Phatthalung, Pattani, Yala, Narathiwat |

Note (6-region ≠ tourism/4-region): the lower-north provinces (Nakhon Sawan, Sukhothai, Phitsanulok, Phichit,
Phetchabun, Kamphaeng Phet, Uthai Thani) fall under **CENTRAL**, and **Tak** falls under **WEST** — this is why
NORTH is only 9. Backend must use this partition, not a tourism grouping.

```ts
// lib/thai-regions.ts (shape)
export type ThaiRegion = 'NORTH' | 'NORTHEAST' | 'CENTRAL' | 'EAST' | 'WEST' | 'SOUTH';
export const REGION_TO_PROVINCES: Readonly<Record<ThaiRegion, readonly string[]>> = Object.freeze({ /* table above, provinceNameEn */ });
```

---

## Decision 2 — a `region` string arg, expanded SERVER-SIDE (faithful sibling of `province`)

**Decision.** Add ONE optional arg `region: z.string().trim().min(1).max(50).optional()` to
`searchCampsitesArgsSchema` — a **plain string** (exactly like `province`), resolved **server-side** by a new
`resolveRegionForSearch(word) → string | string[]` (Decision 3). The server does the region→province
**expansion**; the model never needs to know which provinces are "northern". Flow in `executeSearchCampsites`:

```ts
let provinceFilter: string | string[] | undefined;
if (args.province !== undefined) {
  provinceFilter = await resolveProvinceForSearch(args.province); // BR-3: province WINS
} else if (args.region !== undefined) {
  provinceFilter = resolveRegionForSearch(args.region);           // string[] (region) | string (raw passthrough)
}
// province is consulted first, so region is *dropped* when both are present — never AND-ed (AC-4/BR-3)
const where = buildCampSiteWhere({ province: provinceFilter, /* …unchanged… */ });
```

- **Why a string arg, not `z.enum(6)`.** The story's BR-2 mandates a **code alias map** (`อีสาน`→NORTHEAST)
  and BR-4/AC-6 mandate the CAM-404/458 **honest-fallback** ("the resolver returns the raw value unchanged →
  the query yields 0 rows", never throws). A hard `z.enum` would (i) push alias normalization into model
  judgement rather than deterministic code (violates BR-2), and (ii) turn AC-6's unrecognized `ภาคสวรรค์` into
  a zod `invalid_args` instead of the required 0-rows-and-banner (violates AC-6/BR-4). A string arg + a
  server alias resolver is the exact mirror of the existing `province` seam and is the only design consistent
  with the **fixed** BR-2/BR-4/AC-6. The `jsonSchema` description still lists the 6 regions + notes Thai
  aliases are accepted and resolved server-side (advisory to the model, like `province`).
- **BR-3 precedence (province wins), concretely:** region is read only in the `else` branch, so a request
  carrying both province and region uses the single province and silently ignores region — the two sets are
  never intersected (which would empty the result). AC-4 satisfied by construction.
- **`resolveRegionForSearch` is PURE + synchronous** (no DB round-trip — the map is a code constant), unlike
  the DB-backed `resolveProvinceForSearch`. This is a deliberate, cheaper property.

> ⚠️ Correction to the dispatch note. The dispatch said "prefer a `region` **enum** arg" — refined to a
> **string** arg here because the fixed BR-2/BR-4/AC-6 require the code alias map + raw-passthrough fallback
> that an enum cannot express. Server-side **expansion** (the dispatch's real intent) is preserved. Flagged as
> a needs_decision for visibility, with this as the recommendation.

**Confirmation.** Unit test asserts: `region:"ภาคเหนือ"`-only → `where.location.province = { in: [<9 NORTH names>] }`;
`province:"เชียงใหม่"` + `region:"ภาคเหนือ"` → `where.location.province = "Chiang Mai"` (province wins, no `in`).

---

## Decision 3 — alias map (exact-key), unrecognized → raw passthrough

**Decision.** A frozen `REGION_ALIASES: Readonly<Record<string, ThaiRegion>>` in `lib/thai-regions.ts`,
**exact-key** match (like CAM-458's `BANGKOK_ALIASES`), applied inside `resolveRegionForSearch`:

```ts
const REGION_ALIASES = Object.freeze({
  'ภาคเหนือ':'NORTH','เหนือ':'NORTH','ทางเหนือ':'NORTH',
  'ภาคตะวันออกเฉียงเหนือ':'NORTHEAST','ภาคอีสาน':'NORTHEAST','อีสาน':'NORTHEAST',
  'ภาคกลาง':'CENTRAL','กลาง':'CENTRAL',
  'ภาคตะวันออก':'EAST','ตะวันออก':'EAST',
  'ภาคตะวันตก':'WEST','ตะวันตก':'WEST',
  'ภาคใต้':'SOUTH','ใต้':'SOUTH','ปักษ์ใต้':'SOUTH',
}); // BR-2 verbatim

export function resolveRegionForSearch(word: string): string | string[] {
  const region = REGION_ALIASES[word.trim()];               // exact key
  return region ? REGION_TO_PROVINCES[region] : word;        // recognized → province[]; else raw word (BR-4)
}
```

- **Exact-key, NOT `contains`** (a deliberate difference from `resolveProvinceForSearch`, which uses a
  substring DB `contains`). `เหนือ` and `ตะวันออก` are substrings of `ตะวันออกเฉียงเหนือ`; exact-key on the
  whole trimmed word avoids that collision. `ภาคตะวันออกเฉียงเหนือ` matches its own NORTHEAST key exactly.
- **Unrecognized → raw string passthrough** (`resolveRegionForSearch` returns `word` unchanged): the raw word
  flows to `buildCampSiteWhere` as a single-province equality, which matches nothing (no camp's province is
  literally `"ภาคสวรรค์"`) → 0 rows → the deterministic `aiChat.zeroResult` banner. This reproduces the exact
  CAM-404/458 semantics AC-6/EC-6 pin ("resolver returns the raw value unchanged → 0 rows"), never throws,
  never invents a region. Sub-region forms (`อีสานใต้`, `ล้านนา`) are intentionally absent → same honest
  fallback (BR-2 out-of-scope note / EC-2).

**Confirmation.** Table-driven unit test: every BR-2 alias → its canonical region's province set; `ภาคสวรรค์`
and `อีสานใต้` → returned unchanged (a string, not a set) and `resolveRegionForSearch` never throws on any input.

---

## Decision 4 — REUSE the CAM-461 widening TECHNIQUE, with a small additive `province` widening in `buildCampSiteWhere`

**Decision.** Widen the shared where-builder's location filter from `province?: string` to
`province?: string | string[]` (additive), emitting an `in`-set for arrays. This **reuses CAM-461's
`string | string[]` widening pattern**, applied to the location filter.

> ⚠️ Repo-reality correction (STOP-RULE 1). The dispatch said "no new `buildCampSiteWhere` change." That is
> **inaccurate against the code and the story**: CAM-461 widened only the **taxonomy** groups
> (`access/facilities/external/equipment/activities/terrain`) to `string | string[]` — `province` in
> `CampSiteFilterParams` is still a **bare `string`** (line 6) and step 3 does a bare equality
> (`where.location.province = province`). There is no existing province-array path to reuse. The story's own
> `## Data` + `## Seams & refs` say buildCampSiteWhere "gains province-SET matching … via the same additive
> `string | string[]` widening CAM-461 used for taxonomy." So a small, backward-compatible change **is
> required**. Designing to the story (the fixed SoT), and flagging the dispatch's parenthetical as wrong so
> the implementer does not assume province already accepts arrays and break the build.

The change (backward-compatible by addition — every existing string caller is byte-identical):

```ts
// CampSiteFilterParams
province?: string | string[];   // widened (was: string)

// step 3 — Location filter
if (province || district) {
  where.location = where.location || {};
  if (province !== undefined) {
    if (Array.isArray(province)) {
      const names = province.filter(Boolean);          // empty array ⇒ no province filter (EC guard, mirrors addOptionFilter)
      if (names.length > 0) where.location.province = { in: names };
    } else {
      where.location.province = province;              // UNCHANGED equality — byte-identical for every catalog caller
    }
  }
  if (district) where.location.district = district;
}
```

- **No forked where-builder** (ADR-009): the AI tool and the catalog share the one `buildCampSiteWhere`. The
  single-province string path is preserved exactly — the catalog grid, cursor counts, and every non-AI caller
  pass a `string` and get identical SQL. Only the AI tool ever passes an array.
- **No schema, no migration, additive + reversible** (revert = delete `lib/thai-regions.ts`, the `region`
  arg, and the array branch; the string path is untouched). `resolveProvinceForSearch` vocabulary reused
  unchanged.

**Confirmation.** Regression unit test: a single-province call (`province: "Chiang Mai"`) produces
`where.location.province = "Chiang Mai"` (equality, no `in`) — identical to pre-CAM-463 (pins the byte-identical
claim for every other caller). Array call produces `{ in: [...] }`.

---

## Decision 5 — EVAL (P18 golden cases)

Add **P18** region cases to `scripts/ai-eval/golden-cases.json` (fixture is **8 cases** today; adding ~4 →
~12, far under `DEFAULT_MAX_EVAL_CASES = 500` in `scripts/ai-eval/guards.ts` — **no ceiling lift**, additive/soft
dependency on CAM-457, same as CAM-460). **Param KEY is now pinned = `region`** (Decision 2's arg name):

| id | zone | utterance | expected (`searchCampsites` params) | strict? |
|---|---|---|---|---|
| P18-NORTH | B | ภาคเหนือมีลานกางเต็นท์ที่ไหนบ้าง | `{ "region": "ภาคเหนือ" }` | subset |
| P18-ALIAS-ISAN | B | อยากไปแคมป์แถวอีสาน | `{ "region": "อีสาน" }` | subset |
| P18-PROVINCE-WINS | B | ภาคเหนือ จังหวัดเชียงใหม่ | `{ "province": "เชียงใหม่" }` | subset (region may co-occur; server drops it — AC-4) |
| P18-SOUTH | B | ใต้มีที่ไหนน่าไปบ้าง | `{ "region": "ใต้" }` | subset |

- **Subset match** (not `strictParams`) for the region cases: the case asserts the model **routes to
  `searchCampsites` with the region arg**; the deterministic province-set expansion + BR-3 precedence are
  proven by the unit tests above, not by the model-facing eval (which should tolerate the model also emitting
  an unrelated field). Note: `expected.params` values here are the **model-emitted** Thai words (what the tool
  is CALLED with), before server resolution — consistent with the existing `SMOKE-B1` case (`{ "province":
  "เชียงใหม่" }`).
- **AC-5/AC-6 honest-empty** are integration/owner-verify (a recognized-but-empty region and `ภาคสวรรค์` each
  return `{ cards: [] }` → the verbatim banner), not model-routing eval cases.

**Confirmation.** `npm run ai:eval` (or the fixture load test) passes with the P18 cases present and no
existing case regressed; the fixture stays under the cap.

---

## Decision 6 — cross-check vs `docs/research/ai-chat/campvibe-schema-gap-analysis.md`

The gap-analysis doc proposes schema additions PREP-4…PREP-10 (policy Pixels, gear layer, FacetScore, etc.)
and a `searchCampsites` upgrade to **array/exclude/sort** filters (§3 tool-surface table) — but it proposes
**no `region` column and no stored region model**. Its §4 "ลำดับลงมือที่คุ้มสุด" ranks the **zero-schema**
moves first ("D1 … ไม่แตะ schema เลย"). **Alignment:** the DERIVED, no-migration region filter is fully
consistent with that doc — it is a zero-schema move on the exact `searchCampsites`/`buildCampSiteWhere` seam
the doc names. **Divergence:** none on approach; the doc simply does not yet enumerate region-as-a-filter — this
story fills that gap without contradicting any PREP proposal (a future STORED region for the phase-2 aggregate
would layer on top, not conflict).

---

## Data model

No change. `Location.region` (free `String?`, display-only, read by `get-camp-detail.ts`) and
`ThailandLocation` (no region column) are untouched under the DERIVED default. The 77→6 relation lives only in
`lib/thai-regions.ts` (code), keyed by `provinceNameEn`. **Migration: none.**

## API contract (tool boundary, not `/api/*`)

- **`searchCampsites`** (`tier: 'guest'`, no authz change): **+1 optional arg**
  `region: z.string().trim().min(1).max(50).optional()`; `jsonSchema.properties.region` = advisory description
  (6 regions + Thai aliases accepted, resolved server-side). Backward-compatible by addition (existing calls
  validate byte-identically). Output shape `SearchCampsitesResult` unchanged. Error/empty behavior: honest
  0-cards + `aiChat.zeroResult` banner (BR-4), never a thrown error. Query strategy: single `findMany` with
  `where.location.province = { in: [...] }` (≤22 names) — no N+1, `take` capped at `SEARCH_CAMPSITES_MAX_RESULTS`
  (10), `provinceNameEn` is indexed via the existing location join. `not measured`: latency.

## Boundary

Client (chat UI) → model → `dispatchTool('searchCampsites')` → `executeSearchCampsites` → pure
`resolveRegionForSearch` (code map) / DB `resolveProvinceForSearch` → shared `buildCampSiteWhere` → Prisma.
No client→DB path; the region map is server-only code.

## ADRs

No standalone ADR — DERIVED-vs-STORED is a reversible, story-scoped call fully recorded in Decision 1 (and
already flagged to the architect in `story.md ## Data`); it does not meet the hard-to-reverse bar. The
phase-2 STORED region, if built, warrants its own ADR then.
Confirmation: the partition test (`__tests__/cam-463-thai-regions.test.ts`, Decision 1) fails if the derived
map drifts from the seeded `provinceNameEn` set — this is the enforcement that keeps DERIVED honest.

## Links

`../../feature.md` (## Architecture overview) · `story.md` · `lib/ai/tools/search-campsites.ts` ·
`lib/campsite-filters.ts` · `prisma/data/thailand-locations.json` · `scripts/ai-eval/golden-cases.json` ·
`docs/research/ai-chat/campvibe-schema-gap-analysis.md`

## Changelog
- v1 (2026-07-24) — created at G2. 6 decisions pinned: DERIVED map in `lib/thai-regions.ts` keyed by
  `provinceNameEn` (6-region NESDB partition, 9+20+22+7+5+14=77) · string `region` arg expanded server-side
  (enum rejected — breaks fixed BR-2/BR-4/AC-6) · exact-key alias map + raw passthrough · additive `province`
  string|string[] widening in `buildCampSiteWhere` (CAM-461 technique; corrects dispatch's "no change" note) ·
  P18 eval cases, key=`region`, no ceiling lift · aligned with gap-analysis (zero-schema). No migration.
