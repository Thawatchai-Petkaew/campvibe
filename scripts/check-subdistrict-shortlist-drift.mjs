#!/usr/bin/env node
/**
 * scripts/check-subdistrict-shortlist-drift.mjs — CAM-605
 *
 * CAM-600 made ตำบล (sub-district) search reliable by shortlisting only the
 * 422 sub-districts that actually hold a camp, into a COMMITTED artifact
 * (`prisma/data/subdistrict-shortlist.json`) that only ever changes when
 * someone re-runs `scripts/generate-subdistrict-shortlist.mjs` by hand. The
 * moment a camp opens in a tambon not yet on that list, the assistant
 * answers "I do not know that place" about a place it now holds a camp in —
 * the honest-failure path behaving correctly on STALE input, which looks
 * exactly like the system working. This script makes that divergence
 * DETECTABLE on demand, rather than something a human has to remember.
 *
 * WHAT IT DOES: regenerates the raw "holds a camp" fact into memory (via
 * `computeLiveShortlistEntries`, the SAME function
 * `generate-subdistrict-shortlist.mjs` uses to WRITE the file — refactored
 * out in this story so the two paths can never quietly disagree on what
 * "holds a camp" means), and diffs it against the committed JSON — filtered
 * through the SAME three candidate-build guards `lib/ai/place-resolver.ts`
 * applies (length floor, ordinary-vocabulary skip-set, substring-of-a-
 * province), so a name the detector would never have used anyway is never
 * reported as actionable drift (see this story's tech.md "Accounting for
 * CAM-600's own guards").
 *
 * WHAT IT NEVER DOES: write to `prisma/data/subdistrict-shortlist.json` (a
 * read-only comparison — regenerating/correcting the file is out of this
 * story's scope, see story.md "Out of scope"), or touch
 * `lib/ai/place-resolver.ts` (its guard VALUES are read and duplicated here
 * with a cross-reference comment, never imported — that file is out of this
 * story's file surface).
 *
 * WHERE IT RUNS (decided in tech.md "Where it runs" — read that before
 * changing this): a manual, on-demand `check:*` script
 * (`npm run check:subdistrict-drift`), the SAME cadence as the generator it
 * checks (before a release train, or after a host-onboarding batch). It is
 * deliberately NOT wired into `.github/workflows/ci.yml`'s `quality-gate`
 * job — that job has NO Postgres service / DATABASE_URL at all, so wiring
 * this there blocking would either always silently skip (permanent no-op)
 * or break every PR outright once someone "fixed" it to require a DB. Both
 * are exactly the "gets disabled within a week" failure this ticket names.
 *
 * NO DATABASE REACHABLE (two cases, both handled the same way — SKIPPED,
 * never a false pass, never a crash):
 *   1. DATABASE_URL unset       -> no PrismaClient is even constructed.
 *   2. DATABASE_URL set but the connection/query throws -> caught, same
 *      SKIPPED treatment, no partial output printed.
 * Exit 0 covers BOTH "skipped, unknowable here" and "checked, clean" — the
 * two are told apart by the printed message (never the exit code), the same
 * shape ci.yml's own `smoke` job already uses for an unconfigured URL
 * (.claude/rules/ops.md: "the skip prints a loud notice naming the missing
 * var"). Exit 1 is reserved for the one actionable case: a real,
 * guard-surviving name difference.
 *
 * Usage: node scripts/check-subdistrict-shortlist-drift.mjs
 * (source the target env's `.env` first for DATABASE_URL — dev DB today).
 */
import { readFileSync } from 'node:fs';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { dirname, join } from 'node:path';
import { PrismaClient } from '@prisma/client';
import { describeUrlShape } from './db-reset.mjs';
import { computeLiveShortlistEntries } from './generate-subdistrict-shortlist.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const SHORTLIST_PATH = join(__dirname, '..', 'prisma', 'data', 'subdistrict-shortlist.json');
const THAILAND_LOCATIONS_PATH = join(__dirname, '..', 'prisma', 'data', 'thailand-locations.json');

/**
 * Mirrors `lib/ai/place-resolver.ts`'s own CAM-600 candidate-build guards
 * (that file's `MIN_SUBDISTRICT_NAME_LENGTH` / `AMBIGUOUS_SUBDISTRICT_VOCAB_TH`
 * / `isSubstringOfAnyProvince`, read directly from the live source at
 * authoring time — lines ~586-687). `lib/ai/**` is out of this story's file
 * surface and does not export these as reusable values, so they are
 * DUPLICATED here rather than imported — a named, bounded risk (tech.md
 * "Accounting for CAM-600's own guards"): a future edit to either copy is
 * only flagged by this comment, not enforced, but a drift between the two
 * can only make THIS report more/less conservative, never reintroduce a
 * real place-name collision (this script only decides whether to PRINT a
 * report line — it never itself resolves a place name).
 */
export const MIN_SUBDISTRICT_NAME_LENGTH = 5;
export const AMBIGUOUS_SUBDISTRICT_VOCAB_TH = new Set(['เหนือ', 'สะอาด', 'สำราญ']);

