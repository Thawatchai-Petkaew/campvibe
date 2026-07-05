/**
 * cam-362-zone-migration.test.ts — CAM-362 Zone entity migration + backfill
 * (tech.md §2, §6 confirmation tests #1, #2, #7).
 *
 * This suite runs with NO live Postgres connection (the CI quality-gate job
 * — `npm test -- --coverage` — has no DB service; only the separate
 * `e2e-regression` CI job provisions one). It proves two independent things:
 *
 *  1. Source-inspection of the COMMITTED migration SQL — the real up/down
 *     files this PR ships — asserting the exact backfill/index/rollback
 *     statements are present, in the right order, with the right WHERE
 *     clauses (mirrors the source-inspection pattern used by
 *     cam-302-internal-holds.test.ts's Group G).
 *  2. A pure-JS mirror of the backfill SQL's dedup/normalization logic
 *     (DISTINCT ON campSiteId + lower(btrim(zone)), earliest createdAt wins,
 *     soft-deleted spots excluded) exercised against the exact fixture
 *     tech.md §2.4 describes, proving the LOGIC the SQL encodes.
 *
 * The REAL live-Postgres proof (this exact migration applied to the LOCAL
 * dev DB, up -> down -> up, against a fixture seeded with these same
 * strings) is captured as a psql transcript in the PR body per the
 * dispatch's "Prove-on-local instruction" (tech.md §2.4) — that is a build-
 * time verification step, not a CI-blocking assertion, because CI's
 * standard test job has no reachable database.
 */

import * as fs from 'fs';
import * as path from 'path';
import { describe, it, expect } from 'vitest';

const MIGRATION_DIR = path.join(
  process.cwd(),
  'prisma/migrations/20260705040333_cam362_zone_entity'
);

const migrationSql = fs.readFileSync(path.join(MIGRATION_DIR, 'migration.sql'), 'utf-8');
const downSql = fs.readFileSync(path.join(MIGRATION_DIR, 'down.sql'), 'utf-8');
const schemaSrc = fs.readFileSync(path.join(process.cwd(), 'prisma/schema.prisma'), 'utf-8');

// ===========================================================================
// Group A: schema.prisma source-inspection — the declared model (Data section)
// ===========================================================================

describe('schema.prisma — Zone model + Spot additive fields (tech.md §1)', () => {
  it('declares the Zone model with campSiteId, name, sortOrder, soft-delete + version', () => {
    const zoneMatch = schemaSrc.match(/model Zone \{[\s\S]*?\n\}/);
    expect(zoneMatch).not.toBeNull();
    expect(zoneMatch![0]).toContain('campSiteId');
    expect(zoneMatch![0]).toContain('name');
    expect(zoneMatch![0]).toContain('sortOrder');
    expect(zoneMatch![0]).toContain('deletedAt');
    expect(zoneMatch![0]).toContain('version');
  });

  it('does NOT declare a full @@unique([campSiteId, name]) in-schema (would burn a name after soft-delete)', () => {
    const zoneMatch = schemaSrc.match(/model Zone \{[\s\S]*?\n\}/);
    // Only the ACTIVE (non-comment) lines matter — the model's own doc
    // comment intentionally mentions the forbidden declaration as a warning.
    const activeLines = zoneMatch![0]
      .split('\n')
      .filter((line) => !line.trim().startsWith('//'));
    expect(activeLines.some((l) => /@@unique\(\s*\[\s*campSiteId\s*,\s*name\s*\]\s*\)/.test(l))).toBe(false);
  });

  it('Spot.zone carries a DEPRECATED (CAM-362) marker comment', () => {
    const spotMatch = schemaSrc.match(/model Spot \{[\s\S]*?\n\}/);
    expect(spotMatch).not.toBeNull();
    expect(spotMatch![0]).toContain('DEPRECATED (CAM-362)');
  });

  it('Spot declares zoneId + a zoneRef relation (not named `zone` — avoids the string-column name collision)', () => {
    const spotMatch = schemaSrc.match(/model Spot \{[\s\S]*?\n\}/);
    expect(spotMatch![0]).toContain('zoneId');
    expect(spotMatch![0]).toContain('zoneRef');
    expect(spotMatch![0]).toContain('onDelete: SetNull');
  });

  it('CampSite gains the zones back-relation', () => {
    const campMatch = schemaSrc.match(/model CampSite \{[\s\S]*?\n\}/);
    expect(campMatch).not.toBeNull();
    expect(campMatch![0]).toContain('zones');
  });
});

// ===========================================================================
// Group B: migration.sql source-inspection (confirmation test #1, #7)
// ===========================================================================

