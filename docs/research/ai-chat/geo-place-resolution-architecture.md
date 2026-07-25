# Geo/Place Resolution Architecture — the "Place Resolver" layer

> Status: **PROPOSED (design only, no code)** — 2026-07-25
> Author: Solution Architect (G2 Technical)
> Extends (does NOT replace): `docs/research/ai-chat/campvibe-capability-loop-plan.md` (SEE→SORT→FIX→PROVE, the 4 FIX lanes, the deterministic turn-hint pre-pass decision, the ConceptMapping/lexicon idea, pgvector-deferred) and `ADR-009` (no-forked-data-path).
> Sibling doc: this is the geo/place deep-dive the loop plan's **S6** ("ต่อ distance เข้า search") and **L1** (province over-anchoring) pointed at but did not design.

---

## 0. TL;DR

- **Named layer: the `Place Resolver`** — a deterministic pre-pass stage (a sibling of the already-decided `resolveDates` resolver) that turns an NL turn into a structured **`PlaceSpec`**, then funnels that spec into the *same* `buildCampSiteWhere` every catalog caller uses. No forked data path (ADR-009), no new model call, no classifier.
- **Root cause of every failing case is NOT the data — it is that geo resolution is being done *implicitly by the LLM*, badly.** The tool-description example `"Chiang Mai"` (`lib/ai/tools/search-campsites.ts:198`, `lib/ai/tools/bulk-availability.ts:148`) makes the model over-anchor and inject a wrong province. The fix is to *take geo resolution away from the model* the same way `resolveDates` took date arithmetic away from it (`openrouter-client.ts:314`).
- **One geo mechanism, three origins.** All three query modes reduce to *a predicate over the coordinates every camp already has* (`CampSite.latitude/longitude`, 475/475 populated):
  - **exact province** → `location.province` equality (resolver already exists, CAM-404/458).
  - **proximity ("ใกล้/แถว X")** → origin = a **province centroid DERIVED from the camps' own lat/lng** (zero curation, self-extending) → bounding-box + haversine.
  - **landmark/area ("เขาใหญ่/ปาย")** → origin = a **curated place gazetteer row** (name→coords+radius) → bounding-box + haversine.
- **Extensibility = a DATA row, not code.** A new province auto-gets a centroid from its camps. A new landmark = one JSON row. A new vibe word = a lexicon entry the miner already proposes. What "changes when data arrives" is a row ranked by real demand from the capability registry — never a province-by-province code patch.
- **Deterministic owns geo; pgvector stays deferred.** A landmark has exact coordinates and a province has a derivable centroid — there is nothing semantic to embed. pgvector is reserved for open-ended *vibe/mood* (P7), and even that waits on registry demand.

---

## 1. The problem, grounded in the real code

The owner's instruction: *don't patch province-by-province; find an architecture that scales as data arrives.* The four verified failing cases share **one** root cause, and it is architectural, not a missing province.

| Failing case | Verified reality | Root cause (file:line) |
|---|---|---|
| `ลานกางเต็นท์ริมทะเล` (CAGD+BEAC) → **0 returned, 24 exist** | terrain=BEAC alone returns 24 | Model injects `province=Chiang Mai` because the tool param *example* is `"Chiang Mai"` (`search-campsites.ts:197-198`). Chiang Mai is landlocked → BEAC∧ChiangMai = 0. |
| `กางเต็นท์ริมแม่น้ำ` → **0, 35 exist** | terrain=RIVE alone returns 35 | Model adds `province` = "เชียงใหม่" unprompted (same over-anchor). |
| `ในกรุงเทพ` (4) vs `ใกล้กรุงเทพ` (~60) | two *different* meanings | Only exact-province (`buildCampSiteWhere` §3 equality) is wired. **Proximity is not wired at all** — `lib/geo/distance.ts` exists but only powers a `distanceFromBangkokKm` display, never `searchCampsites`. |
| `เขาใหญ่` → **5, many more nearby** | keyword `เขาใหญ่` matches only camps that literally tagged the word | เขาใหญ่ is a national park spanning **4 provinces**, not a province and not a camp name. There is no place→coords lookup, so it degrades to a `keyword` text match (`buildCampSiteWhere` §2). |

