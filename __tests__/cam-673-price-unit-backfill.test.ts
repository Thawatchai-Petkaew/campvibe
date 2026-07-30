/**
 * cam-673-price-unit-backfill.test.ts — CAM-673
 * (platform-hardening — moves most camps to PER_PERSON pricing, ADR-014)
 *
 * `scripts/backfill-cam-673-price-unit.mjs` moves the still-untouched
 * `PER_SITE` migration default to a deterministic ~95% PER_PERSON / ~5%
 * PER_SITE split, never touches the CAM-663 demo-camp fixture, and never
 * overwrites a row a host/form has already set away from the default. This
 * suite exercises the pure selection function directly (no DB round trip —
 * per the ticket's own instruction) plus the plan builder/apply/undo against
 * an in-memory fake Prisma client (never a real DB — this agent never runs
 * the write path itself, see the script's own hard prohibition).
 *
 * Coverage matrix (qa.md §7): normal · null/empty · boundary · error/
 * validation · concurrent/ordering (idempotent re-run / dry-run determinism
 * / apply-undo round trip).
 */
import { describe, it, expect, afterEach, vi } from 'vitest';
import { unlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  PER_SITE_FRACTION,
  hashIdToUnitInterval,
  selectPriceUnitForId,
  DEMO_CAMP_SLUG_TH,
  checkGuard,
  loadManifest,
  saveManifest,
  buildPlan,
  summarizePlan,
  applyPlan,
  undoPlan,
  parseArgs,
} from '../scripts/backfill-cam-673-price-unit.mjs';

/** A unique, isolated manifest path per test — never the real default file. */
function makeTestManifestPath(): string {
  return join(tmpdir(), `cam-673-test-manifest-${Date.now()}-${Math.random().toString(36).slice(2)}.json`);
}

// ===========================================================================
// Fake Prisma — in-memory, tailored to exactly the calls this script makes.
// ===========================================================================

type FakeCamp = { id: string; nameThSlug: string; priceUnit: string; deletedAt: null };
type FakeSpot = { id: string; campSiteId: string; priceUnit: string; deletedAt: null };

function makeFakePrisma(fixture: { camps: FakeCamp[]; spots: FakeSpot[] }) {
  const camps = fixture.camps.map((c) => ({ ...c }));
  const spots = fixture.spots.map((s) => ({ ...s }));

  return {
    _store: { camps, spots },
    campSite: {
      findMany: async ({ where }: any) => {
        return camps
          .filter((c) => c.deletedAt === where.deletedAt)
          .sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0))
          .map((c) => ({
            id: c.id,
            nameThSlug: c.nameThSlug,
            priceUnit: c.priceUnit,
            spots: spots
              .filter((s) => s.campSiteId === c.id && s.deletedAt === null)
              .sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0))
              .map((s) => ({ id: s.id, priceUnit: s.priceUnit })),
          }));
      },
      update: async ({ where, data }: any) => {
        const c = camps.find((x) => x.id === where.id);
        if (!c) throw new Error(`no camp ${where.id}`);
        Object.assign(c, data);
        return { ...c };
      },
      findUnique: async ({ where }: any) => {
        const c = camps.find((x) => x.id === where.id);
        return c ? { priceUnit: c.priceUnit } : null;
      },
    },
    spot: {
      update: async ({ where, data }: any) => {
        const s = spots.find((x) => x.id === where.id);
        if (!s) throw new Error(`no spot ${where.id}`);
        Object.assign(s, data);
        return { ...s };
      },
      findUnique: async ({ where }: any) => {
        const s = spots.find((x) => x.id === where.id);
        return s ? { priceUnit: s.priceUnit } : null;
      },
    },
  };
}

