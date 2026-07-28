/**
 * CAM-599 (owner decision 2026-07-28, "อำเภอปายควรได้อำเภอนั้น") —
 * `resolvePlace` gains ONE new detector, `detectExplicitDistrictPrefix`,
 * checked BEFORE the landmark check (CAM-503): an explicit "อำเภอ"/"อ."
 * marker in front of a real district name wins over a landmark gazetteer
 * match on the exact same bare name (e.g. "อำเภอปาย" vs the "ปาย" landmark).
 * A bare landmark mention with no marker — including under a proximity
 * word ("ใกล้ปาย") — is completely untouched: CAM-503's original reasoning
 * (a landmark can span multiple provinces, so `near` is the only honest
 * answer) still holds there.
 *
 * Coverage matrix (story.md AC-1..4, BR-1..4, EC-1..2):
 *   - AC-1/AC-2  an explicit "อำเภอ"/"อ." marker resolves the DISTRICT, even
 *                though the same bare name also sits in the landmark
 *                gazetteer (the ticket's own reported bug)
 *   - AC-3       the SAME bare landmark name, with no marker (with or
 *                without a proximity word), is unaffected — pinned
 *                alongside the AC-1 case in the SAME describe block so the
 *                pair can never silently drift apart
 *   - AC-4/BR-3  a province named in the same message as an explicit
 *                district is still attached alongside it (mirrors CAM-596
 *                BR-2)
 *   - BR-1       the one-rule precedence itself is pinned directly (the
 *                new step runs before landmark, which runs before the
 *                marker-less CAM-596 `detectDistrict`)
 *   - BR-2/EC-1  the explicit marker resolves a district even when that
 *                district would fail CAM-596's own bare-mention guards
 *                (too short / curated-ambiguous / substring-of-a-province)
 *   - BR-4       only "อำเภอ"/"อ." are recognized markers — a colloquial
 *                "เมือง" prefix is NOT treated as an explicit marker
 *   - EC-2       no marker anywhere in the message -> nothing this story
 *                added ever fires (regression guard, generalized beyond ปาย)
 */
import { describe, it, expect } from 'vitest';
import { resolvePlace } from '@/lib/ai/place-resolver';

describe('CAM-599 resolvePlace — AC-1/AC-2/AC-3: an explicit district marker beats a landmark match on the same name', () => {
  it('[AC-1, normal] "อำเภอปาย" resolves the ปาย DISTRICT, not the landmark radius (the ticket\'s own reported bug)', () => {
    expect(resolvePlace('แคมป์ที่อำเภอปาย')).toEqual({ district: 'ปาย' });
  });

  it('[AC-2, normal] the "อ." abbreviation form resolves the same way', () => {
    expect(resolvePlace('แคมป์ที่ อ.ปาย')).toEqual({ district: 'ปาย' });
  });

  it('[AC-3, regression — paired with AC-1/AC-2 above so the two can never drift apart] the SAME bare landmark name, with NO explicit marker, is completely unaffected by this story', () => {
    // No "อำเภอ"/"อ." marker anywhere in either message below — both keep
    // their exact pre-CAM-599 behavior: the landmark's own proximity
    // radius, camping-context-guarded exactly as CAM-503-DEF-2 documents.
    expect(resolvePlace('ลานกางเต็นท์ปาย')).toEqual({ near: 'ปาย', nearIsLandmark: true });
    expect(resolvePlace('มีแคมป์ใกล้ปายไหม')).toEqual({ near: 'ปาย', nearIsLandmark: true });
  });

  it('[AC-3, boundary — measured, not assumed] a truly BARE proximity mention with no camping-context marker at all was already {} before this story, and still is', () => {
    // "ใกล้ปาย" alone carries no camping-context marker, so the existing
    // CAM-503-DEF-2 context-guard on the landmark's own short/collision-
    // prone bare form ("ปาย" is in CONTEXT_GUARDED_LANDMARK_NAMES_TH)
    // withholds even the `near` hint — this is PRE-EXISTING, measured
    // behavior on `dev` before this story, untouched by it (this story's
    // new detector requires an explicit "อำเภอ"/"อ." marker, which this
    // string does not contain, so it never fires here either).
    expect(resolvePlace('ใกล้ปาย')).toEqual({});
  });

  it('[AC-3, regression, generalized beyond ปาย] every other landmark gazetteer entry with an "อำเภอ"-prefixed alias now ALSO resolves as a district when marked, and is unaffected when bare', () => {
    // เขาค้อ, สวนผึ้ง, วังน้ำเขียว all have a measured "อำเภอ"-prefixed alias
    // in prisma/data/landmark-gazetteer.json AND are all real districts —
    // this is the SAME general fix, not a ปาย-special-case.
    expect(resolvePlace('แคมป์ที่อำเภอเขาค้อ')).toEqual({ district: 'เขาค้อ' });
    expect(resolvePlace('ที่พักเขาค้อ')).toEqual({ near: 'เขาค้อ', nearIsLandmark: true });

    expect(resolvePlace('แคมป์ที่อำเภอสวนผึ้ง')).toEqual({ district: 'สวนผึ้ง' });
    expect(resolvePlace('สวนผึ้ง')).toEqual({ near: 'สวนผึ้ง', nearIsLandmark: true });

    expect(resolvePlace('แคมป์ที่อำเภอวังน้ำเขียว')).toEqual({ district: 'วังน้ำเขียว' });
  });
});

