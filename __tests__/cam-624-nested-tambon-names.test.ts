/**
 * CAM-624 — a shortlisted ตำบล name can be a literal substring of a
 * DIFFERENT, unrelated shortlisted ตำบล name ("ทองหลาง" inside "ท่าทองหลาง",
 * "หินโงม" inside "ท่าหินโงม"). Both names in each pair are real, camp-holding
 * places (neither is removable), so this is a distinct collision shape from
 * CAM-609 (ordinary vocabulary) and CAM-611 (a common prefix needing a
 * context marker).
 *
 * MEASURED before fixing (see this ticket's tech.md for the full table):
 * with a camping-context marker present, the longer/more-specific name
 * already won (candidates are sorted longest-name-first, loop returns on
 * first match) — "ลานกางเต็นท์ท่าทองหลาง" already resolved correctly, so
 * there was nothing to fix for that phrasing. The real defect was narrower:
 * CAM-611's own `requiresCampingContext` guard, when it SKIPS the longer
 * candidate (no camping word present), let the "skip and keep scanning"
 * idiom fall through to the shorter, unrelated, unguarded embedded name
 * instead of failing honestly — confirmed by this repo's own CAM-611 test
 * (its EC-5 block, explicitly labelled "found, not fixed").
 *
 * FIX (general, not per-name): a sub-district candidate whose `nameTh` is a
 * proper substring of another surviving candidate is "shadowed" whenever
 * that longer candidate's own `nameTh` is also present in the text,
 * regardless of why the longer one didn't itself fire. See
 * `lib/ai/place-resolver.ts`'s `buildSubDistrictShadowParents`/
 * `isShadowedByLongerSubDistrict` and this ticket's tech.md for the full
 * measured evidence (12 embedding pairs exist in today's 503-row shortlist;
 * only these two are an observable misfire today).
 */
import { describe, it, expect } from 'vitest';
import { resolvePlace } from '@/lib/ai/place-resolver';

describe('CAM-624 — ท่าทองหลาง / ทองหลาง (the same-shape pair CAM-611 found and did not fix)', () => {
  it('[AC-1] camping phrasing already resolved correctly before this fix (longer wins, unchanged)', () => {
    expect(resolvePlace('ลานกางเต็นท์ท่าทองหลาง')).toEqual({ subDistrict: 'ท่าทองหลาง', district: 'บางคล้า' });
  });

  it('[AC-2] neutral phrasing (no camping word) — the fix: resolves to nothing instead of the wrong, unrelated ทองหลาง (was {subDistrict:"ทองหลาง", district:"บ้านนา"} before this ticket)', () => {
    expect(resolvePlace('เมื่อวานนี้ไปท่าทองหลางเยี่ยมญาติมา')).toEqual({});
  });

  it('[regression] a genuine mention of the OTHER real place (ทองหลาง, no ท่า prefix) still resolves — the fix must not remove a legitimate place', () => {
    expect(resolvePlace('ลานกางเต็นท์ทองหลาง')).toEqual({ subDistrict: 'ทองหลาง', district: 'บ้านนา' });
  });
});

describe('CAM-624 — ท่าหินโงม / หินโงม (the second confirmed pair)', () => {
  it('[AC-1] camping phrasing already resolved correctly before this fix (longer wins, unchanged)', () => {
    expect(resolvePlace('ลานกางเต็นท์ท่าหินโงม')).toEqual({ subDistrict: 'ท่าหินโงม', district: 'เมืองชัยภูมิ' });
  });

  it('[AC-2] neutral phrasing (no camping word) — the fix: resolves to nothing instead of the wrong, unrelated หินโงม (was {subDistrict:"หินโงม", district:"เมืองหนองคาย"} before this ticket)', () => {
    expect(resolvePlace('เมื่อวานนี้ไปท่าหินโงมเยี่ยมญาติมา')).toEqual({});
  });

  it('[regression] a genuine mention of the OTHER real place (หินโงม, no ท่า prefix) still resolves', () => {
    expect(resolvePlace('ลานกางเต็นท์หินโงม')).toEqual({ subDistrict: 'หินโงม', district: 'เมืองหนองคาย' });
  });
});

