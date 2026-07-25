/**
 * CAM-270 AC-2, BR-1/BR-4, EC-4 — lib/ai/tools/check-availability.ts
 *
 * Coverage matrix:
 *   - normal: passes through the LIVE getRemainingCapacity result
 *     (capacity/bookedGuests/heldGuests/remaining/blockedByHost)
 *   - boundary: a fully-booked / host-blocked range → remaining 0
 *   - error/validation: an over-wide range (AvailabilityRangeTooWideError)
 *     → handled { ok:false, code:'RANGE_TOO_WIDE' }, no throw to the caller
 *   - error/validation: invalid campSiteId (not a uuid) → rejected by zod
 *
 * CAM-469 — the tool now runs a public-visibility gate (prisma.campSite.
 * findFirst) BEFORE calling getRemainingCapacity. Every scenario in THIS file
 * represents an already-public camp, so `mockFindFirst` defaults to resolving
 * a row (visible) in `beforeEach` — keeping these pre-existing passthrough
 * assertions byte-identical (regression guard, AC-1). The gate's own
 * unpublished/inactive/deleted/nonexistent behavior is covered in
 * __tests__/cam-469-check-availability-gate.test.ts.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockGetRemainingCapacity = vi.fn();
const mockFindFirst = vi.fn();

vi.mock('@/lib/campsite-availability', async () => {
  const actual = await vi.importActual<typeof import('@/lib/campsite-availability')>(
    '@/lib/campsite-availability'
  );
  return {
    ...actual,
    getRemainingCapacity: (...args: unknown[]) => mockGetRemainingCapacity(...args),
  };
});

vi.mock('@/lib/prisma', () => ({
  prisma: {
    campSite: {
      findFirst: (...args: unknown[]) => mockFindFirst(...args),
    },
  },
}));

const {
  executeCheckAvailability,
  checkAvailabilityArgsSchema,
} = await import('@/lib/ai/tools/check-availability');
const { AvailabilityRangeTooWideError } = await import('@/lib/campsite-availability');

const VALID_UUID = '123e4567-e89b-12d3-a456-426614174000';

beforeEach(() => {
  vi.clearAllMocks();
  // CAM-469 — every test in this file is a public-camp scenario.
  mockFindFirst.mockResolvedValue({ id: VALID_UUID });
});

describe('checkAvailability — normal (LIVE passthrough)', () => {
  it('[unit] returns the getRemainingCapacity result flattened with ok:true', async () => {
    mockGetRemainingCapacity.mockResolvedValueOnce({
      capacity: 20,
      bookedGuests: 5,
      heldGuests: 2,
      remaining: 13,
      blockedByHost: false,
    });

    const args = checkAvailabilityArgsSchema.parse({
      campSiteId: VALID_UUID,
      startDate: '2026-08-01',
      endDate: '2026-08-03',
    });
    const result = await executeCheckAvailability(args);

    // CAM-485 BR-2: the capacity numbers still flatten EXACTLY as before —
    // strict, not weakened — a tappable card is ADDITIVE on top of this
    // shape (asserted separately below), not folded into a full AiCampCard
    // fixture here (this file's concern is the capacity passthrough, not
    // card shape/select fields — that's __tests__/cam-485-*.test.ts's job).
    expect(result).toMatchObject({
      ok: true,
      capacity: 20,
      bookedGuests: 5,
      heldGuests: 2,
      remaining: 13,
      blockedByHost: false,
    });
    expect(result.ok && result.cards).toHaveLength(1);
    expect(result.ok && result.cards?.[0]).toMatchObject({ remaining: 13 });
    expect(mockGetRemainingCapacity).toHaveBeenCalledOnce();
  });
});

describe('checkAvailability — boundary (full / host-blocked → remaining 0)', () => {
  it('[unit] a numerically-full range returns remaining:0', async () => {
    mockGetRemainingCapacity.mockResolvedValueOnce({
      capacity: 10,
      bookedGuests: 10,
      heldGuests: 0,
      remaining: 0,
      blockedByHost: false,
    });

    const args = checkAvailabilityArgsSchema.parse({
      campSiteId: VALID_UUID,
      startDate: '2026-08-01',
      endDate: '2026-08-02',
    });
    const result = await executeCheckAvailability(args);

    expect(result.ok).toBe(true);
    if (result.ok) expect(result.remaining).toBe(0);
  });

  it('[unit] a host-blocked range returns remaining:0 and blockedByHost:true', async () => {
    mockGetRemainingCapacity.mockResolvedValueOnce({
      capacity: 10,
      bookedGuests: 0,
      heldGuests: 0,
      remaining: 0,
      blockedByHost: true,
    });

    const args = checkAvailabilityArgsSchema.parse({
      campSiteId: VALID_UUID,
      startDate: '2026-08-01',
      endDate: '2026-08-02',
    });
    const result = await executeCheckAvailability(args);

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.remaining).toBe(0);
      expect(result.blockedByHost).toBe(true);
    }
  });
});

describe('checkAvailability — over-wide range (EC-4, BR-4)', () => {
  it('[unit] maps AvailabilityRangeTooWideError to a handled result, never throws', async () => {
    mockGetRemainingCapacity.mockRejectedValueOnce(new AvailabilityRangeTooWideError(400));

    const args = checkAvailabilityArgsSchema.parse({
      campSiteId: VALID_UUID,
      startDate: '2026-01-01',
      endDate: '2027-06-01',
    });

    await expect(executeCheckAvailability(args)).resolves.toEqual({ ok: false, code: 'RANGE_TOO_WIDE' });
  });

  it('[unit] re-throws any OTHER (unexpected) error — only the range guard is handled here', async () => {
    mockGetRemainingCapacity.mockRejectedValueOnce(new Error('db exploded'));

    const args = checkAvailabilityArgsSchema.parse({
      campSiteId: VALID_UUID,
      startDate: '2026-08-01',
      endDate: '2026-08-02',
    });

    await expect(executeCheckAvailability(args)).rejects.toThrow('db exploded');
  });
});

describe('checkAvailability — invalid args (zod boundary)', () => {
  it('[unit] rejects a non-uuid campSiteId at the schema boundary', () => {
    const parsed = checkAvailabilityArgsSchema.safeParse({
      campSiteId: 'not-a-uuid',
      startDate: '2026-08-01',
      endDate: '2026-08-02',
    });
    expect(parsed.success).toBe(false);
  });

  it('[unit] rejects an unparseable date string at the schema boundary', () => {
    const parsed = checkAvailabilityArgsSchema.safeParse({
      campSiteId: VALID_UUID,
      startDate: 'not-a-date',
      endDate: '2026-08-02',
    });
    expect(parsed.success).toBe(false);
  });
});
