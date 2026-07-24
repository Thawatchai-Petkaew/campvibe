/**
 * lib/facet-scores.ts — CAM-464: derived facet scores (family / beginner /
 * road_access), rules-only v1, COMPUTE-ON-READ.
 *
 * Pure function — no Prisma, no clock, no randomness, no I/O inside this
 * module (D1/D6, mirrors the `lib/listing-completeness.ts` precedent). The
 * only caller is `lib/ai/tools/get-camp-detail.ts::executeGetCampDetail`,
 * which maps its already-selected `options {code,group}` + `minimumAge`
 * fields into `FacetScoreInput` before calling `computeFacetScores`. This
 * split is what lets the scoring rule be unit-tested with zero DB/mocking.
 *
 * The weight tables (D3), the constants, and the BR-1..BR-7 rules are copied
 * byte-for-byte from the story + tech spec:
 * docs/specs/ai-assistant/assistant-answers-real-camper-asks-gap-closure-w1/
 * CAM-464-derived-facet-scores-family-beginner-road-access-f/{story.md,tech.md}
 * Do not retype the weight/threshold values anywhere else — import from here.
 *
 * BR-5 (evidence mandatory, P13 provenance): every produced facet score
 * carries a NON-EMPTY evidence list naming the exact fields that drove it. A
 * facet whose evidence would be empty is NOT produced — the facet is ABSENT
 * (never a fake 0-score with no reason), which routes the assistant to the
 * honest "ข้อมูลไม่พอ" fallback (AC-4/EC-1/EC-4).
 *
 * BR-6 (deterministic/reproducible, P13): identical input ⇒ identical score,
 * confidence, and evidence, in fixed slot order — pure function, no AI, no
 * randomness, no I/O.
 */

/** D2 — closed set, engineering-owned (ADR-003). v1 = the three the AC pins. */
export type FacetId = 'family' | 'beginner' | 'road_access';

/** v1 = 'rules' for every facet; phase-2 adds 'reviews' | 'host'. */
export type FacetSource = 'rules';

export interface FacetEvidence {
  /** v1 rules-only provenance; phase-2: 'review' | 'host'. */
  type: 'field';
  /** A MasterData code ('TOIL', 'DRIV') or a CampSite field ('minimumAge'). */
  ref: string;
  /** supports = raised the score; limits = capped/lowered it. */
  effect: 'supports' | 'limits';
  /** OPTIONAL stable machine caveat tag (NOT prose), e.g. 'vehicle_class_unknown'. */
  note?: string;
}

export interface FacetScore {
  facet: FacetId;
  /** 0.00–1.00, 2 dp (deterministic). */
  score: number;
  /** 0.00–1.00, 2 dp. */
  confidence: number;
  /** confidence >= ANSWERABLE_CONFIDENCE — the honesty gate (BR-4). */
  answerable: boolean;
  /** NON-EMPTY (BR-5); a facet with empty evidence is NOT emitted (absent). */
  evidence: FacetEvidence[];
  source: FacetSource;
}

/** Exactly what `getCampDetail`'s select already returns — zero new query cost (D4). */
export interface FacetScoreInput {
  options: { code: string; group: string }[];
  minimumAge: number | null;
}

/**
 * D3 constants — named, single-source. Changing a value here is the ONE
 * place to change it (mirrors `listing-completeness`'s `PUBLISH_MIN_COMPLETENESS`
 * single-source pattern).
 */
export const ANSWERABLE_CONFIDENCE = 0.3;
export const ROAD_ACCESS_CONFIDENCE_CAP = 0.5;
export const FAMILY_AGE_CEILING = 12;
export const FAMILY_AGE_RESTRICTED_CAP = 0.4;
export const ROAD_DRIVABLE_SCORE = 0.7;
export const ROAD_NOT_DRIVABLE_SCORE = 0.15;

/** BR-1 — family weight table, Σ = 1.00 (5 slots). */
const FAMILY_WEIGHTS = {
  toilet: 0.25,
  shower: 0.2,
  driveUp: 0.25,
  waterPower: 0.15,
  kidsWelcome: 0.15,
} as const;

/** BR-2 — beginner weight table, Σ = 1.00 (7 slots). */
const BEGINNER_WEIGHTS = {
  driveUp: 0.35,
  toilet: 0.1,
  shower: 0.1,
  power: 0.1,
  water: 0.1,
  food: 0.1,
  gearRental: 0.15,
} as const;

const FAMILY_SLOT_COUNT = 5;
const BEGINNER_SLOT_COUNT = 7;

/** Fixed evidence-pick order for the family/beginner "any of" slots (BR-6 deterministic ordering). */
const WATER_POWER_ORDER = ['POTA', 'WATE', 'ELEC'] as const;
const FOOD_ORDER = ['REST', 'CAFE', 'MIMT', 'GRIL'] as const;
const HARD_ACCESS_ORDER = ['BAOT', 'HIKE'] as const;
const ROAD_ACCESS_OTHER_ORDER = ['BAOT', 'HIKE', 'WALK'] as const;

