---
linear: CAM-465
feature: ai-assistant
epic: assistant-answers-real-camper-asks-gap-closure-w1 (CAM-456)
persona: Camper
artifact: tech
owner: architect
status: In Progress (G2 — Technical design)
version: v1
updated: 2026-07-24
---
# Tech — bulkAvailability (live-batch, hard-capped) (CAM-465)

> Rich tool-contract artifact. `bulkAvailability` is a NEW read-only AI tool
> (`lib/ai/tools/bulk-availability.ts` + one `registerTool` line in
> `lib/ai/tools/index.ts`). No schema, no migration, no HTTP endpoint — it is
> dispatched through the existing `/api/ai/chat` tool registry exactly like
> `searchCampsites`/`checkAvailability`/`resolveDates`. This file records the 6
> G2 decisions the story flagged (Seams §"ARCHITECT G2 DECISIONS").

## Data model
No new model. No migration. `bulkAvailability` is CODE only — a READER over the
existing Booking / InternalHold / BlockedDate / CampSite / Spot tables via the
already-shipped batched core `getRemainingCapacityForCamps`
(`lib/campsite-availability.ts`, CAM-427). It writes nothing. `npx prisma
validate` is unaffected (no schema touch).

---

## Decision 1 — LIVE-BATCH, not materialized (confirmed)