describe('migration.sql — backfill INSERT/UPDATE + partial unique index (tech.md §2.2)', () => {
  it('backfills one Zone row per DISTINCT normalized live zone string per camp', () => {
    expect(migrationSql).toContain('INSERT INTO "Zone"');
    expect(migrationSql).toContain('DISTINCT ON (s."campSiteId", lower(btrim(s."zone")))');
    // Excludes soft-deleted + null/blank zone strings.
    expect(migrationSql).toContain('s."zone" IS NOT NULL');
    expect(migrationSql).toContain('s."deletedAt" IS NULL');
  });

  it('picks a deterministic representative (earliest createdAt) per normalized group', () => {
    expect(migrationSql).toContain('ORDER BY s."campSiteId", lower(btrim(s."zone")), s."createdAt"');
  });

  it('links every live spot to its Zone by normalized (case/whitespace-insensitive) name match', () => {
    expect(migrationSql).toContain('UPDATE "Spot" s SET "zoneId" = z."id"');
    expect(migrationSql).toContain('lower(btrim(z."name")) = lower(btrim(s."zone"))');
  });

  it('never touches Spot.zone (the reversibility guarantee, tech.md §2.3)', () => {
    expect(migrationSql).not.toMatch(/SET\s+"zone"\s*=/);
  });

  it('creates the partial unique index scoped to live rows only, case/whitespace-insensitive', () => {
    expect(migrationSql).toContain('CREATE UNIQUE INDEX "Zone_campSiteId_name_active_key"');
    expect(migrationSql).toContain('(lower(btrim("name")))');
    expect(migrationSql).toContain('WHERE "deletedAt" IS NULL');
  });

  it('the partial unique index is created AFTER the backfill INSERT/UPDATE (surfaces a dedup bug loudly)', () => {
    const insertIdx = migrationSql.indexOf('INSERT INTO "Zone"');
    const updateIdx = migrationSql.indexOf('UPDATE "Spot" s SET "zoneId"');
    const indexIdx = migrationSql.indexOf('CREATE UNIQUE INDEX "Zone_campSiteId_name_active_key"');
    expect(insertIdx).toBeGreaterThan(-1);
    expect(updateIdx).toBeGreaterThan(insertIdx);
    expect(indexIdx).toBeGreaterThan(updateIdx);
  });
});

// ===========================================================================
// Group C: down.sql source-inspection (confirmation test #2 — reversibility)
// ===========================================================================

describe('down.sql — reversal order + no data loss on Spot.zone (tech.md §2.3)', () => {
  it('drops the partial unique index, the FK, the zoneId index, the zoneId column, then the Zone table', () => {
    const dropIndexIdx = downSql.indexOf('DROP INDEX IF EXISTS "Zone_campSiteId_name_active_key"');
    const dropFkIdx = downSql.indexOf('DROP CONSTRAINT IF EXISTS "Spot_zoneId_fkey"');
    const dropSpotIdxIdx = downSql.indexOf('DROP INDEX IF EXISTS "Spot_zoneId_idx"');
    const dropColIdx = downSql.indexOf('DROP COLUMN IF EXISTS "zoneId"');
    const dropTableIdx = downSql.indexOf('DROP TABLE IF EXISTS "Zone"');

    expect(dropIndexIdx).toBeGreaterThan(-1);
    expect(dropFkIdx).toBeGreaterThan(dropIndexIdx);
    expect(dropSpotIdxIdx).toBeGreaterThan(dropFkIdx);
    expect(dropColIdx).toBeGreaterThan(dropSpotIdxIdx);
    expect(dropTableIdx).toBeGreaterThan(dropColIdx);
  });

  it('never drops Spot.zone (the legacy string column survives rollback intact)', () => {
    expect(downSql).not.toContain('DROP COLUMN IF EXISTS "zone"');
    expect(downSql).not.toMatch(/DROP COLUMN\s+"zone"[^I]/);
  });

  it('every drop statement is guarded with IF EXISTS (idempotent, safe to re-run)', () => {
    const dropLines = downSql
      .split('\n')
      .filter((l) => l.trim().startsWith('DROP') || l.includes('DROP CONSTRAINT'));
    for (const line of dropLines) {
      expect(line).toContain('IF EXISTS');
    }
  });
});

// ===========================================================================
// Group D: pure-JS mirror of the backfill dedup logic (proves the LOGIC the
// SQL encodes, against the exact fixture tech.md §2.4 describes). This is a
// test-local reference implementation — NOT shipped in lib/ — it exists only
// to give CI (no live DB) a fast, deterministic check on the dedup semantics
// that were ALSO proven for real against Postgres (see PR body transcript).
// ===========================================================================

interface FixtureSpot {
  campSiteId: string;
  zone: string | null;
  deletedAt: Date | null;
  createdAt: Date;
}