describe('CAM-599 resolvePlace — AC-4/BR-3: a province named alongside an explicit district is still attached', () => {
  it('[AC-4, normal] "อำเภอปาย จ.แม่ฮ่องสอน" resolves BOTH — district for the filter, province for scoping (mirrors CAM-596 BR-2)', () => {
    expect(resolvePlace('อำเภอปาย จ.แม่ฮ่องสอน')).toEqual({ district: 'ปาย', province: 'Mae Hong Son' });
  });

  it('[normal] no co-named province -> district only, no stray province field', () => {
    expect(resolvePlace('อำเภอปาย')).toEqual({ district: 'ปาย' });
  });
});

describe('CAM-599 resolvePlace — BR-2/EC-1: an explicit marker resolves a district even past CAM-596\'s own bare-mention guards', () => {
  it('[EC-1, edge] "อำเภออุทัย" resolves the district even though bare "อุทัย" is guard-#3-excluded (a substring of the UNRELATED province "อุทัยธานี") and would never fire unmarked', () => {
    // "อุทัย" is measured (CAM-596 tech.md) to be a real district in
    // Ayutthaya — a DIFFERENT province than "อุทัยธานี" (Uthai Thani), whose
    // name it happens to be a substring of. The marker removes exactly
    // that ambiguity: the camper explicitly said "อำเภอ", so there is no
    // question of confusing it with the province.
    expect(resolvePlace('อำเภออุทัย')).toEqual({ district: 'อุทัย' });
    expect(resolvePlace('อ.อุทัย')).toEqual({ district: 'อุทัย' });
  });

  it('[normal, contrast] the same bare "อุทัย" with no marker never fires as a district (the guard-#3 exclusion holds, unaffected by this story)', () => {
    expect(resolvePlace('แคมป์อุทัย')).toEqual({});
  });
});

describe('CAM-599 resolvePlace — BR-4: only "อำเภอ"/"อ." are explicit markers, not a colloquial "เมือง" prefix', () => {
  it('[normal] "เมืองปาย" is NOT treated as an explicit marker — unaffected, still the landmark alias it was before this story', () => {
    expect(resolvePlace('พักที่เมืองปาย')).toEqual({ near: 'ปาย', nearIsLandmark: true });
  });
});

describe('CAM-599 resolvePlace — BR-1: the precedence rule itself, pinned directly', () => {
  it('[boundary] the new explicit-marker step runs BEFORE the landmark check — proven by the exact same bare name resolving two different ways depending only on the marker', () => {
    const marked = resolvePlace('แคมป์ที่อำเภอปาย');
    const bare = resolvePlace('ลานกางเต็นท์ปาย');
    expect(marked).toEqual({ district: 'ปาย' });
    expect(bare).toEqual({ near: 'ปาย', nearIsLandmark: true });
    expect(marked).not.toEqual(bare);
  });

  it('[regression] CAM-596\'s own marker-less district detection (no "อำเภอ"/"อ." prefix) still runs AFTER the landmark check, unchanged — a marker-less district never overrides a landmark match', () => {
    // เขาใหญ่ itself is a landmark (not a real single district — it spans
    // several provinces) — this is CAM-596's own pinned regression,
    // re-asserted here to prove this story's new first step never shadows it.
    expect(resolvePlace('ลานกางเต็นท์เขาใหญ่')).toEqual({ near: 'เขาใหญ่', nearIsLandmark: true });
  });
});

describe('CAM-599 resolvePlace — EC-2: no explicit marker anywhere -> nothing this story added ever fires', () => {
  it('[regression] a bare province mention with no marker resolves exactly as before (byte-identical)', () => {
    expect(resolvePlace('แคมป์ริมน้ำเชียงใหม่')).toEqual({ province: 'Chiang Mai' });
  });

  it('[regression] CAM-596\'s own bare-district AC-1 case is unaffected', () => {
    expect(resolvePlace('ลานกางเต็นท์แม่ริม')).toEqual({ district: 'แม่ริม' });
  });

  it('[null/empty] empty string -> {}, never throws', () => {
    expect(resolvePlace('')).toEqual({});
  });
});
