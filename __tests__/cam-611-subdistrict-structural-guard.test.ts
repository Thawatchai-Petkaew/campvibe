/**
 * CAM-611 — sub-district detection never inherited CAM-596's district-level
 * `requiresCampingContext` structural guard (a name built from a very common
 * component — "เมือง"/"ท่า" — must not resolve on a bare, unrelated
 * mention). CAM-600 built the sub-district level against a 422-name list
 * "selected to be distinctive", so the guard looked unnecessary; CAM-606's
 * regeneration grew that list to 503 and the assumption expired unnoticed.
 * CAM-609's own wider re-scan found this gap (~24 names exposed) plus three
 * individual ordinary words neither the structural guard nor the existing
 * vocabulary skip-set covered — this suite proves both fixes, individually,
 * per name.
 *
 * This story reuses CAM-596's own `CONTEXT_GUARDED_ADMIN_AREA_PREFIXES_TH`
 * constant and `hasCampingContextMarker` check verbatim (no new mechanism);
 * see `lib/ai/place-resolver.ts`'s own doc comments (CAM-611 paragraphs) and
 * this story's `tech.md` for the full measured evidence.
 */
import { describe, it, expect } from 'vitest';
import { resolvePlace } from '@/lib/ai/place-resolver';
import subDistrictShortlist from '@/prisma/data/subdistrict-shortlist.json';

describe('CAM-611 — three named words (เหนือเมือง/เสาธง/รังนก): BR-4 vocabulary fix', () => {
  describe('ordinary phrasing (no ตำบล marker) resolves to nothing', () => {
    it('[EC-3] "เมื่อวานนี้ไปเหนือเมืองเยี่ยมญาติมา" (no camping word) resolves to nothing', () => {
      expect(resolvePlace('เมื่อวานนี้ไปเหนือเมืองเยี่ยมญาติมา')).toEqual({});
    });
    it('[EC-3] "ลานกางเต็นท์เหนือเมือง" (camping word present, still bare) resolves to nothing', () => {
      expect(resolvePlace('ลานกางเต็นท์เหนือเมือง')).toEqual({});
    });
    it('[EC-3] "เมื่อวานนี้ไปเสาธงเยี่ยมญาติมา" resolves to nothing', () => {
      expect(resolvePlace('เมื่อวานนี้ไปเสาธงเยี่ยมญาติมา')).toEqual({});
    });
    it('[EC-3] "ลานกางเต็นท์เสาธง" resolves to nothing', () => {
      expect(resolvePlace('ลานกางเต็นท์เสาธง')).toEqual({});
    });
    it('[EC-3] "เมื่อวานนี้ไปรังนกเยี่ยมญาติมา" resolves to nothing', () => {
      expect(resolvePlace('เมื่อวานนี้ไปรังนกเยี่ยมญาติมา')).toEqual({});
    });
    it('[EC-3] "ลานกางเต็นท์รังนก" resolves to nothing', () => {
      expect(resolvePlace('ลานกางเต็นท์รังนก')).toEqual({});
    });
  });

  describe('the explicitly-marked ตำบล form still resolves the real place (AC-4, guard NOT weakened)', () => {
    it('[EC-4] "ลานกางเต็นท์ตำบลเหนือเมือง" resolves to เหนือเมือง, เมืองร้อยเอ็ด', () => {
      expect(resolvePlace('ลานกางเต็นท์ตำบลเหนือเมือง')).toEqual({ subDistrict: 'เหนือเมือง', district: 'เมืองร้อยเอ็ด' });
    });
    it('[EC-4] "ลานกางเต็นท์ตำบลเสาธง" resolves to เสาธง, ร่อนพิบูลย์', () => {
      expect(resolvePlace('ลานกางเต็นท์ตำบลเสาธง')).toEqual({ subDistrict: 'เสาธง', district: 'ร่อนพิบูลย์' });
    });
    it('[EC-4] "ลานกางเต็นท์ตำบลรังนก" resolves to รังนก, สามง่าม', () => {
      expect(resolvePlace('ลานกางเต็นท์ตำบลรังนก')).toEqual({ subDistrict: 'รังนก', district: 'สามง่าม' });
    });
  });
});