function makeFixture() {
  const camps: FakeCamp[] = [
    { id: 'camp-a', nameThSlug: 'camp-a-th', priceUnit: 'PER_SITE', deletedAt: null },
    { id: 'camp-b', nameThSlug: 'camp-b-th', priceUnit: 'PER_SITE', deletedAt: null },
    { id: 'camp-c', nameThSlug: 'camp-c-th', priceUnit: 'PER_SITE', deletedAt: null },
    // already diverged (e.g. a host used the live picker) — must be left alone
    { id: 'camp-d', nameThSlug: 'camp-d-th', priceUnit: 'PER_PERSON', deletedAt: null },
    // soft-deleted — must never be considered
    { id: 'camp-e', nameThSlug: 'camp-e-th', priceUnit: 'PER_SITE', deletedAt: new Date() as unknown as null },
    // the CAM-663 demo camp fixture — must be entirely excluded
    { id: 'camp-demo', nameThSlug: DEMO_CAMP_SLUG_TH, priceUnit: 'PER_SITE', deletedAt: null },
  ];
  const spots: FakeSpot[] = [
    { id: 'spot-a1', campSiteId: 'camp-a', priceUnit: 'PER_SITE', deletedAt: null },
    { id: 'spot-a2', campSiteId: 'camp-a', priceUnit: 'PER_SITE', deletedAt: null },
    // a host-set per-spot override under camp-a — must be left alone
    { id: 'spot-a3', campSiteId: 'camp-a', priceUnit: 'PER_PERSON', deletedAt: null },
    // still-default spot under an already-diverged camp — must follow camp-d's PER_PERSON
    { id: 'spot-d1', campSiteId: 'camp-d', priceUnit: 'PER_SITE', deletedAt: null },
    // soft-deleted spot — must never be considered
    { id: 'spot-a4', campSiteId: 'camp-a', priceUnit: 'PER_SITE', deletedAt: new Date() as unknown as null },
    // demo camp's own pitches — must be entirely excluded, whatever their unit
    { id: 'spot-demo-1', campSiteId: 'camp-demo', priceUnit: 'PER_SITE', deletedAt: null },
    { id: 'spot-demo-2', campSiteId: 'camp-demo', priceUnit: 'PER_PERSON', deletedAt: null },
  ];
  return { camps, spots };
}

// ===========================================================================
// (a) checkGuard
// ===========================================================================
describe('CAM-673 (a) — checkGuard: refuses production, allows local dev + staging', () => {
  afterEach(() => vi.unstubAllEnvs());

  it('[error/validation] refuses when DATABASE_URL is unset', () => {
    vi.stubEnv('DATABASE_URL', '');
    const result = checkGuard();
    expect(result.ok).toBe(false);
    expect(result.message).toContain('DATABASE_URL is not set');
  });

  it('[Critical, teeth] refuses when the URL looks like production', () => {
    vi.stubEnv('DATABASE_URL', 'postgresql://user:pw@campvibe-prod.example.com:5432/campvibe');
    const result = checkGuard();
    expect(result.ok).toBe(false);
    expect(result.message).toContain('PRODUCTION');
  });

  it('[Critical, teeth] refuses when NODE_ENV=production even if the URL looks benign', () => {
    vi.stubEnv('DATABASE_URL', 'postgresql://user:pw@db.example.com:5432/campvibe');
    vi.stubEnv('NODE_ENV', 'production');
    expect(checkGuard().ok).toBe(false);
  });

  it('[normal] allows a local dev host', () => {
    vi.stubEnv('DATABASE_URL', 'postgresql://user:pw@localhost:5432/campvibe_dev');
    expect(checkGuard().ok).toBe(true);
  });

  it('[normal] allows a real staging-shaped host', () => {
    vi.stubEnv('DATABASE_URL', 'postgresql://user:pw@db.staging.example.com:5432/campvibe?api_key=secret');
    expect(checkGuard().ok).toBe(true);
  });
});

