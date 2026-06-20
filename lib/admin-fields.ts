import type { UserRole } from '@/types/api';

/**
 * Admin-only fields that may only be written by a platform admin (role === 'ADMIN').
 * For any other caller, these fields are stripped from the update payload silently —
 * the existing DB values are preserved and the rest of the request proceeds normally.
 */
const ADMIN_ONLY_FIELDS = ['isVerified', 'verifiedDate'] as const;
type AdminOnlyField = (typeof ADMIN_ONLY_FIELDS)[number];

export type ValidatedCampSiteData = Record<string, unknown>;

/**
 * Strip admin-only fields from `data` unless the caller's role is 'ADMIN'.
 * Returns a new object; does not mutate the input.
 */
export function applyAdminOnlyFields(
  data: ValidatedCampSiteData,
  callerRole: UserRole | undefined
): ValidatedCampSiteData {
  if (callerRole === 'ADMIN') {
    return data;
  }

  const sanitised = { ...data };
  for (const field of ADMIN_ONLY_FIELDS) {
    delete sanitised[field as string];
  }
  return sanitised;
}
