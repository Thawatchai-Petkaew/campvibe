---
linear: CAM-188
feature: performance-and-freshness
epic: data-layer-performance-and-freshness (CAM-186)
artifact: tech
status: In Progress
version: v1
updated: 2026-06-26
---

# PERF-2 — DB Composite Indexes: priceLow / createdAt (CAM-188)

## 1. Purpose

The catalog listing's filter+sort currently runs against an unindexed `priceLow` and `createdAt` on `CampSite`. As the row count grows, every `price_asc`, `price_desc`, and `related` (default) sort degrades to a sequential scan. This design adds two composite `@@index`es so Postgres uses an index scan for filter+sort in one b-tree pass.

---

## 2. Ground truth: real query shapes

### 2a. Base WHERE (every query)

File: `lib/campsite-filters.ts:41-45`

```ts
const where: Prisma.CampSiteWhereInput = {
  isActive: true,
  isPublished: true,
  deletedAt: null,
};
```

All three equality conditions appear on every catalog query. `isPublished` and `deletedAt` are already the leading columns of the existing `@@index([isPublished, deletedAt])` on `CampSite` (schema line 337).

Note on `isActive`: the base WHERE includes `isActive: true` but the existing partial-index idiom in the schema leads with `isPublished, deletedAt`. Adding `isActive` as a leading column would widen every new index without meaningful selectivity gain (virtually all published rows also have `isActive: true`; the column carries almost no discriminating power in that filtered sub-set). The composite indexes therefore lead with `isPublished, deletedAt` — the same established two-column prefix — and extend with the sort key. This matches the current index convention and keeps the Prisma `@@index` declaration minimal.

### 2b. Sort branches

File: `app/page.tsx:87-91`

```ts
const orderBy =
  sanitizedSort === 'price_asc'  ? { priceLow: 'asc'  as const } :
  sanitizedSort === 'price_desc' ? { priceLow: 'desc' as const } :
  { createdAt: 'desc' as const }; // 'related' default + any unrecognised value
```

| Sort param value | Prisma `orderBy` | `take` | Where defined |
|---|---|---|---|
| `price_asc` | `{ priceLow: 'asc' }` | 40 | `app/page.tsx:88` |
| `price_desc` | `{ priceLow: 'desc' }` | 40 | `app/page.tsx:89` |
| `related` (default) | `{ createdAt: 'desc' }` | 40 | `app/page.tsx:90` |
| `rating` | no `orderBy` (JS in-memory sort via `sortByRating`) | none (all rows) | `app/page.tsx:96-107` |

`app/api/campsites/route.ts` (GET, line 34-39) and `app/api/campgrounds/route.ts` (GET, line 34-39) both call `prisma.campSite.findMany({ where, select: campCardSelect })` with **no `orderBy` and no `take`**. These routes expose the listing to API consumers but do not specify a sort; they benefit from the same indexes through the filter-path portion and are noted here for completeness.

### 2c. `avgRating` sort

File: `app/page.tsx:96-107`

The `rating` sort path fetches all matching rows, then calls `sortByRating(rows)` in JavaScript (no DB `orderBy`). There is no `avgRating` column on `CampSite` yet; a stored column is gated on AGG-1. No index for `avgRating` is added in this story.

---

## 3. Exact `@@index` set to add

Two composite indexes. Both are **additive only** — no existing index is removed or modified.

### Index A — price sort

```prisma
@@index([isPublished, deletedAt, priceLow, id])
```

Serves: `price_asc` and `price_desc` sorts — `app/page.tsx:88-89` — and any future API consumer that applies a price sort on the same filter.

Column rationale:
- `isPublished` — equality filter (=true), highest selectivity anchor; matches left-most column of the existing `[isPublished, deletedAt]` index so Postgres will prefer the more specific new index.
- `deletedAt` — equality filter (=null); second most selective after `isPublished`.
- `priceLow` — the `orderBy` column for both `price_asc` and `price_desc`. Postgres b-tree can scan the index in either direction, so a single ascending index serves both `ASC` and `DESC` sorts (no need for a separate descending index).
- `id` — tiebreak; ensures deterministic pagination for `take: 40`.

Effect: Postgres walks the `[isPublished=true, deletedAt=null]` prefix, then reads rows in `priceLow` order directly from the index — no post-filter sort step, no sequential scan.

### Index B — default/related + newest sort

```prisma
@@index([isPublished, deletedAt, createdAt, id])
```

Serves: `related` (default) sort and any unknown/fallback sort — `app/page.tsx:90` — which emit `orderBy: { createdAt: 'desc' }`.