const GEAR_RENTAL_GROUP = 'Equipment for rent';

/** 2 dp per D3 — kept as one helper so rounding never drifts between facets. */
function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

function codeSet(options: FacetScoreInput['options']): Set<string> {
  return new Set(options.map((o) => o.code));
}

/** The first code (in `order`) present in `codes`, or undefined if none fire. */
function firstPresent(codes: Set<string>, order: readonly string[]): string | undefined {
  return order.find((code) => codes.has(code));
}

/**
 * BR-1 FAMILY — 5 slots (proves AC-1; absent = AC-4/EC-1). Age ceiling: a
 * `minimumAge >= FAMILY_AGE_CEILING` clamps the score to
 * FAMILY_AGE_RESTRICTED_CAP and appends a `limits` evidence entry (the age
 * gate makes the camp less family-suitable, stated as evidence).
 * `kidsWelcome` (age null or <= 6) and the age ceiling (age >= 12) can never
 * both fire for the same input, so there is no double count. Confidence
 * counts only fired SUPPORT slots (the `limits` entry never counts).
 */
function computeFamilyFacet(input: FacetScoreInput): FacetScore | null {
  const codes = codeSet(input.options);
  const evidence: FacetEvidence[] = [];
  let score = 0;
  let firedSupportSlots = 0;

  if (codes.has('TOIL')) {
    score += FAMILY_WEIGHTS.toilet;
    firedSupportSlots += 1;
    evidence.push({ type: 'field', ref: 'TOIL', effect: 'supports' });
  }
  if (codes.has('SHOW')) {
    score += FAMILY_WEIGHTS.shower;
    firedSupportSlots += 1;
    evidence.push({ type: 'field', ref: 'SHOW', effect: 'supports' });
  }
  if (codes.has('DRIV')) {
    score += FAMILY_WEIGHTS.driveUp;
    firedSupportSlots += 1;
    evidence.push({ type: 'field', ref: 'DRIV', effect: 'supports' });
  }
  const waterPowerCode = firstPresent(codes, WATER_POWER_ORDER);
  if (waterPowerCode) {
    score += FAMILY_WEIGHTS.waterPower;
    firedSupportSlots += 1;
    evidence.push({ type: 'field', ref: waterPowerCode, effect: 'supports' });
  }
  const kidsWelcome = input.minimumAge == null || input.minimumAge <= 6;
  if (kidsWelcome) {
    score += FAMILY_WEIGHTS.kidsWelcome;
    firedSupportSlots += 1;
    evidence.push({ type: 'field', ref: 'minimumAge', effect: 'supports' });
  }

  if (input.minimumAge != null && input.minimumAge >= FAMILY_AGE_CEILING) {
    score = Math.min(score, FAMILY_AGE_RESTRICTED_CAP);
    evidence.push({ type: 'field', ref: 'minimumAge', effect: 'limits' });
  }

  // BR-5: empty evidence ⇒ absent (never a fake 0-score with no reason).
  if (evidence.length === 0) return null;

  const confidence = round2(firedSupportSlots / FAMILY_SLOT_COUNT);
  return {
    facet: 'family',
    score: round2(score),
    confidence,
    answerable: confidence >= ANSWERABLE_CONFIDENCE,
    evidence,
    source: 'rules',
  };
}

/**
 * BR-2 BEGINNER — 7 slots (proves AC-2; conflict = EC-2). Hard-access cap:
 * drive-up absent AND boat/hike-only present clamps the score to 0.30 and
 * appends a `limits` entry (BR-3 region). EC-2 (drive-up but zero comfort)
 * needs no special case — it falls out of the same weight table + confidence
 * formula (driveUp fires alone ⇒ low confidence ⇒ not answerable).
 */