// ===========================================================================
// (b) selectPriceUnitForId / hashIdToUnitInterval — pure, no DB
// ===========================================================================
describe('CAM-673 (b) — selectPriceUnitForId: deterministic, stable, ~5% PER_SITE', () => {
  it('[normal] the same id always returns the same verdict (stable across calls)', () => {
    const id = 'a-real-camp-uuid-0001';
    const first = selectPriceUnitForId(id);
    for (let i = 0; i < 20; i += 1) {
      expect(selectPriceUnitForId(id)).toBe(first);
    }
  });

  it('[normal] a fixed set of ids returns the identical set on a second pass (no reshuffle)', () => {
    const ids = Array.from({ length: 500 }, (_, i) => `fixed-id-${i}`);
    const first = ids.map((id) => selectPriceUnitForId(id));
    const second = ids.map((id) => selectPriceUnitForId(id));
    expect(second).toEqual(first);
  });

  it('[normal, teeth] over a realistic population, the PER_SITE fraction lands near 5%', () => {
    const ids = Array.from({ length: 5000 }, (_, i) => `camp-population-${i}`);
    const perSiteCount = ids.filter((id) => selectPriceUnitForId(id) === 'PER_SITE').length;
    const pct = (perSiteCount / ids.length) * 100;
    expect(pct).toBeGreaterThan(2.5);
    expect(pct).toBeLessThan(8.5);
  });

  it('[boundary] fraction=0 never selects PER_SITE', () => {
    for (let i = 0; i < 50; i += 1) {
      expect(selectPriceUnitForId(`id-${i}`, 0)).toBe('PER_PERSON');
    }
  });

  it('[boundary] fraction=1 always selects PER_SITE', () => {
    for (let i = 0; i < 50; i += 1) {
      expect(selectPriceUnitForId(`id-${i}`, 1)).toBe('PER_SITE');
    }
  });

  it('[null/empty] hashIdToUnitInterval tolerates an empty-string id and stays in [0,1)', () => {
    const v = hashIdToUnitInterval('');
    expect(v).toBeGreaterThanOrEqual(0);
    expect(v).toBeLessThan(1);
  });

  it('[boundary] the default PER_SITE_FRACTION constant is 0.05 (the owner\'s ~5%)', () => {
    expect(PER_SITE_FRACTION).toBe(0.05);
  });

  it('[normal] two different ids can (and generally do) diverge', () => {
    const a = hashIdToUnitInterval('id-alpha');
    const b = hashIdToUnitInterval('id-beta');
    expect(a).not.toBe(b);
  });
});

// ===========================================================================
// (c) buildPlan — demo-camp exclusion, already-diverged skip, pitch follows camp
// ===========================================================================
describe('CAM-673 (c) — buildPlan: excludes the demo camp, skips already-diverged rows, pitch follows camp', () => {
  it('[Critical, teeth] the CAM-663 demo camp and its pitches never appear in plan.rows', async () => {
    const prisma = makeFakePrisma(makeFixture());
    const plan = await buildPlan(prisma as any);

    expect(plan.rows.some((r) => r.nameThSlug === DEMO_CAMP_SLUG_TH)).toBe(false);
    expect(plan.skippedDemoCamp).toEqual({ campId: 'camp-demo', nameThSlug: DEMO_CAMP_SLUG_TH, spotCount: 2 });
  });

  it('[null/empty] skippedDemoCamp is null when the demo camp is not present on this target', async () => {
    const fixture = makeFixture();
    fixture.camps = fixture.camps.filter((c) => c.nameThSlug !== DEMO_CAMP_SLUG_TH);
    fixture.spots = fixture.spots.filter((s) => s.campSiteId !== 'camp-demo');
    const prisma = makeFakePrisma(fixture);
    const plan = await buildPlan(prisma as any);
    expect(plan.skippedDemoCamp).toBeNull();
  });

  it('[Critical, teeth] a camp already NOT PER_SITE (host/form choice) is left eligible=false and never scheduled for update', async () => {
    const prisma = makeFakePrisma(makeFixture());
    const plan = await buildPlan(prisma as any);
    const campD = plan.rows.find((r) => r.campId === 'camp-d')!;
    expect(campD.eligible).toBe(false);
    expect(campD.needsUpdate).toBe(false);
    expect(campD.targetUnit).toBe('PER_PERSON'); // its own current value, unchanged
  });

  it('[Critical, teeth] a still-default spot under an already-diverged camp follows that camp\'s effective unit', async () => {
    const prisma = makeFakePrisma(makeFixture());
    const plan = await buildPlan(prisma as any);
    const campD = plan.rows.find((r) => r.campId === 'camp-d')!;
    const spotD1 = campD.spots.find((s: any) => s.id === 'spot-d1')!;
    expect(spotD1.eligible).toBe(true);
    expect(spotD1.targetUnit).toBe('PER_PERSON'); // camp-d's effective unit
    expect(spotD1.needsUpdate).toBe(true); // was PER_SITE, camp says PER_PERSON
  });

  it('[Critical, teeth] a host-set per-spot override is left eligible=false and never scheduled for update', async () => {
    const prisma = makeFakePrisma(makeFixture());
    const plan = await buildPlan(prisma as any);
    const campA = plan.rows.find((r) => r.campId === 'camp-a')!;
    const overrideSpot = campA.spots.find((s: any) => s.id === 'spot-a3')!;
    expect(overrideSpot.eligible).toBe(false);
    expect(overrideSpot.needsUpdate).toBe(false);
  });

  it('[boundary] soft-deleted camps and soft-deleted spots are never considered', async () => {
    const prisma = makeFakePrisma(makeFixture());
    const plan = await buildPlan(prisma as any);
    expect(plan.rows.some((r) => r.campId === 'camp-e')).toBe(false);
    const campA = plan.rows.find((r) => r.campId === 'camp-a')!;
    expect(campA.spots.some((s: any) => s.id === 'spot-a4')).toBe(false);
  });

  it('[concurrent/ordering, teeth] calling buildPlan twice with no write in between returns an identical plan', async () => {
    const prisma = makeFakePrisma(makeFixture());
    const planA = await buildPlan(prisma as any);
    const planB = await buildPlan(prisma as any);
    expect(summarizePlan(planA)).toEqual(summarizePlan(planB));
  });
});

