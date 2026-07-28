#!/usr/bin/env node
/**
 * check-clearable-fields.mjs — CAM-615 root-cause guard
 *
 * A host cannot clear a field they filled in when its zod schema carries only
 * `.optional()` (undefined = "skip", by design) with no `.nullable()`
 * counterpart to carry an explicit "clear this column" signal. That exact gap
 * shipped THREE times as three separate incidents (CAM-341, CAM-360, CAM-615)
 * because each fix was hand-rolled per field instead of guarded structurally.
 *
 * WHAT THIS CHECKS: every nullable SCALAR column on CampSite/Spot (the two
 * models this ticket's measured sweep covered — lib/validations/campsite.ts
 * and lib/validations/spot.ts are the two host-facing contracts) that also
 * appears as a field in the paired zod schema must carry `.nullable()`
 * somewhere in that field's definition. A Prisma field line counts as a
 * "scalar column" here when it has no `@relation` on it (an object relation
 * like `zoneRef Zone? @relation(...)` is a different clearing mechanism
 * entirely — see resolveSpotZoneWrite in lib/api-utils.ts).
 *
 * WHAT THIS DELIBERATELY DOES NOT FLAG (documented ALLOWLIST below, each with
 * a reason — never silently skipped):
 *   - CampSite.tags / Spot.nearFacilities — arrays serialized to CSV; the
 *     clearability idiom is an empty array + `?? null` at the Prisma write
 *     site (arrayToCsv), not a zod `.nullable()` on an array type.
 *   - CampSite.groundType — a per-key numeric counter object; setting a key
 *     to 0 already writes 0 (not omitted); no UI action produces an empty
 *     object.
 *   - CampSite.ownershipType — the host form is a two-way toggle
 *     (PRIVATE/NATIONAL_PARK) with no third "not specified" option; there is
 *     no reachable host action that would send a clear.
 *   - Spot.zone/Spot.zoneId — zone detachment is an explicit round-1 scope
 *     boundary (lib/api-utils.ts resolveSpotZoneWrite); the "no zone" select
 *     option is disabled once a zone is set (spot-form-dialog.tsx).
 *
 * ROLLOUT (per .claude/rules/ops.md: report-mode -> backlog 0 -> blocking):
 * this check runs in REPORT MODE ONLY for this story (always exits 0). The
 * measured backlog is 0 as of CAM-615 — flip to blocking (non-zero exit on a
 * violation) in a follow-up once that has held across a few runs; a guard
 * shipped straight to blocking with an unproven false-positive rate is the
 * kind of guard that gets disabled within a week.
 *
 * Usage:
 *   node scripts/check-clearable-fields.mjs
 *   npm run check:clearable-fields
 */

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');

export const PRISMA_SCHEMA_PATH = path.join(ROOT, 'prisma', 'schema.prisma');
export const CAMPSITE_ZOD_PATH = path.join(ROOT, 'lib', 'validations', 'campsite.ts');
export const SPOT_ZOD_PATH = path.join(ROOT, 'lib', 'validations', 'spot.ts');

/** Fields intentionally excluded from the `.nullable()` requirement, each with a stated reason. */
export const ALLOWLIST = {
  CampSite: {
    tags: 'array serialized to CSV; clearability is an empty array + `?? null` at the write site, not zod .nullable() on an array',
    groundType: 'per-key numeric counter object; setting a key to 0 already writes 0, no UI action produces an empty object',
    ownershipType: 'host form is a two-way toggle (PRIVATE/NATIONAL_PARK) with no "not specified" option; no reachable clear action',
  },
  Spot: {
    zone: 'deprecated legacy display string (CAM-362); no new writers per the retirement plan in prisma/schema.prisma',
    zoneId: 'zone detachment is an explicit round-1 scope boundary (resolveSpotZoneWrite); the "no zone" option is disabled once a zone is set',
    nearFacilities: 'array serialized to CSV; same rule as CampSite.tags',
  },
};

/**
 * Extract `name Type?` scalar column names from one Prisma model body.
 * Skips `@relation` lines (object relations, not scalar columns) and array
 * relations (`Type[]`, which never matches the trailing `?` pattern anyway).
 */
