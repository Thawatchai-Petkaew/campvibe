---
linear: CAM-605
feature: platform-hardening
epic: taxonomy-ui-foundation
persona: admin
artifact: story
owner: backend-engineer
status: in-progress
version: v1
updated: 2026-07-28
---
# The sub-district shortlist goes stale silently when a camp opens somewhere new (CAM-605)

## Story
As the **Admin** (the person who re-runs `scripts/generate-subdistrict-shortlist.mjs` before a release train), I want a command that tells me, on demand, whether the committed sub-district shortlist still matches which sub-districts actually hold a camp today, so that a camp opening in a new tambon produces a visible signal instead of a silent miss that looks exactly like the honest-failure path working correctly.
Why: CAM-600 built the shortlist as a build-time artifact regenerated manually — correct per its own tech.md, but "regenerate it when camps change" is a note in a ticket, not a mechanism. Today's retro promoted a rule into `.claude/rules/performance.md` from the identical failure shape (CAM-595: a bound that truncates without signalling reads as "you have seen everything"); a derived artifact that goes stale without signalling reads the same way, and the lesson is hours old.
Scope: one new script, `scripts/check-subdistrict-shortlist-drift.mjs`, that regenerates the raw "holds a camp" fact into memory (reusing `scripts/generate-subdistrict-shortlist.mjs`'s own query, refactored into an exported function so the two never compute it two different ways) and diffs it against the committed `prisma/data/subdistrict-shortlist.json`, filtered through the SAME candidate-build guards `lib/ai/place-resolver.ts` applies (length floor, ordinary-vocabulary skip-set, substring-of-a-province) so a difference the detector would never have acted on anyway is never reported as actionable drift. Does not touch `lib/ai/place-resolver.ts` itself (guards are read-only-mirrored, not imported — see tech.md), does not regenerate or edit `prisma/data/subdistrict-shortlist.json`, and is not wired into the CI `quality-gate` job (see tech.md "Where it runs" for why).
Depends on: CAM-600 (the shortlist + generator this story checks against).

## AC
<!-- Internal delivery-tooling surface (a manual/on-demand CLI check), not end-user-facing copy — "Then" is the exact dev-facing output/behavior, per the same framing CAM-595's story.md used for this same class of tool. -->
| # | Given | When | Then (dev-facing, plain language) | System effect | Neg/edge |
|---|---|---|---|---|---|
| AC-1 | The live DB holds a camp in a sub-district that is NOT in the committed shortlist (and the name survives the CAM-600 guards) | The Admin runs `node scripts/check-subdistrict-shortlist-drift.mjs` against a reachable DB | The named sub-district prints as a MISSED entry, and the command exits non-zero — never a quiet pass | The script regenerates the raw live fact in memory, diffs it against the committed JSON post-guard, and reports the specific name(s) | EC-1 |
| AC-2 | The committed shortlist exactly matches the live, guard-surviving fact | The Admin runs the same command | The command prints a single OK line naming 0 drift and exits 0 | No name is reported; the command proves it ran (names the DB it checked), not merely that it found nothing | EC-2 |
| AC-3 | `DATABASE_URL` is unset, or set but unreachable, in the environment running the command (e.g. CI's `quality-gate` job, which has no DB at all) | The Admin (or CI) runs the command | A loud, explicit notice prints naming that the check was SKIPPED (not passed) and why, and the command exits 0 | The script never attempts a query it cannot make, and never fails a build for an environment where the fact is simply unknowable | EC-3 |
| AC-4 | A live sub-district that is new (not in the committed file) would itself be excluded by a CAM-600 guard (too short, ordinary vocabulary, or a substring of a real province) | The Admin runs the command | Nothing is reported for that name — it is not actionable drift, because the detector would never have used it regardless of the shortlist's staleness | The guard-filter is applied to BOTH the committed and the live name sets before the diff runs | EC-4 |

## Rules
- BR-1 The raw "holds a camp" fact is computed by ONE function (`computeLiveShortlistEntries`, exported from `scripts/generate-subdistrict-shortlist.mjs`, refactored in this story) — the check script and the generator CLI both call it, so the two paths cannot silently diverge on what "holds a camp" means.
- BR-2 The diff runs on names filtered through the SAME three guards `lib/ai/place-resolver.ts`'s `buildSubDistrictCandidates` applies at candidate-build time: length < 5 Thai characters, membership in the ordinary-vocabulary skip-set (`เหนือ`/`สะอาด`/`สำราญ`), or a substring of any real province's own name. `lib/ai/place-resolver.ts` is out of this story's file surface and does not export these as reusable values, so they are duplicated here with a two-way code comment cross-reference (never imported) — a follow-up ticket can replace the duplication with a real import if/when place-resolver.ts's own story exports them.
- BR-3 `DATABASE_URL` unset → the check prints a named SKIP notice and exits `0` (not a pass — a distinct message and the same exit code, so a build never fails for an unknowable fact, but a human reading the log is never told "clean" when it was actually "unchecked").
- BR-4 `DATABASE_URL` set but the connection/query fails → the same SKIP treatment as BR-3 (exit `0`, named notice, no partial/garbled diff attempted).
- BR-5 A real, guard-surviving difference (added or removed) → the check prints every name involved and exits `1`. This is the ONLY path that exits non-zero.
- BR-6 The script is a `check:*`-class command (`node scripts/check-subdistrict-shortlist-drift.mjs`, wired as `npm run check:subdistrict-drift`), run manually/on-demand at the same cadence as the generator it checks (before a release train, or after a host-onboarding batch) — NOT wired into the CI `quality-gate` job. `quality-gate` has zero DB service (confirmed in `.github/workflows/ci.yml`); wiring a DB-dependent check there blocking would either always fail-closed (breaking every PR) or always silently skip (permanently a no-op) — both outcomes this ticket names as reasons a guard gets disabled within a week. See tech.md "Where it runs" for the fuller reasoning and the rejected alternatives.

## Edge cases
- EC-1 IF a name survives the guards AND exists live but not committed THEN it is named in the "MISSED" list and the exit code is `1` (BR-2, BR-5) — proven with a constructed fixture, not asserted from the real DB's current state alone.
- EC-2 IF the committed and live guard-surviving name sets are identical THEN the command exits `0` with an explicit "0 drift" line — never a bare silent exit (BR-5; a check nobody has seen run is not proven to have run).
- EC-3 IF `DATABASE_URL` is empty/unset THEN the command never constructs a Prisma client at all and exits `0` with a named SKIP notice (BR-3); IF it is set but the query throws THEN the same SKIP notice fires with the same exit code, and no partial output is printed (BR-4).
- EC-4 IF a live-only name would itself fail a CAM-600 guard (too short / ordinary vocabulary / substring-of-province) THEN it is silently excluded from the diff, on BOTH the committed and live side, before any reporting happens (BR-2) — reporting it would be a difference the detector was always going to ignore.

## Data
- No schema/migration, no change to `prisma/data/subdistrict-shortlist.json` (read-only in this story — regenerating/correcting it is explicitly out of scope, see below).

## Seams & refs
- Reuse: `scripts/generate-subdistrict-shortlist.mjs`'s own `AdminArea`/`Location`/`CampSite` query (refactored into an exported `computeLiveShortlistEntries(prisma)`, called by both the generator's own `main()` and this story's new script) · `scripts/db-reset.mjs`'s `describeUrlShape` (never print a raw connection string, per CAM-359/CAM-369) · the `validate-landmark-gazetteer.mjs` / `validate-place-aliases.mjs` convention (pure, exported validation/diff function + a separate `main()` CLI wrapper guarded by an `isMain` check so importing the module for tests never triggers a live run) · `lib/ai/place-resolver.ts`'s CAM-600 guard VALUES (read, duplicated with a cross-reference comment — see BR-2; the file itself is untouched).
- Refs: `.claude/rules/performance.md` "a bound that truncates without signalling reads as you have seen everything" (CAM-595) — this story extends the same principle to a derived, regenerable artifact · `.claude/rules/ops.md` "report-mode → clear the backlog to 0 → flip to blocking" rollout (this story ships report-mode: a manual, non-blocking `check:*` script; flipping any part of it to blocking is an explicit, separate follow-up decision, not assumed here) · CAM-600 tech.md ("Build-time or runtime", the regeneration-cadence reasoning this story makes checkable).

## Out of scope
- Regenerating or correcting `prisma/data/subdistrict-shortlist.json` — this story detects drift, it does not fix it. If the real dev DB shows non-zero drift when this check is run for real, that count is reported honestly in the PR, not silently corrected in this story's diff.
- Wiring the check into CI as a blocking (or even advisory) step — `quality-gate` has no DB service at all (confirmed in `.github/workflows/ci.yml`), and this fact changes at host-onboarding cadence, not per-commit cadence, so a per-PR CI cadence is a mismatch even with a DB service added. A follow-up ticket only if the owner wants a scheduled (not per-PR) CI job with its own DB service pointed at a representative snapshot.
- Automating the regeneration cadence itself (a bot that opens a PR on drift) — CAM-600's own story.md already named this as a future follow-up; this story makes the drift *detectable on demand*, not *self-healing*.
- Exporting the CAM-600 guard constants from `lib/ai/place-resolver.ts` for a real (non-duplicated) import — `lib/ai/**` is out of this story's file surface; noted as a named follow-up in BR-2.

## Self-verify
- AC-1..4 → unit (`__tests__/cam-605-shortlist-drift.test.ts`), pure `computeDrift`/`survivesGuards`/`isSubstringOfAnyProvince` functions exercised with constructed fixtures (never a real DB in the test run) — the drift-detection path is proven to both fire (AC-1/EC-1) and stay quiet (AC-2/EC-2) on demand, and the guard-filter is proven with a case in the ordinary-vocab skip-set and a case below the length floor (AC-4/EC-4).
- Story-specific: no migration (N/A) · a real-DB run against the local dev DB is performed once as part of self-verify and its actual output (quiet, or a named count) is reported in the PR body — never fabricated (per `.claude/rules/performance.md` "metric honesty").
- Gate = `/quality-gate` · Done = every AC verified on localhost (dev DB) before merge into `dev`.

## Changelog
- v1 (2026-07-28) — created.
