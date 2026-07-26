/**
 * CAM-553 — `prisma/data/thailand-locations.json` full-hierarchy completeness.
 *
 * Measured gap (verified on the dev DB before this story): province 77/77,
 * district 29 real (+77 province-only placeholders), sub-district 0 (no
 * column). Source: kongvut/thai-province-data (MIT), data/raw/{provinces,
 * districts,sub_districts}.json, dataset v2.0.0 (CHANGELOG.md, 2025-09-20),
 * downloaded 2026-07-26 — see story.md for the full citation + the 2 RTGS
 * spelling overrides applied (Lop Buri / Phang Nga, kept two-word to match
 * the pinned CAM-458 province-spelling regression test).
 *
 * Coverage matrix (qa.md §7):
 *   normal      — full counts present (77 provinces, ~930 districts, ~7452
 *                 sub-districts); every district has ≥1 sub-district
 *   boundary    — spot-check Bangkok/Khet Phra Nakhon's 12 sub-districts
 *   error/regression — codes are unique + prefix-consistent at every level
 *                 (province code is a 2-digit prefix of its districts'
 *                 4-digit codes, which are in turn a prefix of their
 *                 sub-districts' 6-digit codes) — this is the exact
 *                 "official code" shape CAM-553's Location/AdminArea linkage
 *                 depends on.
 */
import { describe, it, expect } from 'vitest';
import thailandLocations from '@/prisma/data/thailand-locations.json';

interface SubDistrictEntry { code: string; nameTh: string; nameEn: string }
interface DistrictEntry { code: string; nameTh: string; nameEn: string; subDistricts: SubDistrictEntry[] }
interface ProvinceEntry { id: number; code: string; nameTh: string; nameEn: string; districts: DistrictEntry[] }

const provinces = thailandLocations as ProvinceEntry[];
const allDistricts = provinces.flatMap((p) => p.districts);
const allSubDistricts = allDistricts.flatMap((d) => d.subDistricts);

describe('thailand-locations.json — full hierarchy counts (CAM-553 normal)', () => {
  it('[normal] exactly 77 provinces (unchanged from CAM-458)', () => {
    expect(provinces).toHaveLength(77);
  });

  it('[normal] district count is complete for Thailand (~928, measured gap was 29)', () => {
    expect(allDistricts.length).toBeGreaterThanOrEqual(900);
    expect(allDistricts.length).toBeLessThanOrEqual(960);
  });

  it('[normal] sub-district count is complete for Thailand (~7,255, measured gap was 0)', () => {
    expect(allSubDistricts.length).toBeGreaterThanOrEqual(7200);
    expect(allSubDistricts.length).toBeLessThanOrEqual(7600);
  });

  it('[normal] every province has at least one district', () => {
    for (const p of provinces) expect(p.districts.length).toBeGreaterThan(0);
  });

  /**
   * The upstream source (kongvut/thai-province-data) carries exactly 2
   * "ท้องถิ่นเทศบาลตำบล..." (local sub-district-municipality) pseudo-district
   * rows with no further tambon breakdown listed (7074 Ban Khong, Ratchaburi;
   * 9077 Sam Nak Kham, Songkhla) — a documented upstream quirk, not a
   * transform bug (verified against the raw `districts.json`/`sub_districts.
   * json` source). Pinning the exact count + codes means a REAL regression
   * (many districts losing their tambon) still fails this test, while these
   * 2 known rows don't.
   */
  it('[regression] exactly the 2 known upstream districts have no listed sub-district (not a transform bug)', () => {
    const empty = allDistricts.filter((d) => d.subDistricts.length === 0).map((d) => d.code).sort();
    expect(empty).toEqual(['7074', '9077']);
  });
});

describe('thailand-locations.json — official code shape + uniqueness (CAM-553 boundary/regression)', () => {
  it('[boundary] every province code is a 2-digit numeric string', () => {
    for (const p of provinces) expect(p.code).toMatch(/^\d{2}$/);
  });

  it('[boundary] every district code is 4 digits and prefixed by its own province code', () => {
    for (const p of provinces) {
      for (const d of p.districts) {
        expect(d.code).toMatch(/^\d{4}$/);
        expect(d.code.slice(0, 2)).toBe(p.code);
      }
    }
  });

  it('[boundary] every sub-district code is 6 digits and prefixed by its own district code', () => {
    for (const p of provinces) {
      for (const d of p.districts) {
        for (const s of d.subDistricts) {
          expect(s.code).toMatch(/^\d{6}$/);
          expect(s.code.slice(0, 4)).toBe(d.code);
        }
      }
    }
  });

  it('[regression] every district code is globally unique across all 77 provinces', () => {
    const codes = allDistricts.map((d) => d.code);
    expect(new Set(codes).size).toBe(codes.length);
  });

  it('[regression] every sub-district code is globally unique across all districts', () => {
    const codes = allSubDistricts.map((s) => s.code);
    expect(new Set(codes).size).toBe(codes.length);
  });

  it('[regression] every district and sub-district has non-empty Thai and English names', () => {
    for (const d of allDistricts) {
      expect(d.nameTh.length).toBeGreaterThan(0);
      expect(d.nameEn.length).toBeGreaterThan(0);
    }
    for (const s of allSubDistricts) {
      expect(s.nameTh.length).toBeGreaterThan(0);
      expect(s.nameEn.length).toBeGreaterThan(0);
    }
  });
});

describe('thailand-locations.json — spot check (CAM-553 boundary normal)', () => {
  it('[normal] Bangkok / Khet Phra Nakhon (code 1001) has its real 12 sub-districts', () => {
    const bangkok = provinces.find((p) => p.code === '10');
    expect(bangkok).toBeDefined();
    const phraNakhon = bangkok!.districts.find((d) => d.code === '1001');
    expect(phraNakhon).toBeDefined();
    expect(phraNakhon!.nameTh).toBe('เขตพระนคร');
    expect(phraNakhon!.subDistricts).toHaveLength(12);
    expect(phraNakhon!.subDistricts.map((s) => s.code)).toContain('100101');
  });
});
