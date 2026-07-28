---
linear: CAM-620
feature: platform-hardening
epic: taxonomy-ui-foundation
persona: admin
artifact: tech
owner: backend-engineer
status: in-progress
version: v1
updated: 2026-07-28
---
# Tech — Two more derived files can go stale with nothing watching (CAM-620)

## Data model
No new entity/field. No change to `prisma/data/province-centroids.json` or `prisma/data/thailand-locations.json` (both read-only). No write to the live `AdminArea`/`CampSite`/`Location` tables. Three new files (`__tests__` wiring for item 1, two new `scripts/check-*.mjs` for items 2/3), plus non-blocking additions to `scripts/db-sync-from-staging.mjs`.

## Item 1 — wiring `validate-place-aliases.mjs` (cheapest, zero DB)

`scripts/validate-place-aliases.mjs` already exports a pure `validatePlaceAliases(data, locations)` and already guards its CLI `main()` behind `if (import.meta.url === \`file://${process.argv[1]}\`)` — it is byte-for-byte the same shape as `validate-landmark-gazetteer.mjs`. Nothing in that file changes. The only gap is that nothing imports it. `__tests__/cam-620-place-aliases-wired.test.ts` closes that gap exactly the way `__tests__/cam-503-landmark.test.ts` already wires `validate-landmark-gazetteer.mjs`: import the real committed `prisma/data/place-aliases.json` + `prisma/data/thailand-locations.json` (via the `@/` alias, so they are bundled as data, not read from disk at test time), call `validatePlaceAliases`, assert `[]`. A second test constructs a bad fixture (a `canonicalCode` absent from a minimal locations fixture) and asserts a non-empty, specific error — proving the assertion actually has teeth (would fail if a bad alias shipped), not just that the real file happens to be clean today.

## Item 2 — `scripts/check-province-centroid-drift.mjs`

### Where it runs — same decision as CAM-605, same reasons
`quality-gate` has no Postgres service/`DATABASE_URL` (unchanged fact, re-confirmed by re-reading `.github/workflows/ci.yml`). `e2e-regression`'s Postgres is fixture data from `prisma/seed.ts`, not the real camp distribution this check compares against — wiring there would compare against the wrong ground truth (always-agree or permanently-disagree, both useless). Manual `check:*` script only: `npm run check:province-centroid-drift`, same cadence as `build-province-centroids.mjs` itself (re-run before a release train or a host-onboarding batch).

### Reuse vs duplication (BR-2)
`scripts/build-province-centroids.mjs` is **not** in this story's editable file surface (only "one or two new `scripts/check-*.mjs`" plus `validate-place-aliases.mjs`/`db-sync-from-staging.mjs`/`package.json`/tests are). Its pure, already-exported `computeCentroids(rows)` and `MIN_CAMPS_FOR_CENTROID` are imported **read-only** — this is the single source of truth for "what does a province's centroid mean", so the check and the generator can never quietly disagree on the MATH (mirrors CAM-605 BR-1's principle exactly). What is **not** exported from that file is the Prisma query that produces `rows` — it lives inline in that file's own `main()`. Since editing that file is out of surface, the query is mirrored here verbatim (same `where`, same `select`), with a comment cross-referencing `build-province-centroids.mjs`'s own query — the same **named, bounded duplication risk** CAM-605 accepted for `lib/ai/place-resolver.ts`'s guard constants (that story's tech.md "Accounting for CAM-600's own guards"). The risk is bounded the same way: a drift between the two copies of the query could only change which raw rows feed the (shared, single-source) math — it can never itself fabricate a coordinate or silently diverge on the MEAN calculation.

`lib/geo/distance.ts`'s `haversineDistanceKm` is a pure, exported, well-tested function — but it is TypeScript, and every sibling `check-*.mjs`/`generate-*.mjs`/`build-*.mjs` script in this family runs via plain `node scripts/*.mjs` (no `tsx`/ts-node loader), so it cannot import a `.ts` file. A minimal, private haversine (same formula, same Earth radius) is written directly in the new script — self-contained, matching every other script in this family's own no-cross-boundary-import convention.

