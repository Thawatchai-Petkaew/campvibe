---
linear: CAM-473
feature: ai-assistant
epic: assistant-answers-real-camper-asks-gap-closure-w1 (CAM-456)
persona: Camper
artifact: tech
owner: architect
status: G2 Design — architect (technical contract; awaiting G2 sign-off → build)
version: v1
updated: 2026-07-24
---
# Tech — compareCamps: 2–4 camps side by side + evidence (CAM-473)

> Rich API contract for a NEW read-only AI tool. No schema, no migration, no HTTP endpoint —
> the tool is dispatched through the EXISTING `/api/ai/chat` tool-registry (ADR-009, same as
> `getCampDetail`/`bulkAvailability`). `story.md ## Data` carries the atomic-field summary; this
> file records the 6 G2 forks the story flagged + the per-criterion value mapping (analyst dim).

## Summary of the 6 G2 decisions

| # | Fork | Decision |
|---|---|---|
| 1 | Batch read: dedicated lean vs reuse `getCampDetail` ×N | **Dedicated lean `findMany`** in a new `lib/ai/tools/compare-camps.ts`; `get-camp-detail.ts` UNTOUCHED (CAM-355). |
| 2 | Criteria vocabulary + default | Closed 10-member `CriterionId` enum (ADR-003); default = `['price','capacity','family','verified','rating']`. |
| 3 | Matrix wire shape | `criteria[]` (column order) + `camps[]` of `{id,nameTh,nameEn,cells}`; atomic values + `FacetScore` for facets; **NO winner field**. |
| 4 | Hard cap (CAM-344) | `MAX_COMPARE_CAMPS = 4`; de-dup then `2..4` checked in `execute` BEFORE any read → graceful discriminated refuse. |
| 5 | Registration + eval | `guest`-tier, registered in `tools/index.ts`; cam-459 roster pin +1; one P2 eval golden case. |
| 6 | Migration / reversibility | No schema, no migration; purely additive; fully reversible (delete file + unregister + revert 1 test line). |

---

## Decision 1 — dedicated LEAN batch read (getCampDetail untouched)