// ===========================================================================
// (d) applyPlan — writes only needs-update rows, idempotent on re-apply,
// records exactly what it touched into the manifest.
// ===========================================================================
describe('CAM-673 (d) — applyPlan: writes only eligible+changed rows, second apply is a no-op', () => {
  let manifestFile: string;
  afterEach(() => {
    try {
      unlinkSync(manifestFile);
    } catch {
      // fine — some tests never write it
    }
  });

  it('[normal, teeth] updates exactly the eligible camps/pitches and leaves everything else untouched', async () => {
    manifestFile = makeTestManifestPath();
    const fixture = makeFixture();
    const prisma = makeFakePrisma(fixture);
    const plan = await buildPlan(prisma as any);

    const result = await applyPlan(prisma as any, plan, { manifestFile });
    const expectedCamps = plan.rows.filter((r) => r.needsUpdate).length;
    const expectedSpots = plan.rows.flatMap((r) => r.spots).filter((s: any) => s.needsUpdate).length;
    expect(result.campsUpdated).toBe(expectedCamps);
    expect(result.spotsUpdated).toBe(expectedSpots);

    // demo camp completely untouched
    const demoCamp = prisma._store.camps.find((c) => c.id === 'camp-demo')!;
    expect(demoCamp.priceUnit).toBe('PER_SITE');
    const demoSpot2 = prisma._store.spots.find((s) => s.id === 'spot-demo-2')!;
    expect(demoSpot2.priceUnit).toBe('PER_PERSON'); // unchanged

    // host override untouched
    expect(prisma._store.spots.find((s) => s.id === 'spot-a3')!.priceUnit).toBe('PER_PERSON');
    // already-diverged camp untouched
    expect(prisma._store.camps.find((c) => c.id === 'camp-d')!.priceUnit).toBe('PER_PERSON');
    // still-default spot under camp-d now follows camp-d
    expect(prisma._store.spots.find((s) => s.id === 'spot-d1')!.priceUnit).toBe('PER_PERSON');
  });

  it('[concurrent/ordering, teeth] a SECOND apply on the same state updates ZERO rows', async () => {
    manifestFile = makeTestManifestPath();
    const prisma = makeFakePrisma(makeFixture());
    const plan1 = await buildPlan(prisma as any);
    await applyPlan(prisma as any, plan1, { manifestFile });

    const plan2 = await buildPlan(prisma as any);
    const second = await applyPlan(prisma as any, plan2, { manifestFile });
    expect(second.campsUpdated).toBe(0);
    expect(second.spotsUpdated).toBe(0);
  });

  it('[normal, teeth] records exactly the touched ids into the manifest (merged with anything already there)', async () => {
    manifestFile = makeTestManifestPath();
    saveManifest({ campIds: ['pre-existing-camp'], spotIds: [] }, manifestFile);

    const prisma = makeFakePrisma(makeFixture());
    const plan = await buildPlan(prisma as any);
    const expectedTouchedCampIds = plan.rows.filter((r: any) => r.needsUpdate).map((r: any) => r.campId);
    await applyPlan(prisma as any, plan, { manifestFile });

    const manifest = loadManifest(manifestFile);
    // Only rows that actually NEEDED an update land in the manifest — an
    // eligible row whose hash target happens to already equal PER_SITE
    // (a legitimate member of the ~5% bucket) is untouched and correctly
    // absent, exactly like a row that was never eligible at all.
    expect(manifest.campIds).toEqual(expect.arrayContaining(['pre-existing-camp', ...expectedTouchedCampIds]));
    expect(manifest.campIds).not.toContain('camp-d'); // never eligible, never written
    expect(manifest.campIds).not.toContain('camp-demo'); // excluded entirely
    expect(manifest.spotIds).toEqual(expect.arrayContaining(['spot-d1']));
    expect(manifest.spotIds).not.toContain('spot-a3'); // host override, never written
  });
});