### Three-way diff, not two-way (BR-3)
CAM-605's `computeDrift` is a two-way set diff because "holds a camp" is a boolean fact. A province centroid is a continuous mean, so the same two-way shape is insufficient — three categories:

```
computeCentroidDrift(committed, live, toleranceKm = CENTROID_DRIFT_THRESHOLD_KM)
  -> { added: string[], removed: string[], shifted: Array<{ province, distanceKm, committedCampCount, liveCampCount }> }
```

- `added` — a province with a live centroid (camp count >= `MIN_CAMPS_FOR_CENTROID`) but **no key** in the committed file. This is the EXACT consequence the ticket names: `lib/ai/tools/search-campsites.ts` treats a missing key as "no centroid available" and silently falls back to an exact-province filter — no proximity behavior, no error, no signal to a developer that anything is wrong.
- `removed` — a province with a committed key whose live camp count has dropped below `MIN_CAMPS_FOR_CENTROID` (camps closed/reprovinced) — the committed centroid now describes a distribution with too few points to be a meaningful center.
- `shifted` — a province present on both sides where `haversineKm(committed, live) > toleranceKm` — the centroid has moved meaningfully since the file was last generated. **This is the category proven non-empty against the real dev DB** (see "Real dev-DB run" below): `scripts/backfill-cam-571-coordinates-inside-thailand.mjs:25` states the file "is itself derived from the CURRENT, partly-wrong seed coordinates", and CAM-571 (18 rows moved inside Thailand), CAM-575 (coordinate-column reconciliation trigger), and CAM-583 (83/103 rows moved to their claimed adjacent province) have all run against real camp coordinates since; each is a real, physical coordinate move that shifts the province mean.

`CENTROID_DRIFT_THRESHOLD_KM = 5` — chosen, not measured, and named as tunable: a province gaining or losing a handful of ordinary camps near its existing cluster should not fire (that would make "0 drift" nearly impossible to ever see again, training an operator to ignore the check — exactly the ops.md "gets disabled within a week" failure), while a real correction batch (CAM-571/575/583-scale) should. 5km is a first cut for a **report-mode, non-blocking, manual** check; tightening or loosening it later costs nothing (no migration, no consumer depends on the exact value) and is named explicitly as a cheap follow-up, not assumed settled here.

### No DB reachable — same two cases, same SKIP shape as CAM-605
1. `DATABASE_URL` unset → no `PrismaClient` constructed; prints `SKIPPED`, exits `0`.
2. `DATABASE_URL` set but the query/connection throws → caught, same `SKIPPED` treatment, exit `0`, no partial diff.
Exit `0` covers both SKIPPED and "checked, clean"; exit `1` is reserved for the one actionable case (any of `added`/`removed`/`shifted` non-empty). `describeUrlShape` (from `db-reset.mjs`) names the target host, never the raw connection string.

## Item 3 — `scripts/check-adminarea-drift.mjs`

### Why this artifact drifts (the mechanism, not just the symptom)
`prisma/seed.ts` seeds `AdminArea` PROVINCE/DISTRICT/SUBDISTRICT rows from `thailand-locations.json` via `prisma.adminArea.upsert({ where: { countryCode_level_code }, update: { nameTh, nameEn, parentId }, ... })` — an upsert that **would** overwrite a live row's name to match the file, **but only the moment the seed is actually re-run**. In practice, a DB is seeded once and then only touched by migrations + targeted backfills (`backfill-cam-56x/57x/58x-*.mjs`, none of which write `AdminArea.nameTh`/`nameEn` — confirmed by grep, they only write `Location.adminAreaId`/coordinates) or by a full `db:sync-from-staging` (which copies the live `AdminArea` table row-for-row, carrying forward whatever names were seeded at THAT DB's last (re)seed, not the currently-committed file). CAM-553's own tech.md records a concrete precedent for the failure mode this guards against: 2 English spellings were deliberately overridden to the RTGS two-word form when the file was rebuilt — if a DB had already been seeded from the file's *previous* content and was never reseeded afterward, its live `AdminArea` rows would keep the old spelling indefinitely, with nothing noticing.

