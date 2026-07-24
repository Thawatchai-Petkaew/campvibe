---
linear: CAM-461
feature: ai-assistant
epic: assistant-answers-real-camper-asks-gap-closure-w1 (CAM-456)
persona: Camper
artifact: tech
owner: architect
status: In Design (G2)
version: v1
updated: 2026-07-24
---
# Tech — Follow-up search refines instead of restarts (excludeIds + sort + OR-within-facet-group) (CAM-461)

> Rich-API-contract artifact for the seam-heavy shared-fn change. The three refinements are
> QUERY-SHAPE changes only — no schema, no migration, no new tool (compareCamps → CAM-473).
> The load-bearing risk is that `buildCampSiteWhere` is shared by 6 callers (CAM-355 lesson);
> every decision below is proven ADDITIVE and byte-identical for the 5 non-AI callers.

## Data model
No entity/field change. No migration. All three refinements are `where`/`orderBy`-shape changes
threaded through the SAME `buildCampSiteWhere` + `orderByFor` + `aiCampCardSelect` every catalog
caller already uses (ADR-009 no-forked-data-path). Reversible by pure code revert.

---

## Decision 1 — OR-within-facet-group (the shared-fn change, additive & non-breaking)

**Today** (`lib/campsite-filters.ts` §6): each taxonomy param is a comma-`string`; `addOptionFilter`
splits it and pushes ONE `{ options: { some: { code } } }` per code into `where.AND` → a camp must
carry EVERY code (AND-per-code). `terrain:"RIVE,BEAC"` today = the impossible intersection.

**Decision** — widen each taxonomy field from `string` to `string | string[]` and branch on shape.
The where-shape per group:

| Input shape (per group) | Emitted `where.AND` element | Semantics |
|---|---|---|
| `string` (`"RIVE"` or `"RIVE,BEAC"`) — **every existing caller** | one `{ options: { some: { code } } }` **per split code** (UNCHANGED) | AND-per-code, byte-identical to today |
| `string[]` (`["RIVE","BEAC"]`) — **the AI tool only** | ONE `{ options: { some: { code: { in: [...] } } } }` | OR-within-group (union) |

Both shapes push exactly ONE-or-more elements onto `where.AND`, so **groups stay AND-ed against
each other** (a camp must satisfy every named group; OR only within a group). Sketch:

```ts
// CampSiteFilterParams: terrain/access/activities/facilities/external/equipment: string | string[]
const addOptionFilter = (param?: string | string[]) => {
  if (param === undefined) return;
  if (Array.isArray(param)) {                       // NEW: OR-within-group
    const codes = param.filter(Boolean);
    if (codes.length === 0) return;                 // EC-3: [] = group not specified (no filter, not zero-match)
    andArray.push({ options: { some: { code: { in: codes } } } });
    return;
  }
  const codes = param.split(",").filter(Boolean);   // UNCHANGED string path — equality shape preserved
  if (codes.length === 0) return;
  codes.forEach((code) => andArray.push({ options: { some: { code } } }));
};
```

**Non-breaking proof** — grep-inventory (arch 15b, grep terms `buildCampSiteWhere`, `terrain:`,
`access:`, `searchParams.get`):

| Caller | Passes | Branch hit | Behavior |
|---|---|---|---|
| `app/api/campsites/route.ts` | destructured query `string` | string | **NO-CHANGE** (byte-identical) |
| `app/api/campgrounds/route.ts` | `searchParams.get('terrain') \|\| undefined` → `string` | string | **NO-CHANGE** |
| `app/actions/getCampSiteCount.ts` | `CampSiteFilterParams` (strings) | string | **NO-CHANGE** |
| `app/actions/getCampgroundCount.ts` | `CampSiteFilterParams` (strings) | string | **NO-CHANGE** |
| `lib/catalog-cursor.ts` (merged by campsites route) | n/a — `buildKeysetWhere`, separate | — | **NO-CHANGE** |
| `lib/ai/tools/search-campsites.ts` | `string \| string[]` | both | **CHANGE** (the one caller that opts into arrays) |

