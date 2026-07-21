/**
 * CAM-458 — `prisma/data/thailand-locations.json` completeness (BR-1/D3).
 * Pure JSON assertions, no DB / no mock — this is what actually proves the
 * seed DATA is complete, since a mocked resolver test (cam-458-province-resolve)
 * cannot see the real file contents.
 *
 * Coverage matrix:
 *   - normal: exactly 77 province-level entries; every entry has non-empty
 *     nameTh + nameEn and a `districts` array.
 *   - boundary: unique provinceCode across all 77; unique Thai names; unique
 *     English names (no duplicate/collision from the 65 newly-added rows).
 *   - normal: spot-check Bangkok (code 10) and Bueng Kan (code 38).
 *   - regression: none of the original 12 seeded rows (code + names) was
 *     lost or altered by the 65-row addition.
 */
import { describe, it, expect } from 'vitest';
import thailandLocations from '@/prisma/data/thailand-locations.json';

interface ProvinceEntry {
  id: number;
  code: string;
  nameTh: string;
  nameEn: string;
  districts: Array<{ code: string; nameTh: string; nameEn: string }>;
}

const provinces = thailandLocations as ProvinceEntry[];

/** The original 12 seeded rows (pre-CAM-458) — must survive the 65-row addition unchanged. */
const ORIGINAL_12: Array<{ code: string; nameTh: string; nameEn: string }> = [
  { code: '10', nameTh: 'กรุงเทพมหานคร', nameEn: 'Bangkok' },
  { code: '11', nameTh: 'สมุทรปราการ', nameEn: 'Samut Prakan' },
  { code: '30', nameTh: 'นครราชสีมา', nameEn: 'Nakhon Ratchasima' },
  { code: '50', nameTh: 'เชียงใหม่', nameEn: 'Chiang Mai' },
  { code: '57', nameTh: 'เชียงราย', nameEn: 'Chiang Rai' },
  { code: '58', nameTh: 'แม่ฮ่องสอน', nameEn: 'Mae Hong Son' },
  { code: '67', nameTh: 'เพชรบูรณ์', nameEn: 'Phetchabun' },
  { code: '42', nameTh: 'เลย', nameEn: 'Loei' },
  { code: '81', nameTh: 'กระบี่', nameEn: 'Krabi' },
  { code: '83', nameTh: 'ภูเก็ต', nameEn: 'Phuket' },
  { code: '84', nameTh: 'สุราษฎร์ธานี', nameEn: 'Surat Thani' },
  { code: '23', nameTh: 'ตราด', nameEn: 'Trat' },
];

describe('thailand-locations.json — 77-province completeness (CAM-458 BR-1 normal)', () => {
  it('[unit] has exactly 77 province-level entries', () => {
    expect(provinces).toHaveLength(77);
  });

  it('[unit] every entry has a non-empty provinceCode, nameTh, nameEn, and a districts array', () => {
    for (const p of provinces) {
      expect(p.code.length).toBeGreaterThan(0);
      expect(p.nameTh.length).toBeGreaterThan(0);
      expect(p.nameEn.length).toBeGreaterThan(0);
      expect(Array.isArray(p.districts)).toBe(true);
    }
  });
});

describe('thailand-locations.json — uniqueness (CAM-458 BR-1 boundary)', () => {
  it('[unit] every provinceCode is unique across all 77 rows', () => {
    const codes = provinces.map((p) => p.code);
    expect(new Set(codes).size).toBe(77);
  });

  it('[unit] every Thai province name (nameTh) is unique', () => {
    const names = provinces.map((p) => p.nameTh);
    expect(new Set(names).size).toBe(77);
  });

  it('[unit] every English province name (nameEn) is unique', () => {
    const names = provinces.map((p) => p.nameEn);
    expect(new Set(names).size).toBe(77);
  });
});

describe('thailand-locations.json — spot checks (CAM-458 BR-1 normal)', () => {
  it('[unit] Bangkok is code 10', () => {
    const bangkok = provinces.find((p) => p.nameEn === 'Bangkok');
    expect(bangkok?.code).toBe('10');
    expect(bangkok?.nameTh).toBe('กรุงเทพมหานคร');
  });

  it('[unit] Bueng Kan (a newly-seeded province, AC-1 example) is code 38', () => {
    const buengKan = provinces.find((p) => p.nameEn === 'Bueng Kan');
    expect(buengKan?.code).toBe('38');
    expect(buengKan?.nameTh).toBe('บึงกาฬ');
  });
});

describe('thailand-locations.json — no row lost from the original 12 (CAM-458 regression)', () => {
  it.each(ORIGINAL_12)('[unit] original province code $code ($nameEn) is present unchanged', ({ code, nameTh, nameEn }) => {
    const row = provinces.find((p) => p.code === code);
    expect(row).toBeDefined();
    expect(row?.nameTh).toBe(nameTh);
    expect(row?.nameEn).toBe(nameEn);
  });
});

