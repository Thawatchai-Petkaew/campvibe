/**
 * CAM-596 — `resolvePlace` district detection (the missing half of CAM-587:
 * the tool's resolution layer was already proven correct — `district:
 * "แม่ริม"` -> 6 cards, called directly — but nothing made the MODEL set the
 * argument). Mirrors the `cam-501`/`cam-502`/`cam-503`/`cam-504` convention:
 * unit coverage of the pure, synchronous pre-pass, plus red-then-green
 * regression cases for every BR-4 collision guard this story's own
 * measurement caught while writing it.
 */
import { describe, it, expect } from 'vitest';
import { resolvePlace } from '@/lib/ai/place-resolver';

describe('CAM-596 resolvePlace — AC-1/AC-3/AC-4 district detection', () => {
  it('[AC-1, normal] a bare district name with no province in the message resolves to district only', () => {
    expect(resolvePlace('ลานกางเต็นท์แม่ริม')).toEqual({ district: 'แม่ริม' });
  });

  it('[AC-3, regression] a bare province mention with no real district substring still resolves to province only (byte-identical to before this story)', () => {
    expect(resolvePlace('ลานกางเต็นท์เชียงใหม่')).toEqual({ province: 'Chiang Mai' });
  });

  it('[AC-4, normal] a province AND a genuinely-nested district named together resolve to BOTH (district for the filter, province for scoping)', () => {
    expect(resolvePlace('เชียงใหม่ แม่ริม ลานกางเต็นท์')).toEqual({ district: 'แม่ริม', province: 'Chiang Mai' });
  });

  it('[normal] an English-only message with no Thai district substring resolves as before (no district)', () => {
    expect(resolvePlace('camping near chiang mai please')).toEqual({ province: 'Chiang Mai' });
  });

  it('[null/empty] an empty string resolves to an empty object, never throws', () => {
    expect(resolvePlace('')).toEqual({});
  });
});

describe('CAM-596 resolvePlace — EC-3 a proximity marker has no effect on district detection', () => {
  it('[edge] a proximity marker next to a district name still resolves district, never near', () => {
    expect(resolvePlace('ใกล้แม่ริม')).toEqual({ district: 'แม่ริม' });
  });
});

describe('CAM-596 resolvePlace — BR-1 landmark/Bangkok still win over a district (unchanged precedence)', () => {
  it('[boundary] a landmark mention wins over an incidental district-shaped substring', () => {
    // เขาใหญ่ itself is a landmark (context-guarded, camping marker present here) — must resolve as `near`, never a district.
    const result = resolvePlace('ลานกางเต็นท์เขาใหญ่');
    expect(result).toEqual({ near: 'เขาใหญ่', nearIsLandmark: true });
  });
});

describe('CAM-596 resolvePlace — BR-4 collision guard #4: the "เมือง"+ownProvince capital-district pattern is skipped', () => {
  it('[DEFECT regression, measured] "เมือง" + a province name (colloquial "the city of X") resolves province only, never the capital district', () => {
    // Proven RED before this guard: a naive scan matched district="เมืองเชียงใหม่" here.
    expect(resolvePlace('อยากไปเที่ยวเมืองเชียงใหม่ครับ')).toEqual({ province: 'Chiang Mai' });
  });
});

describe('CAM-596 resolvePlace — BR-4 collision guard #3: a district that is a substring of an UNRELATED province is excluded', () => {
  it('[DEFECT regression, measured] "อุทัยธานี" (province) never fires the unrelated "อุทัย" district (which is actually in Ayutthaya)', () => {
    // Proven RED before this guard: a naive scan matched district="อุทัย" + province="Uthai Thani" — a
    // scoped lookup for a district that is NOT actually in Uthai Thani, breaking the search.
    expect(resolvePlace('แคมป์อุทัยธานี')).toEqual({ province: 'Uthai Thani' });
  });

  it('[DEFECT regression, measured] a district that is an EXACT duplicate of a real province name never fires (that province is unrelated)', () => {
    // "เชียงใหม่" is itself, unrelatedly, a real sub-district name (Roi Et) — irrelevant now that
    // sub-district detection is out of scope, but the guard is also proven at province-exact-match level:
    // no OTHER province's name collides with a district exactly, so a bare Chiang Mai mention stays province-only.
    expect(resolvePlace('แคมป์ริมน้ำเชียงใหม่')).toEqual({ province: 'Chiang Mai' });
  });
});

describe('CAM-596 resolvePlace — BR-4 collision guard: "ท่า"-prefixed district requires a camping-context marker', () => {
  it('[normal] a ท่า-prefixed district WITH a camping-context marker resolves normally', () => {
    expect(resolvePlace('ลานกางเต็นท์ท่าเรือ')).toEqual({ district: 'ท่าเรือ' });
  });

  it('[EC-1, edge] the same ท่า-prefixed word with NO camping-context marker does not fire (ordinary "pier" usage)', () => {
    expect(resolvePlace('ไปท่าเรือกันเถอะ')).toEqual({});
  });
});

describe('CAM-596 resolvePlace — BR-4 collision guard: candidates shorter than 4 Thai characters are excluded entirely', () => {
  it('[boundary] a 3-character district-shaped word never fires even with a camping-context marker', () => {
    // "ฝาง" is a real, genuine 3-char district (Chiang Mai) — excluded purely by the length floor, a
    // deliberate, documented recall trade-off (mirrors AMBIGUOUS_PROVINCE_NAMES_TH's own short-name floor).
    expect(resolvePlace('ลานกางเต็นท์ฝาง')).toEqual({});
  });
});

describe('CAM-596 resolvePlace — sub-district detection is out of scope (measured, not built)', () => {
  it('[out-of-scope, regression] a bare sub-district-shaped common word never fires a hint (no subDistrict field exists on the result)', () => {
    // "กลาง"/"เหนือ" are real sub-district names AND ordinary Thai vocabulary that always co-occurs
    // with a camping-context marker in this assistant's own messages — proven unsafe during this
    // story's own measurement (see place-resolver.ts's detectDistrict doc comment).
    expect(resolvePlace('อยากได้ที่กางเต็นท์กลางแจ้งวิวดี')).toEqual({});
    expect((resolvePlace('อยากได้ที่กางเต็นท์กลางแจ้งวิวดี') as { subDistrict?: string }).subDistrict).toBeUndefined();
  });
});
