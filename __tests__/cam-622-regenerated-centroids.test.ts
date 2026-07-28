/**
 * CAM-622 — regenerate `prisma/data/province-centroids.json` from the
 * current dev DB via the existing, unmodified `scripts/build-province-
 * centroids.mjs` (CAM-620's drift check found 38 of 77 committed provinces
 * had drifted 5.1km-20.2km from the live camp distribution; 0 added/removed —
 * see this story's PR body for the full before/after and behavioral
 * verification of `lib/ai/tools/search-campsites.ts`'s near-path, read-only
 * reference, never touched by this story).
 *
 * This story touches ONLY the committed data file — neither
 * `scripts/build-province-centroids.mjs` nor `scripts/check-province-
 * centroid-drift.mjs` (CAM-620) is modified, so these tests reuse that
 * check's own, already-exported, pure `computeCentroidDrift` read-only
 * (never re-derives the diff math) to prove two things about the
 * REGENERATED file:
 *   1. it is self-consistent (diffed against itself -> 0 drift) — the same
 *      invariant CAM-620's own test (`cam-620-province-centroid-drift.test.ts`)
 *      already asserts against the file as it stood at CAM-620 authoring
 *      time; re-run here because THIS story is the one that actually
 *      changed the file's content, so it must hold on the NEW content too.
 *   2. no province present before this story's regeneration is missing
 *      after it — the ticket's own named failure mode: "a province that
 *      drops below the minimum camp count silently loses proximity
 *      behaviour entirely, with no error."
 *
 * Pure, DB-free (mirrors CAM-620's own test convention): the committed JSON
 * is imported directly as data; no PrismaClient, no network.
 */
import { describe, it, expect } from 'vitest';
import regeneratedCentroids from '@/prisma/data/province-centroids.json';
import { computeCentroidDrift } from '../scripts/check-province-centroid-drift.mjs';

type CentroidEntry = { lat: number; lng: number; campCount: number };

// The exact 77-province key set committed BEFORE this story's regeneration
// (captured at authoring time from the pre-regeneration file) — frozen as a
// regression net: if a FUTURE regeneration silently drops one of these (the
// ticket's own "no error, just gone" failure mode), this test goes red
// instead of the loss going unnoticed.
const PROVINCES_BEFORE_CAM_622 = [
  'Amnat Charoen',
  'Ang Thong',
  'Bangkok',
  'Bueng Kan',
  'Buri Ram',
  'Chachoengsao',
  'Chai Nat',
  'Chaiyaphum',
  'Chanthaburi',
  'Chiang Mai',
  'Chiang Rai',
  'Chon Buri',
  'Chumphon',
  'Kalasin',
  'Kamphaeng Phet',
  'Kanchanaburi',
  'Khon Kaen',
  'Krabi',
  'Lampang',
  'Lamphun',
  'Loei',
  'Lop Buri',
  'Mae Hong Son',
  'Maha Sarakham',
  'Mukdahan',
  'Nakhon Nayok',
  'Nakhon Pathom',
  'Nakhon Phanom',
  'Nakhon Ratchasima',
  'Nakhon Sawan',
  'Nakhon Si Thammarat',
  'Nan',
  'Narathiwat',
  'Nong Bua Lam Phu',
  'Nong Khai',
  'Nonthaburi',
  'Pathum Thani',
  'Pattani',
  'Phang Nga',
  'Phatthalung',
  'Phayao',
  'Phetchabun',
  'Phetchaburi',
  'Phichit',
  'Phitsanulok',
  'Phra Nakhon Si Ayutthaya',
  'Phrae',
  'Phuket',
  'Prachin Buri',
  'Prachuap Khiri Khan',
  'Ranong',
  'Ratchaburi',
  'Rayong',
  'Roi Et',
  'Sa Kaeo',
  'Sakon Nakhon',
  'Samut Prakan',
  'Samut Sakhon',
  'Samut Songkhram',
  'Saraburi',
  'Satun',
  'Si Sa Ket',
  'Sing Buri',
  'Songkhla',
  'Sukhothai',
  'Suphan Buri',
  'Surat Thani',
  'Surin',
  'Tak',
  'Trang',
  'Trat',
  'Ubon Ratchathani',
  'Udon Thani',
  'Uthai Thani',
  'Uttaradit',
  'Yala',
  'Yasothon',
];

describe('CAM-622 — regenerated province-centroids.json: no province silently lost its centroid', () => {
  it('[real data] no province present before this regeneration is missing after it', () => {
    const after = Object.keys(regeneratedCentroids).sort((a, b) => a.localeCompare(b));
    const missing = PROVINCES_BEFORE_CAM_622.filter((p) => !after.includes(p));
    expect(missing).toEqual([]);
  });

  it('[real data] exactly the same 77 provinces as before — no key silently appeared either', () => {
    const after = Object.keys(regeneratedCentroids).sort((a, b) => a.localeCompare(b));
    expect(after).toEqual(PROVINCES_BEFORE_CAM_622);
  });

  it('[real data] the regenerated file is self-consistent (0 added/removed/shifted against itself)', () => {
    const real = regeneratedCentroids as Record<string, CentroidEntry>;
    const { added, removed, shifted } = computeCentroidDrift(real, real);
    expect(added).toEqual([]);
    expect(removed).toEqual([]);
    expect(shifted).toEqual([]);
  });
});

describe('CAM-622 — the three most-shifted provinces (measured by CAM-620) actually moved, not a no-op regen', () => {
  // The pre-regeneration committed values for the top 3 by distance in
  // CAM-620's real drift-check run (Nakhon Phanom 20.2km, Prachin Buri
  // 19.5km, Phang Nga 19.1km) — captured at authoring time, before this
  // story overwrote the file. Pinned here so the NEW committed value is
  // provably different from the stale one it replaced.
  const OLD_VALUES_BEFORE_CAM_622: Record<string, { lat: number; lng: number }> = {
    'Nakhon Phanom': { lat: 17.378983, lng: 104.8013 },
    'Prachin Buri': { lat: 14.156225, lng: 101.355625 },
    'Phang Nga': { lat: 8.3096, lng: 98.5004 },
  };

  it.each(Object.keys(OLD_VALUES_BEFORE_CAM_622))(
    '[real data] %s moved from its pre-regeneration committed value',
    (province) => {
      const real = regeneratedCentroids as Record<string, CentroidEntry>;
      const old = OLD_VALUES_BEFORE_CAM_622[province];
      const now = real[province];
      expect(now, `${province} must still have a committed centroid`).toBeDefined();
      const moved = Math.abs(now.lat - old.lat) > 0.0001 || Math.abs(now.lng - old.lng) > 0.0001;
      expect(moved, `${province} centroid should differ from its stale pre-CAM-622 value`).toBe(true);
    }
  );
});