// ===========================================================================
// (e) undoPlan — restores exactly what apply changed, back to PER_SITE, via
// the manifest (never a live-DB re-scan — see the script's own docstring for
// the Prove-It bug this design fixes).
// ===========================================================================
describe('CAM-673 (e) — undoPlan: reverts exactly the manifested rows to PER_SITE, never an already-diverged row', () => {
  let manifestFile: string;
  afterEach(() => {
    try {
      unlinkSync(manifestFile);
    } catch {
      // fine
    }
  });

  it('[normal, teeth] apply then undo restores every touched row to PER_SITE', async () => {
    manifestFile = makeTestManifestPath();
    const prisma = makeFakePrisma(makeFixture());
    const plan1 = await buildPlan(prisma as any);
    await applyPlan(prisma as any, plan1, { manifestFile });

    const removed = await undoPlan(prisma as any, { manifestFile });
    expect(removed.campsReverted).toBeGreaterThan(0);
    expect(removed.spotsReverted).toBeGreaterThan(0);

    expect(prisma._store.camps.find((c) => c.id === 'camp-a')!.priceUnit).toBe('PER_SITE');
    expect(prisma._store.camps.find((c) => c.id === 'camp-b')!.priceUnit).toBe('PER_SITE');
    expect(prisma._store.camps.find((c) => c.id === 'camp-c')!.priceUnit).toBe('PER_SITE');
  });

  it('[Critical, teeth] undo NEVER reverts a row apply did not touch — an already-diverged host choice survives', async () => {
    manifestFile = makeTestManifestPath();
    const prisma = makeFakePrisma(makeFixture());
    const plan1 = await buildPlan(prisma as any);
    await applyPlan(prisma as any, plan1, { manifestFile });

    await undoPlan(prisma as any, { manifestFile });

    // camp-d and spot-a3 were NEVER in the manifest (apply never touched them) —
    // this is the exact bug a Prove-It test caught in an earlier draft that
    // reverted "anything not PER_SITE" instead of "what apply recorded".
    expect(prisma._store.spots.find((s) => s.id === 'spot-a3')!.priceUnit).toBe('PER_PERSON');
    expect(prisma._store.camps.find((c) => c.id === 'camp-d')!.priceUnit).toBe('PER_PERSON');
  });

  it('[concurrent/ordering, teeth] a SECOND undo on an already-reverted state reverts ZERO rows (manifest cleared)', async () => {
    manifestFile = makeTestManifestPath();
    const prisma = makeFakePrisma(makeFixture());
    const plan1 = await buildPlan(prisma as any);
    await applyPlan(prisma as any, plan1, { manifestFile });

    await undoPlan(prisma as any, { manifestFile });
    const second = await undoPlan(prisma as any, { manifestFile });
    expect(second.campsReverted).toBe(0);
    expect(second.spotsReverted).toBe(0);
  });

  it('[Critical, teeth] undo with no prior apply (empty/missing manifest) is a no-op', async () => {
    manifestFile = makeTestManifestPath();
    const prisma = makeFakePrisma(makeFixture());
    const removed = await undoPlan(prisma as any, { manifestFile });
    expect(removed.campsReverted).toBe(0);
    expect(removed.spotsReverted).toBe(0);
  });

  it('[null/empty] an id recorded in the manifest that no longer exists in the DB is skipped gracefully', async () => {
    manifestFile = makeTestManifestPath();
    saveManifest({ campIds: ['does-not-exist'], spotIds: ['also-missing'] }, manifestFile);
    const prisma = makeFakePrisma(makeFixture());
    const removed = await undoPlan(prisma as any, { manifestFile });
    expect(removed.campsReverted).toBe(0);
    expect(removed.spotsReverted).toBe(0);
  });
});

