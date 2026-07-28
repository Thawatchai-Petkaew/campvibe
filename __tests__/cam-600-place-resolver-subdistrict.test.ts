/**
 * CAM-600 — `resolvePlace` sub-district (ตำบล) detection, completing the
 * ladder CAM-596 deliberately left incomplete: only the 422 sub-districts
 * that actually hold a published camp today are detected (the curated
 * shortlist, `prisma/data/subdistrict-shortlist.json`), never the full
 * 7,452 — the owner's insight that changes the math CAM-596 measured as
 * unsafe. The shortlist alone is NOT sufficient (measured residual risk):
 * a length floor + a curated ordinary-vocabulary skip-set guard the
 * <=4-char/common-word collision class the ticket itself names (ตลาด/ถนน),
 * and a within-shortlist name collision (the SAME ตำบล name in >1 province)
 * must be scoped by a co-occurring district/province name before it is
 * ever hinted — an unresolvable ambiguity is never guessed.
 */
import { describe, it, expect } from 'vitest';
import { resolvePlace } from '@/lib/ai/place-resolver';

describe('CAM-600 resolvePlace — a shortlisted, unique sub-district resolves and pairs its district', () => {
  it('[normal] a bare, unambiguous shortlisted sub-district name resolves to BOTH subDistrict and its own district (never subDistrict alone)', () => {
    // "แสนสุข" (Saen Suk, Chon Buri) holds a camp and its name is unique
    // within the shortlist — the same fixture the real-model golden case
    // (GEO-7-CAM600-SUBDISTRICT) proves end-to-end.
    expect(resolvePlace('ลานกางเต็นท์แสนสุข')).toEqual({ subDistrict: 'แสนสุข', district: 'เมืองชลบุรี' });
  });

  it('[null/empty] an empty string resolves to an empty object, never throws', () => {
    expect(resolvePlace('')).toEqual({});
  });
});

describe('CAM-600 resolvePlace — the negative that protects the user: ordinary vocabulary is never hijacked', () => {
  it('[EC, DEFECT-class regression] "ถนน" (road) inside an ordinary sentence never triggers a sub-district search — a real shortlisted name (Mayo district, Pattani), excluded by the length floor', () => {
    expect(resolvePlace('อยากได้ลานกางเต็นท์ริมถนนสวยๆ')).toEqual({});
  });

  it('[EC, DEFECT-class regression] "ตลาด" (market) inside an ordinary sentence never triggers a sub-district search — a real shortlisted name (Mueang Maha Sarakham district), excluded by the length floor', () => {
    expect(resolvePlace('มีตลาดนัดใกล้ที่กางเต็นท์ไหม')).toEqual({});
  });

  it('[boundary, measured] the curated ordinary-vocabulary skip-set catches a 5-character collision the length floor alone cannot: "เหนือ" ("north") is itself a real, shortlisted sub-district (Kalasin), and a compass-direction/region sentence must keep resolving as a REGION, never a sub-district', () => {
    expect(resolvePlace('ริมน้ำภาคเหนือ')).toEqual({ region: 'ภาคเหนือ' });
    expect(resolvePlace('อยากไปเที่ยวภาคตะวันออกเฉียงเหนือ')).toEqual({ region: 'ภาคตะวันออกเฉียงเหนือ' });
  });
});

describe('CAM-600 resolvePlace — a name colliding WITHIN the shortlist itself must not be guessed', () => {
  it('[EC, normal] "ในเมือง" (In Mueang) repeats across 5 provinces in the shortlist — a bare mention with NO scoping province/district present fails honestly (no subDistrict hint at all)', () => {
    const result = resolvePlace('ลานกางเต็นท์ในเมือง') as { subDistrict?: string };
    expect(result.subDistrict).toBeUndefined();
    expect(result).toEqual({});
  });

  it('[normal] the SAME colliding name, scoped by ONE of its real owning provinces in the same message, resolves to that exact entry', () => {
    expect(resolvePlace('ลานกางเต็นท์ในเมืองขอนแก่น')).toEqual({ subDistrict: 'ในเมือง', district: 'เมืองขอนแก่น' });
  });

  it('[edge, tautology guard] "บ้านแหลม" collides across 2 provinces, and one of its OWN entries has a district ALSO literally named "บ้านแหลม" — a bare mention must not "self-confirm"; it falls through to the (unchanged) CAM-596 district detector instead of guessing which province', () => {
    expect(resolvePlace('ลานกางเต็นท์บ้านแหลม')).toEqual({ district: 'บ้านแหลม' });
  });

  it('[edge, tautology guard resolved by province] the SAME "บ้านแหลม" name, scoped by its real province, resolves the exact sub-district entry', () => {
    expect(resolvePlace('ลานกางเต็นท์บ้านแหลม เพชรบุรี')).toEqual({ subDistrict: 'บ้านแหลม', district: 'บ้านแหลม' });
  });
});

describe('CAM-600 resolvePlace — precedence: a landmark bare mention still wins over a same-named shortlisted sub-district', () => {
  it('[boundary, measured sibling conflict] "เขาค้อ" (Khao Kho) is BOTH a context-guarded landmark name (CAM-503) AND a real, shortlisted sub-district (Phetchabun) — a bare mention with no explicit "อำเภอ"/"อ." marker must still resolve as the landmark radius, unchanged from before this story', () => {
    expect(resolvePlace('ที่พักเขาค้อ')).toEqual({ near: 'เขาค้อ', nearIsLandmark: true });
  });

  it('[regression] an explicit "อำเภอ" marker on the SAME name still wins over both the landmark and the sub-district (CAM-599, unchanged)', () => {
    expect(resolvePlace('แคมป์ที่อำเภอเขาค้อ')).toEqual({ district: 'เขาค้อ' });
  });
});

describe('CAM-600 resolvePlace — sibling regression: every pre-existing pinned fixture stays byte-identical', () => {
  it('[regression] CAM-596\'s own flagship bare-district case is unaffected ("แม่ริม" is not itself a shortlisted sub-district)', () => {
    expect(resolvePlace('ลานกางเต็นท์แม่ริม')).toEqual({ district: 'แม่ริม' });
  });

  it('[regression] a bare province mention with no district/sub-district substring resolves exactly as before', () => {
    expect(resolvePlace('ลานกางเต็นท์เชียงใหม่')).toEqual({ province: 'Chiang Mai' });
  });

  it('[regression] CAM-596\'s own "ท่าเรือ" district collision-guard fixtures resolve exactly as before ("ท่าเรือ" is ALSO a shortlisted, colliding sub-district with no scoping signal present, so it correctly falls through to the district level)', () => {
    expect(resolvePlace('ลานกางเต็นท์ท่าเรือ')).toEqual({ district: 'ท่าเรือ' });
    expect(resolvePlace('ไปท่าเรือกันเถอะ')).toEqual({});
  });
});
