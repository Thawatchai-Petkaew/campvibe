---
linear: CAM-605
feature: platform-hardening
epic: taxonomy-ui-foundation
persona: admin
artifact: tech
owner: backend-engineer
status: in-progress
version: v1
updated: 2026-07-28
---
# Tech — The sub-district shortlist goes stale silently (CAM-605)

## Data model
No new entity/field. No change to `prisma/data/subdistrict-shortlist.json` (read-only in this story). One new script, no new data artifact.

## Where it runs — decided: a manual `check:*` script, NOT a CI step, NOT a pre-hook

Three shapes were on the table, per the ticket's own framing. Decided against two, with reasons:

- **CI step (rejected).** `.github/workflows/ci.yml`'s `quality-gate` job — the ONE required/blocking check — has **no Postgres service and no `DATABASE_URL` at all** (confirmed by reading the workflow: `npm install` → lint → `check:palette` → `check:ds` → typecheck → `npm test -- --coverage` → `npm run build` → `npm audit`, none of which set `DATABASE_URL` or run a `services:` block). Only two other jobs (`e2e-regression`, its own advisory job) spin up a throwaway Postgres, and it is seeded from `prisma/seed.ts`, a fixed fixture — comparing the committed shortlist against a CI-only seed DB proves nothing about REAL staleness; it would either always agree (if the seed happens to match the shortlist, telling us nothing) or permanently disagree (if it doesn't, becoming un-actionable red the same PR after PR) or require keeping the seed in lockstep with the shortlist, which is circular. Wiring this check into `quality-gate` blocking would, in the best case, always skip (a permanent no-op, silently) or, if someone later "fixed" it to require a DB, break every single PR outright. Either is exactly the "gets disabled within a week" the ticket warns about. There is also a cadence mismatch: this fact changes at host-onboarding/release-train cadence (CAM-600 tech.md's own regeneration cadence), not per-commit cadence — a per-PR CI job would run far more often than the fact it checks could plausibly have changed.
- **Pre-hook (rejected).** A `predev`/`pretest`/`pre-commit` wiring runs on every dev machine, including ones with no DB access or a different (e.g. empty, or a stale local snapshot) local DB — higher frequency than CI, same false-positive risk, worse: it would fire on every single `npm test`/`npm run dev` a working agent runs, for a fact that has nothing to do with the code change in front of them.
- **Manual `check:*` script (chosen).** Mirrors the generator it checks: `scripts/generate-subdistrict-shortlist.mjs` is already explicitly "a manual/on-demand command today... re-run it... whenever a meaningfully large batch of new camps goes live" (its own docblock, CAM-600). A `check:*` sibling that answers "has that happened without anyone re-running the generator?" belongs at the exact same cadence and cannot be wired any tighter without inheriting a cadence mismatch. Wired as `npm run check:subdistrict-drift` (package.json), alongside the existing `check:palette`/`check:ds`/`check:contrast` family — but unlike those three, deliberately **not** added to `ci.yml`'s `quality-gate` steps, for the DB-availability reason above.

**What happens with no DB reachable (both cases handled, neither crashes nor false-alarms):**
1. `DATABASE_URL` unset → the script never constructs a `PrismaClient` at all; it prints `SKIPPED — no DATABASE_URL...` and exits `0`.
2. `DATABASE_URL` set but the connection/query throws (wrong creds, network down, DB genuinely unreachable) → caught, the SAME `SKIPPED` treatment, exit `0`, no partial/garbled diff printed. `describeUrlShape()` (imported from `scripts/db-reset.mjs`, CAM-359/CAM-369) prints scheme+hostname only when confirming which target it attempted — never the raw connection string.

Exit `0` is used for BOTH "skipped, unknowable here" and "checked, clean" — deliberately, because CI (if it ever did invoke this, which it does not today) must never fail a build over an environment where the fact is simply unreachable. The two cases are told apart by the printed message, not the exit code — the same shape `ci.yml`'s own smoke job already uses for "no URL var configured, skipping" (`.claude/rules/ops.md`'s own named lesson: "every conditional job needs... the skip prints a loud notice naming the missing var", not a silent pass). Exit `1` is reserved for the one case that IS actionable: a real, guard-surviving name difference.

