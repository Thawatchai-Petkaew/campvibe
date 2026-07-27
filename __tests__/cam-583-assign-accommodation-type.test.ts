/**
 * cam-583-assign-accommodation-type.test.ts — CAM-583
 * (platform-hardening/taxonomy-ui-foundation)
 *
 * `scripts/backfill-cam-583-assign-accommodation-type.mjs` assigns `DISP`
 * to every `CampSite` whose `accommodationTypes` is empty (the ones whose
 * only value was the retired horse-camp code, CAM-538) — but ONLY when the
 * camp's own name + Terrain tags both agree it is an open field. A candidate
 * matching just one signal is left untouched and reported, never forced.
 *
 * Coverage matrix (qa.md §7): normal · null/empty · boundary · error/
 * validation · concurrent/ordering (idempotent re-run).
 */
import { describe, it, expect, afterEach, vi } from 'vitest';
import {
  ASSIGNED_CODE,
  OPEN_FIELD_NAME_KEYWORDS,
  OPEN_FIELD_TERRAIN_CODES,
  fitsOpenFieldPattern,
  runBackfill,
  checkGuard,
} from '../scripts/backfill-cam-583-assign-accommodation-type.mjs';

type FakeCampSite = {
  id: string;
  nameTh: string;
  nameEn: string;
  accommodationTypes: string;
  terrainCodes?: string[];
};

function makeFakePrisma(campSites: FakeCampSite[]) {
  const data = campSites.map((c) => ({ ...c }));
  return {
    data,
    campSite: {
      findMany: async ({ where }: { where?: { accommodationTypes?: string } } = {}) => {
        return data
          .filter((r) => (where?.accommodationTypes !== undefined ? r.accommodationTypes === where.accommodationTypes : true))
          .map((r) => ({
            id: r.id,
            nameTh: r.nameTh,
            nameEn: r.nameEn,
            accommodationTypes: r.accommodationTypes,
            options: (r.terrainCodes ?? []).map((code) => ({ code, group: 'Terrain' })),
          }));
      },
      update: async ({ where, data: patch }: { where: { id: string }; data: Record<string, unknown> }) => {
        const row = data.find((r) => r.id === where.id);
        if (!row) throw new Error(`no row for id ${where.id}`);
        Object.assign(row, patch);
        return { ...row };
      },
    },
  };
}

// ===========================================================================
// (a) fitsOpenFieldPattern — co-occurrence, never a bare substring match
// ===========================================================================
describe('CAM-583 (a) — fitsOpenFieldPattern: requires BOTH name keyword AND terrain tag', () => {
  it('[normal] a real ticket example (name + terrain both present) fits', () => {
    expect(fitsOpenFieldPattern({ nameTh: 'ทุ่งโล่งชานเมืองพระนครศรีอยุธยา', terrainCodes: ['FORE', 'MTNS'] })).toBe(true);
    expect(fitsOpenFieldPattern({ nameTh: 'เนินหญ้าชายทุ่งพิษณุโลก', terrainCodes: ['FORE', 'MTNS', 'FILD', 'FARM'] })).toBe(true);
  });

  it('[Critical, teeth] a name-keyword match with NO supporting terrain tag is refused (CAM-501/503 substring-collision guard)', () => {
    expect(fitsOpenFieldPattern({ nameTh: 'ทุ่งริมทะเลภูเก็ต', terrainCodes: ['BEAC', 'SEA'] })).toBe(false);
  });

  it('[Critical, teeth] a supporting terrain tag with NO name-keyword match is refused (never assign from terrain alone)', () => {
    expect(fitsOpenFieldPattern({ nameTh: 'ริมหาดสวยเขาใหญ่', terrainCodes: ['FILD', 'FARM'] })).toBe(false);
  });

  it('[null/empty] empty name and empty terrain list both refuse', () => {
    expect(fitsOpenFieldPattern({ nameTh: '', terrainCodes: [] })).toBe(false);
    expect(fitsOpenFieldPattern({ nameTh: undefined as unknown as string, terrainCodes: undefined })).toBe(false);
  });

  it('[boundary] every documented keyword/terrain code is honored', () => {
    for (const kw of OPEN_FIELD_NAME_KEYWORDS) {
      for (const code of OPEN_FIELD_TERRAIN_CODES) {
        expect(fitsOpenFieldPattern({ nameTh: `${kw}ทดสอบ`, terrainCodes: [code] })).toBe(true);
      }
    }
  });
});