**Decision.** A NEW file `lib/ai/tools/compare-camps.ts` owns its own lean `prisma.campSite.findMany`
over the resolved ids WITH the CAM-469 visibility predicate baked in. `get-camp-detail.ts`'s
single-id read is **not touched, not extracted, not shared** (CAM-355 "fifth-reader" caution — the
story's Seams & refs pin).

**Rationale.** A comparison needs price/capacity/rating/verified/policy/distance/amenities + the 3
facet inputs — a small guest-safe subset. It does NOT need the two heavy per-camp computations
`getCampDetail` runs: the ~8-Saturday `weekendAvailability`/`availableWeekendDates` loop
(`getRemainingCapacityForCamps` ×8 per camp) and the verified-review list (`reviews take:10` +
`buildReviewSummary`). Batching `N × getCampDetail` would run `N × ~10` queries for data the
comparison discards — the exact N+1/over-fetch `performance.md §3` forbids. A dedicated select is
lean by construction and leaves the single read a hard regression boundary.

**Read home + select** (guest-safe ONLY — no operator/contact/payout/KYC field, PDPA, mirrors the
CAM-427/CAM-449 boundary):

```ts
// lib/ai/tools/compare-camps.ts
const rows = await prisma.campSite.findMany({
  where: { id: { in: ids }, isActive: true, isPublished: true, deletedAt: null }, // CAM-469 gate, verbatim
  select: {
    id: true, nameTh: true, nameEn: true,                                  // identity (reused shape, Decision 3)
    priceLow: true, priceHigh: true, priceCurrency: true, isFree: true,    // [Financial] price (atomic)
    extraFeeAmount: true, extraFeeLabel: true, feeInfo: true,              // [Financial]
    useSpotView: true, maxGuestsPerDay: true, maxTentsPerDay: true,        // capacity inputs (per-spot correctness ↓)
    avgRating: true, reviewCount: true,                                    // [Public] rating (atomic aggregate)
    isVerified: true,                                                      // [Public]
    cancellationPolicy: true,                                             // [Public] enum, nullable
    latitude: true, longitude: true,                                      // [Geo] — only the DERIVED km is returned
    minimumAge: true,                                                     // [Public] facet input (family age gate)
    options: { select: { code: true, group: true, nameTh: true, nameEn: true, icon: true } }, // [Public] facet + facilities input
  },
});
```

**Gate inheritance is explicit (Decision 1 = the security seam).** The `where` reuses the SAME public
predicate `{ isActive: true, isPublished: true, deletedAt: null }` that `executeGetCampDetail`
(`findFirst`) and `buildCampSiteWhere` already apply (CAM-469). An id that is unpublished / inactive /
soft-deleted / forged / nonexistent simply **does not appear in `rows`** — it is *absent*, not a
partial leak and not an existence oracle: an unpublished id is indistinguishable from a nonexistent
one (both absent), the same shape a nonexistent id already returns. The tool NEVER returns a per-id
"dropped/not-found" list (that would be the oracle) — a shortfall surfaces only as an aggregate
`insufficient_visible` refuse (Decision 4). No non-public camp is ever read into the matrix.

**Capacity sub-decision (per-spot correctness — refuses the CAM-355/CAM-400 fork).** The `capacity`
cell is the **effective** capacity via the canonical `getEffectiveCapacity(prisma, {id, useSpotView,
maxGuestsPerDay, maxTentsPerDay})`, NOT the raw `maxGuestsPerDay` column. For a whole-camp camp
(`useSpotView=false`) the helper returns the stored column synchronously (0 extra query); for a
per-spot camp (`useSpotView=true`) it sums live spots (1 query). Called only when `capacity` is a
requested criterion, `Promise.all` over the ≤`MAX_COMPARE_CAMPS` rows ⇒ **≤4 bounded queries**, the
SAME canonical derivation `getCampDetail` uses (ADR-009, no fork).

**Rejected alternative.** (a) Reuse `getCampDetail` ×N — rejected: `N×~10` queries of availability +
reviews the comparison discards (N+1), and the shared-read/extract risk on the single tool (CAM-355).
(b) Read the raw `maxGuestsPerDay` column for capacity — rejected: a per-spot camp's column is null
while its real capacity lives on spots, so the comparison would print a FALSE "ไม่มีข้อมูล" for a camp
that has capacity — the exact CAM-355/CAM-400 fork `get-camp-detail.ts`'s capacity comment warns
against, and an ADR-009 second-derivation.

**Confirmation.** `__tests__/cam-473-*.test.ts` asserts (i) an unpublished/forged/nonexistent id is
absent from `camps` and no id-level "not found" is ever returned; (ii) the select carries zero
operator/contact/payout/KYC field (guest-safe regression); (iii) a per-spot camp's `capacity` cell is
its effective (spot-summed) capacity, not null. Regression: `git diff --exit-code lib/ai/tools/get-camp-detail.ts` is clean (single read untouched).

---

## Decision 2 — criteria vocabulary + default set

**Decision.** A closed, engineering-owned enum (ADR-003 — a criteria vocabulary is an engineering
enum, never free-text). All 10 story-candidate members are admitted (each maps 1:1 to an
already-selected field, so full expressiveness is zero marginal cost):

```ts
export const CRITERION_IDS = [
  'price', 'capacity', 'rating', 'verified',            // atomic scalar/compound
  'facilities', 'cancellation_policy', 'distance',       // atomic
  'family', 'beginner', 'road_access',                   // CAM-464 facets (evidence-carrying)
] as const;
export type CriterionId = (typeof CRITERION_IDS)[number];

export const DEFAULT_COMPARE_CRITERIA: CriterionId[] =
  ['price', 'capacity', 'family', 'verified', 'rating'];
```

**Default** (used when `criteria` is omitted or empty — AC-3/EC-6): the PO-recommended decision core
`['price','capacity','family','verified','rating']` — the five a camper weighs on an open
"อันไหนดีกว่ากัน". `beginner`/`road_access` (free from CAM-464), `facilities`, `cancellation_policy`,
and `distance` are in the vocabulary but OUT of the default — the model requests them when the
camper's question implies them (keeps the open-compare answer focused, not a 10-column dump).

**Rationale.** `z.enum(CRITERION_IDS)` rejects an unknown criterion as `invalid_args` before any query
(BR-4). A closed enum is compile-checked against the value-mapping switch (Decision 3), so a criterion
added to the enum with no mapping is a build error, not a silent gap.

**Rejected alternative.** Free-text `criteria: string[]` — rejected: unvalidated model output as a
query key (ADR-003 violation), no compile-time completeness, and no honest rejection of a typo. A
larger default (all 10) — rejected: a wall of columns buries the decision the camper actually asked.

**Confirmation.** `z.enum(CRITERION_IDS)` (a bad criterion ⇒ `invalid_args`, no read); a
`satisfies Record<CriterionId, …>` mapping table so a new enum member without a value mapping fails
`tsc`; a unit asserting `criteria` omitted ⇒ `DEFAULT_COMPARE_CRITERIA`.

---

## Decision 3 — matrix wire shape (values + evidence, NO winner)

**Decision.** `camp × criterion → value`, compact and bounded (≤4 camps × ≤10 criteria, default 5).
Identity reuses the fields the AI card / `getCampDetail` already expose (`id`, `nameTh`, `nameEn`) —
no new card identity, no images/terrain-tag re-fetch. Facet cells carry the CAM-464
`FacetScore {score, confidence, answerable, evidence}` UNCHANGED (evidence mandatory, P13). There is
**NO `winner` / `rank` / `best` field anywhere** — the tool returns values + evidence; the model
phrases any recommendation (the PO's key honesty call — confirmed: a camp's "suitability" depends on
the camper's unstated priorities, so a tool-asserted verdict would over-claim).

```ts
import type { CampAmenity } from '@/lib/ai/tools/get-camp-detail';         // reuse — no redefine
import type { CancellationPolicyValue } from '@/lib/cancellation-policy';   // reuse
import type { FacetScore } from '@/lib/facet-scores';                       // reuse (CAM-464)

export interface ComparePrice {          // atomic — NEVER a merged "฿1,250" string (api.md rule 4)
  startingPrice: number | null;          // = priceLow, the "from" price (CAM-470 honesty label)
  priceHigh: number | null;
  currency: string;                      // priceCurrency (ISO 4217)
  isFree: boolean;
  extraFeeAmount: number | null; extraFeeLabel: string | null; feeInfo: string | null;
}
export interface CompareCapacity { maxGuestsPerDay: number | null; maxTentsPerDay: number | null; } // effective (Decision 1)
export interface CompareRating   { avgRating: number | null; reviewCount: number; }                  // atomic aggregate
export interface CompareVerified { isVerified: boolean; }
export interface CompareFacilities { amenities: CampAmenity[]; }                                      // atomic list (code + localized name)
export interface CompareCancellation { policy: CancellationPolicyValue | null; }
export interface CompareDistance { distanceFromBangkokKm: number | null; }

export interface ComparisonCells {       // ONLY the requested criteria are populated
  price?: ComparePrice; capacity?: CompareCapacity; rating?: CompareRating; verified?: CompareVerified;
  facilities?: CompareFacilities; cancellation_policy?: CompareCancellation; distance?: CompareDistance;
  family?: FacetScore | null; beginner?: FacetScore | null; road_access?: FacetScore | null; // null = absent = honest "ไม่มีข้อมูล"
}

export interface ComparisonCamp { id: string; nameTh: string; nameEn: string | null; cells: ComparisonCells; }

export type CompareCampsResult =        // discriminated union (api.md §11); ok:false never fabricates a comparison
  | { ok: true; criteria: CriterionId[]; camps: ComparisonCamp[] }        // camps in INPUT id order (visible only); NO winner
  | { ok: false; reason: 'too_few' | 'too_many' | 'insufficient_visible' | 'error' };
```

`camps` is ordered by the input `ids` (stable) so the model's "ลานที่ 1 / ลานที่ 2" ordinals from the
CAM-460 shown-state line up. `criteria` echoes the resolved set and defines column order.

**Rejected alternative.** A per-criterion `winner`/`recommended` field — rejected: a tool-asserted
verdict is the P13 honesty violation the story forbids (BR-5). A merged display string per cell
(`"฿800/คืน"`) — rejected: not atomic, not independently comparable (api.md rule 4). A positional
`cells[]` aligned to `criteria[]` (bulk-availability's shape) — considered; a keyed
`ComparisonCells` reads/tests better for a small NAMED criteria set (`camp.cells.price.startingPrice`).

**Confirmation.** `grep -iE 'winner|rank|recommend|best' lib/ai/tools/compare-camps.ts → 0`; a
type-level test that `CompareCampsResult` has no such key; a unit asserting a `price` cell exposes
atomic `startingPrice`+`currency` (never a merged string) and a facet cell carries CAM-464's non-empty
`evidence`.

### Per-criterion VALUE MAPPING (concrete + testable — the analyst dimension)

| Criterion | Source field(s) | Cell value | "no data" cell (honest, never fabricated) |
|---|---|---|---|
| `price` | `priceLow`,`priceHigh`,`priceCurrency`,`isFree`,`extraFee*`,`feeInfo` | `ComparePrice` (`startingPrice`=priceLow) | `startingPrice:null` & `isFree:false` ⇒ model says "ไม่มีข้อมูลราคา" (if `isFree:true` ⇒ ฟรี, not no-data) |
| `capacity` | `getEffectiveCapacity(...)` (Decision 1) | `CompareCapacity` | `maxGuestsPerDay:null` (unbounded/unset) ⇒ "ไม่ได้ระบุจำนวน" |
| `rating` | `avgRating`,`reviewCount` | `CompareRating` | `avgRating:null` (⇔ `reviewCount:0`) ⇒ "ยังไม่มีรีวิว" |
| `verified` | `isVerified` | `CompareVerified` | none — a boolean is always known |
| `facilities` | `options{code,group,nameTh,nameEn,icon}` | `CompareFacilities` (atomic amenity list) | `amenities:[]` ⇒ "ไม่มีข้อมูลสิ่งอำนวยความสะดวก" |
| `cancellation_policy` | `cancellationPolicy` | `CompareCancellation` | `policy:null` ⇒ "ยังไม่ได้ระบุนโยบายยกเลิก" (EC-4 exemplar) |
| `distance` | `distanceFromBangkokKm(latitude,longitude)` | `CompareDistance` | `distanceFromBangkokKm:null` (lat/lng missing) ⇒ "ไม่ทราบระยะทาง" |
| `family` / `beginner` / `road_access` | `computeFacetScores({options{code,group}, minimumAge})` | `FacetScore` (`{score,confidence,answerable,evidence}`) | facet ABSENT from `computeFacetScores` ⇒ `null` (never a fake 0-score — mirrors CAM-464 BR-5) |

Every facet cell = `facets.find(f => f.facet === criterion) ?? null`, where `facets =
computeFacetScores(...)` (pure, synchronous, zero query — same call `getCampDetail` makes). Raw
`latitude`/`longitude` and raw `minimumAge` are NOT returned — only the derived km / the facet
`evidence` that references `minimumAge`. A camp missing data for a requested criterion yields the
explicit "no data" cell above; the model renders the honest "ไม่มีข้อมูล" line — never a fabricated
value (AC-1 honesty, EC-4).

---

## Decision 4 — hard cap (CAM-344) + de-dup, checked BEFORE the read

**Decision.** `export const MAX_COMPARE_CAMPS = 4;` The bound is enforced in `execute` as a graceful
discriminated refuse (mirrors CAM-465 `bulkAvailability`'s over-cap contract), AFTER de-dup and BEFORE
any DB read:

```ts
export const compareCampsArgsSchema = z.object({
  campIds: z.array(z.string().uuid()).min(1),        // per-id uuid guard; semantic 2..4 lives in execute (de-dup first)
  criteria: z.array(z.enum(CRITERION_IDS)).optional(), // unknown criterion ⇒ invalid_args, no read (BR-4)
});

export async function executeCompareCamps(args): Promise<CompareCampsResult> {
  const ids = [...new Set(args.campIds)];             // de-dup a model/state-controlled array
  if (ids.length < 2)  return { ok: false, reason: 'too_few' };   // AC-4-neighbour / EC-2  ─┐ both O(1),
  if (ids.length > MAX_COMPARE_CAMPS) return { ok: false, reason: 'too_many' }; // AC-4 / EC-1 ─┘ BEFORE findMany
  const criteria = args.criteria?.length ? [...new Set(args.criteria)] : DEFAULT_COMPARE_CRITERIA;
  const rows = await prisma.campSite.findMany({ /* Decision 1 gate + select */ });
  if (rows.length < 2) return { ok: false, reason: 'insufficient_visible' };    // AC-5 / EC-2 / EC-3 (no id list — no oracle)
  // …build cells for `criteria` only; order camps by `ids`… wrap the read+compute in try/catch → reason:'error' (honest, never fabricate)
}
```

**Rationale.** De-dup must run BEFORE the count, which a zod `.max()` on the raw array cannot do
(`[a,a,a,a,a]` = 1 unique). A graceful `{ok:false, reason}` (not a bare zod `invalid_args`) gives the
model a phraseable, distinct reason for the honest decline — `too_many` ⇒ "เทียบทีละ 2-4 ลาน" (AC-4),
`too_few`/`insufficient_visible` ⇒ "ต้องมีอย่างน้อย 2 ลาน" / "เหลือลานเดียวที่เทียบได้" (EC-2). Both
length checks and the de-dup are O(n) in-memory with NO DB work, so the CAM-344 "cap before the loop"
invariant holds regardless of array size — no unbounded scan can run before the refuse. `>MAX` is
REFUSED, never silently truncated to a partial compare (BR-2 — a truncated named set misleads).

**Rejected alternative.** zod `.min(2).max(4)` → `invalid_args` (the story's BR-1 shorthand) —
rejected: cannot de-dup before counting, and a generic validation failure gives the model no distinct
reason to phrase the "narrow it down" vs "cannot compare" answers. (The story flagged the exact
ceiling + refuse-shape as an architect G2 call.)

**Confirmation.** Units: `campIds.length > 4 (unique)` ⇒ `too_many` with `prisma.campSite.findMany`
NOT called (spy asserts zero DB call — cap-before-read); `< 2 unique` ⇒ `too_few`; `[a,a]` ⇒ `too_few`
(de-dup); an unknown criterion ⇒ `invalid_args`. Integration: gating an id below 2 visible ⇒
`insufficient_visible` (no per-id list returned).

---

## Decision 5 — registration (guest / read-only) + roster pin + eval

**Decision.** Register `compareCampsTool` (tier `'guest'`, read-only, `execute: (args,_ctx)=>…`, `_ctx`
unused — no caller identity needed, mirrors `getCampDetail`/`bulkAvailability`) in
`lib/ai/tools/index.ts`. It is additive to the read-only registry (BR-1 invariant unchanged — zero
`prisma.*.create|update|delete|upsert`).

**Authz (per-tool, named — quality bar).** PUBLIC / `guest` tier: no session, no ownership, no
role-gate. Reads only public published camps (the CAM-469 gate). No new PII surface (guest-safe
subset only). The registry still refuses any `authed`-tier tool without a session (`dispatchTool`), but
`compareCamps` is `guest`, so it is always offered — the tier is the authz contract.

**Error-code mapping** (this is a registry tool, not an HTTP route — the api.md set maps to the tool
result + `dispatchTool` codes): `400`→`invalid_args` (bad uuid / unknown criterion) + the semantic
`too_few`/`too_many` refuses · `401`/`403`→ N/A (guest, no auth/ownership) · `404`→ N/A (an absent id
is silent — no not-found error, no existence oracle; a fully-unresolvable set surfaces as
`insufficient_visible`) · `409`→ N/A (no state conflict) · `500`→ a thrown DB/read error is caught in
`execute` and returned as `{ok:false, reason:'error'}` (honest — never a fabricated comparison;
mirrors `bulkAvailability`).

**Roster pin (cam-459).** `__tests__/cam-459-answer-policy-3-zones.test.ts` pins the EXACT registered
roster (the "fails loudly if a tool is added" test, ~line 243). Build must add `'compareCamps'` to that
sorted array (with a `// CAM-473 — new read-only guest-tier tool` comment) in the SAME PR — this is an
additive read-only entry, the zone-C write-tool invariant is unchanged.

**Eval (P2, 8-case ceiling note).** Add one P2 comparative golden case to
`scripts/ai-eval/golden-cases.json` (+ `case-schema.ts` if a new field is needed) — a SMOKE case
(the fixture is ~8 cases) asserting `compareCamps` is called with the resolved campIds + the intent's
`criteria`. `DEFAULT_MAX_EVAL_CASES = 500` (`scripts/ai-eval/guards.ts`) so the ~8-case smoke set is
nowhere near a ceiling — no guard blocks it. A SOFT dependency on CAM-457's format (CAM-459/460/461
added theirs the same way), not a hard block.

**Prompt seam (build/backend).** The tool description + the system prompt instruct the model to
resolve `campIds` from CAM-460's `<shown_results>` ordinals and set `criteria` from the camper's intent
(omit ⇒ default). Facet cells are answered ONLY from `evidence`; an absent facet / null cell ⇒
"ไม่มีข้อมูล", never a guess (same honesty clause `getCampDetail`'s description carries). No
`winner` is asserted by the tool — the model phrases the recommendation from the returned evidence.

**Confirmation.** `getRegisteredTools('guest')` includes `compareCamps`; the cam-459 roster-equality
test is green WITH `'compareCamps'` in the sorted array (and RED without — prove teeth once); the P2
golden case loads with 0 `loadErrors`.

---

## Decision 6 — migration / reversibility / additivity

**Decision.** No schema change, no migration — every field is an existing `CampSite` column (or a
pure derivation: `getEffectiveCapacity`, `computeFacetScores`, `distanceFromBangkokKm`). The change is
purely additive: ONE new file (`lib/ai/tools/compare-camps.ts`) + one `registerTool` line + one export +
one roster-test line + one eval case. `get-camp-detail.ts` and every other tool are UNCHANGED.

**Reversibility.** Fully reversible with no data effect — delete the file, drop the `registerTool` +
export, revert the roster-test line and the eval case. No `prisma migrate` runs. Nothing to backfill,
nothing to roll back on the DB.

**Confirmation.** `npx prisma migrate dev --create-only` produces NO migration (schema unchanged);
`git diff` touches only the additive surface above; the read-only-registry grep stays 0.

## ADRs

No NEW ADR required — the hard-to-reverse stances are already governed:
- **Closed criteria enum** → ADR-003 (enum vs MasterData: a criteria vocabulary is an engineering enum).
- **No forked data path** (reuse `computeFacetScores` + `getEffectiveCapacity`; dedicated lean read; single-camp read untouched) → ADR-009.
- **No-winner / values+evidence honesty** → story BR-5 + research P13 (owner/PO-fixed at G1); recorded here as a Decision-3 contract with a grep/type Confirmation rather than a standalone ADR (local to this tool, reversible).

Confirmation: the Confirmation line under each Decision above is the CI check/test that fails if that
decision is violated (roster grep, `winner` grep, cap-before-read spy, guest-safe-select regression,
`getCampDetail` diff-clean, no-migration).

## Links
`../../feature.md` (## Architecture overview) · `story.md` · `prisma/schema.prisma` (CampSite) ·
`lib/ai/tools/get-camp-detail.ts` (select + `CampAmenity`, reuse — do NOT mutate) ·
`lib/facet-scores.ts` (`computeFacetScores`, CAM-464) · `lib/campsite-availability.ts`
(`getEffectiveCapacity`) · `lib/ai/tool-registry.ts` · `lib/ai/tools/bulk-availability.ts` (CAM-465
cap/refuse precedent) · `docs/adr/ADR-003-enum-vs-masterdata.md` · `docs/adr/ADR-009-ai-assistant-data-architecture.md`

## Changelog
- v1 (2026-07-24) — created at G2. Records all 6 architect/analyst forks the story flagged: dedicated
  lean batch read (getCampDetail untouched, CAM-355) with explicit CAM-469 gate inheritance +
  per-spot-correct capacity via `getEffectiveCapacity` (rejects the CAM-355/400 raw-column fork);
  closed 10-member `CriterionId` enum + `['price','capacity','family','verified','rating']` default;
  keyed values+evidence matrix with NO winner field; `MAX_COMPARE_CAMPS=4` de-dup + graceful
  discriminated refuse checked before the read (CAM-344); guest/read-only registration + cam-459
  roster pin +1 + one P2 eval smoke case; no schema/migration, fully reversible. Concrete+testable
  per-criterion value mapping table added (analyst dimension). Zero open clarification markers.
