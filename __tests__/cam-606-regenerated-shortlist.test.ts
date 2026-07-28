/**
 * CAM-606 — the sub-district shortlist (`prisma/data/subdistrict-shortlist.json`)
 * regenerated via the EXISTING, unmodified `scripts/generate-subdistrict-shortlist.mjs`
 * (CAM-600) against the current dev DB: 422 -> 503 rows, closing the 74-tambon
 * gap CAM-605's drift check found on its first real run (0 removed — pure
 * addition, confirmed by `git diff --stat` at authoring time). This story
 * touches ONLY the data file — `lib/ai/place-resolver.ts` and its guards
 * (length floor, ordinary-vocabulary skip-set, substring-of-province,
 * within-shortlist collision-scoping) are unchanged, so these tests prove the
 * LARGER list behaves correctly through the SAME, untouched detector — never
 * a new code path.
 *
 * Pure, DB-free (mirrors `cam-600-place-resolver-subdistrict.test.ts`'s own
 * convention): `resolvePlace` reads the committed JSON at module-load time,
 * so re-running these against the regenerated file is the real, current
 * candidate set — not a stale fixture.
 *
 * Addendum (CAM-609): the "unchanged detector" statement above describes
 * THIS story's own scope at authoring time. CAM-609 is a later, separate
 * follow-up story that DID touch `lib/ai/place-resolver.ts` (one
 * vocabulary-set addition + one new explicit-marker path) to close the
 * collision-risk finding this file itself documented below — see that
 * describe block's own updated comment.
 */
import { describe, it, expect } from 'vitest';
import { resolvePlace } from '@/lib/ai/place-resolver';

describe('CAM-606 — three of the 74 newly-covered tambons resolve through the unchanged detector', () => {
  // Each pairing (subDistrict + its own district) was confirmed against the
  // real dev DB to belong to the exact camp that made this tambon qualify
  // for the shortlist in the first place (verified via `executeSearchCampsites`
  // at authoring time, reported in the PR body — not re-asserted here since
  // that call is DB-backed and this suite stays DB-free, per CAM-600's own
  // convention):
  //   เขาฉกรรจ์ (เขาฉกรรจ์, สระแก้ว)   -> "ชายป่าอนุรักษ์สระแก้ว"
  //   ป่าตอง (กะทู้, ภูเก็ต)             -> "ลานกางเต็นท์หาดป่าตอง"
  //   วารินชำราบ (วารินชำราบ, อุบลราชธานี) -> "ริมแม่น้ำสายหลักอุบลราชธานี"
  it('[normal] "เขาฉกรรจ์" (Sa Kaeo) — new after regeneration, was absent from the 422-row list', () => {
    expect(resolvePlace('ลานกางเต็นท์เขาฉกรรจ์')).toEqual({ subDistrict: 'เขาฉกรรจ์', district: 'เขาฉกรรจ์' });
  });

  it('[normal] "ป่าตอง" (Patong, Phuket) — new after regeneration, pairs with its own district (Kathu)', () => {
    expect(resolvePlace('ลานกางเต็นท์ป่าตอง')).toEqual({ subDistrict: 'ป่าตอง', district: 'กะทู้' });
  });

  it('[normal] "วารินชำราบ" (Ubon Ratchathani) — new after regeneration', () => {
    expect(resolvePlace('ลานกางเต็นท์วารินชำราบ')).toEqual({ subDistrict: 'วารินชำราบ', district: 'วารินชำราบ' });
  });
});

describe('CAM-600 negative cases, re-run against the larger 503-row (was 422) shortlist', () => {
  // A longer shortlist is a wider collision surface — this is where the
  // ordinary-vocabulary/length-floor guards get re-tested for real, not just
  // in theory. All six must still resolve to nothing.
  it.each([
    'ลานกางเต็นท์ริมถนน',
    'ลานกางเต็นท์ใกล้ตลาด',
    'ลานกางเต็นท์ริมบ่อ',
    'ลานกางเต็นท์ทางเหนือ',
    'ลานกางเต็นท์ที่สะอาด',
    'ลานกางเต็นท์บรรยากาศสำราญ',
  ])('[EC, regression] "%s" is not hijacked into a sub-district search', (text) => {
    expect(resolvePlace(text)).toEqual({});
  });
});

describe('CAM-606 — siblings unchanged after regeneration', () => {
  it('[regression] "แม่ริม" still resolves as a district (not itself a shortlisted sub-district)', () => {
    expect(resolvePlace('ลานกางเต็นท์แม่ริม')).toEqual({ district: 'แม่ริม' });
  });

  it('[regression] "อำเภอปาย" still resolves as an explicit-marker district (CAM-599)', () => {
    expect(resolvePlace('แคมป์ที่อำเภอปาย')).toEqual({ district: 'ปาย' });
  });

  it('[regression] "เชียงใหม่" still resolves as a bare province', () => {
    expect(resolvePlace('ลานกางเต็นท์เชียงใหม่')).toEqual({ province: 'Chiang Mai' });
  });

  it('[regression] "ใกล้เขาใหญ่" still resolves as the landmark, unchanged', () => {
    expect(resolvePlace('ลานกางเต็นท์ใกล้เขาใหญ่')).toEqual({ near: 'เขาใหญ่', nearIsLandmark: true });
  });
});

describe('CAM-606 — collision-risk finding, FIXED by its own follow-up (CAM-609)', () => {
  // FINDING (originally reported here, see PR body / ticket note): "ตำนาน"
  // ("legend"/"myth") is one of the 74 newly-covered names. It is ordinary
  // Thai vocabulary, exactly 5 Thai characters (the length floor is "< 5
  // excluded", so 5 survives), and was NOT a member of
  // `AMBIGUOUS_SUBDISTRICT_VOCAB_TH` (which only curated เหนือ/สะอาด/สำราญ at
  // the time this story shipped) — the exact same guard-gap class CAM-600's
  // own docblock names for สะอาด/สำราญ (a common word landing exactly on the
  // floor). An entirely ordinary phrase about a "legendary"/"iconic" tent was
  // being hijacked into a real-place hint (เมืองพัทลุง). This story's own scope
  // deliberately did NOT touch the resolver/guards (out of file surface) —
  // these two assertions originally DOCUMENTED that bug so it would be
  // visible here, not silently discovered again. CAM-609 is the named
  // follow-up: it added "ตำนาน" to `AMBIGUOUS_SUBDISTRICT_VOCAB_TH` (closing
  // this exact finding) AND a new explicit-`ตำบล`-marker path so the
  // genuinely correct form ("ลานกางเต็นท์ตำบลตำนาน") keeps resolving — see
  // `__tests__/cam-609-tamnan-false-hint.test.ts` for the full before/after
  // coverage. These two assertions are updated here to the now-fixed
  // behavior rather than left pinning a bug CAM-609 already closed.
  it('[regression, fixed by CAM-609] "เต็นท์รุ่นตำนาน" (an "iconic/legendary-edition tent") no longer hints ตำบลตำนาน (เมืองพัทลุง)', () => {
    expect(resolvePlace('อยากได้เต็นท์รุ่นตำนาน')).toEqual({});
  });

  it('[regression, fixed by CAM-609] "ลานกางเต็นท์ในตำนาน" ("a legendary campsite") — same collision, no longer hijacked', () => {
    expect(resolvePlace('ลานกางเต็นท์ในตำนาน')).toEqual({});
  });
});
