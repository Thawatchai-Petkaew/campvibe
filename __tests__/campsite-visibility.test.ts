import { describe, it, expect } from 'vitest';
import { isCampSitePublic, canViewCampSite } from '../lib/campsite-visibility';
import type { CampSiteVisibilityFields, VisibilitySession } from '../lib/campsite-visibility';

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const publicCamp: CampSiteVisibilityFields = {
  isActive: true,
  isPublished: true,
  deletedAt: null,
  operatorId: 'operator-1',
};

const unpublishedCamp: CampSiteVisibilityFields = {
  isActive: true,
  isPublished: false,
  deletedAt: null,
  operatorId: 'operator-1',
};

const inactiveCamp: CampSiteVisibilityFields = {
  isActive: false,
  isPublished: true,
  deletedAt: null,
  operatorId: 'operator-1',
};

const deletedCamp: CampSiteVisibilityFields = {
  isActive: true,
  isPublished: true,
  deletedAt: new Date('2024-01-01'),
  operatorId: 'operator-1',
};

const anonymousSession: VisibilitySession = null;

const ownerSession: VisibilitySession = {
  user: { id: 'operator-1', role: 'OPERATOR' },
};

const adminSession: VisibilitySession = {
  user: { id: 'admin-1', role: 'ADMIN' },
};

const otherUserSession: VisibilitySession = {
  user: { id: 'other-user-99', role: 'CAMPER' },
};

// ---------------------------------------------------------------------------
// isCampSitePublic — pure visibility predicate
// ---------------------------------------------------------------------------

describe('isCampSitePublic', () => {
  it('returns true for a camp that is active, published, and not deleted', () => {
    expect(isCampSitePublic(publicCamp)).toBe(true);
  });

  it('returns false when isPublished is false', () => {
    expect(isCampSitePublic(unpublishedCamp)).toBe(false);
  });

  it('returns false when isActive is false', () => {
    expect(isCampSitePublic(inactiveCamp)).toBe(false);
  });

  it('returns false when deletedAt is set (soft-deleted)', () => {
    expect(isCampSitePublic(deletedCamp)).toBe(false);
  });

  it('returns false when both isActive and isPublished are false', () => {
    expect(
      isCampSitePublic({ isActive: false, isPublished: false, deletedAt: null })
    ).toBe(false);
  });

  it('returns false when all three conditions fail', () => {
    expect(
      isCampSitePublic({ isActive: false, isPublished: false, deletedAt: new Date() })
    ).toBe(false);
  });

  it('treats undefined deletedAt (omitted by partial select) as not-deleted — camp is still public', () => {
    // A partial Prisma select that omits deletedAt returns undefined; this must
    // behave identically to null (not deleted) so the gate does not false-positive.
    expect(
      isCampSitePublic({ isActive: true, isPublished: true, deletedAt: undefined })
    ).toBe(true);
  });

  it('treats undefined deletedAt as not-deleted for an otherwise non-public camp', () => {
    // The falsy check must not accidentally make an inactive/unpublished camp public.
    expect(
      isCampSitePublic({ isActive: false, isPublished: true, deletedAt: undefined })
    ).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// canViewCampSite — full authz check
// ---------------------------------------------------------------------------

describe('canViewCampSite', () => {
  // --- Public camp -----------------------------------------------------------

  it('AC-1: public camp is visible to anonymous (null session)', () => {
    expect(canViewCampSite(publicCamp, anonymousSession)).toBe(true);
  });

  it('AC-1: public camp is visible to a logged-in user who is not the owner', () => {
    expect(canViewCampSite(publicCamp, otherUserSession)).toBe(true);
  });

  it('AC-1: public camp is visible to the owner', () => {
    expect(canViewCampSite(publicCamp, ownerSession)).toBe(true);
  });

  it('AC-1: public camp is visible to ADMIN', () => {
    expect(canViewCampSite(publicCamp, adminSession)).toBe(true);
  });

  // --- Unpublished camp ------------------------------------------------------

  it('AC-2: unpublished camp is NOT visible to anonymous', () => {
    expect(canViewCampSite(unpublishedCamp, anonymousSession)).toBe(false);
  });

  it('AC-2: unpublished camp is NOT visible to a different logged-in user', () => {
    expect(canViewCampSite(unpublishedCamp, otherUserSession)).toBe(false);
  });

  it('AC-3: unpublished camp IS visible to its owner', () => {
    expect(canViewCampSite(unpublishedCamp, ownerSession)).toBe(true);
  });

  it('AC-4: unpublished camp IS visible to ADMIN', () => {
    expect(canViewCampSite(unpublishedCamp, adminSession)).toBe(true);
  });

  // --- Inactive camp ---------------------------------------------------------

  it('AC-5: inactive camp is NOT visible to anonymous', () => {
    expect(canViewCampSite(inactiveCamp, anonymousSession)).toBe(false);
  });

  it('inactive camp IS visible to its owner', () => {
    expect(canViewCampSite(inactiveCamp, ownerSession)).toBe(true);
  });

  it('inactive camp IS visible to ADMIN', () => {
    expect(canViewCampSite(inactiveCamp, adminSession)).toBe(true);
  });

  // --- Soft-deleted camp -----------------------------------------------------

  it('AC-6: soft-deleted camp is NOT visible to anonymous', () => {
    expect(canViewCampSite(deletedCamp, anonymousSession)).toBe(false);
  });

  it('soft-deleted camp IS visible to ADMIN', () => {
    // Admin can view anything — intentional for moderation flows
    expect(canViewCampSite(deletedCamp, adminSession)).toBe(true);
  });

  it('soft-deleted camp IS visible to its owner', () => {
    expect(canViewCampSite(deletedCamp, ownerSession)).toBe(true);
  });

  // --- Non-owner logged-in user ---------------------------------------------

  it('AC-7: non-owner logged-in user cannot view unpublished camp', () => {
    expect(canViewCampSite(unpublishedCamp, otherUserSession)).toBe(false);
  });

  it('AC-7: non-owner cannot view inactive camp', () => {
    expect(canViewCampSite(inactiveCamp, otherUserSession)).toBe(false);
  });

  it('AC-7: non-owner cannot view soft-deleted camp', () => {
    expect(canViewCampSite(deletedCamp, otherUserSession)).toBe(false);
  });

  // --- Session edge cases ---------------------------------------------------

  it('handles undefined session (same as null)', () => {
    expect(canViewCampSite(unpublishedCamp, undefined)).toBe(false);
  });

  it('handles session with no user property', () => {
    expect(canViewCampSite(unpublishedCamp, {})).toBe(false);
  });

  it('handles session with user but null id and null role', () => {
    const session: VisibilitySession = { user: { id: null, role: null } };
    expect(canViewCampSite(unpublishedCamp, session)).toBe(false);
  });

  it('does not grant owner access when user id does not match operatorId', () => {
    const session: VisibilitySession = { user: { id: 'wrong-id', role: 'OPERATOR' } };
    expect(canViewCampSite(unpublishedCamp, session)).toBe(false);
  });

  it('ADMIN role grants access even without a matching operatorId', () => {
    const adminWithDifferentId: VisibilitySession = {
      user: { id: 'completely-different-id', role: 'ADMIN' },
    };
    expect(canViewCampSite(unpublishedCamp, adminWithDifferentId)).toBe(true);
  });
});