**The through-line:** the model is the geo resolver today, and it is unreliable at it — it invents provinces, it can't tell `ใน` from `ใกล้`, and it has no notion of a landmark. Every "fix" that edits a province list or a prompt sentence is a patch because the *resolution* is happening in the least testable place (model judgment) instead of in deterministic code with a right answer.

**Precedent that already proved the cure:** `resolveDates` (CAM-462). Date arithmetic used to be the model's job and was unreliable; it was moved into a deterministic tool/resolver, and the prompt now says *"call resolveDates … never assume one"* (`openrouter-client.ts:314`). Geo is the exact same shape of problem. This doc applies the same move to place.

---

## 2. The named layer — `Place Resolver`

### 2.1 What it is

`Place Resolver` is a **deterministic, pure, testable pre-pass** that converts an NL turn into a structured **`PlaceSpec`**. It is one capability of the broader *Turn-Resolution pre-pass* the loop plan already decided on (§2.3 "deterministic turn-hint pre-pass — NO separate classifier model"). It is the geographic sibling of `resolveDates`.

It is the "layer for assembling/composing the data" the owner asked for: it sits **between the model's intent and `buildCampSiteWhere`**, assembling the raw geo signal in the turn into a spec the query layer can execute — without the model having to get geography right, and without a second query path.

### 2.2 Inputs → stages → output

```
INPUT  (NL turn text + the turn's existing context)
  "ลานกางเต็นท์ริมทะเลใกล้กรุงเทพ"

STAGE 1  Tokenize + preposition parse  (deterministic, regex/lexicon)
  - detect place cue:  ใน / แถว / ใกล้ / รอบ / โซน / <bare province> / <landmark token>
  - split "how it relates to the place" (mode) from "the place token"

STAGE 2  Place-token resolution  (ordered, first hit wins)
  a. exact province  → resolveProvinceForSearch (CAM-404/458, DB)          → provinceMode
  b. region (ภาค)    → resolveRegionForSearch    (CAM-463, code map)        → provinceMode (set)
  c. landmark/area   → gazetteer lookup           (place-gazetteer.json)    → radiusMode(origin)
  d. proximity unit  → province centroid          (derived from camp lat/lng)→ radiusMode(origin)
  e. unresolved      → (no place filter) + keyword fallback + honest 0-result

STAGE 3  Emit PlaceSpec  (one of the discriminated shapes below)

OUTPUT  PlaceSpec  →  (a) injected as a <resolved_place> DATA block in the system prompt
                      (b) OR pre-bound as resolved searchCampsites args
                      →  ALWAYS funnels into buildCampSiteWhere (ADR-009)
```

### 2.3 The `PlaceSpec` (the structured output — a discriminated union)

```ts
type PlaceSpec =
  | { mode: 'province';  provinces: string[] }                    // ใน / bare / region → equality or IN-set
  | { mode: 'radius';    origin: { lat: number; lng: number };    // ใกล้ / landmark
                          radiusKm: number;
                          source: 'province-centroid' | 'gazetteer';
                          label: string;                          // e.g. "เขาใหญ่" — for the answer copy
                          excludeExactProvince?: string }         // OPEN Q (§7): does "near X" exclude in-X?
  | { mode: 'none' };                                             // no place cue → unchanged behavior
```

Every field is an atomic Pixel (architecture rule 9): `lat`/`lng`/`radiusKm` are `Geo`-classified numeric Pixels, `provinces`/`label` are `Public`. Nothing is a UI-shaped or crammed string.

### 2.4 Where it sits (ADR-009 preserved)