**Decision.** Ship LIVE-BATCH: every call computes availability fresh by reusing
`getRemainingCapacityForCamps` (the SAME batched core `searchCampsites`' "เหลือ N
ที่" already runs). No new table, **no migration**.

**Rationale.** ADR-009 (live tool reads, never cached/materialized) + the epic
core rule (availability is ALWAYS live, BR-2). Reusing the shipped core means
bulk can never disagree with the single-camp `checkAvailability` or the search
card for the same (camp, range) — one derivation, ADR-009 no-forked-data-path.

**Rejected — the PREP-6 materialized `AvailabilityCalendar` table** (schema-gap
§PREP-6): a precomputed calendar is a SECOND source of truth that must be kept
in sync on every Booking/Hold/BlockedDate write, and it earns its keep only at
query volume this tool does not yet have (CAM-344 / CAM-355 no-premature-
materialization). Deferred to phase-2; trigger = measured live-batch query
volume. Not built here.

**Confirmation.** Grep `bulk-availability.ts` imports `getRemainingCapacityForCamps`
and references NO `AvailabilityCalendar`/`prisma.availabilityCalendar`; the file
issues no `prisma.$transaction`/write. `npx prisma migrate diff` shows an empty
diff for this story.

---

## Decision 2 — The hard cap (load-bearing, CAM-344)

Two independent hard caps, **both checked BEFORE any DB call**, reusing the
existing shipped constants:

| Dimension | Constant (value) | Where enforced | Over-cap behaviour |
|---|---|---|---|
| **Ranges** (model-controlled array) | `MAX_DATE_SET_RANGES` = 12 (reuse from CAM-462) | Step 1 in `execute`, O(1) `args.dates.length` check, **before any Prisma call** | **REFUSE** → `{ ok:false, reason:'over_cap' }` |
| **Candidate camps** (filter result page) | `SEARCH_CAMPSITES_MAX_RESULTS` = 10 (reuse from CAM-427) | `take: 10` on the candidate `findMany` | **BOUND (top-N page)**, not refused |
| **Total cells** | 10 × 12 = **120** (derived) | structural invariant of the two caps above | n/a — cannot exceed 120 by construction |

**Ranges → refuse (CAM-344 literal).** `dates` is a model-controlled array; a
partial/truncated date-set silently answers a DIFFERENT question ("which of
SOME weekends"). So the range cap is a pre-loop `if (args.dates.length >
MAX_DATE_SET_RANGES) return { ok:false, reason:'over_cap' }` — checked FIRST,
before the candidate query, before any availability read. The model surfaces
`ช่วงเวลาหรือจำนวนลานกว้างไป ลองแคบลงหน่อยนะ` (AC-5). This mirrors resolveDates'
own `too_many` and search-campsites' pre-query `excludeIds` bound — cap the
model array BEFORE the query, never build-then-truncate.

**Camps → `take`-bound, NOT refused (deliberate departure from "refuse both").**
The candidate set comes from a FILTER (province/type/price/taxonomy), not an
enumerated camper list, so returning the top-N matching camps is the SAME
"top 10 results" contract `searchCampsites` already ships (`take:
SEARCH_CAMPSITES_MAX_RESULTS`) — a complete, honest answer to a filter, not a
silent partial of a user-named list. Refusing every filter that matches >10
camps (e.g. a bare province) would make the tool near-useless. The matrix
reports exactly the camps queried; the model can say "checked the top 10
matching camps." Deterministic `orderBy: orderByFor(sort ?? 'related')` (reuse)
makes the page stable.

**Total cells → structural, no runtime check.** Because ranges are hard-refused
at 12 and camps are hard-bound at 10 independently and both BEFORE the batch,
`cells ≤ 120` is an invariant — a separate runtime cell-count guard is
redundant for filter input. (It becomes REQUIRED only if a model-controlled
`campId[]` input is ever added — see Decision 3 phase-2 contract.)

**Per-range night guard inherited (CAM-344 MAX_STATUS_RANGE_NIGHTS = 366).**
Each range is passed straight into `getRemainingCapacityForCamps` →
`computeBatchedNightlyOccupancy`, which already rejects a single range wider
than 366 nights (returns `null`/`{}` → that range's cells become `unknown`,
EC-6). A single hand-crafted 8000-night range therefore cannot allocate a
per-night loop — the guard already lives one layer down, inherited for free,
same as `checkAvailability` inherits it.

**Confirmation.** Unit test: over-cap on ranges (13 ranges) returns `over_cap`
with **zero** Prisma calls issued before the return (spy on `prisma`); a filter
matching 25 published camps returns a matrix of exactly 10 rows; a 400-night
single range yields `unknown` cells without throwing.

---

## Decision 3 — Input shape: FILTER-ONLY (recommended)

**Decision.** v1 accepts a candidate-camp **FILTER** (a subset of the
`searchCampsites` arg shape) + `dates: DateRange[]` passed **directly** by the
model (the `resolveDates` output). No raw `campId[]` in v1.

```ts
bulkAvailabilityArgsSchema = z.object({
  // candidate filter — same vocabulary searchCampsites already validates
  province: z.string().trim().min(1).max(100).optional(),
  region:   z.string().trim().min(1).max(50).optional(),
  type:     z.string().trim().min(1).max(20).optional(),
  keyword:  z.string().trim().min(1).max(100).optional(),
  priceMin: z.number().nonnegative().optional(),
  priceMax: z.number().nonnegative().optional(),
  petFriendly: z.boolean().optional(),
  terrain:    z.enum(TERRAIN_CODES).or(z.array(z.enum(TERRAIN_CODES))).optional(),
  access:     z.enum(ACCESS_CODES).or(z.array(z.enum(ACCESS_CODES))).optional(),
  activities: z.enum(ACTIVITY_CODES).or(z.array(z.enum(ACTIVITY_CODES))).optional(),
  facilities: z.enum(FACILITY_CODES).or(z.array(z.enum(FACILITY_CODES))).optional(),
  sort:    z.enum(VALID_SORTS).optional(),
  guests:  z.number().int().positive().optional(),      // BR-7, default 1
  // the date-SET — resolveDates output, passed straight through (min 1; the
  // MAX_DATE_SET_RANGES cap is enforced in execute → over_cap, NOT via zod .max
  // so it surfaces as a graceful refuse, not invalid_args)
  dates: z.array(z.object({ startDate: isoDate, endDate: isoDate })).min(1),
});
```

**Rationale.**
- Every AC (AC-1/AC-4/AC-6) is stated over a FILTER candidate set; the Story
  scope names the filter explicitly. Both flagged KPI asks resolve with
  filter-only: `มีลานไหนว่างวีคเอนด์เดือนนี้` = filter + N ranges;
  `ถูกสุดที่ยังว่างเสาร์นี้` = filter(`sort: price_asc`) + 1 range.
- **Visibility gate inherited for free (CAM-469).** `buildCampSiteWhere` already
  gates `isActive:true AND isPublished:true AND deletedAt:null` (BR-4); no
  forged/unpublished id can enter the matrix, and there is no ungated
  `campId[]` surface to leak one. This closes AC-6/EC-5 by construction.
- Lean/YAGNI: fewer caps to reason about (camps bounded by `take`; only ranges
  need the refuse-cap).
- The "is camp A, B, C free" ask is already served by per-camp
  `checkAvailability` within the 6-call/turn budget (ADR-013).

**`dates` arrival — model passes the `DateRange[]` directly** (does NOT have bulk
call `resolveDates` internally). Rationale: `resolveDates` is a separate tool the
model already orchestrates (resolveDates → searchCampsites is the shipped
pattern); keeping bulk single-responsibility (availability, not phrase parsing)
avoids duplicating the ambiguous/`too_many` surface `resolveDates` already owns,
and matches how `searchCampsites` takes `startDate`/`endDate` directly. Rejected:
bulk calling `resolveDates` internally (couples two concerns; re-owns phrase
errors).

**Rejected for v1 — raw `campId[]` input.** Not required by any AC. `phase-2
contract (if ever added)`: since `getRemainingCapacityForCamps` is UNGATED
(CAM-469 note), a model-supplied `campId[]` MUST be re-gated BEFORE the batch —
`prisma.campSite.findMany({ where: { id: { in: ids }, isActive:true,
isPublished:true, deletedAt:null }, select:{ id:true } })`, and only the
surviving ids proceed (identical predicate to `check-availability.ts`'s CAM-469
gate + `get-camp-detail.ts`). It is ALSO a model-controlled array → its length
must be pre-capped (slice/refuse) AND the total-cell guard (Decision 2) becomes
required. Documented here so the gate is not lost; not built.

**Confirmation.** Unit test: a filter matching an unpublished/inactive/soft-
deleted camp never appears in the matrix (AC-6/EC-5); the args schema exposes NO
`campId`/`campSiteId`/`userId` field (grep the zod object + jsonSchema).

---

## Decision 4 — N+1 / performance (verified: the core batches per-range)

**Verified.** `getRemainingCapacityForCamps(campIds, start, end)` →
`computeBatchedNightlyOccupancy` runs **5 grouped `{ in: campIds }` queries in
one `Promise.all`** for ALL candidate camps in that range (campSite, booking,
blockedDate, internalHold, spot) — NOT one query per camp. It is genuinely
batched per-range; there is **no per-camp round-trip**.

**Query count (real).** `1` candidate `findMany` (buildCampSiteWhere + take:10)
`+ 5 × R` for the R ranges, where `R ≤ MAX_DATE_SET_RANGES = 12`.
→ **≤ 1 + 5×12 = 61 queries total, O(rangeCount), NOT O(camps × ranges).**
The camp count never multiplies the query count.

**Design.** bulk calls `getRemainingCapacityForCamps(candidateIds, start, end)`
**once per range** (a small `for range of dates` loop, R ≤ 12), building the
matrix column-by-range. No per-camp loop, no parallel capacity formula.

**Rejected — collapse all ranges into ONE widened-window query classified
per-range in memory.** Two hard problems: (1) it would fork the per-range
bottleneck-night derivation OUTSIDE `computeBatchedNightlyOccupancy` → an
ADR-009 no-forked-data-path violation (bulk would re-derive what the core
already computes); (2) a widened window (earliest start → latest end) can exceed
`MAX_STATUS_RANGE_NIGHTS = 366` even when each range is a 2-night weekend spread
across a year → the core's DoS guard returns `{}` and blanks ALL ranges. The
per-range calls are therefore both correct AND necessary; 61 bounded queries is
well within budget (no measured hot-path pressure — premature optimization).

**Confirmation.** Unit test asserts a mocked `getRemainingCapacityForCamps` is
called exactly `R` times (once per range) and `prisma.campSite.findMany` /
per-camp `getRemainingCapacity` are never called per-camp; numbers for a given
(camp, range) equal the single-camp `checkAvailability` result (ADR-009 parity).

---

## Decision 5 — Return matrix wire shape

Discriminated union (api.md §11), positional camp × range matrix — compact
(cells align by INDEX to `ranges`, no date repeated per cell), bounded ≤120
cells, camp identity reuses the `ai-camp-card` fields (parity with the search
cards, ADR-009):

```ts
type CellStatus =
  | { status: 'free';    remaining: number }   // remaining >= guests
  | { status: 'full' }                         // remaining===0 OR blockedByHost OR remaining<guests
  | { status: 'unknown' };                     // remaining===null (unbounded/unrated) or range fail-open (EC-6)

interface BulkAvailabilityCamp extends AiCampCard {  // id, nameTh, slug, province, priceLow, avgRating, firstTag, hasReviews…
  cells: CellStatus[];                               // cells[i] ↔ ranges[i], SAME order
}

type BulkAvailabilityResult =
  | { ok: true;
      ranges: { startDate: string; endDate: string }[];   // echoes the queried date-set, defines the column order
      camps:  BulkAvailabilityCamp[]; }                    // EVERY candidate camp present (AC-2), never omitted
  | { ok: false; reason: 'over_cap' | 'no_match' | 'error' };
```

- **Cell projection over `RemainingCapacityResult` (BR-5, reused verbatim — no
  new availability math):** `full` when `remaining === 0 || blockedByHost ||
  (remaining !== null && remaining < guests)`; `free` (carry `remaining`) when
  `remaining !== null && remaining >= guests`; `unknown` when `remaining ===
  null`. The `< guests` comparison is the SAME `numericallyFull` shape
  `getAvailabilityStatusForCamps` already uses — a projection, not a fork.
- **Full camps stay present (AC-2/AC-3/EC-1):** every candidate camp row is
  emitted with a cell for every range; a camp full for all ranges is `full`
  cells across the row, never dropped. Per-range status is preserved (AC-3), not
  collapsed to one flag.
- **Camp identity via `aiCampCardSelect` + `toAiCampCard`** (CAM-427 read model)
  so the matrix cards match the `searchCampsites` cards byte-for-byte (price for
  "ถูกสุดที่ยังว่าง" ranking, first-tag, review flag) — no parallel projection.
- **Token budget:** ≤10 camps × ≤12 positional cells; cells carry only a 1-word
  status + an int — compact and within the model's tool-result budget.

**Assembly order in `execute` (all caps pre-batch):**
1. `if (args.dates.length > MAX_DATE_SET_RANGES) return { ok:false, reason:'over_cap' }` — O(1), before any DB call.
2. Resolve candidates: `buildCampSiteWhere(filter)` → `findMany({ where, select: aiCampCardSelect, orderBy: orderByFor(sort ?? 'related'), take: SEARCH_CAMPSITES_MAX_RESULTS })` (1 query; visibility gate + region/province resolve reused from search-campsites).
3. `if (rows.length === 0) return { ok:false, reason:'no_match' }` — AC-4/EC-2, no availability query runs.
4. For each range → `getRemainingCapacityForCamps(candidateIds, start, end)`; project each camp's cell. A range that fail-opens (`{}`) → `unknown` cells for that range only, matrix continues (EC-6).
5. Any **throw** from a live read → `return { ok:false, reason:'error' }` (BR-6/EC-4 — never fabricate "free", never a silent partial matrix; the model tells the camper it couldn't check).

**Confirmation.** Unit tests: a mixed camp (free some ranges, full others) shows
per-range cells (AC-3); a full-everywhere camp is present with all `full` (AC-2);
empty candidate set → `no_match` (AC-4); a thrown read → `error`, no fabricated
`free` (EC-4).

---

## Decision 6 — Confirmations

| Item | Confirmed |
|---|---|
| Tier | `guest` (read-only, no identity; `ctx.userId` unused) — same as `checkAvailability`/`searchCampsites`/`resolveDates` |
| Read-only | Reads only; no `$transaction`, no write, no mutation |
| Live-only | Reuses `getRemainingCapacityForCamps`; never cached, never a materialized read (ADR-009, BR-2) |
| CAM-469 gate | Inherited via `buildCampSiteWhere` (isActive+isPublished+deletedAt:null); no ungated `campId[]` surface in v1 |
| Migration | **None** — no schema change; `prisma validate` unaffected |
| Reversible | Additive: delete `lib/ai/tools/bulk-availability.ts` + its one `registerTool` line → fully removed, no data effect |
| Backward-compatible | New tool only; changes NO existing tool/contract (api.md §12 additive) |
| Guests | Optional `guests` arg, **default 1** (BR-7) — a projection comparison over the reused `remaining`, no forked math |

**Eval P3/P4/P12 (8-case ceiling note).** This story ships the CAPABILITY the
P3/P4/P12 temporal+aggregate golden cases measure — it does NOT add the fixture
cases. The `cam-457` harness currently pins `cases.length <= 8`
(`__tests__/cam-457-eval-harness.test.ts:102`); lifting that ceiling + importing
the golden corpus is Out-of-scope (blocked on the owner corpus, story
Out-of-scope). The eval pass-rate is owner-verified once the corpus lands.

## ADRs
No standalone ADR required. Every decision here reverses cheaply (additive new
tool, no schema, no migration) — the hard-to-reverse call (materialize vs live)
is Decision 1, recorded above with its rejected alternative and phase-2 trigger;
it does not clear the "hard-to-reverse / cross-module" bar for a separate
`docs/adr/ADR-NNN` because live-batch adds no persistent state to unwind. It
composes under the existing ADR-009 (live tool reads) + ADR-013 (bounded loop /
guest tier). If phase-2 materialization is taken up, THAT earns an ADR
(introduces a synced second store).

Confirmation: `npx prisma migrate diff --from-schema-datamodel prisma/schema.prisma
--to-schema-datamodel prisma/schema.prisma` is empty (no schema decision to
record); the tool's live-only contract is enforced by the Decision 1 grep +
ADR-009 parity test in Decision 4.

## Links
`../../feature.md` (## Architecture overview) · `story.md` · `prisma/schema.prisma` ·
`lib/campsite-availability.ts` (getRemainingCapacityForCamps, CAM-427) ·
`lib/campsite-filters.ts` (buildCampSiteWhere) ·
`lib/ai/tools/search-campsites.ts` (filter arg shape, SEARCH_CAMPSITES_MAX_RESULTS) ·
`lib/ai/tools/resolve-dates.ts` (DateRange, MAX_DATE_SET_RANGES) ·
`lib/ai/tools/check-availability.ts` (CAM-469 gate precedent) ·
`lib/ai/tool-registry.ts` · ADR-009 · ADR-013 · CAM-344

## Changelog
- v1 (2026-07-24) — created; 6 G2 decisions recorded. Live-batch confirmed (no
  migration), two-dimension hard cap (ranges refuse @12 / camps take-bound @10 /
  cells ≤120 structural), filter-only input (CAM-469 gate inherited; campId[]
  phase-2 with its explicit re-gate contract), N+1 verified absent (O(rangeCount)
  = ≤61 queries), positional camp×range matrix over the reused RemainingCapacity
  projection, guest/read-only/live/reversible/additive confirmed.