### Diff shape
```
computeAdminAreaDrift(committed, live)
  -> { missingLive: Array<{level,code,nameTh}>, missingCommitted: Array<{level,code,nameTh}>, renamed: Array<{level,code,committed:{nameTh,nameEn},live:{nameTh,nameEn}}> }
```
- `committed` = `{ provinces: Map<code,{nameTh,nameEn}>, districts: Map<code,{nameTh,nameEn,provinceCode}> }`, built by walking `thailand-locations.json`'s `districts[]` (province-level) — SUBDISTRICT entries are read from the same file but never touched (CAM-605 already owns that level; BR-5).
- `live` = the same shape, built from one `prisma.adminArea.findMany({ where: { countryCode: 'TH', level: { in: ['PROVINCE','DISTRICT'] } }, select: { id, level, code, nameTh, nameEn, parentId } })` — a district's `provinceCode` is resolved by matching its `parentId` against the PROVINCE rows' `id` in the SAME result set (no second query; `@@unique([countryCode, level, code])` guarantees `code` is a stable per-level key on both sides).
- `missingLive` — a code the file lists but the live table has never seeded (the file grew since the DB's last seed).
- `missingCommitted` — a code the live table has but the current file no longer lists (the file shrank/renumbered since the DB's last seed — the symmetric, less likely direction, still worth naming rather than silently ignoring).
- `renamed` — a code present on both sides where `nameTh` or `nameEn` differs — the concrete "the DB still shows the pre-correction spelling" case.

Pure, DB-free function — `__tests__/cam-620-adminarea-drift.test.ts` constructs synthetic committed/live maps directly (no DB, no real file needed to prove the diff logic fires and stays quiet).

### Where it runs / no-DB shape
Identical reasoning and identical SKIP/exit-code contract to item 2 (and to CAM-605): manual `check:*` script (`npm run check:adminarea-drift`), not CI-wired, SKIP (exit `0`, named notice) when `DATABASE_URL` is absent/unreachable, exit `1` reserved for a real, guard-free difference (any of the three categories non-empty).

## Riding along `db:sync-from-staging` (both DB-backed checks)

CAM-605's own reasoning for choosing this ride-along site applies unchanged: it is the one moment real, current data (camps AND, incidentally, the live `AdminArea` tree, since it is copied model-for-model by the sync's own loop) most recently lands in the exact same local dev DB `DATABASE_URL` these checks would read anyway. Two new blocks are appended immediately after the existing CAM-605 ride-along block, each following the identical shape: its own `try { … } catch (driftErr) { console.warn(...) }`, reusing THIS story's own exported `computeCentroidDrift`/`computeAdminAreaDrift` (no re-derived query — the two new check scripts' own `computeLiveCentroids`-equivalent query pieces are re-run here too, since the sync already has an open `target` client and these are the same read-only queries the standalone checks run), never touching `process.exitCode`. `promote-release` is not re-evaluated as a second ride-along site — CAM-605's tech.md already rejected it for a structural reason (a documented multi-step workflow, not a single running process with an already-resolved local DB connection) that applies identically to these two artifacts; not repeated here.

## Real dev-DB run (self-verify, reported honestly)

Both new checks were run against the real local dev DB (795 real camps, `AdminArea` seeded and previously synced from staging) after sourcing `.env` — actual output below, never fabricated (`.claude/rules/performance.md` "metric honesty"). Neither this story nor its self-verify regenerates/corrects either artifact in response — explicitly out of scope (story.md).

