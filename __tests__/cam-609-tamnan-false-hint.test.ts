/**
 * CAM-609 — "ตำนาน" ("legend"/"myth") is ordinary Thai vocabulary AND a real,
 * camp-holding sub-district (ตำบลตำนาน, เมืองพัทลุง) newly surfaced by CAM-606's
 * regeneration (422 -> 503 rows). It is exactly 5 Thai characters (CAM-600's
 * length floor excludes only `< 5`) and did not exist in the 422-row list
 * `AMBIGUOUS_SUBDISTRICT_VOCAB_TH` was originally curated against — CAM-606
 * found and deliberately did not fix it (out of that story's file surface).
 *
 * The fix has two parts, both asserted here:
 * 1. `ตำนาน` added to `AMBIGUOUS_SUBDISTRICT_VOCAB_TH` — the bare word no
 *    longer hints a place.
 * 2. A new explicit-marker path (`detectExplicitSubDistrictPrefix`) so a
 *    camper who explicitly writes `ตำบลตำนาน` still gets the real place —
 *    the skip-set is consulted by the ONE existing sub-district code path
 *    with no marked/unmarked split before this story, so the vocabulary
 *    exclusion alone would have silently broken the correct, explicit form
 *    too.
 */
import { describe, it, expect } from 'vitest';
import { resolvePlace } from '@/lib/ai/place-resolver';

describe('CAM-609 — the bare word "ตำนาน" no longer hints a place', () => {
  it('[EC, Prove-It] "เต็นท์รุ่นตำนาน" ("an iconic/legendary-edition tent") resolves to nothing', () => {
    expect(resolvePlace('เต็นท์รุ่นตำนาน')).toEqual({});
  });

  it('[EC, Prove-It] "ลานกางเต็นท์ระดับตำนาน" ("a legendary-tier campground") resolves to nothing', () => {
    expect(resolvePlace('ลานกางเต็นท์ระดับตำนาน')).toEqual({});
  });
});

describe('CAM-609 — the explicitly-marked form still resolves the real place', () => {
  it('[normal] "ลานกางเต็นท์ตำบลตำนาน" still resolves to the real ตำบลตำนาน (เมืองพัทลุง)', () => {
    expect(resolvePlace('ลานกางเต็นท์ตำบลตำนาน')).toEqual({ subDistrict: 'ตำนาน', district: 'เมืองพัทลุง' });
  });
});

describe('CAM-609 — the six CAM-600 negative cases, re-checked individually after this change', () => {
  it('[regression] "ลานกางเต็นท์ริมถนน" resolves to nothing', () => {
    expect(resolvePlace('ลานกางเต็นท์ริมถนน')).toEqual({});
  });

  it('[regression] "ลานกางเต็นท์ใกล้ตลาด" resolves to nothing', () => {
    expect(resolvePlace('ลานกางเต็นท์ใกล้ตลาด')).toEqual({});
  });

  it('[regression] "ลานกางเต็นท์ริมบ่อ" resolves to nothing', () => {
    expect(resolvePlace('ลานกางเต็นท์ริมบ่อ')).toEqual({});
  });

  it('[regression] "ลานกางเต็นท์ทางเหนือ" resolves to nothing', () => {
    expect(resolvePlace('ลานกางเต็นท์ทางเหนือ')).toEqual({});
  });

  it('[regression] "ลานกางเต็นท์ที่สะอาด" resolves to nothing', () => {
    expect(resolvePlace('ลานกางเต็นท์ที่สะอาด')).toEqual({});
  });

  it('[regression] "ลานกางเต็นท์บรรยากาศสำราญ" resolves to nothing', () => {
    expect(resolvePlace('ลานกางเต็นท์บรรยากาศสำราญ')).toEqual({});
  });
});

describe('CAM-609 — the five sibling fixtures, re-checked individually after this change', () => {
  it('[regression] "ลานกางเต็นท์แม่ริม" still resolves as a district', () => {
    expect(resolvePlace('ลานกางเต็นท์แม่ริม')).toEqual({ district: 'แม่ริม' });
  });

  it('[regression] "แคมป์ที่อำเภอปาย" still resolves as an explicit-marker district (CAM-599)', () => {
    expect(resolvePlace('แคมป์ที่อำเภอปาย')).toEqual({ district: 'ปาย' });
  });

  it('[regression] "ลานกางเต็นท์เชียงใหม่" still resolves as a bare province', () => {
    expect(resolvePlace('ลานกางเต็นท์เชียงใหม่')).toEqual({ province: 'Chiang Mai' });
  });

  it('[regression] "ลานกางเต็นท์ใกล้เขาใหญ่" still resolves as the landmark, unchanged', () => {
    expect(resolvePlace('ลานกางเต็นท์ใกล้เขาใหญ่')).toEqual({ near: 'เขาใหญ่', nearIsLandmark: true });
  });

  it('[regression] "ลานกางเต็นท์ป่าตอง" (CAM-606 addition) still resolves', () => {
    expect(resolvePlace('ลานกางเต็นท์ป่าตอง')).toEqual({ subDistrict: 'ป่าตอง', district: 'กะทู้' });
  });
});