/**
 * QA gap-fill (independent verify) — DATA AUTHORITY spot-audit. The pinned
 * suite proved count=77 + uniqueness + 2 spot-checks (Bangkok, Bueng Kan) but
 * never pinned the exact RTGS/DOPA spelling of the historically error-prone
 * province names (two-word vs one-word conventions, e.g. "Chon Buri" not
 * "Chonburi", "Buri Ram" not "Buriram"). A typo here would still pass every
 * pinned test (non-empty + unique) while silently breaking the AC-1 seam
 * invariant against a real `Location.province` value entered with the
 * standard spelling. Cross-checked against ISO 3166-2:TH / TIS 1099-2548.
 * Prove-It: flipping any one expected string below to a plausible wrong
 * spelling (e.g. "Buriram") fails this test — verified by hand before commit.
 */
describe('thailand-locations.json — RTGS/DOPA spelling spot-audit (QA gap-fill, BR-1 normal)', () => {
  const SPELLING_TRAPS: Array<{ code: string; nameTh: string; nameEn: string }> = [
    { code: '14', nameTh: 'พระนครศรีอยุธยา', nameEn: 'Phra Nakhon Si Ayutthaya' },
    { code: '33', nameTh: 'ศรีสะเกษ', nameEn: 'Si Sa Ket' },
    { code: '20', nameTh: 'ชลบุรี', nameEn: 'Chon Buri' },
    { code: '25', nameTh: 'ปราจีนบุรี', nameEn: 'Prachin Buri' },
    { code: '80', nameTh: 'นครศรีธรรมราช', nameEn: 'Nakhon Si Thammarat' },
    { code: '31', nameTh: 'บุรีรัมย์', nameEn: 'Buri Ram' },
    { code: '39', nameTh: 'หนองบัวลำภู', nameEn: 'Nong Bua Lam Phu' },
    { code: '24', nameTh: 'ฉะเชิงเทรา', nameEn: 'Chachoengsao' },
    { code: '18', nameTh: 'ชัยนาท', nameEn: 'Chai Nat' },
    { code: '58', nameTh: 'แม่ฮ่องสอน', nameEn: 'Mae Hong Son' },
    { code: '93', nameTh: 'พัทลุง', nameEn: 'Phatthalung' },
    { code: '91', nameTh: 'สตูล', nameEn: 'Satun' },
    { code: '34', nameTh: 'อุบลราชธานี', nameEn: 'Ubon Ratchathani' },
    { code: '75', nameTh: 'สมุทรสงคราม', nameEn: 'Samut Songkhram' },
    { code: '16', nameTh: 'ลพบุรี', nameEn: 'Lop Buri' },
  ];

  it.each(SPELLING_TRAPS)(
    '[unit] province code $code resolves to the exact RTGS spelling "$nameEn" ($nameTh)',
    ({ code, nameTh, nameEn }) => {
      const row = provinces.find((p) => p.code === code);
      expect(row).toBeDefined();
      expect(row?.nameTh).toBe(nameTh);
      expect(row?.nameEn).toBe(nameEn);
    }
  );
});

/**
 * QA gap-fill — case-insensitive nameEn duplicate guard. The pinned
 * uniqueness test (`new Set(names).size === 77`) is CASE-SENSITIVE: a
 * differently-cased duplicate (e.g. "Bueng Kan" + "bueng kan") would pass
 * that Set check silently while still colliding as the same
 * `Location.province` value at query time. Prove-It: verified by hand this
 * fails when a case-variant duplicate is injected (see verify notes).
 */
describe('thailand-locations.json — case-insensitive nameEn duplicate guard (QA gap-fill, boundary)', () => {
  it('[unit] no two provinces share the same nameEn when case is ignored', () => {
    const lower = provinces.map((p) => p.nameEn.toLowerCase());
    expect(new Set(lower).size).toBe(provinces.length);
  });
});

/**
 * QA gap-fill — substring-ambiguity seam invariant. `resolveProvinceForSearch`
 * matches via `ThailandLocation.findFirst({ where: { provinceName: {
 * contains } } })` with NO `orderBy` — if a camper's exact province word were
 * a substring of more than one stored `provinceName`, `findFirst` would
 * return a NONDETERMINISTIC row (adversarial risk named at verify time:
 * "เชียงใหม่" vs "เชียงราย"). This asserts the real 77-row data never
 * produces that ambiguity for a full province-name query: every full nameTh
 * is a substring of ONLY its own row. Prove-It: verified by hand this fails
 * when a fragment like "เชียง" is injected as its own row.
 */
describe('thailand-locations.json — no full province name is an ambiguous substring of another (QA gap-fill, seam invariant)', () => {
  it('[unit] every full nameTh matches exactly one row under a `contains`-style lookup', () => {
    for (const p of provinces) {
      const matches = provinces.filter((q) => q.nameTh.includes(p.nameTh));
      expect(matches).toHaveLength(1);
      expect(matches[0]?.code).toBe(p.code);
    }
  });
});