## Report-mode rollout (ops.md's own prescribed shape)

This ships as the **report-mode** step of ops.md's "report-mode → clear the backlog to 0 → flip to blocking" rollout: a script that exists, can be run, and can fail loudly — but is not wired to block anything (no CI step at all, per "Where it runs"). Flipping any part of this to blocking (e.g. a future scheduled CI job with its own seeded-from-a-real-snapshot DB) is an explicit, separate decision for a follow-up ticket, not assumed here — consistent with the ticket's own instruction to decide the rollout shape deliberately rather than ship blocking with an unknown backlog.

## Avoiding a second "which fact is true" — `computeLiveShortlistEntries`

`scripts/generate-subdistrict-shortlist.mjs`'s query (the `AdminArea`/`Location`/`CampSite` walk that defines "holds a camp") is refactored into an exported `async function computeLiveShortlistEntries(prisma)` returning `{ entries, skipped }` — the exact same shape/values the generator's `main()` already produced inline. `main()` now calls this function instead of holding the logic itself; behavior when run directly (`node scripts/generate-subdistrict-shortlist.mjs`) is unchanged (same console output, same file write). The new check script imports this SAME function rather than re-deriving the query, so "what does holding a camp mean" can never quietly diverge between the generator and the check that verifies it (BR-1).