function computeBeginnerFacet(input: FacetScoreInput): FacetScore | null {
  const codes = codeSet(input.options);
  const evidence: FacetEvidence[] = [];
  let score = 0;
  let firedSupportSlots = 0;

  if (codes.has('DRIV')) {
    score += BEGINNER_WEIGHTS.driveUp;
    firedSupportSlots += 1;
    evidence.push({ type: 'field', ref: 'DRIV', effect: 'supports' });
  }
  if (codes.has('TOIL')) {
    score += BEGINNER_WEIGHTS.toilet;
    firedSupportSlots += 1;
    evidence.push({ type: 'field', ref: 'TOIL', effect: 'supports' });
  }
  if (codes.has('SHOW')) {
    score += BEGINNER_WEIGHTS.shower;
    firedSupportSlots += 1;
    evidence.push({ type: 'field', ref: 'SHOW', effect: 'supports' });
  }
  if (codes.has('ELEC')) {
    score += BEGINNER_WEIGHTS.power;
    firedSupportSlots += 1;
    evidence.push({ type: 'field', ref: 'ELEC', effect: 'supports' });
  }
  if (codes.has('POTA')) {
    score += BEGINNER_WEIGHTS.water;
    firedSupportSlots += 1;
    evidence.push({ type: 'field', ref: 'POTA', effect: 'supports' });
  }
  const foodCode = firstPresent(codes, FOOD_ORDER);
  if (foodCode) {
    score += BEGINNER_WEIGHTS.food;
    firedSupportSlots += 1;
    evidence.push({ type: 'field', ref: foodCode, effect: 'supports' });
  }
  const gearRentalCodes = input.options
    .filter((o) => o.group === GEAR_RENTAL_GROUP)
    .map((o) => o.code)
    .sort();
  if (gearRentalCodes.length > 0) {
    score += BEGINNER_WEIGHTS.gearRental;
    firedSupportSlots += 1;
    evidence.push({ type: 'field', ref: gearRentalCodes[0], effect: 'supports' });
  }

  if (!codes.has('DRIV')) {
    const hardAccessCode = firstPresent(codes, HARD_ACCESS_ORDER);
    if (hardAccessCode) {
      score = Math.min(score, 0.3);
      evidence.push({ type: 'field', ref: hardAccessCode, effect: 'limits' });
    }
  }

  // BR-5: empty evidence ⇒ absent.
  if (evidence.length === 0) return null;

  const confidence = round2(firedSupportSlots / BEGINNER_SLOT_COUNT);
  return {
    facet: 'beginner',
    score: round2(score),
    confidence,
    answerable: confidence >= ANSWERABLE_CONFIDENCE,
    evidence,
    source: 'rules',
  };
}

/**
 * ROAD_ACCESS — special-cased single-dimension facet (proves AC-3/EC-3; the
 * P13 honesty demo). Reads the `Access type` group only. Confidence is
 * CAPPED at ROAD_ACCESS_CONFIDENCE_CAP for EVERY produced outcome (BR-4) —
 * `Access type` cannot distinguish sedan/pickup/4WD (schema-gap PREP-7), so
 * this facet never over-claims certainty even when the access mode itself is
 * known with certainty. A `DRIV`-present camp always carries the
 * `vehicle_class_unknown` note — the model phrases the caveat, this is only
 * the stable machine hook (P13 sedan-honesty rule).
 */
function computeRoadAccessFacet(input: FacetScoreInput): FacetScore | null {
  const codes = codeSet(input.options);
  const hasDriv = codes.has('DRIV');

  if (hasDriv) {
    return {
      facet: 'road_access',
      score: ROAD_DRIVABLE_SCORE,
      confidence: ROAD_ACCESS_CONFIDENCE_CAP,
      answerable: true,
      evidence: [{ type: 'field', ref: 'DRIV', effect: 'supports', note: 'vehicle_class_unknown' }],
      source: 'rules',
    };
  }

  const otherAccessCodes = ROAD_ACCESS_OTHER_ORDER.filter((code) => codes.has(code));
  if (otherAccessCodes.length === 0) {
    // No access codes at all ⇒ evidence would be empty ⇒ absent (AC-4).
    return null;
  }

  return {
    facet: 'road_access',
    score: ROAD_NOT_DRIVABLE_SCORE,
    confidence: ROAD_ACCESS_CONFIDENCE_CAP,
    answerable: true,
    evidence: otherAccessCodes.map((code) => ({ type: 'field', ref: code, effect: 'limits' }) as const),
    source: 'rules',
  };
}

/**
 * D2 confirmation — a `satisfies Record<FacetId, …>` rule table (mirrors
 * `listing-completeness`'s `SATISFIED_WHEN`): a facet added to `FacetId` with
 * no entry here is a compile error, not a silent gap.
 */
const FACET_COMPUTERS = {
  family: computeFamilyFacet,
  beginner: computeBeginnerFacet,
  road_access: computeRoadAccessFacet,
} satisfies Record<FacetId, (input: FacetScoreInput) => FacetScore | null>;

/** Fixed emission order (BR-6 deterministic ordering) — family, beginner, road_access. */
const FACET_ORDER: FacetId[] = ['family', 'beginner', 'road_access'];

/**
 * BR-6/P13 — computes the deterministic facet-score set from the current
 * atomic field state. Same input ALWAYS yields the same output (no AI, no
 * randomness, no I/O). A facet whose evidence would be empty is OMITTED from
 * the result (BR-5) — never a fake 0-score with no reason.
 */
export function computeFacetScores(input: FacetScoreInput): FacetScore[] {
  const out: FacetScore[] = [];
  for (const facet of FACET_ORDER) {
    const result = FACET_COMPUTERS[facet](input);
    if (result) out.push(result);
  }
  return out;
}