describe('CAM-611 — BR-1 structural guard: the 23 currently-exposed เมือง/ท่า-prefixed names', () => {
  // The 21 names that close cleanly: {} with no camping-context marker,
  // correct {subDistrict, district} with one present. Verified against the
  // real, committed shortlist (see tech.md's full per-name table); ท่าเรือ
  // (collides within the shortlist, CAM-600's own guard) and the two
  // substring-embedding exceptions (ท่าทองหลาง/ท่าหินโงม, EC-5, tech.md) are
  // asserted separately below with their own, precise expected values.
  const cleanSingleEntryNames: ReadonlyArray<{ nameTh: string; districtNameTh: string }> = [
    { nameTh: 'เมืองปอน', districtNameTh: 'ขุนยวม' },
    { nameTh: 'เมืองเก่า', districtNameTh: 'เมืองสุโขทัย' },
    { nameTh: 'ท่าม่วง', districtNameTh: 'ท่าม่วง' },
    { nameTh: 'ท่าขุนราม', districtNameTh: 'เมืองกำแพงเพชร' },
    { nameTh: 'ท่าตะเกียบ', districtNameTh: 'ท่าตะเกียบ' },
    { nameTh: 'ท่าเทววงษ์', districtNameTh: 'เกาะสีชัง' },
    { nameTh: 'ท่าชัย', districtNameTh: 'เมืองชัยนาท' },
    { nameTh: 'ท่าจำปี', districtNameTh: 'เมืองพะเยา' },
    { nameTh: 'ท่าช้าง', districtNameTh: 'พรหมพิราม' },
    { nameTh: 'ท่างาม', districtNameTh: 'วัดโบสถ์' },
    { nameTh: 'ท่ายาง', districtNameTh: 'ท่ายาง' },
    { nameTh: 'ท่าแร้งออก', districtNameTh: 'บ้านแหลม' },
    { nameTh: 'ท่าตูม', districtNameTh: 'เมืองมหาสารคาม' },
    { nameTh: 'ท่าสองคอน', districtNameTh: 'เมืองมหาสารคาม' },
    { nameTh: 'ท่านัด', districtNameTh: 'ดำเนินสะดวก' },
    { nameTh: 'ท่าศาลา', districtNameTh: 'ภูเรือ' },
    { nameTh: 'ท่าเกษม', districtNameTh: 'เมืองสระแก้ว' },
    { nameTh: 'ท่าสว่าง', districtNameTh: 'เมืองสุรินทร์' },
    { nameTh: 'ท่าอิฐ', districtNameTh: 'เมืองอุตรดิตถ์' },
    { nameTh: 'ท่าลาด', districtNameTh: 'วารินชำราบ' },
  ];

  it('lists exactly 20 clean single-entry names (documents the count checked here — 23 total minus ท่าเรือ minus the 2 EC-5 exceptions)', () => {
    expect(cleanSingleEntryNames).toHaveLength(20);
  });

  describe.each(cleanSingleEntryNames)('$nameTh', ({ nameTh, districtNameTh }) => {
    it(`[EC-1] neutral phrasing (no camping word) resolves to nothing`, () => {
      expect(resolvePlace(`เมื่อวานนี้ไป${nameTh}เยี่ยมญาติมา`)).toEqual({});
    });
    it(`[EC-2] camping phrasing resolves correctly, unchanged`, () => {
      expect(resolvePlace(`ลานกางเต็นท์${nameTh}`)).toEqual({ subDistrict: nameTh, district: districtNameTh });
    });
  });

  describe('ท่าเรือ (collides within the shortlist — CAM-596/CAM-600 own pinned behavior, re-confirmed here)', () => {
    it('[regression] neutral phrasing resolves to nothing', () => {
      expect(resolvePlace('เมื่อวานนี้ไปท่าเรือเยี่ยมญาติมา')).toEqual({});
    });
    it('[regression] camping phrasing with no scoping signal falls through to the district level (unchanged)', () => {
      expect(resolvePlace('ลานกางเต็นท์ท่าเรือ')).toEqual({ district: 'ท่าเรือ' });
    });
  });

  describe('ท่าทองหลาง / ท่าหินโงม — EC-5 finding: guard suppresses the outer name, but an unrelated, unguarded, independently-real inner name still fires (found, not fixed — tech.md)', () => {
    it('[EC-5] "ท่าทองหลาง" neutral phrasing no longer resolves to ท่าทองหลาง itself (guard works) but resolves to the embedded, unrelated ทองหลาง (บ้านนา) — a separate, pre-existing collision class', () => {
      expect(resolvePlace('เมื่อวานนี้ไปท่าทองหลางเยี่ยมญาติมา')).toEqual({ subDistrict: 'ทองหลาง', district: 'บ้านนา' });
    });
    it('[regression] "ท่าทองหลาง" camping phrasing still resolves correctly (guard passes, outer candidate wins as before)', () => {
      expect(resolvePlace('ลานกางเต็นท์ท่าทองหลาง')).toEqual({ subDistrict: 'ท่าทองหลาง', district: 'บางคล้า' });
    });
    it('[EC-5] "ท่าหินโงม" neutral phrasing no longer resolves to ท่าหินโงม itself (guard works) but resolves to the embedded, unrelated หินโงม (เมืองหนองคาย)', () => {
      expect(resolvePlace('เมื่อวานนี้ไปท่าหินโงมเยี่ยมญาติมา')).toEqual({ subDistrict: 'หินโงม', district: 'เมืองหนองคาย' });
    });
    it('[regression] "ท่าหินโงม" camping phrasing still resolves correctly', () => {
      expect(resolvePlace('ลานกางเต็นท์ท่าหินโงม')).toEqual({ subDistrict: 'ท่าหินโงม', district: 'เมืองชัยภูมิ' });
    });
  });
});