Column rationale:
- `isPublished`, `deletedAt` — same equality prefix as Index A.
- `createdAt` — the `orderBy` column. The query uses `createdAt: 'desc'`; Postgres b-tree can scan this index backward (reverse scan), so an ascending `createdAt` index serves the descending sort with no additional cost.
- `id` — tiebreak for deterministic `take: 40`.

### What is NOT added

| Candidate | Why deferred |
|---|---|
| `@@index([isPublished, deletedAt, avgRating, id])` | `avgRating` column does not exist on `CampSite`. It is gated on AGG-1. Do not add now. |
| Bare `@@index([priceLow])` or `@@index([createdAt])` | A single-column index on `priceLow` or `createdAt` cannot serve both the `isPublished/deletedAt` equality filter AND the sort in one b-tree pass. Postgres would use it only for the sort, then apply the filter as a heap-fetch, which is often slower than a scan for small tables and offers no improvement for filtered queries. |

---

## 4. Why composite leading with filter columns

A query of the form:

```sql
SELECT ... FROM "CampSite"
WHERE "isPublished" = true AND "deletedAt" IS NULL AND "isActive" = true
ORDER BY "priceLow" ASC
LIMIT 40;
```

needs Postgres to (a) narrow to the published/non-deleted rows and (b) return them in `priceLow` order. A bare `@@index([priceLow])` satisfies (b) but not (a) efficiently: Postgres must either scan the entire `priceLow` index and filter, or use the index for the sort and fetch the heap for the WHERE conditions — both are suboptimal.

A composite `@@index([isPublished, deletedAt, priceLow, id])` lets Postgres seek to the `(true, null)` prefix (index condition pushdown), then scan only the matching rows in `priceLow` order without revisiting the heap for those two conditions. The result is an **Index Scan** (or Index Only Scan if the `select` covers the index columns) instead of a **Seq Scan + Sort**.

---

## 5. Prisma schema diff

Current state of `CampSite` indexes in `prisma/schema.prisma` (lines 335-337):

```prisma
@@index([operatorId])
@@index([locationId])
@@index([isPublished, deletedAt])
```

Change (additive only — add after the existing three):

```prisma
@@index([operatorId])
@@index([locationId])
@@index([isPublished, deletedAt])
// PERF-2 (CAM-188): composite indexes for catalog price-sort and default/related-sort
@@index([isPublished, deletedAt, priceLow, id])
@@index([isPublished, deletedAt, createdAt, id])
```

No existing index is removed. The existing `@@index([isPublished, deletedAt])` is kept: it serves other queries (admin list, publish-state checks) that do not need a sort key.

---

## 6. Migration shape and reversibility

- **Type:** additive `CREATE INDEX CONCURRENTLY` — no data change, no column alter, no row backfill.
- **Generated SQL (up):**
  ```sql
  CREATE INDEX CONCURRENTLY "CampSite_isPublished_deletedAt_priceLow_id_idx"
    ON "CampSite" ("isPublished", "deletedAt", "priceLow", "id");

  CREATE INDEX CONCURRENTLY "CampSite_isPublished_deletedAt_createdAt_id_idx"
    ON "CampSite" ("isPublished", "deletedAt", "createdAt", "id");
  ```
  Note: Prisma migrate does not emit `CONCURRENTLY` by default; it uses a plain `CREATE INDEX`. On staging (low volume), a plain `CREATE INDEX` inside the migration transaction is acceptable. On prod, if index build time is a concern, the migration can be applied offline or split. This is noted but not a blocker at current scale (not measured).

- **Generated SQL (down / rollback):**
  ```sql
  DROP INDEX "CampSite_isPublished_deletedAt_priceLow_id_idx";
  DROP INDEX "CampSite_isPublished_deletedAt_createdAt_id_idx";
  ```
  Fully reversible: dropping indexes never affects data, never blocks reads or writes beyond a brief lock.

- **Auto-apply path:** `prisma migrate deploy` runs on `vercel-build` for the staging branch deploy and is re-run for prod promotion per `.claude/rules/ops.md`. No manual intervention required.

- **Data migration:** none. Indexes do not change stored data. No backfill.

- **Downtime:** none. `CREATE INDEX` on Postgres acquires a `ShareLock` while building; reads and writes continue. At staging data volumes (< 200 rows), index build completes in milliseconds.

- **Per `.claude/rules/api.md` §6 (Reversible migrations):** paired up/down confirmed, no data destruction, test on Staging before prod.

---

## 7. Verification plan (post-deploy on staging)

After `prisma migrate deploy` succeeds on staging:

1. **Schema validates:** `npx prisma validate` must exit 0. Run locally before the PR merges.

2. **EXPLAIN ANALYZE — price sort query:** Connect to the staging DB (requires DB access — note: not measurable in this design artifact) and run:
   ```sql
   EXPLAIN ANALYZE
   SELECT id, "nameTh", "priceLow", "createdAt"
   FROM "CampSite"
   WHERE "isPublished" = true AND "deletedAt" IS NULL AND "isActive" = true
   ORDER BY "priceLow" ASC
   LIMIT 40;
   ```
   Expected plan node: `Index Scan using CampSite_isPublished_deletedAt_priceLow_id_idx` (or `Index Only Scan`). A `Seq Scan` at this data volume means the planner chose a full scan because the table is too small — this is expected behavior for very small tables (< ~1000 rows); the index pays off as rows grow. Record the plan in the MEAS-1 baseline.

3. **EXPLAIN ANALYZE — default sort query:**
   ```sql
   EXPLAIN ANALYZE
   SELECT id, "nameTh", "priceLow", "createdAt"
   FROM "CampSite"
   WHERE "isPublished" = true AND "deletedAt" IS NULL AND "isActive" = true
   ORDER BY "createdAt" DESC
   LIMIT 40;
   ```
   Expected: `Index Scan Backward using CampSite_isPublished_deletedAt_createdAt_id_idx`.

4. **Behavioral correctness:** the listing page (`/`) must return the same result set as before the migration for all four sort modes (`price_asc`, `price_desc`, `related`, `rating`). Indexes do not change query results — this is a smoke check only.

5. **Migration rollback test:** run `prisma migrate down 1` on staging, confirm the two indexes are dropped, confirm the listing still works (using the existing `[isPublished, deletedAt]` index), then re-apply `prisma migrate deploy`. Record pass/fail.

---

## 8. Risk and write-overhead note

- **Write overhead:** each new index adds a small cost to every `INSERT` and `UPDATE` on `CampSite`. At current catalog scale (not measured, expected < 200 published rows), this overhead is negligible. The listing is read-heavy (many reads per camp created); the trade-off clearly favors the read path.
- **Index maintenance:** Postgres handles b-tree index maintenance automatically (`VACUUM`, `REINDEX`). No manual intervention required.
- **Planner behavior at small scale:** Postgres may choose a sequential scan over an index scan when the table is small enough that a full scan is cheaper. This is correct planner behavior, not a bug. The index becomes material as the catalog grows beyond a few hundred published rows. MEAS-1 should note the planner choice at baseline.

---

## 9. Open questions for G2

None blocking the build. One informational note for the owner:

| Item | Note |
|---|---|
| `isActive` in the composite prefix | The base WHERE includes `isActive: true` but the new indexes lead with `isPublished, deletedAt` (matching the existing index convention). If the data distribution ever produces a large number of `isPublished=true, isActive=false` rows, adding `isActive` as a leading column would improve selectivity. At current seed data this is not the case. Monitor via MEAS-1; no action needed now. |
| `avgRating` index | Deferred to AGG-1 (no `avgRating` column exists). After AGG-1 ships, add `@@index([isPublished, deletedAt, avgRating, id])` in a follow-on story. |
| API routes without `orderBy` | `app/api/campsites/route.ts` and `app/api/campgrounds/route.ts` GET handlers do not specify `orderBy` or `take`. They benefit from the filter portion of the new indexes but return unordered result sets. This is a separate concern; adding `orderBy` to those routes is out of scope for PERF-2. |

---

## 10. Traceability

| AC | Endpoint / query | Prisma model / field | Index added |
|---|---|---|---|
| AC-1 (price sort) | `app/page.tsx:88-89` `orderBy:{priceLow:asc/desc}` | `CampSite.priceLow` | `[isPublished, deletedAt, priceLow, id]` |
| AC-1 (default sort) | `app/page.tsx:90` `orderBy:{createdAt:desc}` | `CampSite.createdAt` | `[isPublished, deletedAt, createdAt, id]` |
| AC-1 (rating sort) | `app/page.tsx:96-107` JS sort, no DB orderBy | — (no DB sort) | deferred to AGG-1 |

No orphan fields (every new index maps to an AC). No orphan AC (every AC has a design element or a documented deferral).

---

## Handoff to backend

Backend action: add the two `@@index` lines to `prisma/schema.prisma` after the existing `@@index([isPublished, deletedAt])`, run `npx prisma migrate dev --create-only` to inspect the generated SQL, then run `npx prisma migrate deploy` on staging. No application code changes are required. Verify with `EXPLAIN ANALYZE` per section 7.