```
                       ┌─────────────────────────────────────┐
   NL turn ──▶ Place Resolver (pre-pass, deterministic) ──▶ PlaceSpec
                       └─────────────────────────────────────┘
                                     │
             ┌───────────────────────┼────────────────────────┐
             ▼                       ▼                         ▼
   mode:'province'          mode:'radius'                mode:'none'
   provinces[] arg     origin+radiusKm → bbox        (no geo filter)
             │            + haversine sort                    │
             └───────────────┬───────────────────────────────┘
                             ▼
                   buildCampSiteWhere(...)   ◀── the SAME where-builder every catalog caller uses
                             ▼
                   prisma.campSite.findMany  ── aiCampCardSelect (unchanged projection)
                             ▼
                   (radius modes only) haversine filter+sort in the tool, post-query
                             ▼
                        result cards
```

**No forked data path.** `province` mode uses the existing `province` arg (already `string | string[]`, `campsite-filters.ts:14`). `radius` mode adds an *optional bounding-box predicate* to the **same** `buildCampSiteWhere` (`latitude:{gte,lte}, longitude:{gte,lte}`) — one where-builder, one projection. The precise haversine filter+sort runs in the tool **after** the query, in exactly the place the availability-badge computation already runs post-query (`search-campsites.ts:315-329`). With 475 rows this is trivially fast and needs **no PostGIS and no pgvector** (see §5).

### 2.5 Where disambiguation happens — answered explicitly

**In the deterministic pre-pass (Stage 1), by parsing the Thai preposition — NOT in the model, NOT as a tool param the model fills.**

| Turn fragment | Cue | Mode |
|---|---|---|
| `ในกรุงเทพ`, `กรุงเทพ`, `ภาคเหนือ` | `ใน` / bare / `ภาค` | `province` (exact / IN-set) |
| `ใกล้กรุงเทพ`, `แถวเชียงใหม่`, `รอบๆ`, `โซน...` | `ใกล้/แถว/รอบ/โซน` | `radius` (centroid origin) |
| `เขาใหญ่`, `ปาย`, `เขาค้อ`, `ปางอุ๋ง` | landmark token in gazetteer | `radius` (gazetteer origin) |
| no place cue | — | `none` |

This is the load-bearing decision: **`ใน` vs `ใกล้` is a lexical fact with a right answer, so it is resolved in code, once, with unit tests — not left to model judgment that today silently turns `ใกล้กรุงเทพ` into `province=Bangkok` (4) or `ริมทะเล` into `province=Chiang Mai` (0).** For genuinely ambiguous turns the pre-pass emits `mode:'none'` and lets the model fall back to the existing args + honest zero-result — it never *invents* a province.

---

## 3. The geo/place model — one mechanism, three origins

The insight that makes this general (not province-by-province): **every camp already carries real coordinates (`latitude`/`longitude`, 475/475 verified).** So proximity and landmark queries are the *same* operation — "camps within R km of an origin point" — and only the **origin** differs. Exact-province stays a set-membership equality (no geo math, and correctly so — "in Bangkok" is not a radius).

### 3.1 The centroid-from-data vs gazetteer split (with the WHY)

| Mode | Origin source | Curation cost | Self-extending? | Why this source |
|---|---|---|---|---|
| exact province | `location.province` equality | 0 (resolver exists) | yes (new province name resolves via ThailandLocation) | "in X" is membership, not distance; a radius would wrongly pull in neighbors |
| **proximity to an admin unit** (`ใกล้กรุงเทพ`, `แถวเชียงใหม่`) | **province centroid = mean of that province's camp lat/lng** | **0 — derived from data** | **yes — a new camp shifts/creates the centroid automatically** | No external gazetteer needed: the camps ARE the evidence of where the province's campable area is. A landlocked/coastal skew is *correct*, it reflects real supply. |
| **landmark / park / informal area** (`เขาใหญ่`, `ปาย`) | **curated gazetteer row: name→lat/lng + default radius** | low — one JSON row per place | grows by adding rows (+ a build step proposes candidates) | เขาใหญ่ is not a province and camps may not tag it, so it **cannot** be derived from camp membership. It needs an authored coordinate — but that authored coordinate is DATA (a row), not code. |
| unresolved place word | none (keyword/tag text fallback) | 0 | yes (new tag extends the searchable text) | never invent a province; fall to keyword + honest 0-result + a miss-beacon (§4) |