export function parsePrismaNullableFields(schemaSource, modelName) {
  const modelRe = new RegExp(`model\\s+${modelName}\\s*\\{([\\s\\S]*?)\\n\\}`, 'm');
  const match = modelRe.exec(schemaSource);
  if (!match) {
    throw new Error(`check-clearable-fields: model ${modelName} not found in schema.prisma`);
  }
  const body = match[1];
  const fieldLineRe = /^\s*([A-Za-z_][A-Za-z0-9_]*)\s+[A-Za-z_][A-Za-z0-9_]*\?\s*(?:@[^\n]*)?\s*(?:\/\/.*)?$/;
  const names = [];
  for (const line of body.split('\n')) {
    if (line.includes('@relation')) continue;
    const m = fieldLineRe.exec(line);
    if (m) names.push(m[1]);
  }
  return names;
}

/**
 * Split a zod `z.object({ ... })` body into `{ fieldName: fullDefinitionText }`
 * blocks. Handles a field definition that spans multiple lines (a chained
 * `.number().min(...).max(...)` etc.) by collecting every line up to the next
 * top-level `  fieldName: ` line (2-space indent — this file's convention).
 */
export function parseZodFieldBlocks(zodSource) {
  const objStart = zodSource.indexOf('z.object({');
  if (objStart === -1) {
    throw new Error('check-clearable-fields: no `z.object({` found in the given source');
  }
  const bodyStart = zodSource.indexOf('\n', objStart) + 1;
  const closeMatch = /\n\}\);/.exec(zodSource.slice(bodyStart));
  if (!closeMatch) {
    throw new Error('check-clearable-fields: no matching `});` found for the z.object({');
  }
  const body = zodSource.slice(bodyStart, bodyStart + closeMatch.index);

  const fields = {};
  let currentName = null;
  let currentLines = [];
  const fieldStartRe = /^  ([A-Za-z_][A-Za-z0-9_]*):\s/;
  for (const line of body.split('\n')) {
    const m = fieldStartRe.exec(line);
    if (m) {
      if (currentName) fields[currentName] = currentLines.join('\n');
      currentName = m[1];
      currentLines = [line];
    } else if (currentName) {
      currentLines.push(line);
    }
  }
  if (currentName) fields[currentName] = currentLines.join('\n');
  return fields;
}

/**
 * Cross-check one model's nullable Prisma columns against its zod schema.
 * `violations` IS the backlog this guard reports on.
 */
export function findClearableGuardViolations({ prismaSource, zodSource, modelName, allowlist = {} }) {
  const nullableFields = parsePrismaNullableFields(prismaSource, modelName);
  const zodFields = parseZodFieldBlocks(zodSource);

  const violations = [];
  const excluded = [];
  const checked = [];

  for (const name of nullableFields) {
    if (!(name in zodFields)) continue; // not part of this contract at all — nothing to guard here
    if (name in allowlist) {
      excluded.push({ name, reason: allowlist[name] });
      continue;
    }
    checked.push(name);
    if (!/\.nullable\(\)/.test(zodFields[name])) {
      violations.push(name);
    }
  }
  return { violations, excluded, checked };
}

function main() {
  const prismaSource = readFileSync(PRISMA_SCHEMA_PATH, 'utf8');
  const campsiteZodSource = readFileSync(CAMPSITE_ZOD_PATH, 'utf8');
  const spotZodSource = readFileSync(SPOT_ZOD_PATH, 'utf8');

  const results = [
    { model: 'CampSite', ...findClearableGuardViolations({ prismaSource, zodSource: campsiteZodSource, modelName: 'CampSite', allowlist: ALLOWLIST.CampSite }) },
    { model: 'Spot', ...findClearableGuardViolations({ prismaSource, zodSource: spotZodSource, modelName: 'Spot', allowlist: ALLOWLIST.Spot }) },
  ];

  const totalViolations = results.reduce((n, r) => n + r.violations.length, 0);
  const totalChecked = results.reduce((n, r) => n + r.checked.length, 0);
  const totalExcluded = results.reduce((n, r) => n + r.excluded.length, 0);

  console.log(
    `check:clearable-fields — ${totalChecked} field(s) checked, ${totalExcluded} excluded (documented), ${totalViolations} violation(s).`
  );
  for (const r of results) {
    for (const v of r.violations) {
      console.log(`  MISSING .nullable(): ${r.model}.${v}`);
    }
  }
  if (totalExcluded > 0) {
    console.log('Excluded (documented reason — see ALLOWLIST in this script):');
    for (const r of results) {
      for (const e of r.excluded) console.log(`  - ${r.model}.${e.name}: ${e.reason}`);
    }
  }

  if (totalViolations > 0) {
    // REPORT MODE ONLY (CAM-615, see file header) — never fails the build yet.
    console.log(`check:clearable-fields — ${totalViolations} report-mode finding(s), NOT blocking yet.`);
  }
  process.exit(0);
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}
