/**
 * lib/facet-scores.ts — CAM-464: derived facet scores (family / beginner /
 * road_access), rules-only v1, COMPUTE-ON-READ.
 *
 * Pure function — no Prisma, no clock, no randomness, no I/O inside this
 * module (D1/D6, mirrors the `lib/listing-completeness.ts` precedent). The
 * only callers are `lib/ai/tools/get-camp-detail.ts::executeGetCampDetail`
 * and `lib/ai/tools/compare-camps.ts::executeCompareCamps`, which map their
 * already-selected `options {code,group}` + `minimumAge` (+ `campSiteType`,
 * CAM-518) fields into `FacetScoreInput` before calling `computeFacetScores`.
 * This split is what lets the scoring rule be unit-tested with zero DB/mocking.
 *
 * The weight tables (D3), the constants, and the BR-1..BR-7 rules are copied
 * byte-for-byte from the story + tech spec:
 * docs/specs/ai-assistant/assistant-answers-real-camper-asks-gap-closure-w1/
 * CAM-464-derived-facet-scores-family-beginner-road-access-f/{story.md,tech.md}
 * Do not retype the weight/threshold values anywhere else — import from here.
 *
 * CAM-518 (S6) — enriches `beginner` with the S1-S5 comfort codes (HOTW/
 * GLAMP/CHIC/LIGT/RESV) and adds a DERIVED `camper_type` facet (BEGN/INMD/
 * PROF) composed on-read from the camp's own comfort vs. hardship signals.
 * Owner rule: Camper Type is DERIVED, never stored — no schema/column/
 * migration; see docs/specs/campsite-data-taxonomy/CAM-512/
 * CAM-518-camper-type-facet/story.md.
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

/** D2 — closed set, engineering-owned (ADR-003). v1 = family/beginner/road_access; CAM-518 (S6) adds `camper_type`. */
export type FacetId = 'family' | 'beginner' | 'road_access' | 'camper_type';

/** CAM-518 — the resolved categorical label for the `camper_type` facet (BEGN มือใหม่ / INMD มือเก่า / PROF มืออาชีพ). */
export type CamperTypeLabel = 'BEGN' | 'INMD' | 'PROF';

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
  /**
   * CAM-518 — the resolved categorical label; ONLY `camper_type` carries this
   * (undefined on family/beginner/road_access). Minimal additive extension to
   * the shape (api.md rule 12) — every pre-existing consumer keeps compiling.
   */
  label?: CamperTypeLabel;
}