**Recommendation: use all three, in the order above (first hit wins).** The split is not a compromise — each source is the *cheapest correct* origin for its class:
- **province centroids are free and self-healing** — never curate what the data already proves. Derive them (a build step writes `prisma/data/province-centroids.json`, or compute live in <1ms over 475 rows; both are compute-on-the-fly per architecture rule 12, the file is only a cache with a named derivation).
- **the gazetteer is a small, high-value curated set** — only ~30–50 landmarks/parks cover the long tail of "area" queries. It is authored because it *must* be (no data can derive เขาใหญ่'s coordinates), but it is authored as **data rows**, and a build step (`scripts/geo/derive-place-index.mjs`) *proposes* new rows by mining recurring `CampSite.tags` tokens + camp clusters, so even the curated set grows semi-automatically from data + a human ratify.

### 3.2 The gazetteer as a proper Set (atomic + classified)

Start as **`prisma/data/place-gazetteer.json`** (following the existing `prisma/data/*.json` convention — `thailand-locations.json`, `thai-holidays.json` — and the loop plan's **L2** "knowledge pack as JSON, no migration" pattern). Each row is a self-describing Set:

```jsonc
{
  "id": "khao-yai",
  "label": "เขาใหญ่",                         // Public
  "aliases": ["เขาใหญ่", "อุทยานเขาใหญ่", "khao yai"], // Public — match vocabulary
  "kind": "national_park",                    // enum: national_park | mountain | beach | island | town | area
  "lat": 14.4396, "lng": 101.3722,            // Geo
  "defaultRadiusKm": 40,                      // Geo — tuned per kind (a park is wider than a town)
  "provinceHints": ["Nakhon Ratchasima","Saraburi","Prachin Buri","Nakhon Nayok"], // Public — trace, not a filter
  "source": "curated-v1", "updatedAt": "2026-07-25"
}
```

Promote to a Prisma table (`PlaceEntry`, or landmark nodes hung off the existing `AdminArea` tree at `schema.prisma:203`) **only if/when** demand needs DB-side querying or operator editing — lean-first (§7 open question).

---

## 4. Extensibility — what changes when data arrives (the core property)

The owner's real question: *"when a new place/term/dimension shows up, what do we touch?"* Answer, by class — **almost always a data row, ranked by real demand, never a code patch:**

| New thing arrives | What changes | Code change? |
|---|---|---|
| A camp in a province that had none | its lat/lng feeds the centroid → proximity for that province works | **none** (centroid derived) |
| A new landmark/area term campers ask for (`ปางอุ๋ง`, `สังขละบุรี`) | **one row** in `place-gazetteer.json` | **none** (data row; build step even proposes it from tags) |
| A new vibe/slang word (`สายมู`, `ฮีลใจ`) | one lexicon/ConceptMapping entry (loop plan §2.2, §3 row 7) | **none** (data; miner proposes it) |
| A new *dimension* (e.g. "near a waterfall") | a MasterData code or a gazetteer `kind`, + a lexicon mapping | data-first; code only if a genuinely new predicate |
| A place word that resolves to nothing | it becomes a **miss-beacon** in `AssistantTurnLog` (loop plan §2.1) → miner buckets it → **capability-registry** row with demand count → either a gazetteer row (data) or a ranked story | **none until demand justifies it** |

**This is exactly the flywheel the loop plan built, now fed by geo.** The province-by-province patching the owner fears is replaced by: an unresolved place term surfaces itself in telemetry (SEE) → the miner ranks it by real demand (SORT) → it is closed as a gazetteer/lexicon row or a demand-ranked story (FIX) → a golden case guards it (PROVE). New geography enters the system as *data ranked by evidence*, not as a screenshot + a guess.

**Tie to the capability registry:** add a `Place/Geo` capability family to `docs/specs/ai-assistant/capability-registry.md` with rows for `exact-province ✅`, `region ✅`, `proximity 🟡→`, `landmark 🔴→`, each carrying its missing-data pointer (centroid derivation / gazetteer) and a demand count the miner fills. The registry is where "which landmark next?" is answered by demand, not intuition.

---

## 5. Deterministic resolution vs pgvector — where each belongs

**Recommendation: geo is 100% deterministic; pgvector stays deferred and is NOT a geo tool.**

| Concern | Owner | Why |
|---|---|---|
| province / region / proximity / landmark resolution, `ใน` vs `ใกล้`, dates, hard filter codes (terrain/facility/activity) | **deterministic** (Place Resolver + resolveDates + buildCampSiteWhere) | These are *lookup/resolution* problems with a **right answer**. A landmark has exact coordinates; a province has a derivable centroid; a preposition is a lexical fact. Embeddings would make a solved, testable problem non-deterministic and *worse* (the current failing cases are the model already "guessing" geo). |
| open-ended vibe/mood/occasion (`อยากฮีลใจ`, `สายมู`, `ถ่ายรูปสวยลง IG`, P7) | **pgvector — DEFERRED** | No exact filter exists; semantic similarity is the right tool. But per the loop plan it waits on infra + registry demand, and it is answered *today* by best-effort derived filters (`openrouter-client.ts:348-353`). |

Explicitly: **do not reach for pgvector to solve `เขาใหญ่`.** That is the tempting-but-wrong move — a landmark is a coordinate lookup, not a semantic-search problem. Keep the deterministic/semantic boundary exactly where the loop plan drew it: deterministic for anything with a right answer (all of geo), pgvector only for open-ended vibe, and only when demand proves it.

---

## 6. Phased build → concrete stories

Each phase is independently shippable, mapped to a FIX lane, and plugs into SEE/SORT/PROVE. Sizes are ≤ ~400-line atomic stories.

| Phase | Story | Size | Lane | Data it needs | Plugs into |
|---|---|---|---|---|---|
| **P0 — stop the bleeding** | **De-anchor the province param.** Remove the `"Chiang Mai"` example from `search-campsites.ts:197-198` + `bulk-availability.ts:148`; reword to a neutral description + an explicit *"do NOT infer a province the camper did not name"* line. | **XS** | none (prompt/tool-desc) | **L1** | PROVE: golden cases for `ริมทะเล`(→24) and `ริมแม่น้ำ`(→35). Recovers the two worst cases with one tiny diff. |
| **P1 — the resolver** | **Place Resolver pre-pass + PlaceSpec + preposition parse.** Deterministic `ใน/แถว/ใกล้/ภาค/bare` routing → `mode:'province'\|'radius'\|'none'`; inject a `<resolved_place>` DATA block (same pattern as `<shown_results>`, `openrouter-client.ts:240-268`). Radius origin stubbed to province-centroid only in P2. | **S** | **L1** | preposition lexicon (code constant); telemetry `placeMode` field on `AssistantTurnLog` | SEE: log `placeMode`. PROVE: unit tests per preposition; golden `ในกรุงเทพ`(4) stays 4. |
| **P2 — proximity (the "ใกล้" case)** | **Wire distance into search via data-derived centroids.** Build step → `province-centroids.json` (mean of each province's camp lat/lng); add optional bbox predicate to `buildCampSiteWhere` (`latitude/longitude` gte/lte); haversine filter+sort in the tool post-query; new `radiusKm` (+ derived origin) arg. Reuses `haversineDistanceKm` (`lib/geo/distance.ts`) and the existing `BANGKOK_ORIGIN`. | **M** | **L1/L3** | `province-centroids.json` (derived, no migration) | This is the loop plan's **S6**. PROVE: `ใกล้กรุงเทพ`→~60 sorted by distance; `ในกรุงเทพ`(4) unchanged. |
| **P3 — landmark gazetteer** | **`place-gazetteer.json` + read helper + `derive-place-index.mjs` propose-step.** Seed ~30–50 top landmarks/parks; landmark mode resolves origin from a gazetteer row (coords + `defaultRadiusKm` by `kind`); build step mines `CampSite.tags` to propose new rows for human ratify. | **S–M** | **L2→L3** | curated gazetteer rows (JSON, no migration) | SORT: proposals ranked by tag frequency. PROVE: `เขาใหญ่`→camps within 40km across its 4 provinces, not just the 5 tagged. |
| **P4 — close the loop** | **Miss-beacon → registry → next row.** Unresolved place tokens flag a miss on `AssistantTurnLog`; the miner buckets them into a `Place/Geo` registry family with demand counts; next gazetteer row / centroid tuning is chosen by demand rank. | **S** | registry | depends on loop-plan **S2/S3** | Ties SEE+SORT: geography now self-reports its gaps. |

Dependency note: **P0 ships alone, today** (biggest ROI per byte). P1–P2 are the core of the owner's ask. P3 depends on P1's resolver. P4 depends on the loop plan's telemetry (S2/S3) already existing.

---

## 7. ADR-016 (PROPOSED — extract to `docs/adr/ADR-016-geo-place-resolution.md` when this is ratified at G2)

> Recorded inline here per the dispatch constraint (create only this doc). On G2 approval, lift verbatim into `docs/adr/ADR-016-*.md` with `Status: ACCEPTED`.

**# ADR-016: Geo/place resolution via a deterministic Place Resolver + data-derived centroids + a curated gazetteer**

**Status:** PROPOSED — 2026-07-25. (References/extends ADR-009 no-forked-data-path; does not supersede it.)

**Context.** The AI chat resolves location intent implicitly inside the LLM, unreliably: a `"Chiang Mai"` tool-param example makes the model inject wrong provinces (`ริมทะเล`→0 of 24), it cannot distinguish `ใน` (exact, 4) from `ใกล้` (proximity, ~60), and it has no concept of a landmark/area (`เขาใหญ่`→5, keyword-only). Every fix so far has been a province-by-province patch. Every camp already stores real `latitude/longitude` (475/475); `lib/geo/distance.ts` exists but is unused by search.

**Decision.** Introduce a deterministic **Place Resolver** pre-pass (sibling of `resolveDates`) that parses the Thai preposition to pick a mode and emits a structured `PlaceSpec` funneled into the *existing* `buildCampSiteWhere` (ADR-009 preserved). One geo mechanism, three origins: exact-province equality; proximity via **province centroids derived from the camps' own lat/lng**; landmark via a **curated JSON gazetteer** (name→coords+radius) grown by data rows + a tag-mining propose-step. Proximity/landmark execute as a bounding-box predicate + in-app haversine sort over 475 rows — **no PostGIS, no pgvector**. Disambiguation (`ใน`/`ใกล้`/landmark) lives in the pre-pass, not the model. New geography enters as data ranked by capability-registry demand, not code.

**Alternatives rejected.**
- *Keep patching province-by-province in prompt/code* — the status quo; does not scale, the owner's explicit "don't do this."
- *A separate intent-classifier model* — rejected (loop plan §2.3): +1 model call (latency/cost) + a new failure point; the real failure is resolution, not classification, and tool schemas already ARE the intent layer.
- *pgvector/semantic search for geo now* — rejected: a landmark is an exact coordinate and a province has a derivable centroid; embeddings make a solved, testable lookup non-deterministic and worse. pgvector stays reserved for open-ended vibe (P7), demand-gated.
- *PostGIS / a geo extension* — rejected as premature: 475 rows resolve in <1ms with a bbox + haversine; adding a DB extension + migration is unjustified complexity (lean).
- *An external gazetteer/geocoding API for every place* — rejected for proximity (centroids are free and self-healing from data); a small curated JSON covers landmarks without a network dependency or SSRF surface.
- *A full Prisma `PlaceEntry` table up front* — deferred: start as JSON (L2 pattern, no migration); promote only when demand needs DB querying/operator editing.

**Consequences.**
- (+) The four failing classes are covered by one coherent mechanism; P0 alone recovers the two worst with an XS diff.
- (+) Self-extending: new provinces need no work; new landmarks are one row; gaps self-report via telemetry→registry.
- (+) Fully deterministic and unit-testable; zero added model calls; no new infra dependency.
- (+) ADR-009 intact — one where-builder, one projection.
- (−) Province centroids skew toward where camps actually are (usually a feature, but a sparse province's centroid is noisy) → mitigate with a min-camp-count fallback to the province's ThailandLocation, or a gazetteer override row.
- (−) Landmark radius is a curated guess per `kind`; wrong radii surface as too-many/too-few results → tune from telemetry.
- (−) "near X" semantics (does it exclude in-X?) is a product choice (§7 open questions) that must be decided before P2 ships.

---

## 8. Open questions for G2 (do NOT decide silently)

1. **Does `ใกล้กรุงเทพ` exclude the 4 camps *in* Bangkok?** Product call: "near X" often means "not X, but around it." Options: (a) include in-province (radius naturally covers it, rank by distance) — simplest; (b) exclude the exact province when the cue is `ใกล้`/`แถว` (`PlaceSpec.excludeExactProvince`). **Recommendation: (a)** for P2 (include, distance-sorted), revisit from telemetry. Needs owner ratify.
2. **Default radii per `kind`** (park 40km? town 15km? province-centroid 60km?) — start with authored defaults, tune from telemetry. Owner sanity-check the starting numbers.
3. **Province centroid: derived-at-build (`province-centroids.json`) vs computed-live?** Recommendation: build-step JSON (a cache with a named derivation, re-runnable), refreshed when the camp corpus changes materially. Live compute is fine too (<1ms) — lean call at P2.
4. **Gazetteer home: JSON now, Prisma later?** Recommendation: JSON first (no migration, ships fast). Promote to `PlaceEntry`/`AdminArea` node only on demand for DB querying or operator editing.
5. **Sparse-province centroid guard** — min camp count before trusting a derived centroid; below it, fall back to `ThailandLocation` province coord (which today has province NAMES only, no coords — would itself need a one-time coordinate seed, a small gazetteer-style row set). Decide the threshold + fallback at P2.

---

## 9. Reuse map (do NOT re-implement)

- `resolveDates` tool + the `openrouter-client.ts:314` prompt line — the exact precedent pattern for a deterministic resolver the model must call/trust.
- `<shown_results>` DATA-block builder (`openrouter-client.ts:240-268`) — the template for the `<resolved_place>` injection block.
- `buildCampSiteWhere` (`lib/campsite-filters.ts`) — the ONE where-builder; add the optional bbox predicate here, never a fork (ADR-009).
- `haversineDistanceKm` + `BANGKOK_ORIGIN` (`lib/geo/distance.ts`) — the distance math and a ready origin constant; already pure/no-dep.
- `resolveProvinceForSearch` (`search-campsites.ts:176`) + `resolveRegionForSearch` (`lib/thai-regions.ts`) — the existing province/region resolvers Stage 2 chains.
- `prisma/data/*.json` convention (`thailand-locations.json`, `thai-holidays.json`) + `scripts/gen-*.mjs` build-step convention — the home + tooling shape for the gazetteer and centroid files.
- The capability-loop flywheel (`campvibe-capability-loop-plan.md` §2.1/2.2) — the SEE/SORT machinery P4 plugs geo into.
