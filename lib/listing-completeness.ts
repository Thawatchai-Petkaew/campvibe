/**
 * lib/listing-completeness.ts — CAM-304: deterministic, rule-based listing
 * completeness score (0–100) + itemized missing-field list for a Host's own
 * campsite (M1 "Listing Truth").
 *
 * Pure function — takes plain field values/counts only, NO Prisma client
 * inside this module (BR-1: compute-on-the-fly, NEVER stored/cached as the
 * source of truth — Atomic Data Framework §12). The only caller that reads
 * from the DB is app/api/campsites/[id]/completeness/route.ts, which converts
 * the raw CampSite scalar fields + relation counts into `ListingCompletenessInput`
 * before calling `computeListingCompleteness`. This split is what lets the
 * scoring rule be unit-tested with zero DB/mocking.
 *
 * The weight table (BR-3), the extra-fee transparency rule (BR-5), and the
 * missing-item shape + verbatim Thai labels (BR-6) are copied byte-for-byte
 * from the story:
 * docs/specs/m1-data-trust/m1-listing-truth-ราคา-ค่าธรรมเนียม-นโยบายยกเลิก-qu/
 * CAM-304-คะแนนความครบของ-listing-แบบ-rule-based-พร้อมรายการ/story.md
 * Do not retype the Thai labels anywhere else — import from here.
 *
 * CAM-351 (BR-5) — the `zones` criterion (weight unchanged at 10) is now
 * mode-neutral: a WHOLE-CAMP camp (`useSpotView = false`) with a stated
 * `maxGuestsPerDay >= 1` also satisfies it, so a camp that legitimately has
 * no individual spots is no longer permanently penalized. The label changes
 * to reflect both paths — see docs/specs/data-trust/
 * availability-correctness-ว่างจริง-blockeddate-part/
 * CAM-351-choose-capacity-mode-whole-camp-vs-per-spot/story.md.
 */

export type ListingCompletenessKey =
  | 'photos'
  | 'price'
  | 'cancellationPolicy'
  | 'extraFee'
  | 'zones'
  | 'amenities';

/**
 * BR-3: the minimum image count for the `photos` criterion to be satisfied.
 * Raising this later requires updating the `ยังไม่มีรูปภาพ` copy (coupled) —
 * do not change this constant without also revisiting the label.
 */
export const MIN_PHOTOS_FOR_COMPLETE = 1;

export interface ListingCompletenessCriterion {
  key: ListingCompletenessKey;
  /** BR-6 — verbatim Thai label shown in `missing` when this criterion is NOT satisfied. */
  label: string;
  /** BR-3 — this criterion's weight; the full table sums to exactly 100. */
  weight: number;
}

/**
 * BR-3/BR-6 — the fixed, testable weight table. This array's order IS the
 * fixed emission order for the `missing` list (BR-6: "Items are emitted in
 * fixed weight-table order"). Do not reorder without updating the story and
 * CAM-305 (the dashboard card that deep-links by `key`).
 */
export const LISTING_COMPLETENESS_WEIGHTS: readonly ListingCompletenessCriterion[] = [
  { key: 'photos', label: 'ยังไม่มีรูปภาพ', weight: 25 },
  { key: 'price', label: 'ยังไม่ระบุราคา', weight: 20 },
  { key: 'cancellationPolicy', label: 'ยังไม่ระบุนโยบายยกเลิก', weight: 20 },
  { key: 'extraFee', label: 'ค่าธรรมเนียมเพิ่มเติมยังระบุไม่ครบ', weight: 15 },
  // CAM-351 BR-5: mode-neutral label — replaces the old spot-only wording
  // 'ยังไม่มีโซนหรือจุดกางเต็นท์' now that a WHOLE-CAMP camp with a stated
  // capacity also satisfies this criterion (see SATISFIED_WHEN.zones below).
  { key: 'zones', label: 'ยังไม่ระบุความจุ (จำนวนรวม หรือจุดกางเต็นท์)', weight: 10 },
  { key: 'amenities', label: 'ยังไม่ระบุสิ่งอำนวยความสะดวก', weight: 10 },
] as const;

/**
 * BR-2 — atomic fields only: every input here is a machine-readable atomic
 * field or a count derived from one; no free-text field (description/feeInfo)
 * is read or interpreted anywhere in this module.
 */
export interface ListingCompletenessInput {
  /** count of Image rows attached to this camp (S4b gallery relation). */
  imageCount: number;
  /** CampSite.priceLow converted to number (Number(Decimal)), or null when unset. */
  priceLow: number | null;
  /** CampSite.isFree. */
  isFree: boolean;
  /** CampSite.extraFeeAmount converted to number (Number(Decimal)), or null when unset. */
  extraFeeAmount: number | null;
  /** CampSite.extraFeeLabel, or null/empty when unset. */
  extraFeeLabel: string | null;
  /** CampSite.cancellationPolicy, or null when the host has not set one. */
  cancellationPolicy: string | null;
  /** count of non-deleted Spot rows for this camp. */
  spotCount: number;
  /** count of MasterData rows connected via CampSite.options. */
  optionsCount: number;
  /** CAM-351 BR-5: CampSite.useSpotView — false = WHOLE-CAMP, true = PER-SPOT. */
  useSpotView: boolean;
  /** CAM-351 BR-5: CampSite.maxGuestsPerDay, or null when unset (WHOLE-CAMP entry). */
  maxGuestsPerDay: number | null;
}