This refactor also required adding the `isMain` guard (`db-reset.mjs`'s own `pathToFileURL` pattern) to `generate-subdistrict-shortlist.mjs`, which it did not previously have — its `main().catch(...)` ran unconditionally at import time. Without this guard, the new check script's `import { computeLiveShortlistEntries } from './generate-subdistrict-shortlist.mjs'` would itself have triggered a live DB write as a side effect of merely importing the function — exactly the "regenerate the data in this story" outcome the ticket rules out. Verified: `node scripts/generate-subdistrict-shortlist.mjs` (run directly) still writes the artifact and prints its usual output; importing the module's exports does not.

## Accounting for CAM-600's own guards (why the diff is guard-filtered, not raw)

The committed `subdistrict-shortlist.json` is the RAW "holds a camp" fact (CAM-600 tech.md: guards are applied later, at `place-resolver.ts`'s candidate-build step, never baked into the generated artifact). A raw-vs-raw diff would therefore report, as "drift", a live-only name that the CAM-600 detector was NEVER going to use anyway — e.g. a brand-new camp in a 3-Thai-character-named tambon, or one named `เหนือ`. Reporting that as actionable noise is precisely "a difference that is deliberate" (the ticket's own phrase): regenerating the artifact would add the row, but `buildSubDistrictCandidates` would still exclude it at candidate-build time, so detector behavior would be unchanged either way. `computeDrift` therefore filters BOTH the committed and the live name sets through the same three guards before diffing:

1. `MIN_SUBDISTRICT_NAME_LENGTH = 5` (mirrors `place-resolver.ts`'s own constant of the same value).
2. `AMBIGUOUS_SUBDISTRICT_VOCAB_TH = new Set(['เหนือ', 'สะอาด', 'สำราญ'])` (the exact three values `place-resolver.ts` curates, read directly from that file for this story — never imported, since `lib/ai/**` is out of file surface and the file does not export these as named values).
3. `isSubstringOfAnyProvince(name, provinceNamesTh)` — re-derived here from `prisma/data/thailand-locations.json`'s own `nameTh` list (the same source `place-resolver.ts`'s `PROVINCES` reads), since `place-resolver.ts`'s own `isSubstringOfAnyProvince` is a module-private function, not exported.

**Named, accepted duplication risk:** these three values are read out of `lib/ai/place-resolver.ts` by hand (verified against the live source at authoring time — `MIN_SUBDISTRICT_NAME_LENGTH`, `AMBIGUOUS_SUBDISTRICT_VOCAB_TH`, and `isSubstringOfAnyProvince`'s logic, lines ~586-687 of that file) rather than imported, because `lib/ai/**` is explicitly out of this story's file surface. Each side carries a code comment pointing at the other so a future edit to either is at least flagged for a human to notice, but nothing enforces they cannot drift silently — named as a follow-up (story.md "Out of scope": export the constants from `place-resolver.ts` for a real import). The risk is bounded, not open-ended: a drift between the two copies can only ever make this CAM-605 check MORE conservative or LESS conservative about what counts as "actionable" — it cannot reintroduce the underlying DEF-1/DEF-2-class Thai-substring collision risk CAM-600 already guards in the real detector, because this script never resolves a place name itself, it only decides whether to print a report line.

## `computeDrift` — pure, exported, tested with constructed fixtures

```
computeDrift(committedEntries, liveEntries, provinceNamesTh)
  -> { added: string[], removed: string[] }  // both sorted, Thai locale
```

`added` = guard-surviving names present live but not committed (a MISS — the honest-failure-on-stale-input case the ticket opens with). `removed` = guard-surviving names present committed but not live (the camp closed / was removed; still worth surfacing, named separately). Pure and DB-free, so `__tests__/cam-605-shortlist-drift.test.ts` constructs synthetic `committedEntries`/`liveEntries`/`provinceNamesTh` fixtures directly — proving the check both fires (a constructed live-only name is named) and stays quiet (identical sets report nothing), per the ticket's own "a check nobody has seen fail has not been proven to work" (CAM-568 lesson). No DB, no environment dependency, runs identically in CI's `quality-gate` (which never calls the DB-touching `main()` path at all, only imports the pure functions, same convention as `cam-369-db-reset-redaction.test.ts`/`cam-503-landmark.test.ts`).

## CLI wrapper (`main()`, guarded, never runs on import)

Reads `prisma/data/subdistrict-shortlist.json` + `prisma/data/thailand-locations.json` from disk (relative paths via `import.meta.url`, the same pattern every sibling `scripts/*.mjs` in this family uses — no `@/` alias, which only resolves under Next.js/TS/vitest, not plain `node script.mjs`). Checks `DATABASE_URL`, connects, calls `computeLiveShortlistEntries`, calls `computeDrift`, prints, `process.exit(0|1)`. Guarded behind the same `isMain` check as `db-reset.mjs` so importing the module (for `computeDrift`/`survivesGuards`/`isSubstringOfAnyProvince` in tests) never triggers a live DB attempt.

## Real dev-DB run (self-verify, reported honestly)

`node scripts/check-subdistrict-shortlist-drift.mjs`, run against the local dev DB after sourcing `.env` — actual output recorded in the PR body (never fabricated, per `.claude/rules/performance.md` "metric honesty"): either a clean `0 drift` line, or a named count. Whichever it is, this story does NOT regenerate/correct the artifact in response — that is explicitly out of scope (story.md).

## Links
`scripts/generate-subdistrict-shortlist.mjs` · `scripts/check-subdistrict-shortlist-drift.mjs` · `scripts/db-reset.mjs` (`describeUrlShape`) · `prisma/data/subdistrict-shortlist.json` · `prisma/data/thailand-locations.json` · `lib/ai/place-resolver.ts` (read-only reference for the guard values, BR-2) · `../CAM-600-tambon-shortlist/tech.md` (the generator + guards this story checks against) · `.claude/rules/performance.md` (CAM-595, the promoted rule this story extends to a derived artifact) · `.claude/rules/ops.md` (report-mode → blocking rollout) · `.github/workflows/ci.yml` (confirms `quality-gate` has no DB service).

## Changelog
- v1 (2026-07-28) — created; documents the manual `check:*` placement decision (and the two rejected alternatives), the shared `computeLiveShortlistEntries` refactor + the `isMain` guard it required, the guard-filtered diff (and the named, bounded duplication risk this creates against `place-resolver.ts`), and the report-mode rollout framing.