interface BackfillZone {
  campSiteId: string;
  name: string; // the representative's btrim(zone) — original case preserved
}

/** Mirrors migration.sql's backfill INSERT ... SELECT DISTINCT ON (tech.md §2.2 step 5). */
function computeBackfillZones(spots: FixtureSpot[]): BackfillZone[] {
  const groups = new Map<string, FixtureSpot>();
  for (const s of spots) {
    if (s.deletedAt !== null) continue; // BR: soft-deleted spots contribute nothing
    if (s.zone === null) continue;
    const trimmed = s.zone.trim();
    if (trimmed === '') continue;
    const key = `${s.campSiteId}::${trimmed.toLowerCase()}`;
    const existing = groups.get(key);
    if (!existing || s.createdAt.getTime() < existing.createdAt.getTime()) {
      groups.set(key, { ...s, zone: trimmed });
    }
  }
  return [...groups.values()].map((s) => ({ campSiteId: s.campSiteId, name: s.zone as string }));
}

const CAMP_A = 'camp-a';
const CAMP_B = 'camp-b';

function d(offsetMs: number): Date {
  return new Date(1700000000000 + offsetMs);
}

describe('computeBackfillZones — mirrors the migration SQL dedup logic (tech.md §2.4 fixture)', () => {
  // The exact fixture tech.md §2.4 describes: distinct strings across >= 2
  // camps, an intra-camp case/whitespace duplicate, and one soft-deleted
  // spot with a zone string.
  const fixture: FixtureSpot[] = [
    { campSiteId: CAMP_A, zone: 'โซน A', deletedAt: null, createdAt: d(0) },
    { campSiteId: CAMP_A, zone: 'โซน a ', deletedAt: null, createdAt: d(1000) }, // case/whitespace dup of "โซน A"
    { campSiteId: CAMP_A, zone: 'โซน VIP', deletedAt: null, createdAt: d(2000) },
    { campSiteId: CAMP_A, zone: 'ริมน้ำ', deletedAt: null, createdAt: d(3000) },
    { campSiteId: CAMP_A, zone: 'โซนลับ', deletedAt: d(4000), createdAt: d(4000) }, // soft-deleted
    { campSiteId: CAMP_B, zone: 'โซน B', deletedAt: null, createdAt: d(5000) },
    { campSiteId: CAMP_B, zone: 'โซน C', deletedAt: null, createdAt: d(6000) },
    { campSiteId: CAMP_B, zone: 'วิวหลัก', deletedAt: null, createdAt: d(7000) },
    { campSiteId: CAMP_B, zone: 'โซนเงียบ', deletedAt: null, createdAt: d(8000) },
    { campSiteId: CAMP_B, zone: 'โซนครอบครัว', deletedAt: null, createdAt: d(9000) },
  ];

  const zones = computeBackfillZones(fixture);

  it('[ac1] Zone-rows-per-camp == DISTINCT normalized live zone strings per camp', () => {
    const campAZones = zones.filter((z) => z.campSiteId === CAMP_A);
    const campBZones = zones.filter((z) => z.campSiteId === CAMP_B);
    // Camp A: "โซน A"/"โซน a " collapse to 1 + VIP + ริมน้ำ = 3
    expect(campAZones).toHaveLength(3);
    // Camp B: 5 distinct strings, no dup
    expect(campBZones).toHaveLength(5);
  });

  it('[ac1] the intra-camp case/whitespace duplicate collapses to ONE Zone row, representative = earliest createdAt', () => {
    const campAZones = zones.filter((z) => z.campSiteId === CAMP_A);
    const nameOccurrences = campAZones.filter((z) => z.name.trim().toLowerCase() === 'โซน a');
    expect(nameOccurrences).toHaveLength(1);
    // Earliest createdAt wins -> "โซน A" (first row), not "โซน a " (second row).
    expect(nameOccurrences[0].name).toBe('โซน A');
  });

  it('[ac1] a soft-deleted spot contributes no Zone row', () => {
    const names = zones.map((z) => z.name);
    expect(names).not.toContain('โซนลับ');
  });

  it('[boundary] a null/blank zone string contributes no Zone row', () => {
    const withNulls: FixtureSpot[] = [
      ...fixture,
      { campSiteId: CAMP_A, zone: null, deletedAt: null, createdAt: d(10000) },
      { campSiteId: CAMP_A, zone: '   ', deletedAt: null, createdAt: d(11000) },
    ];
    const result = computeBackfillZones(withNulls);
    // Same 8 total zones as before — the null/blank rows added nothing.
    expect(result).toHaveLength(8);
  });

  it('[null/empty] no spots at all -> no Zone rows, no crash', () => {
    expect(computeBackfillZones([])).toEqual([]);
  });
});