export interface ListingCompletenessMissingItem {
  key: ListingCompletenessKey;
  label: string;
}

export interface ListingCompletenessResult {
  score: number;
  missing: ListingCompletenessMissingItem[];
}

/**
 * BR-5 — extra-fee transparency: satisfied when the fee status is
 * unambiguous — BOTH `extraFeeAmount` and `extraFeeLabel` present (a
 * fully-specified fee) OR BOTH empty (no extra fee — a valid, truthful
 * state). Unsatisfied ONLY on a partial fill (one set, the other empty).
 */
function isExtraFeeSatisfied(input: ListingCompletenessInput): boolean {
  const hasAmount = input.extraFeeAmount != null;
  const hasLabel = input.extraFeeLabel != null && input.extraFeeLabel !== '';
  return hasAmount === hasLabel;
}

/**
 * BR-3 — satisfied-when predicate per criterion key, in the exact same order
 * as LISTING_COMPLETENESS_WEIGHTS (kept as a Record so a missing predicate for
 * a key added to the weight table is a compile-time error, not a silent gap).
 */
const SATISFIED_WHEN: Record<
  ListingCompletenessKey,
  (input: ListingCompletenessInput) => boolean
> = {
  photos: (input) => input.imageCount >= MIN_PHOTOS_FOR_COMPLETE,
  price: (input) => input.priceLow != null || input.isFree === true,
  cancellationPolicy: (input) => input.cancellationPolicy != null,
  extraFee: isExtraFeeSatisfied,
  // CAM-351 BR-5 — fairness fix: a spot-derived count still satisfies zones
  // (unchanged CAM-304 path), OR a WHOLE-CAMP camp (`useSpotView === false`)
  // that has stated a real capacity (`maxGuestsPerDay >= 1`) also satisfies
  // it — a whole-camp camp with no individual spots is no longer permanently
  // penalized. A PER-SPOT camp with zero spots stays unsatisfied either way.
  zones: (input) =>
    input.spotCount >= 1 ||
    (input.useSpotView === false && input.maxGuestsPerDay != null && input.maxGuestsPerDay >= 1),
  amenities: (input) => input.optionsCount >= 1,
};

/**
 * BR-1/BR-2 — computes a deterministic completeness score (0–100) + itemized
 * missing-field list from the current atomic field state. Same input ALWAYS
 * yields the same output (no AI, no randomness, no I/O). Score is the sum of
 * satisfied criteria's weights (EC-2: naturally floors at 0 and can never be
 * negative or NaN, since every term added is a non-negative literal from the
 * weight table).
 */
export function computeListingCompleteness(
  input: ListingCompletenessInput
): ListingCompletenessResult {
  let score = 0;
  const missing: ListingCompletenessMissingItem[] = [];

  for (const criterion of LISTING_COMPLETENESS_WEIGHTS) {
    if (SATISFIED_WHEN[criterion.key](input)) {
      score += criterion.weight;
    } else {
      missing.push({ key: criterion.key, label: criterion.label });
    }
  }

  return { score, missing };
}

/**
 * CAM-365 BR-1: single-source publish floor. Both the client
 * (components/CampgroundForm.tsx's disabled-switch UX gate) and the server
 * (the PUT/POST /api/campsites write path) import this ONE constant — the
 * value never appears as a literal anywhere else. Changing the floor later is
 * a one-line, single-place edit. BR-2: the boundary is inclusive — a score
 * `>= PUBLISH_MIN_COMPLETENESS` permits publishing, 79 (one below) blocks it.
 */
export const PUBLISH_MIN_COMPLETENESS = 80;

/**
 * CAM-365 BR-5: the exact copy shown when a false->true publish transition is
 * rejected for scoring below PUBLISH_MIN_COMPLETENESS. Both write paths
 * (app/api/campsites/[id]/route.ts PUT, app/api/campsites/route.ts POST)
 * import this ONE function so the two routes can never drift into two
 * different phrasings of the same rejection. `{N}` (score) is the only
 * caller-supplied part; the floor itself is interpolated from
 * PUBLISH_MIN_COMPLETENESS so BR-1's "one-line edit" also covers this string.
 */
export function publishGateBlockedMessage(score: number): string {
  return `ยังเผยแพร่ไม่ได้ ต้องกรอกข้อมูลให้ครบอย่างน้อย ${PUBLISH_MIN_COMPLETENESS}% ก่อน ตอนนี้ ${score}%`;
}
