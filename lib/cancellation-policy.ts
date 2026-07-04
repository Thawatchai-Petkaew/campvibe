/**
 * lib/cancellation-policy.ts — PREP-2 (CAM-268)
 *
 * Single seam for resolving a CampSite.cancellationPolicy value (closed enum, see
 * ADR-003 + prisma/schema.prisma) into the Thai/EN copy defined in
 * locales/translations.json (`campground.cancellationPolicy.*`). Never inferred from
 * price or any other field — a camp with no policy set always resolves to the
 * explicit "not set" copy (AC-3).
 */

/** The four closed values, in the same order as the Prisma enum. */
export const CANCELLATION_POLICY_VALUES = [
  'FLEXIBLE',
  'MODERATE',
  'STRICT',
  'NON_REFUNDABLE',
] as const;

export type CancellationPolicyValue = (typeof CANCELLATION_POLICY_VALUES)[number];

/** Narrows an unknown value (e.g. from a serialized API response) to the closed set. */
export function isCancellationPolicyValue(value: unknown): value is CancellationPolicyValue {
  return (
    typeof value === 'string' &&
    (CANCELLATION_POLICY_VALUES as readonly string[]).includes(value)
  );
}

/** Shape of the `campground.cancellationPolicy` i18n branch this module reads from. */
export interface CancellationPolicyCopy {
  title: string;
  notSet: string;
  FLEXIBLE: string;
  MODERATE: string;
  STRICT: string;
  NON_REFUNDABLE: string;
}

/**
 * resolveCancellationPolicyCopy — AC-2/AC-3: returns the exact copy to render for a
 * camp's cancellationPolicy. `policy` is whatever the serialized CampSite carries
 * (string | null | undefined) — anything that is not one of the four closed values
 * (including null/undefined/an unrecognized string) resolves to `copy.notSet`.
 */
export function resolveCancellationPolicyCopy(
  policy: unknown,
  copy: CancellationPolicyCopy
): string {
  return isCancellationPolicyValue(policy) ? copy[policy] : copy.notSet;
}