describe('CAM-611 — BR-3: the "เมือง"+ownProvince guard #4 equivalent has zero matches today (measured, not added)', () => {
  it('no shortlisted sub-district name equals "เมือง" + its own province\'s full name in the current committed shortlist', () => {
    const matches = (subDistrictShortlist as ReadonlyArray<{ nameTh: string; provinceNameTh: string }>).filter(
      (e) => e.nameTh === `เมือง${e.provinceNameTh}`
    );
    expect(matches).toEqual([]);
  });

  it('sanity: the two เมือง-prefixed shortlist survivors are not that pattern', () => {
    const mueangNames = (subDistrictShortlist as ReadonlyArray<{ nameTh: string; provinceNameTh: string }>)
      .filter((e) => e.nameTh.startsWith('เมือง'))
      .map((e) => e.nameTh);
    expect(new Set(mueangNames)).toEqual(new Set(['เมืองปอน', 'เมืองเก่า']));
  });
});

describe('CAM-611 — regression: CAM-600\'s six negatives still resolve to nothing', () => {
  it.each([
    'ลานกางเต็นท์ริมถนน',
    'ใกล้ตลาด',
    'ริมบ่อ',
    'ทางเหนือ',
    'ที่สะอาด',
    'บรรยากาศสำราญ',
  ])('%s -> {}', (text) => {
    expect(resolvePlace(text)).toEqual({});
  });
});

describe('CAM-611 — regression: CAM-609\'s ตำนาน cases still hold', () => {
  it('"เต็นท์รุ่นตำนาน" resolves to nothing', () => {
    expect(resolvePlace('เต็นท์รุ่นตำนาน')).toEqual({});
  });
  it('"ลานกางเต็นท์ตำบลตำนาน" still resolves to the real ตำบลตำนาน (เมืองพัทลุง)', () => {
    expect(resolvePlace('ลานกางเต็นท์ตำบลตำนาน')).toEqual({ subDistrict: 'ตำนาน', district: 'เมืองพัทลุง' });
  });
});

describe('CAM-611 — regression: sibling cases unchanged', () => {
  it('"แม่ริม" still resolves as a district', () => {
    expect(resolvePlace('แม่ริม')).toEqual({ district: 'แม่ริม' });
  });
  it('"อำเภอปาย" still resolves as an explicit-marker district (CAM-599)', () => {
    expect(resolvePlace('อำเภอปาย')).toEqual({ district: 'ปาย' });
  });
  it('"เชียงใหม่" still resolves as a bare province', () => {
    expect(resolvePlace('เชียงใหม่')).toEqual({ province: 'Chiang Mai' });
  });
  it('"ใกล้เขาใหญ่" (bare, no camping-context marker) is unchanged — pre-existing {} behavior, this story touches no landmark logic', () => {
    expect(resolvePlace('ใกล้เขาใหญ่')).toEqual({});
  });
  it('"ลานกางเต็นท์ป่าตอง" still resolves (CAM-606 addition)', () => {
    expect(resolvePlace('ลานกางเต็นท์ป่าตอง')).toEqual({ subDistrict: 'ป่าตอง', district: 'กะทู้' });
  });
  it('"ลานกางเต็นท์หมูสี" still resolves', () => {
    expect(resolvePlace('ลานกางเต็นท์หมูสี')).toEqual({ subDistrict: 'หมูสี', district: 'ปากช่อง' });
  });
});

describe('CAM-611 — BR-2: the explicit ตำบล-marker path is untouched (still bypasses the structural guard, same as it always bypassed the vocab skip-set)', () => {
  it('an explicitly-marked เมือง/ท่า-prefixed name resolves with NO camping word anywhere in the sentence', () => {
    // "ท่าเรือ" collides within the shortlist (2 entries) — scope by province to disambiguate,
    // same requirement the unmarked path already has via resolveAmbiguousSubDistrictEntry.
    expect(resolvePlace('ตำบลท่าเรือ นครนายก')).toEqual({ subDistrict: 'ท่าเรือ', district: 'ปากพลี' });
  });
});