No catalog caller can reach the array branch — URL params are always `string | undefined`, and the
count actions forward strings. Widening `CampSiteFilterParams` from `string` to `string | string[]`
is an INPUT-type widening (every string caller still type-checks). The single-code path keeps the
equality shape `{ options: { some: { code: 'RIVE' } } }` — the shape `__tests__/cam-408-...test.ts:61`
pins. **The AI tool must pass a single model-emitted string THROUGH as a string** (never normalize
`"RIVE"`→`["RIVE"]`), or it would flip to the `{ code: { in: [...] } }` shape and drift cam-408.

**Rejected alternative** — flip the shared semantics to OR for everyone (make comma-string = OR).
Rejected: silently changes the public catalog's multi-select filter meaning for 5 callers with no AC
asking for it — exactly the CAM-355/CAM-400 shared-seam-flip incident. Additive array = pure superset.

Confirmation: `__tests__/cam-408-*.test.ts:61` still green (single string → equality shape) + a new
cam-461 unit asserts `terrain:["RIVE","BEAC"]` → `{options:{some:{code:{in:["RIVE","BEAC"]}}}}` AND
a second named group co-present stays a SEPARATE `where.AND` element (OR-within, AND-across).

---

## Decision 2 — excludeIds delivery: MODEL-emits from the CAM-460 shown-set (option a)

**Decision** — the MODEL emits `excludeIds: string[]` as a `searchCampsites` arg, reading the
campSiteIds from CAM-460's already-injected `<shown_results>` prompt block. The server does NOT
auto-inject. `buildCampSiteWhere` gains `excludeIds?: string[]` → `where.id = { notIn: excludeIds }`
when non-empty (additive; absent = unset = byte-identical for every other caller).

**Why (a) over (b) server-auto-inject** — correctness, not just flexibility:
- Only the model can distinguish "ขออีก / ไม่เอาที่แสดงไปแล้ว" (exclude the shown set, AC-1/AC-5)
  from a **filter-refine** ("ริมน้ำ อันถูกๆ") where the camper still WANTS matching camps they saw.
  Server auto-inject (b) is blunt: it would exclude the shown set on EVERY follow-up search, wrongly
  hiding matching camps on a legitimate refine — a new bug in exchange for determinism.
- The shown-set is ALREADY in the prompt (CAM-460 `<shown_results>` = ordinal→campSiteId→name). (a)
  reuses that seam with ZERO new plumbing. (b) needs `shownIds` threaded into `ToolContext` +
  `executeSearchCampsites` reading `ctx.shownIds` — new machinery that still can't get semantics right.

**Reliability guard rails** (the known weakness of (a) is a mis-transcribed UUID):
- `excludeIds` is typed `z.array(z.string())` — **NOT** `.uuid()`: a mis-copied id lands in `notIn`
  and simply excludes nothing (graceful under-exclude, a shown camp may reappear) rather than failing
  the whole search as `invalid_args`. Degraded, never broken; no crash, no data effect.
- ONE prompt line (added to `buildShownResultsBlock`, the CAM-460 seam): when the camper asks for
  more/other/different results, re-call `searchCampsites` with the SAME filters plus `excludeIds` set
  to the campSiteIds listed in `<shown_results>`.
- Cap `MAX_EXCLUDE_IDS = 50` (new export, `search-campsites.ts`): the tool **slices** `args.excludeIds`
  to the first 50 **before** `buildCampSiteWhere`/`findMany` (CAM-344 — bound a model-controlled array
  length before the query). BR-1 says "keep the first N, never fail" → a `.slice`, NEVER a rejecting
  `zod.max()`.

**Rejected alternative** — server-auto-inject (b): blunt semantics above. **Rejected / deferred
hybrid** — a boolean `excludeShown:true` the server expands to the true `shownIds` (dodges UUID copy):
rejected for now because BR-1 already fixed the arg as an id array, a second exclusion arg is two ways
to do one thing, and the guest path has no server-side shownIds to expand. Revisit ONLY if eval P5
shows UUID-transcription is unreliable in practice (flagged to G2 — see `needs_decision`).

Confirmation: cam-461 unit — `>50` ids → `findMany` `where.id.notIn.length === 50` (never throws);
a non-matching id in `excludeIds` excludes nothing; eval P5 (`ขออีก` → `excludeIds` = shown set;
all-excluded → `[]`).

---

## Decision 3 — sort: reuse VALID_SORTS / orderByFor verbatim (no new vocabulary)