// ===========================================================================
// (b) runBackfill — dry-run/real-run, exception reporting, idempotency
// ===========================================================================
describe('CAM-583 (b) — runBackfill: assigns DISP only when verified, reports exceptions, never forces', () => {
  it('[normal, teeth] assigns DISP to a candidate whose name+terrain both fit', async () => {
    const fake = makeFakePrisma([
      { id: 'c1', nameTh: 'ทุ่งกว้างริมหมู่บ้านลพบุรี', nameEn: 'Lop Buri Meadow', accommodationTypes: '', terrainCodes: ['FORE', 'MTNS', 'FILD', 'FARM'] },
    ]);
    const summary = await runBackfill(fake, { dryRun: false });
    expect(summary.assigned).toHaveLength(1);
    expect(summary.assigned[0]).toMatchObject({ id: 'c1' });
    expect(fake.data[0].accommodationTypes).toBe(ASSIGNED_CODE);
  });

  it('[AC, teeth] DRY_RUN computes the projected assignment but writes ZERO rows', async () => {
    const fake = makeFakePrisma([
      { id: 'c1', nameTh: 'ทุ่งกว้างริมหมู่บ้านลพบุรี', nameEn: 'Lop Buri Meadow', accommodationTypes: '', terrainCodes: ['FORE', 'MTNS'] },
    ]);
    const summary = await runBackfill(fake, { dryRun: true });
    expect(summary.assigned).toHaveLength(1);
    expect(fake.data[0].accommodationTypes).toBe(''); // unchanged — dry run
  });

  it('[error/validation, Critical, teeth] a candidate that does NOT fit the open-field pattern is left untouched and reported — never forced', async () => {
    const fake = makeFakePrisma([
      { id: 'c-exception', nameTh: 'ลานกางเต็นท์ริมทะเลชลบุรี', nameEn: 'Chonburi Beachside Campground', accommodationTypes: '', terrainCodes: ['BEAC', 'SEA'] },
    ]);
    const summary = await runBackfill(fake, { dryRun: false });
    expect(summary.assigned).toHaveLength(0);
    expect(summary.exceptions).toHaveLength(1);
    expect(summary.exceptions[0]).toMatchObject({ id: 'c-exception', reason: 'does_not_fit_open_field_pattern' });
    expect(fake.data[0].accommodationTypes).toBe(''); // untouched
  });

  it('[null/empty] a row whose accommodationTypes is already non-empty is never a candidate', async () => {
    const fake = makeFakePrisma([
      { id: 'c-typed', nameTh: 'ทุ่งกว้าง', nameEn: 'Already typed', accommodationTypes: 'TSIT', terrainCodes: ['FILD'] },
    ]);
    const summary = await runBackfill(fake, { dryRun: false });
    expect(summary.candidates).toBe(0);
    expect(summary.assigned).toHaveLength(0);
  });

  it('[concurrent/ordering, teeth] a SECOND run after a successful assignment is idempotent — 0 rows written', async () => {
    const fake = makeFakePrisma([
      { id: 'c1', nameTh: 'ทุ่งกว้างริมหมู่บ้านลพบุรี', nameEn: 'Lop Buri Meadow', accommodationTypes: '', terrainCodes: ['FORE', 'MTNS'] },
    ]);
    const first = await runBackfill(fake, { dryRun: false });
    expect(first.assigned).toHaveLength(1);

    const second = await runBackfill(fake, { dryRun: false });
    expect(second.candidates).toBe(0);
    expect(second.assigned).toHaveLength(0);
    expect(fake.data[0].accommodationTypes).toBe(ASSIGNED_CODE);
  });

  it('[normal] the real ticket-shaped batch: mixed fit/no-fit candidates in one run', async () => {
    const fake = makeFakePrisma([
      { id: 'c1', nameTh: 'ทุ่งโล่งชานเมืองปทุมธานี', nameEn: 'Pathum Thani Meadow', accommodationTypes: '', terrainCodes: ['FORE', 'MTNS'] },
      { id: 'c2', nameTh: 'เนินหญ้าชายทุ่งชัยนาท', nameEn: 'Chai Nat Meadow', accommodationTypes: '', terrainCodes: ['FORE', 'MTNS', 'FILD', 'FARM'] },
      { id: 'c3', nameTh: 'ลานกางเต็นท์ริมน้ำตก', nameEn: 'Waterfall Campground', accommodationTypes: '', terrainCodes: ['WATF'] },
    ]);
    const summary = await runBackfill(fake, { dryRun: false });
    expect(summary.assigned.map((a: { id: string }) => a.id).sort()).toEqual(['c1', 'c2']);
    expect(summary.exceptions.map((e: { id: string }) => e.id)).toEqual(['c3']);
  });
});

// ===========================================================================
// (c) checkGuard
// ===========================================================================
describe('CAM-583 (c) — checkGuard: refuses missing opt-in / DATABASE_URL, or a production-looking target', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('[error/validation] refuses when ALLOW_ASSIGN_ACCOMMODATION_TYPE_BACKFILL is unset', () => {
    vi.stubEnv('ALLOW_ASSIGN_ACCOMMODATION_TYPE_BACKFILL', '');
    vi.stubEnv('DATABASE_URL', 'postgresql://localhost:5432/campvibe_dev');
    const result = checkGuard();
    expect(result.ok).toBe(false);
    expect(result.message).toContain('ALLOW_ASSIGN_ACCOMMODATION_TYPE_BACKFILL=1');
  });

  it('[error/validation] refuses when DATABASE_URL is unset', () => {
    vi.stubEnv('ALLOW_ASSIGN_ACCOMMODATION_TYPE_BACKFILL', '1');
    vi.stubEnv('DATABASE_URL', '');
    const result = checkGuard();
    expect(result.ok).toBe(false);
    expect(result.message).toContain('DATABASE_URL is not set');
  });

  it('[error/validation] refuses when the target URL looks like production', () => {
    vi.stubEnv('ALLOW_ASSIGN_ACCOMMODATION_TYPE_BACKFILL', '1');
    vi.stubEnv('DATABASE_URL', 'postgresql://user:pw@prod-db.example.com:5432/campvibe');
    vi.stubEnv('NODE_ENV', 'test');
    vi.stubEnv('VERCEL_ENV', '');
    const result = checkGuard();
    expect(result.ok).toBe(false);
    expect(result.message).toContain('PRODUCTION');
  });

  it('[normal] allows when opt-in + DATABASE_URL are set and the target does not look like production', () => {
    vi.stubEnv('ALLOW_ASSIGN_ACCOMMODATION_TYPE_BACKFILL', '1');
    vi.stubEnv('DATABASE_URL', 'postgresql://localhost:5432/campvibe_dev');
    vi.stubEnv('NODE_ENV', 'test');
    vi.stubEnv('VERCEL_ENV', '');
    const result = checkGuard();
    expect(result.ok).toBe(true);
  });
});