**`node scripts/check-province-centroid-drift.mjs` — NOT quiet, exit 1.** 38 of 76 committed provinces are `shifted` beyond the 5km tolerance (distances 5.1km–20.2km), `added`/`removed` both empty on this run. This confirms the ticket's own prediction ("It is known-stale TODAY") and `backfill-cam-571-coordinates-inside-thailand.mjs:25`'s comment: campCounts on most shifted rows have roughly doubled since the file was last generated (e.g. Nakhon Ratchasima 12→12 camps but still 16.2km moved — a pure coordinate correction, not just growth; Chon Buri 4→9 camps, 15.2km), consistent with the real coordinate-correction backfills (CAM-571 moved 18 rows inside Thailand, CAM-575 reconciled the CampSite/Location coordinate columns, CAM-583 moved 83/103 rows to their claimed adjacent province) that ran after this file was committed. Per BR-9/story.md "Out of scope", this story does **not** regenerate `province-centroids.json` in response — the count is reported here and in the PR, a regeneration is a separate follow-up decision with its own proximity-result verification (the same relationship CAM-605→CAM-606 established).

**`node scripts/check-adminarea-drift.mjs` — quiet, exit 0.** `77 provinces + 930 districts in thailand-locations.json still match the live AdminArea table exactly` — 0 drift on all three categories (`missingLive`/`missingCommitted`/`renamed`) against the real dev DB today. A legitimate, honestly-reported clean result: the dev DB's `AdminArea` table currently matches the committed seed file at the PROVINCE/DISTRICT level.

**Teeth proven for both, against the real artifacts (not just constructed fixtures), then restored:** `province-centroids.json`'s `Trat` key was deleted → the check reported `ADDED — 1 province(s) ... Trat` (exit 1) → the file was restored from a backup → the check went back to reporting only the 38 pre-existing `shifted` entries (`Trat` no longer mentioned). `thailand-locations.json`'s Bangkok (`code: "10"`) `nameEn` was corrupted to `"BANGKOK-CORRUPTED-FOR-TEST"` → the check reported `RENAMED — 1 code(s) ... PROVINCE:10` (exit 1) → the file was restored → the check returned to `OK — 0 drift` (exit 0). `git status`/`git diff` confirmed both `prisma/data/*.json` files carry zero uncommitted changes after restore. The same demonstration was run for item 1 (not just the constructed-fixture unit tests): `place-aliases.json`'s first `provinceAliases[0].canonicalCode` was corrupted to a non-existent code → `npx vitest run __tests__/cam-620-place-aliases-wired.test.ts` failed naming the bad reference → restored → green again.

Both DB-backed checks' no-DB and unreachable-DB SKIP paths were also run for real: `DATABASE_URL` unset → both print the named `SKIPPED` notice and exit `0`; `DATABASE_URL` pointed at an unreachable host (`localhost:59999`) → both print the same `SKIPPED` treatment (naming the connection error) and exit `0` — neither ever printed a partial diff or crashed.

## Links
`scripts/build-province-centroids.mjs` (read-only import of `computeCentroids`/`MIN_CAMPS_FOR_CENTROID`, query mirrored) · `scripts/check-province-centroid-drift.mjs` · `scripts/check-adminarea-drift.mjs` · `scripts/db-sync-from-staging.mjs` (both new ride-alongs) · `scripts/db-reset.mjs` (`describeUrlShape`) · `scripts/validate-place-aliases.mjs` (unmodified) · `prisma/data/province-centroids.json` · `prisma/data/thailand-locations.json` · `prisma/seed.ts` (the upsert mechanism that only fires on an actual reseed) · `../CAM-605-shortlist-staleness/tech.md` (the model this story extends) · `.claude/rules/ops.md` (report-mode → blocking rollout) · `.github/workflows/ci.yml` (confirms `quality-gate` has no DB service).

## Changelog
- v1 (2026-07-28) — created.