/** Exactly what `getCampDetail`'s select already returns — zero new query cost (D4). */
export interface FacetScoreInput {
  options: { code: string; group: string }[];
  minimumAge: number | null;
  /**
   * CAM-518 — `CampSite.campSiteType` (e.g. 'GLAMP'), read for the enriched
   * `beginner` facet + `camper_type`. OPTIONAL so every existing
   * `FacetScoreInput` fixture (built before CAM-518) keeps compiling.
   */
  campSiteType?: string | null;
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
/** CAM-518 BR-2 — the beginner-friendliness thresholds `camper_type`'s composite score is bucketed against. */
export const CAMPER_TYPE_BEGN_THRESHOLD = 0.6;
export const CAMPER_TYPE_PROF_THRESHOLD = 0.4;

/** BR-1 — family weight table, Σ = 1.00 (5 slots). */
const FAMILY_WEIGHTS = {
  toilet: 0.25,
  shower: 0.2,
  driveUp: 0.25,
  waterPower: 0.15,
  kidsWelcome: 0.15,
} as const;

/**
 * BR-2 — beginner weight table, Σ = 1.00 (12 slots). CAM-518 (S6) enriches
 * the original 7-slot table (driveUp/toilet/shower/power/water/food/
 * gearRental, kept unchanged in spirit/order) with 5 new comfort slots the
 * S1-S5 taxonomy stories introduced: hotWater (HOTW), glamp (campSiteType),
 * chic (CHIC), lighting (LIGT), reservable (RESV). Re-balanced so the table
 * still sums to 1.00 (the score-bound invariant on `FacetScore.score`).
 */
const BEGINNER_WEIGHTS = {
  driveUp: 0.2,
  toilet: 0.08,
  shower: 0.08,
  power: 0.07,
  water: 0.07,
  food: 0.07,
  gearRental: 0.12,
  hotWater: 0.09,
  chic: 0.09,
  glamp: 0.08,
  lighting: 0.03,
  reservable: 0.02,
} as const;

const FAMILY_SLOT_COUNT = 5;
const BEGINNER_SLOT_COUNT = 12;

/**
 * CAM-518 — `camper_type` weight tables. COMFORT signals pull the composite
 * toward BEGN; HARDSHIP signals pull it toward PROF. Each table sums to 1.00
 * independently; the composite nets them (see `computeCamperTypeFacet`).
 */
const CAMPER_TYPE_COMFORT_WEIGHTS = {
  driveUp: 0.2,
  gearRental: 0.15,
  glamp: 0.15,
  hotWater: 0.12,
  toiletOrShower: 0.12,
  chic: 0.12,
  waterPower: 0.08,
  lighting: 0.06,
} as const;

const CAMPER_TYPE_HARDSHIP_WEIGHTS = {
  hardAccess: 0.25,
  camperStyle: 0.25,
  rusticTerrain: 0.2,
  noGearRental: 0.2,
  minimalFacilities: 0.1,
} as const;

/** 8 comfort + 5 hardship — the confidence denominator for `camper_type`. */
const CAMPER_TYPE_SLOT_COUNT = 13;

/** Fixed evidence-pick order for the family/beginner "any of" slots (BR-6 deterministic ordering). */
const WATER_POWER_ORDER = ['POTA', 'WATE', 'ELEC'] as const;
const FOOD_ORDER = ['REST', 'CAFE', 'MIMT', 'GRIL'] as const;
const HARD_ACCESS_ORDER = ['BAOT', 'HIKE'] as const;
const ROAD_ACCESS_OTHER_ORDER = ['BAOT', 'HIKE', 'WALK'] as const;

/** CAM-518 — fixed evidence-pick order for `camper_type`'s "any of" slots (BR-6 deterministic ordering). */
const CAMPER_TYPE_TOILET_SHOWER_ORDER = ['TOIL', 'SHOW'] as const;
const CAMPER_TYPE_POWER_WATER_ORDER = ['ELEC', 'WATE'] as const;
const CAMPER_TYPE_HARD_ACCESS_ORDER = ['HIKE', 'WALK'] as const;
const CAMPER_TYPE_STYLE_HARDSHIP_ORDER = ['DIFT', 'IDMT'] as const;
const CAMPER_TYPE_RUSTIC_TERRAIN_ORDER = ['FORE', 'MTNS', 'CAVE'] as const;

const GEAR_RENTAL_GROUP = 'Equipment for rent';
/** CAM-518 — the `Internal facility` MasterData group, used for the `minimalFacilities` hardship signal. */
const INTERNAL_FACILITY_GROUP = 'Internal facility';
/** CAM-518 — `minimalFacilities` fires only when the camp has ZERO internal-facility codes (never a false-trigger on a comfort-loaded camp missing just one or two). */
const CAMPER_TYPE_MINIMAL_FACILITIES_MAX = 0;

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
 * BR-2 BEGINNER — 12 slots (proves AC-2; conflict = EC-2). CAM-518 (S6)
 * enriches the original 7 slots with 5 new comfort signals (HOTW/GLAMP/CHIC/
 * LIGT/RESV, checked in that order right after the original slots — BR-1).
 * Hard-access cap: drive-up absent AND boat/hike-only present clamps the
 * score to 0.30 and appends a `limits` entry (BR-3 region, unchanged). EC-2
 * (drive-up but zero comfort) needs no special case — it falls out of the
 * same weight table + confidence formula (driveUp fires alone ⇒ low
 * confidence ⇒ not answerable).
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
  // CAM-518 BR-1 — the 5 new comfort signals, in the story's stated order.
  if (codes.has('HOTW')) {
    score += BEGINNER_WEIGHTS.hotWater;
    firedSupportSlots += 1;
    evidence.push({ type: 'field', ref: 'HOTW', effect: 'supports' });
  }
  if (input.campSiteType === 'GLAMP') {
    score += BEGINNER_WEIGHTS.glamp;
    firedSupportSlots += 1;
    evidence.push({ type: 'field', ref: 'campSiteType', effect: 'supports' });
  }
  if (codes.has('CHIC')) {
    score += BEGINNER_WEIGHTS.chic;
    firedSupportSlots += 1;
    evidence.push({ type: 'field', ref: 'CHIC', effect: 'supports' });
  }
  if (codes.has('LIGT')) {
    score += BEGINNER_WEIGHTS.lighting;
    firedSupportSlots += 1;
    evidence.push({ type: 'field', ref: 'LIGT', effect: 'supports' });
  }
  if (codes.has('RESV')) {
    score += BEGINNER_WEIGHTS.reservable;
    firedSupportSlots += 1;
    evidence.push({ type: 'field', ref: 'RESV', effect: 'supports' });
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
 * CAM-518 (S6) BR-2 — CAMPER_TYPE: a DERIVED categorical facet (BEGN/INMD/
 * PROF), never stored (owner rule). Two independent weighted tallies —
 * COMFORT (pulls toward BEGN) and HARDSHIP (pulls toward PROF), each Σ=1.00
 * — net into a single 0..1 composite score:
 *   netScore = comfortRaw - hardshipRaw  ∈ [-1, 1]
 *   score    = (netScore + 1) / 2        ∈ [0, 1]
 * score >= CAMPER_TYPE_BEGN_THRESHOLD ⇒ BEGN; score <= CAMPER_TYPE_PROF_THRESHOLD
 * ⇒ PROF; otherwise INMD (the honest middle, not a forced binary).
 *
 * BR-3 honesty gate (stricter than the other 3 facets, AC-3/EC-1): a
 * categorical label is a stronger claim than a continuous score, so this
 * facet is OMITTED (returns null) whenever confidence < ANSWERABLE_CONFIDENCE
 * — never emitted with `answerable:false` the way family/beginner/road_access
 * are. `evidence.length === 0` is checked first (BR-5, mirrors the others).
 *
 * `noGearRental` and `minimalFacilities` are ABSENCE-based hardship signals
 * (mirrors road_access's honest "no DRIV" treatment) — they fire on genuinely
 * rustic camps, but the confidence gate above stops them from alone forcing a
 * low-confidence PROF guess on a merely sparse/new listing (EC-1).
 */
function computeCamperTypeFacet(input: FacetScoreInput): FacetScore | null {
  const codes = codeSet(input.options);
  const evidence: FacetEvidence[] = [];
  let comfortRaw = 0;
  let hardshipRaw = 0;
  let firedSlots = 0;

  // COMFORT (toward BEGN) — 8 slots.
  if (codes.has('DRIV')) {
    comfortRaw += CAMPER_TYPE_COMFORT_WEIGHTS.driveUp;
    firedSlots += 1;
    evidence.push({ type: 'field', ref: 'DRIV', effect: 'supports' });
  }
  const gearRentalCodes = input.options
    .filter((o) => o.group === GEAR_RENTAL_GROUP)
    .map((o) => o.code)
    .sort();
  if (gearRentalCodes.length > 0) {
    comfortRaw += CAMPER_TYPE_COMFORT_WEIGHTS.gearRental;
    firedSlots += 1;
    evidence.push({ type: 'field', ref: gearRentalCodes[0], effect: 'supports' });
  }
  if (input.campSiteType === 'GLAMP') {
    comfortRaw += CAMPER_TYPE_COMFORT_WEIGHTS.glamp;
    firedSlots += 1;
    evidence.push({ type: 'field', ref: 'campSiteType', effect: 'supports' });
  }
  if (codes.has('HOTW')) {
    comfortRaw += CAMPER_TYPE_COMFORT_WEIGHTS.hotWater;
    firedSlots += 1;
    evidence.push({ type: 'field', ref: 'HOTW', effect: 'supports' });
  }
  const toiletOrShowerCode = firstPresent(codes, CAMPER_TYPE_TOILET_SHOWER_ORDER);
  if (toiletOrShowerCode) {
    comfortRaw += CAMPER_TYPE_COMFORT_WEIGHTS.toiletOrShower;
    firedSlots += 1;
    evidence.push({ type: 'field', ref: toiletOrShowerCode, effect: 'supports' });
  }
  if (codes.has('CHIC')) {
    comfortRaw += CAMPER_TYPE_COMFORT_WEIGHTS.chic;
    firedSlots += 1;
    evidence.push({ type: 'field', ref: 'CHIC', effect: 'supports' });
  }
  const powerWaterCode = firstPresent(codes, CAMPER_TYPE_POWER_WATER_ORDER);
  if (powerWaterCode) {
    comfortRaw += CAMPER_TYPE_COMFORT_WEIGHTS.waterPower;
    firedSlots += 1;
    evidence.push({ type: 'field', ref: powerWaterCode, effect: 'supports' });
  }
  if (codes.has('LIGT')) {
    comfortRaw += CAMPER_TYPE_COMFORT_WEIGHTS.lighting;
    firedSlots += 1;
    evidence.push({ type: 'field', ref: 'LIGT', effect: 'supports' });
  }

  // HARDSHIP (toward PROF) — 5 slots.
  const hardAccessCode = firstPresent(codes, CAMPER_TYPE_HARD_ACCESS_ORDER);
  if (hardAccessCode) {
    hardshipRaw += CAMPER_TYPE_HARDSHIP_WEIGHTS.hardAccess;
    firedSlots += 1;
    evidence.push({ type: 'field', ref: hardAccessCode, effect: 'limits' });
  }
  const styleHardshipCode = firstPresent(codes, CAMPER_TYPE_STYLE_HARDSHIP_ORDER);
  if (styleHardshipCode) {
    hardshipRaw += CAMPER_TYPE_HARDSHIP_WEIGHTS.camperStyle;
    firedSlots += 1;
    evidence.push({ type: 'field', ref: styleHardshipCode, effect: 'limits' });
  }
  const rusticTerrainCode = firstPresent(codes, CAMPER_TYPE_RUSTIC_TERRAIN_ORDER);
  if (rusticTerrainCode) {
    hardshipRaw += CAMPER_TYPE_HARDSHIP_WEIGHTS.rusticTerrain;
    firedSlots += 1;
    evidence.push({ type: 'field', ref: rusticTerrainCode, effect: 'limits' });
  }
  if (gearRentalCodes.length === 0) {
    hardshipRaw += CAMPER_TYPE_HARDSHIP_WEIGHTS.noGearRental;
    firedSlots += 1;
    evidence.push({ type: 'field', ref: 'gearRental', effect: 'limits' });
  }
  const facilityCount = input.options.filter((o) => o.group === INTERNAL_FACILITY_GROUP).length;
  if (facilityCount <= CAMPER_TYPE_MINIMAL_FACILITIES_MAX) {
    hardshipRaw += CAMPER_TYPE_HARDSHIP_WEIGHTS.minimalFacilities;
    firedSlots += 1;
    evidence.push({ type: 'field', ref: 'facilityCount', effect: 'limits' });
  }

  // BR-5: empty evidence ⇒ absent.
  if (evidence.length === 0) return null;

  const confidence = round2(firedSlots / CAMPER_TYPE_SLOT_COUNT);
  // BR-3 (stricter honesty gate) — a categorical label is OMITTED, never
  // emitted low-confidence (AC-3/EC-1), unlike the other 3 facets.
  if (confidence < ANSWERABLE_CONFIDENCE) return null;

  const netScore = comfortRaw - hardshipRaw;
  const score = round2((netScore + 1) / 2);
  const label: CamperTypeLabel =
    score >= CAMPER_TYPE_BEGN_THRESHOLD ? 'BEGN' : score <= CAMPER_TYPE_PROF_THRESHOLD ? 'PROF' : 'INMD';

  return {
    facet: 'camper_type',
    score,
    confidence,
    answerable: true,
    evidence,
    source: 'rules',
    label,
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
  camper_type: computeCamperTypeFacet,
} satisfies Record<FacetId, (input: FacetScoreInput) => FacetScore | null>;

/** Fixed emission order (BR-6 deterministic ordering) — family, beginner, road_access, camper_type. */
const FACET_ORDER: FacetId[] = ['family', 'beginner', 'road_access', 'camper_type'];

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