// ===========================================================================
// (h) manifest — loadManifest / saveManifest, pure file I/O helpers
// ===========================================================================
describe('CAM-673 (h) — manifest: load/save round trip, tolerant of a missing/corrupt file', () => {
  let manifestFile: string;
  afterEach(() => {
    try {
      unlinkSync(manifestFile);
    } catch {
      // fine
    }
  });

  it('[null/empty] loadManifest on a non-existent file returns an empty manifest', () => {
    manifestFile = makeTestManifestPath(); // never written
    expect(loadManifest(manifestFile)).toEqual({ campIds: [], spotIds: [] });
  });

  it('[normal] save then load round-trips exactly', () => {
    manifestFile = makeTestManifestPath();
    saveManifest({ campIds: ['c1', 'c2'], spotIds: ['s1'] }, manifestFile);
    expect(loadManifest(manifestFile)).toEqual({ campIds: ['c1', 'c2'], spotIds: ['s1'] });
  });

  it('[error/validation] a corrupt manifest file is treated as empty, never thrown', () => {
    manifestFile = makeTestManifestPath();
    writeFileSync(manifestFile, '{not valid json', 'utf8');
    expect(loadManifest(manifestFile)).toEqual({ campIds: [], spotIds: [] });
  });
});

// ===========================================================================
// (f) summarizePlan / printPlan — the report the owner reads
// ===========================================================================
describe('CAM-673 (f) — summarizePlan: percentages + skip accounting', () => {
  it('[normal] percentages are computed against the considered population, excluding the demo camp', async () => {
    const prisma = makeFakePrisma(makeFixture());
    const plan = await buildPlan(prisma as any);
    const s = summarizePlan(plan);

    expect(s.totalCamps).toBe(4); // camp-a, camp-b, camp-c, camp-d (camp-e soft-deleted, camp-demo excluded)
    expect(s.resultPerPersonCamps + s.resultPerSiteCamps).toBe(s.totalCamps);
    expect(Number(s.resultPerPersonCampsPct) + Number(s.resultPerSiteCampsPct)).toBeCloseTo(100, 1);
    expect(s.skippedDemoCamp).toEqual({ campId: 'camp-demo', nameThSlug: DEMO_CAMP_SLUG_TH, spotCount: 2 });
  });

  it('[boundary] an empty target (no camps at all) reports 0.0% without dividing by zero', () => {
    const s = summarizePlan({ rows: [], skippedDemoCamp: null });
    expect(s.resultPerPersonCampsPct).toBe('0.0');
    expect(s.resultPerSiteCampsPct).toBe('0.0');
    expect(s.totalCamps).toBe(0);
  });
});

// ===========================================================================
// (g) parseArgs — CLI parsing
// ===========================================================================
describe('CAM-673 (g) — parseArgs: default dry-run, explicit --apply/--undo', () => {
  it('[normal] no flags = dry run by default', () => {
    expect(parseArgs([])).toEqual({ apply: false, undo: false, dryRun: true });
  });

  it('[normal] --dry-run explicitly is still dry run', () => {
    expect(parseArgs(['--dry-run'])).toMatchObject({ dryRun: true, apply: false });
  });

  it('[normal] --apply switches to write mode', () => {
    expect(parseArgs(['--apply'])).toEqual({ apply: true, undo: false, dryRun: false });
  });

  it('[normal] --undo switches to undo mode', () => {
    expect(parseArgs(['--undo'])).toEqual({ apply: false, undo: true, dryRun: false });
  });
});