**Decision** — `sort?: 'related'|'price_asc'|'price_desc'|'rating'` (import `VALID_SORTS` from
`lib/catalog-cursor.ts`; `z.enum(VALID_SORTS)`). `executeSearchCampsites` applies
`orderBy: orderByFor(args.sort ?? 'related')` — the SAME pure `orderByFor` the catalog uses (ADR-009,
no forked sort). No parallel ordering logic; NULL handling (free-first for `price_asc`, no-review-last
for `rating`) comes for free from `orderByFor`.

**Default-order note (BR-2 🟡, resolved)** — today the tool calls `findMany` with **no `orderBy`**
(unspecified/nondeterministic order). Defaulting absent `sort` → `related` makes results deterministic
(eval reproducibility) and matches the catalog's default. This is the ONE intended behavior change;
it is safe because no existing search test pins result ORDER — cam-270/404/408 assert `where`/set
membership via `.toContainEqual`, never full-object `findMany` equality, so adding `orderBy` does not
break them. Recommend `related` (not order-unspecified) — confirm at G2.

**Rejected alternative** — a bespoke `sort` map inside the tool. Rejected: forks the catalog's
sort semantics (ADR-009 violation) and re-solves the NULL-ordering edge cases `orderByFor` already owns.

Confirmation: cam-461 unit — absent `sort` → `findMany` called with `orderBy: orderByFor('related')`;
`sort:'price_asc'` → `orderByFor('price_asc')`; eval P4 (`ถูกไปแพง`→`price_asc`, `รีวิวดีสุด`→`rating`).

---

## Decision 4 — zod + tool-registry: backward-compatible by addition

`searchCampsitesArgsSchema` deltas (all additive, api.md §12):

```ts
terrain:  z.enum(TERRAIN_CODES).or(z.array(z.enum(TERRAIN_CODES))).optional(),   // string OR array
access:   z.enum(ACCESS_CODES).or(z.array(z.enum(ACCESS_CODES))).optional(),
activities: z.enum(ACTIVITY_CODES).or(z.array(z.enum(ACTIVITY_CODES))).optional(),
facilities: z.enum(FACILITY_CODES).or(z.array(z.enum(FACILITY_CODES))).optional(),
sort:       z.enum(VALID_SORTS).optional(),                                       // NEW
excludeIds: z.array(z.string()).optional(),                                       // NEW (no .uuid, no rejecting .max)
```

- Each array element is still enum-validated → an unknown code fails `invalid_args` before any query
  (EC-3, CAM-408 precedent, `dispatchTool`). Empty array `[]` = "group not specified" (handled in
  `addOptionFilter`, EC-3) — never a zero-match query.
- Backward compatible: a call with today's args (`{province, terrain:"RIVE", priceMax}`) matches the
  first union member of each field and validates byte-identically (BR-4). No arg removed/retyped.
- `jsonSchema` for each taxonomy prop becomes
  `{ oneOf: [ {type:'string', enum:CODES}, {type:'array', items:{type:'string', enum:CODES}} ] }`
  with a description telling the model to pass an ARRAY when the camper names two options in one group
  ("ริมน้ำหรือชายหาด" → `["RIVE","BEAC"]`). `sort`/`excludeIds` get their own prop descriptions.
- `SEARCH_CAMPSITES_MAX_RESULTS = 10` (`take`) UNCHANGED — the refinements narrow WITHIN the cap (BR-5).
- **No new tool.** `compareCamps` + batch `getCampDetails` → CAM-473.