describe('CAM-624 — general shadow rule: representative already-safe embedding pairs stay unaffected (unguarded longer names already won before this fix, and still do)', () => {
  it('"ปากน้ำแหลมสิงห์" (contains "ปากน้ำ") still resolves to itself, not the shorter, unrelated "ปากน้ำ"', () => {
    expect(resolvePlace('เมื่อวานนี้ไปปากน้ำแหลมสิงห์เยี่ยมญาติมา')).toEqual({
      subDistrict: 'ปากน้ำแหลมสิงห์',
      district: 'แหลมสิงห์',
    });
  });
  it('"เวียงยอง" (contains the ambiguous, 2-entry "เวียง") still resolves to itself unconditionally', () => {
    expect(resolvePlace('เมื่อวานนี้ไปเวียงยองเยี่ยมญาติมา')).toEqual({ subDistrict: 'เวียงยอง', district: 'เมืองลำพูน' });
  });
});

describe('CAM-624 — regression: CAM-600\'s six negatives still resolve to nothing', () => {
  it.each(['ลานกางเต็นท์ริมถนน', 'ใกล้ตลาด', 'ริมบ่อ', 'ทางเหนือ', 'ที่สะอาด', 'บรรยากาศสำราญ'])('%s -> {}', (text) => {
    expect(resolvePlace(text)).toEqual({});
  });
});

describe('CAM-624 — regression: CAM-609\'s ตำนาน pair still holds', () => {
  it('"เต็นท์รุ่นตำนาน" resolves to nothing', () => {
    expect(resolvePlace('เต็นท์รุ่นตำนาน')).toEqual({});
  });
  it('"ลานกางเต็นท์ตำบลตำนาน" still resolves to the real ตำบลตำนาน (เมืองพัทลุง)', () => {
    expect(resolvePlace('ลานกางเต็นท์ตำบลตำนาน')).toEqual({ subDistrict: 'ตำนาน', district: 'เมืองพัทลุง' });
  });
});

describe('CAM-624 — regression: CAM-611\'s three words still hold', () => {
  it('"เมื่อวานนี้ไปเหนือเมืองเยี่ยมญาติมา" resolves to nothing', () => {
    expect(resolvePlace('เมื่อวานนี้ไปเหนือเมืองเยี่ยมญาติมา')).toEqual({});
  });
  it('"เมื่อวานนี้ไปเสาธงเยี่ยมญาติมา" resolves to nothing', () => {
    expect(resolvePlace('เมื่อวานนี้ไปเสาธงเยี่ยมญาติมา')).toEqual({});
  });
  it('"เมื่อวานนี้ไปรังนกเยี่ยมญาติมา" resolves to nothing', () => {
    expect(resolvePlace('เมื่อวานนี้ไปรังนกเยี่ยมญาติมา')).toEqual({});
  });
});

describe('CAM-624 — regression: siblings unchanged', () => {
  it('"แม่ริม" still resolves as a district', () => {
    expect(resolvePlace('แม่ริม')).toEqual({ district: 'แม่ริม' });
  });
  it('"อำเภอปาย" still resolves as an explicit-marker district', () => {
    expect(resolvePlace('อำเภอปาย')).toEqual({ district: 'ปาย' });
  });
  it('"เชียงใหม่" still resolves as a bare province', () => {
    expect(resolvePlace('เชียงใหม่')).toEqual({ province: 'Chiang Mai' });
  });
  it('"ใกล้เขาใหญ่" (bare, no camping-context marker) is unchanged', () => {
    expect(resolvePlace('ใกล้เขาใหญ่')).toEqual({});
  });
  it('"ลานกางเต็นท์ป่าตอง" still resolves', () => {
    expect(resolvePlace('ลานกางเต็นท์ป่าตอง')).toEqual({ subDistrict: 'ป่าตอง', district: 'กะทู้' });
  });
  it('"ลานกางเต็นท์หมูสี" still resolves', () => {
    expect(resolvePlace('ลานกางเต็นท์หมูสี')).toEqual({ subDistrict: 'หมูสี', district: 'ปากช่อง' });
  });
});
