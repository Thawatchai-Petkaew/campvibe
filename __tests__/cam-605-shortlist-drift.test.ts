/**
 * CAM-605 — the sub-district shortlist (CAM-600) goes stale silently when a
 * camp opens in a tambon that was never added to
 * `prisma/data/subdistrict-shortlist.json`. This file proves
 * `scripts/check-subdistrict-shortlist-drift.mjs`'s pure diff/guard
 * functions actually detect that drift — and stay quiet when there is none
 * — using ONLY constructed, in-memory fixtures. No DATABASE_URL, no Prisma
 * connection, no file write: `computeDrift`/`survivesGuards`/
 * `isSubstringOfAnyProvince` are DB-free by construction (see the script's
 * own docblock + this story's tech.md "computeDrift — pure, exported,
 * tested with constructed fixtures"), so this suite runs identically in
 * CI's `quality-gate` (which has no DB service at all) and on a local
 * machine.
 *
 * Coverage matrix (story.md AC-1..4, BR-1..6, EC-1..4):
 *   - AC-1/EC-1  a guard-surviving name that exists live but not committed
 *                is named in `added` (the "MISSED" case — CAM-568's own
 *                "a check nobody has seen fail has not been proven to
 *                work" lesson: this is that proof, constructed on demand)
 *   - AC-2/EC-2  identical guard-surviving sets -> both `added`/`removed`
 *                empty (the check must not cry wolf on the common case)
 *   - AC-4/EC-4  a guard-EXCLUDED name (too short / ordinary vocabulary /
 *                substring-of-province) that differs between the two sides
 *                is NEVER reported — proves the diff accounts for CAM-600's
 *                own guards rather than reporting deliberate exclusions
 *   - BR-2       `survivesGuards`/`isSubstringOfAnyProvince` unit-level,
 *                boundary at the length floor (4 vs 5 Thai characters)
 *   - BR-1       the real, committed shortlist diffed against itself is
 *                quiet — proves the function works against the real fixture
 *                shape without requiring a DB
 *   - AC-3/EC-3/BR-3/BR-4 (main()'s no-DB / unreachable-DB SKIP path) are
 *                verified by source inspection below — `main()` itself
 *                calls `process.exit`, which a behavioral test would have
 *                to mock around for no additional proof; the SAME
 *                convention `__tests__/cam-369-db-reset-redaction.test.ts`
 *                already uses for `db-reset.mjs`'s own guard semantics.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import path from 'path';
import realShortlist from '@/prisma/data/subdistrict-shortlist.json';
import realThailandLocations from '@/prisma/data/thailand-locations.json';

const root = path.resolve(__dirname, '..');
function readSrc(rel: string) {
  return readFileSync(path.join(root, rel), 'utf-8');
}

const FAKE_PROVINCES = ['สระแก้ว', 'เชียงใหม่', 'ภูเก็ต'];

describe('CAM-605 check-subdistrict-shortlist-drift.mjs — source inspection', () => {
  const src = readSrc('scripts/check-subdistrict-shortlist-drift.mjs');

  it('must never write to the committed shortlist (read-only comparison)', () => {
    expect(src).not.toMatch(/writeFileSync/);
  });

  it('never constructs a PrismaClient when DATABASE_URL is unset (BR-3)', () => {
    // The `if (!url) { ...; process.exit(0); return; }` guard must appear
    // BEFORE `new PrismaClient()` in source order.
    const noUrlIdx = src.indexOf('if (!url)');
    const newClientIdx = src.indexOf('new PrismaClient()');
    expect(noUrlIdx).toBeGreaterThan(-1);
    expect(newClientIdx).toBeGreaterThan(-1);
    expect(noUrlIdx).toBeLessThan(newClientIdx);
  });

  it('the unreachable-DB path is caught and exits 0, never crashes the process (BR-4)', () => {
    expect(src).toMatch(/catch \(error\)/);
    const catchStart = src.indexOf('catch (error)');
    const catchEnd = src.indexOf('}\n  await prisma.$disconnect();', catchStart);
    expect(catchStart).toBeGreaterThan(-1);
    expect(catchEnd).toBeGreaterThan(catchStart);
    const catchBlock = src.slice(catchStart, catchEnd);
    expect(catchBlock).toContain('process.exit(0)');
  });

  it('a real difference is the ONLY path that exits 1 (BR-5)', () => {
    const exit1Count = (src.match(/process\.exit\(1\)/g) || []).length;
    expect(exit1Count).toBe(1);
  });

  it('imports the SAME raw-fact function the generator uses to write the file (BR-1) — never a second query', () => {
    expect(src).toContain("import { computeLiveShortlistEntries } from './generate-subdistrict-shortlist.mjs'");
    expect(src).not.toMatch(/prisma\.adminArea\.findMany/); // no re-derived query in THIS file
  });

  it('is guarded behind isMain so importing it for tests never runs main() (matches db-reset.mjs convention)', () => {
    expect(src).toContain('const isMain =');
    expect(src).toContain('if (isMain) {\n  main();\n}');
  });
});

describe('CAM-605 generate-subdistrict-shortlist.mjs — isMain guard (required by this story)', () => {
  it('main() no longer auto-runs on import (writeFileSync is not reachable at module-load time)', () => {
    const src = readSrc('scripts/generate-subdistrict-shortlist.mjs');
    expect(src).toContain('const isMain =');
    expect(src).toMatch(/if \(isMain\) \{\s*main\(\)\.catch/);
    // the bare `main().catch(...)` unconditional call this story replaced must be gone
    expect(src).not.toMatch(/^main\(\)\.catch/m);
  });

  it('exports computeLiveShortlistEntries for CAM-605 to reuse', () => {
    const src = readSrc('scripts/generate-subdistrict-shortlist.mjs');
    expect(src).toContain('export async function computeLiveShortlistEntries(prisma)');
  });
});

describe('CAM-605 isSubstringOfAnyProvince / survivesGuards — unit', () => {
  it('[unit] exact match and substring both count as "is a province name"', async () => {
    const mod = await import('../scripts/check-subdistrict-shortlist-drift.mjs');
    expect(mod.isSubstringOfAnyProvince('สระแก้ว', FAKE_PROVINCES)).toBe(true); // exact
    expect(mod.isSubstringOfAnyProvince('เชียงใหม่', FAKE_PROVINCES)).toBe(true);
    expect(mod.isSubstringOfAnyProvince('ไม่มีจริง', FAKE_PROVINCES)).toBe(false);
  });

  it('[boundary] length floor: shorter than 5 Thai characters is excluded, 5+ survives', async () => {
    const mod = await import('../scripts/check-subdistrict-shortlist-drift.mjs');
    expect(mod.MIN_SUBDISTRICT_NAME_LENGTH).toBe(5);

    const belowFloor = 'บ่อ'; // real CAM-600-named risk word
    expect(belowFloor.length).toBeLessThan(5); // confirms THIS fixture is actually below the floor
    expect(mod.survivesGuards(belowFloor, [])).toBe(false);

    const atOrAboveFloor = 'แสนสุข'; // ordinary tambon name, not in the skip-set
    expect(atOrAboveFloor.length).toBeGreaterThanOrEqual(5);
    expect(mod.survivesGuards(atOrAboveFloor, [])).toBe(true);
  });

  it('[unit] the curated ordinary-vocabulary skip-set excludes เหนือ/สะอาด/สำราญ even though each is >=5 chars', async () => {
    const mod = await import('../scripts/check-subdistrict-shortlist-drift.mjs');
    expect(mod.AMBIGUOUS_SUBDISTRICT_VOCAB_TH.has('เหนือ')).toBe(true);
    expect(mod.survivesGuards('เหนือ', [])).toBe(false);
    expect(mod.survivesGuards('สะอาด', [])).toBe(false);
    expect(mod.survivesGuards('สำราญ', [])).toBe(false);
  });

  it('[unit] a substring-of-province name is excluded even above the length floor', async () => {
    const mod = await import('../scripts/check-subdistrict-shortlist-drift.mjs');
    expect(mod.survivesGuards('สระแก้ว', FAKE_PROVINCES)).toBe(false);
  });

  it('[unit] a plausible, ordinary sub-district name survives all three guards', async () => {
    const mod = await import('../scripts/check-subdistrict-shortlist-drift.mjs');
    expect(mod.survivesGuards('แสนสุข', FAKE_PROVINCES)).toBe(true);
  });
});

describe('CAM-605 computeDrift — the check proven to fail on demand, and to stay quiet (AC-1/AC-2/AC-4)', () => {
  it('[AC-1/EC-1] names a guard-surviving sub-district that a NEW camp opened in but the committed file lacks', async () => {
    const mod = await import('../scripts/check-subdistrict-shortlist-drift.mjs');
    const committed = [{ nameTh: 'แสนสุข', districtNameTh: 'เมืองชลบุรี', provinceNameTh: 'ชลบุรี' }];
    const live = [
      { nameTh: 'แสนสุข', districtNameTh: 'เมืองชลบุรี', provinceNameTh: 'ชลบุรี' },
      { nameTh: 'บ้านใหม่พัฒนา', districtNameTh: 'เมืองเชียงใหม่', provinceNameTh: 'เชียงใหม่' }, // NEW camp, new tambon
    ];
    const { added, removed } = mod.computeDrift(committed, live, FAKE_PROVINCES);
    expect(added).toEqual(['บ้านใหม่พัฒนา']);
    expect(removed).toEqual([]);
  });

  it('[AC-2/EC-2] reports 0 drift when the committed and live guard-surviving sets are identical', async () => {
    const mod = await import('../scripts/check-subdistrict-shortlist-drift.mjs');
    const entries = [
      { nameTh: 'แสนสุข', districtNameTh: 'เมืองชลบุรี', provinceNameTh: 'ชลบุรี' },
      { nameTh: 'อ่าวนาง', districtNameTh: 'เมืองกระบี่', provinceNameTh: 'กระบี่' },
    ];
    const { added, removed } = mod.computeDrift(entries, entries, FAKE_PROVINCES);
    expect(added).toEqual([]);
    expect(removed).toEqual([]);
  });

  it('names a sub-district that no longer holds a camp (removed, the STALE case)', async () => {
    const mod = await import('../scripts/check-subdistrict-shortlist-drift.mjs');
    const committed = [
      { nameTh: 'แสนสุข', districtNameTh: 'เมืองชลบุรี', provinceNameTh: 'ชลบุรี' },
      { nameTh: 'อ่าวนาง', districtNameTh: 'เมืองกระบี่', provinceNameTh: 'กระบี่' },
    ];
    const live = [{ nameTh: 'แสนสุข', districtNameTh: 'เมืองชลบุรี', provinceNameTh: 'ชลบุรี' }];
    const { added, removed } = mod.computeDrift(committed, live, FAKE_PROVINCES);
    expect(added).toEqual([]);
    expect(removed).toEqual(['อ่าวนาง']);
  });

  it('[AC-4/EC-4] a live-only name excluded by the length floor is NEVER reported as drift', async () => {
    const mod = await import('../scripts/check-subdistrict-shortlist-drift.mjs');
    const committed: Array<{ nameTh: string }> = [];
    const live = [{ nameTh: 'บ่อ', districtNameTh: 'x', provinceNameTh: 'y' }]; // 3 chars — excluded, not "drift"
    const { added, removed } = mod.computeDrift(committed, live, FAKE_PROVINCES);
    expect(added).toEqual([]);
    expect(removed).toEqual([]);
  });

  it('[AC-4/EC-4] a live-only name excluded by the ordinary-vocabulary skip-set is NEVER reported as drift', async () => {
    const mod = await import('../scripts/check-subdistrict-shortlist-drift.mjs');
    const committed: Array<{ nameTh: string }> = [];
    const live = [{ nameTh: 'เหนือ', districtNameTh: 'x', provinceNameTh: 'y' }]; // real Kalasin tambon, curated skip-set
    const { added, removed } = mod.computeDrift(committed, live, FAKE_PROVINCES);
    expect(added).toEqual([]);
    expect(removed).toEqual([]);
  });

  it('[AC-4/EC-4] a live-only name that is a substring of a province is NEVER reported as drift', async () => {
    const mod = await import('../scripts/check-subdistrict-shortlist-drift.mjs');
    const committed: Array<{ nameTh: string }> = [];
    const live = [{ nameTh: 'สระแก้ว', districtNameTh: 'x', provinceNameTh: 'y' }];
    const { added, removed } = mod.computeDrift(committed, live, FAKE_PROVINCES);
    expect(added).toEqual([]);
    expect(removed).toEqual([]);
  });

  it('[real data] the real committed shortlist diffed against itself is quiet (proves the shape works, no DB needed)', async () => {
    const mod = await import('../scripts/check-subdistrict-shortlist-drift.mjs');
    const provinceNamesTh = (realThailandLocations as Array<{ nameTh: string }>).map((p) => p.nameTh);
    const { added, removed } = mod.computeDrift(realShortlist as Array<{ nameTh: string }>, realShortlist as Array<{ nameTh: string }>, provinceNamesTh);
    expect(added).toEqual([]);
    expect(removed).toEqual([]);
  });
});