/** True when `name` appears as a substring inside ANY given province name (incl. exact match) — mirrors `place-resolver.ts`'s own `isSubstringOfAnyProvince`. */
export function isSubstringOfAnyProvince(name, provinceNamesTh) {
  return provinceNamesTh.some((p) => typeof p === 'string' && p.length > 0 && p.includes(name));
}

/** True when `nameTh` would actually be used by `lib/ai/place-resolver.ts`'s sub-district detector — i.e. survives all three CAM-600 candidate-build guards. */
export function survivesGuards(nameTh, provinceNamesTh) {
  if (nameTh.length < MIN_SUBDISTRICT_NAME_LENGTH) return false;
  if (AMBIGUOUS_SUBDISTRICT_VOCAB_TH.has(nameTh)) return false;
  if (isSubstringOfAnyProvince(nameTh, provinceNamesTh)) return false;
  return true;
}

/**
 * Pure — diffs two RAW entry lists (the committed shortlist shape and the
 * shape `computeLiveShortlistEntries` returns), filtered through
 * `survivesGuards` on BOTH sides before comparing, so a name that would
 * never fire as a detector anyway is never reported as drift (EC-4) — that
 * would be "a difference that is deliberate", the ticket's own phrase.
 *
 * @param {Array<{nameTh: string}>} committedEntries
 * @param {Array<{nameTh: string}>} liveEntries
 * @param {string[]} provinceNamesTh
 * @returns {{ added: string[]; removed: string[] }} both sorted, Thai locale
 */
export function computeDrift(committedEntries, liveEntries, provinceNamesTh) {
  const committedNames = new Set(
    committedEntries.map((e) => e.nameTh).filter((n) => survivesGuards(n, provinceNamesTh))
  );
  const liveNames = new Set(
    liveEntries.map((e) => e.nameTh).filter((n) => survivesGuards(n, provinceNamesTh))
  );

  const added = [...liveNames]
    .filter((n) => !committedNames.has(n))
    .sort((a, b) => a.localeCompare(b, 'th'));
  const removed = [...committedNames]
    .filter((n) => !liveNames.has(n))
    .sort((a, b) => a.localeCompare(b, 'th'));

  return { added, removed };
}

export async function main() {
  const provinceNamesTh = JSON.parse(readFileSync(THAILAND_LOCATIONS_PATH, 'utf-8')).map((p) => p.nameTh);
  const committedEntries = JSON.parse(readFileSync(SHORTLIST_PATH, 'utf-8'));

  const url = process.env.DATABASE_URL || '';
  if (!url) {
    console.warn(
      '[check-subdistrict-shortlist-drift] SKIPPED (not a pass) — no DATABASE_URL in this environment. ' +
        "CI's quality-gate job has none by design (see this file's own docblock); source a real env's .env " +
        '(e.g. dev) and re-run to actually check for drift.'
    );
    process.exit(0);
    return;
  }

  const prisma = new PrismaClient();
  let liveEntries;
  try {
    console.log(`[check-subdistrict-shortlist-drift] comparing the committed shortlist against ${describeUrlShape(url)}`);
    const result = await computeLiveShortlistEntries(prisma);
    liveEntries = result.entries;
  } catch (error) {
    console.warn(
      `[check-subdistrict-shortlist-drift] SKIPPED (not a pass) — DATABASE_URL was set but unreachable: ${
        error instanceof Error ? error.message : 'unknown error'
      }`
    );
    await prisma.$disconnect().catch(() => {});
    process.exit(0);
    return;
  }
  await prisma.$disconnect();

  const { added, removed } = computeDrift(committedEntries, liveEntries, provinceNamesTh);

  if (added.length === 0 && removed.length === 0) {
    console.log(
      `[check-subdistrict-shortlist-drift] OK — 0 drift. The committed shortlist (${committedEntries.length} raw rows) ` +
        'still matches the live, guard-surviving fact.'
    );
    process.exit(0);
    return;
  }

  if (added.length > 0) {
    console.error(
      `[check-subdistrict-shortlist-drift] MISSED — ${added.length} sub-district(s) now hold a camp but are NOT in ` +
        `the committed shortlist (a camper naming one of these gets an honest "not found" that is actually stale data): ${added.join(', ')}`
    );
  }
  if (removed.length > 0) {
    console.error(
      `[check-subdistrict-shortlist-drift] STALE — ${removed.length} committed sub-district(s) no longer hold a camp: ${removed.join(', ')}`
    );
  }
  console.error(
    '[check-subdistrict-shortlist-drift] Regenerate: node scripts/generate-subdistrict-shortlist.mjs, review the diff, commit.'
  );
  process.exit(1);
}

// Only auto-run when executed directly (`node scripts/check-subdistrict-shortlist-drift.mjs` /
// `npm run check:subdistrict-drift`) — not when imported for its pure exports
// (tests). Same pattern as `scripts/db-reset.mjs` / `scripts/generate-subdistrict-shortlist.mjs`.
const isMain = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;
if (isMain) {
  main();
}