Confirmation: cam-461 unit — `{terrain:"RIVE"}` (today's shape) still parses; `{terrain:["RIVE","BEAC"]}`
parses; `{terrain:["RIVE","NOPE"]}`/`{sort:"cheapest"}` → `invalid_args`, `findMany` never runs.

---

## Decision 5 — eval

P4 (sort) + P5 (exclusion / OR-within-group) golden cases attach to the CAM-457 fixture the same way
CAM-459/460 added theirs (`scripts/ai-eval/golden-cases.json` + `case-schema.ts`). Current fixture =
**8 smoke cases**; `DEFAULT_MAX_EVAL_CASES = 500` (`scripts/ai-eval/guards.ts`) → the "8 cases" is the
current smoke set, NOT a ceiling — adding a handful of P4/P5 cases has full headroom, no cap blocks it.
Cases assert BEHAVIOR (correct tool + params: `excludeIds` set / `sort` value / facet ARRAY), per BR-6.
**Soft dependency only** — flag to the orchestrator ONLY if a later corpus-freeze story lands first
(story Seams). No hard block.

---

## Decision 6 — migration / reversibility

No schema, no migration, no data touched — three query-shape changes. Fully reversible by code revert.
The OR change ships strictly BEHIND the additive array arg, so it is a **pure superset**: every
existing single-code/comma-string caller is byte-identical, and the union is reachable only via the
one CHANGE caller (the AI tool). Nothing to test on Staging beyond the normal quality-gate + eval smoke.

## API contract
`POST /api/ai/chat` request/response wire shape **UNCHANGED** (CAM-342 seam discipline) — the tool arg
change is internal to the model↔tool contract, not the HTTP contract. `searchCampsites` tool contract:
inputs `+sort? +excludeIds? +terrain/access/activities/facilities: string|string[]`; output shape
`{ cards: SearchCampsiteCard[] }` unchanged. Authz: unchanged — read-only guest-tier tool, no session
required, no ownership (no mutation, no owned resource); abuse bounded by the route's per-IP rate limit
+ zod caps + `MAX_EXCLUDE_IDS`/`SEARCH_CAMPSITES_MAX_RESULTS`. Error path: unknown code / bad sort →
`invalid_args` (no DB hit), same as CAM-408.

## ADRs
No new ADR — all three refinements REUSE ADR-009 (no forked data path): shared `buildCampSiteWhere`
(id-exclusion + OR-within-group) + shared `orderByFor`/`VALID_SORTS`. The one hard-to-reverse call —
the `excludeIds` delivery mechanism (Decision 2, model-emits vs server-inject vs boolean-hybrid) — is
surfaced to the human at G2 as an open trade-off (the story pre-authorized model-emits as the default);
recorded here, not silently decided.
Confirmation: the cam-461 unit + eval P4/P5 tests named per-decision above each FAIL if the decided
behavior is violated; the cam-408 single-code assertion FAILS if the OR change breaks the string path.

## Docs rider

This PR also carries `docs/specs/platform-hardening/CAM-471-prompt-fence-survives-zero-width-digit-bypass/story.md`
bumped to **v1.3** (doc-text-only, orchestrator-directed). CAM-471 is a separate, already-Done
story (BR-2 tolerant-delimiter fix shipped in v1.2); v1.3 only corrects stale BR-3/EC-3/Out-of-scope
prose that still said "NFKC-normalize" after the v1.2 implementation deviation ratified NOT applying
NFKC (it corrupts Thai U+0E33 SARA AM). No code/AC/behavior change — riding it here (rather than a
separate docs-only PR) avoids a second PR for a pure doc fix per `ops.md` §3 ("no separate docs-only
PRs; specs are read pre-merge via local links"); it does not touch this story's allowed file surface
(`lib/campsite-filters.ts` / `lib/ai/tools/search-campsites.ts` / tests) and carries zero risk to the
CAM-461 change.

## Links
`../../feature.md` (## Architecture overview) · `lib/campsite-filters.ts` · `lib/catalog-cursor.ts` ·
`lib/ai/tools/search-campsites.ts` · `lib/ai/openrouter-client.ts` (CAM-460 `<shown_results>` seam) ·
`story.md` · ADR-009

## Changelog
- v1 (2026-07-24) — created (G2 architect). 6 decisions recorded: OR-within-group = additive
  `string|string[]` branch in `buildCampSiteWhere` (`{options:{some:{code:{in:[...]}}}}`), proven
  byte-identical for the 5 catalog callers (grep-backed blast-radius table); excludeIds = model-emits
  from the CAM-460 shown-set (option a) with a no-uuid graceful-degrade + `MAX_EXCLUDE_IDS=50` pre-query
  slice, boolean-hybrid rejected/deferred; sort reuses `orderByFor`/`VALID_SORTS` with default `related`;
  zod additive/backward-compatible; eval P4/P5 attach to CAM-457 (no ceiling); no schema/migration,
  reversible, pure superset. excludeIds mechanism flagged to G2 as an open trade-off.
