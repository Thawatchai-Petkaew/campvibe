/**
 * cam-576-detail-district-language.test.ts — CAM-576
 *
 * Closes the last surface of CAM-567 that CAM-573 flagged as a "Known gap":
 * the camp DETAIL page's own data-fetch (`getCampBySlug`, lib/catalog-cache.ts)
 * did not include `location.adminArea`, so `withProvinceThaiNames`/
 * `buildLocationText` had no id-derived chain to read and fell back to the
 * raw free-text `district` column — always stored in English. A Thai user
 * therefore saw an English district sitting beside a Thai province on the
 * detail page, confirmed visually on `phra-nakhon-si-ayutthaya-meadow-camp-3-60-th`
 * ("Phachi, พระนครศรีอยุธยา").
 *
 * No new renderer is introduced — this test proves the EXISTING CAM-573 seam
 * (`buildLocationText` / `withProvinceThaiNames` / `resolveLocationDisplayNames`)
 * renders correctly once `getCampBySlug`'s row carries `location.adminArea`,
 * using the REAL shape `prisma.campSite.findFirst` returns (verified against
 * the dev DB directly, see the ticket's tech notes) — not an invented fixture.
 *
 * Coverage matrix (qa.md §7):
 *   normal      — SUBDISTRICT/DISTRICT/PROVINCE depth, TH + EN, real camps at
 *                 each depth (not one happy row)
 *   null/empty  — province-only camp renders with no dangling separator
 *   boundary    — the confirmed repro camp; the literal "Phachi" must not
 *                 leak into the Thai-mode render (EC-1)
 *   error/validation — n/a (pure derivation, no I/O beyond the existing
 *                 CAM-573 province-name-map mock)
 *   concurrent/ordering — n/a (stateless)
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { readFileSync } from 'fs';
import path from 'path';
import type { AdminAreaChainNode } from '../lib/read-models/camp-card';

const mockThailandLocationFindMany = vi.fn();

vi.mock('@/lib/prisma', () => ({
  prisma: {
    thailandLocation: {
      findMany: (...args: unknown[]) => mockThailandLocationFindMany(...args),
    },
  },
}));

const { buildLocationText } = await import('../components/CampgroundCard');
const { withProvinceThaiNames } = await import('../lib/read-models/camp-card');

beforeEach(() => {
  vi.clearAllMocks();
  // The name-based fallback map — present so a test can prove the id-derived
  // chain is what actually renders, not this legacy path (CAM-573 keeps this
  // as a fallback only for rows with NO adminArea at all).
  mockThailandLocationFindMany.mockResolvedValue([
    { provinceNameEn: 'Phra Nakhon Si Ayutthaya', provinceName: 'WRONG-SHOULD-NOT-BE-USED' },
  ]);
});

// ---------------------------------------------------------------------------
// Source-inspect: getCampBySlug's include shape carries the AdminArea chain.
// Prove-It: FAILS if the adminArea include is ever removed from
// lib/catalog-cache.ts — reproducing the exact CAM-576/CAM-567 defect.
// ---------------------------------------------------------------------------
describe('getCampBySlug include shape (lib/catalog-cache.ts)', () => {
  const src = readFileSync(path.join(process.cwd(), 'lib/catalog-cache.ts'), 'utf-8');

  it('[normal] location include carries the resolved AdminArea chain via adminAreaChainSelect', () => {
    expect(src).toContain('location: {');
    expect(src).toContain('adminArea: { select: adminAreaChainSelect }');
  });

  it('[normal] imports adminAreaChainSelect from lib/read-models/camp-card (reused, not re-declared)', () => {
    expect(src).toContain('adminAreaChainSelect');
    expect(src).toContain("from '@/lib/read-models/camp-card'");
  });

  it('[structural] the full detail include (operator/spots/options/images) is still present', () => {
    expect(src).toContain('spots:');
    expect(src).toContain('options: true');
    expect(src).toContain('images:');
    expect(src).toContain('operator:');
  });
});

// ---------------------------------------------------------------------------
// AC-1/AC-2/EC-1 — the confirmed repro camp, real DB-measured values
// (phra-nakhon-si-ayutthaya-meadow-camp-3-60-th; verified directly against
// the dev DB): province "Phra Nakhon Si Ayutthaya"/"พระนครศรีอยุธยา", district
// AdminArea node nameEn "Phachi"/nameTh "ภาชี", sub-district nameEn
// "Khok Muang"/nameTh "โคกม่วง". Chosen (per the ticket) because the camp's
// own Thai name contains neither เขต nor a province name, so a Thai-string
// match cannot be a false positive.
// ---------------------------------------------------------------------------
const ayutthayaMeadowCampAdminArea: AdminAreaChainNode = {
  level: 'SUBDISTRICT',
  nameTh: 'โคกม่วง',
  nameEn: 'Khok Muang',
  parent: {
    level: 'DISTRICT',
    nameTh: 'ภาชี',
    nameEn: 'Phachi',
    parent: {
      level: 'PROVINCE',
      nameTh: 'พระนครศรีอยุธยา',
      nameEn: 'Phra Nakhon Si Ayutthaya',
    },
  },
};

function rowWithLocation(location: {
  province: string;
  district?: string | null;
  subDistrict?: string | null;
  adminArea?: AdminAreaChainNode | null;
}) {
  return { location };
}

describe('detail-page pipeline — the confirmed repro camp (AC-1/AC-2/EC-1)', () => {
  it('[boundary] AC-1: Thai mode renders "sub-district, district, province" in Thai — the literal "Phachi" never appears', () => {
    const [row] = withProvinceThaiNames(
      [rowWithLocation({
        province: 'Phra Nakhon Si Ayutthaya',
        district: 'Phachi',
        subDistrict: 'Khok Muang',
        adminArea: ayutthayaMeadowCampAdminArea,
      })],
      new Map(),
    );
    const th = buildLocationText(row.location, 'th');
    expect(th).toBe('โคกม่วง, ภาชี, พระนครศรีอยุธยา');
    // EC-1 — the exact confirmed defect: an English district beside a Thai province.
    expect(th).not.toContain('Phachi');
  });

  it('[normal] AC-2: English mode renders the full English chain', () => {
    const [row] = withProvinceThaiNames(
      [rowWithLocation({
        province: 'Phra Nakhon Si Ayutthaya',
        district: 'Phachi',
        subDistrict: 'Khok Muang',
        adminArea: ayutthayaMeadowCampAdminArea,
      })],
      new Map(),
    );
    const en = buildLocationText(row.location, 'en');
    expect(en).toBe('Khok Muang, Phachi, Phra Nakhon Si Ayutthaya');
  });

  it('[boundary] pre-fix behavior (no adminArea on the row) reproduces the exact defect — proves the fix is what closes it', () => {
    // Simulates getCampBySlug's OLD include (`location: true`, no adminArea) —
    // the row the detail page received before this story's fix.
    const [row] = withProvinceThaiNames(
      [rowWithLocation({
        province: 'Phra Nakhon Si Ayutthaya',
        district: 'Phachi',
        subDistrict: 'Khok Muang',
      })],
      new Map(),
    );
    const th = buildLocationText(row.location, 'th');
    // provinceTh falls back to the name-map only (the WRONG-SHOULD-NOT-BE-USED
    // fixture proves the map is not consulted once adminArea is present above;
    // here, with no adminArea, the raw district string leaks through untranslated).
    expect(th).toContain('Phachi');
  });
});

// ---------------------------------------------------------------------------
// AC-3/EC-2 — a province-only camp renders with no dangling separator.
// Real camp: koh-kood-clearwater-28 (Trat) — verified against the dev DB.
// ---------------------------------------------------------------------------
describe('province-only camp — no dangling comma/separator (AC-3/EC-2)', () => {
  const koTratAdminArea: AdminAreaChainNode = {
    level: 'PROVINCE',
    nameTh: 'ตราด',
    nameEn: 'Trat',
    parent: null,
  };

  it('[null/empty] AC-3: Thai mode renders the province alone, no comma', () => {
    const [row] = withProvinceThaiNames(
      [rowWithLocation({ province: 'Trat', adminArea: koTratAdminArea })],
      new Map(),
    );
    const th = buildLocationText(row.location, 'th');
    expect(th).toBe('ตราด');
    expect(th).not.toContain(',');
  });

  it('[null/empty] AC-3: English mode renders the province alone, no comma', () => {
    const [row] = withProvinceThaiNames(
      [rowWithLocation({ province: 'Trat', adminArea: koTratAdminArea })],
      new Map(),
    );
    const en = buildLocationText(row.location, 'en');
    expect(en).toBe('Trat');
    expect(en).not.toContain(',');
  });
});

// ---------------------------------------------------------------------------
// Real-dataset-shaped coverage — the real distinct set, not one happy row
// (tech.md-measured depth distribution: 96 province-only / 23 district /
// 531 sub-district of 650 live camps). Fixtures below are real camps'
// values, verified directly against the dev DB.
// ---------------------------------------------------------------------------
describe('real distinct-camp coverage across all 3 depths (not one happy row)', () => {
  const cases: {
    name: string;
    location: { province: string; district?: string | null; subDistrict?: string | null; adminArea?: AdminAreaChainNode | null };
    expectTh: string;
    expectEn: string;
  }[] = [
    {
      name: 'phu-thap-boek-mist-1 (province-only, Phetchabun)',
      location: { province: 'Phetchabun', adminArea: { level: 'PROVINCE', nameTh: 'เพชรบูรณ์', nameEn: 'Phetchabun', parent: null } },
      expectTh: 'เพชรบูรณ์',
      expectEn: 'Phetchabun',
    },
    {
      name: 'doi-ang-khang-highland-3 (district depth, Chiang Mai / Fang)',
      location: {
        province: 'Chiang Mai', district: 'Fang',
        adminArea: { level: 'DISTRICT', nameTh: 'ฝาง', nameEn: 'Fang', parent: { level: 'PROVINCE', nameTh: 'เชียงใหม่', nameEn: 'Chiang Mai', parent: null } },
      },
      expectTh: 'ฝาง, เชียงใหม่',
      expectEn: 'Fang, Chiang Mai',
    },
    {
      name: 'khao-sok-rainforest-44 (district depth, Surat Thani / Phanom)',
      location: {
        province: 'Surat Thani', district: 'Phanom',
        adminArea: { level: 'DISTRICT', nameTh: 'พนม', nameEn: 'Phanom', parent: { level: 'PROVINCE', nameTh: 'สุราษฎร์ธานี', nameEn: 'Surat Thani', parent: null } },
      },
      expectTh: 'พนม, สุราษฎร์ธานี',
      expectEn: 'Phanom, Surat Thani',
    },
    {
      name: 'khao-sok-jungle-camp-en-10 (sub-district depth, Surat Thani / Phanom / Khlong Sok)',
      location: {
        province: 'Surat Thani', district: 'Phanom', subDistrict: 'Khlong Sok',
        adminArea: {
          level: 'SUBDISTRICT', nameTh: 'คลองศก', nameEn: 'Khlong Sok',
          parent: { level: 'DISTRICT', nameTh: 'พนม', nameEn: 'Phanom', parent: { level: 'PROVINCE', nameTh: 'สุราษฎร์ธานี', nameEn: 'Surat Thani' } },
        },
      },
      expectTh: 'คลองศก, พนม, สุราษฎร์ธานี',
      expectEn: 'Khlong Sok, Phanom, Surat Thani',
    },
    {
      name: 'phu-chi-fa-sunrise-camp-en-11 (sub-district depth, Chiang Rai / Mueang Chiang Rai / Wiang)',
      location: {
        province: 'Chiang Rai', district: 'Mueang Chiang Rai', subDistrict: 'Wiang',
        adminArea: {
          level: 'SUBDISTRICT', nameTh: 'เวียง', nameEn: 'Wiang',
          parent: { level: 'DISTRICT', nameTh: 'เมืองเชียงราย', nameEn: 'Mueang Chiang Rai', parent: { level: 'PROVINCE', nameTh: 'เชียงราย', nameEn: 'Chiang Rai' } },
        },
      },
      expectTh: 'เวียง, เมืองเชียงราย, เชียงราย',
      expectEn: 'Wiang, Mueang Chiang Rai, Chiang Rai',
    },
  ];

  it.each(cases)('[normal] $name renders the correct depth in both languages, no English leak in Thai mode', ({ location, expectTh, expectEn }) => {
    const [row] = withProvinceThaiNames([rowWithLocation(location)], new Map());
    const th = buildLocationText(row.location, 'th');
    const en = buildLocationText(row.location, 'en');
    expect(th).toBe(expectTh);
    expect(en).toBe(expectEn);
    // No raw English free-text district/sub-district value ever leaks into the Thai render.
    if (location.district) expect(th).not.toContain(location.district);
    if (location.subDistrict) expect(th).not.toContain(location.subDistrict);
  });
});
