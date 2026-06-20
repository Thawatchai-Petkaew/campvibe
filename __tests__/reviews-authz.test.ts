import { describe, it, expect } from 'vitest';
import { reviewBodySchema, canReview, VERIFIED_STAY_STATUSES } from '../lib/validations/review';

// ---------------------------------------------------------------------------
// reviewBodySchema — input validation (zod boundary)
// ---------------------------------------------------------------------------
describe('reviewBodySchema', () => {
    const VALID_UUID = '123e4567-e89b-12d3-a456-426614174000';
    const VALID_BASE = {
        campSiteId: VALID_UUID,
        rating: 3,
    };

    describe('valid inputs', () => {
        it('accepts minimal valid body (campSiteId + rating)', () => {
            const result = reviewBodySchema.safeParse(VALID_BASE);
            expect(result.success).toBe(true);
        });

        it('accepts full optional fields', () => {
            const result = reviewBodySchema.safeParse({
                ...VALID_BASE,
                title: 'Great camp',
                content: 'Loved the view',
                visitDate: '2025-12-01T00:00:00Z',
            });
            expect(result.success).toBe(true);
        });

        it('accepts rating 1 (boundary low)', () => {
            const result = reviewBodySchema.safeParse({ ...VALID_BASE, rating: 1 });
            expect(result.success).toBe(true);
        });

        it('accepts rating 5 (boundary high)', () => {
            const result = reviewBodySchema.safeParse({ ...VALID_BASE, rating: 5 });
            expect(result.success).toBe(true);
        });
    });

    describe('invalid inputs — rejected with 400-level semantics', () => {
        it('rejects missing campSiteId', () => {
            const result = reviewBodySchema.safeParse({ rating: 3 });
            expect(result.success).toBe(false);
        });

        it('rejects non-UUID campSiteId', () => {
            const result = reviewBodySchema.safeParse({ campSiteId: 'not-a-uuid', rating: 3 });
            expect(result.success).toBe(false);
        });

        it('rejects missing rating', () => {
            const result = reviewBodySchema.safeParse({ campSiteId: VALID_UUID });
            expect(result.success).toBe(false);
        });

        it('rejects rating 0 (below minimum)', () => {
            const result = reviewBodySchema.safeParse({ ...VALID_BASE, rating: 0 });
            expect(result.success).toBe(false);
        });

        it('rejects rating 6 (above maximum)', () => {
            const result = reviewBodySchema.safeParse({ ...VALID_BASE, rating: 6 });
            expect(result.success).toBe(false);
        });

        it('rejects non-integer rating (float)', () => {
            const result = reviewBodySchema.safeParse({ ...VALID_BASE, rating: 3.5 });
            expect(result.success).toBe(false);
        });

        it('rejects authorId in body (field does not exist in schema)', () => {
            // authorId must not be accepted from the body — it is not part of reviewBodySchema.
            // If supplied, it must be stripped/unknown (zod strips unknown keys by default).
            // The parsed output must not contain authorId.
            const result = reviewBodySchema.safeParse({ ...VALID_BASE, authorId: VALID_UUID });
            expect(result.success).toBe(true);
            if (result.success) {
                expect('authorId' in result.data).toBe(false);
            }
        });

        it('rejects malformed visitDate (not ISO datetime)', () => {
            const result = reviewBodySchema.safeParse({
                ...VALID_BASE,
                visitDate: '2025-13-99', // invalid date string
            });
            expect(result.success).toBe(false);
        });
    });
});

// ---------------------------------------------------------------------------
// canReview — verified-stay decision (pure, no DB)
// ---------------------------------------------------------------------------
describe('canReview', () => {
    it('returns false when user has no confirmed booking', () => {
        expect(canReview({ hasConfirmedBooking: false })).toBe(false);
    });

    it('returns true when user has a confirmed booking', () => {
        expect(canReview({ hasConfirmedBooking: true })).toBe(true);
    });
});

// ---------------------------------------------------------------------------
// VERIFIED_STAY_STATUSES — documents which statuses the DB query uses
// ---------------------------------------------------------------------------
describe('VERIFIED_STAY_STATUSES', () => {
    it('includes CONFIRMED', () => {
        expect(VERIFIED_STAY_STATUSES).toContain('CONFIRMED');
    });

    it('does not include CANCELLED', () => {
        expect(VERIFIED_STAY_STATUSES).not.toContain('CANCELLED');
    });

    it('does not include PENDING', () => {
        expect(VERIFIED_STAY_STATUSES).not.toContain('PENDING');
    });
});
