/**
 * cam-446-camp-detail-route.test.ts — CAM-446: GET /api/ai/camp-detail/[id].
 *
 * `lib/ai/tools/get-camp-detail` is mocked (its own behavior — amenities,
 * reviews, availability, the PDPA-safe select — is proven in
 * __tests__/cam-427-get-camp-detail.test.ts). The rate-limit layer is the
 * REAL `lib/rate-limit` module (server-authoritative testing, qa.md §6 —
 * never mock the layer you are about to assert), store reset between tests
 * (mirrors __tests__/cam-421-conversation-routes.test.ts).
 *
 * Coverage matrix:
 *   - normal: 200 with the guest-safe shape for a valid uuid; asserts NO
 *     operator/contact/phone/email/LINE field anywhere in the body (PDPA)
 *   - error/validation: 400 for a non-uuid id — the tool is never called
 *   - null/empty: 404 for an unknown (but valid-uuid) id, tool's own
 *     not_found signal forwarded as-is
 *   - error/validation: 500 generic body on an unexpected tool throw — no
 *     stack/internal leaked
 *   - boundary/ordering: 429 + Retry-After once the per-IP budget (30/15min,
 *     same guard as POST /api/ai/chat) is exhausted; the rate limiter runs
 *     BEFORE id validation (mirrors CAM-421 BR-7)
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';
import { _store } from '@/lib/rate-limit';

const mockExecuteGetCampDetail = vi.fn();

vi.mock('@/lib/ai/tools/get-camp-detail', () => ({
  executeGetCampDetail: (...args: unknown[]) => mockExecuteGetCampDetail(...args),
}));

const { GET } = await import('@/app/api/ai/camp-detail/[id]/route');

const VALID_UUID = '123e4567-e89b-12d3-a456-426614174000';

function makeRequest(id = VALID_UUID): NextRequest {
  return new NextRequest(`http://localhost/api/ai/camp-detail/${id}`, { method: 'GET' });
}

function makeContext(id = VALID_UUID): { params: Promise<{ id: string }> } {
  return { params: Promise.resolve({ id }) };
}

function fullOkResult() {
  return {
    ok: true as const,
    id: VALID_UUID,
    nameTh: 'ลานกางเต็นท์ริมน้ำ',
    nameEn: 'Riverside Camp',
    amenities: [
      { code: 'RIVE', group: 'Terrain', nameTh: 'แม่น้ำ ลำธาร คลองเล็ก', nameEn: 'River, stream, or creek', icon: 'Waves' },
    ],
    reviews: [{ name: 'สมชาย', rating: 5, content: 'ดีมาก', createdAt: '2026-01-01T00:00:00.000Z' }],
    reviewSummary: { hasReviews: true, avgRating: 4.5, count: 12 },
    availableWeekendDates: ['2026-07-25', '2026-08-01'],
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  _store.clear();
});

describe('GET /api/ai/camp-detail/[id] — normal', () => {
  it('[normal] 200 with the guest-safe shape for a valid uuid; NO operator/contact/phone/email/LINE field anywhere (PDPA)', async () => {
    mockExecuteGetCampDetail.mockResolvedValueOnce(fullOkResult());

    const res = await GET(makeRequest(), makeContext());
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body).toEqual(fullOkResult());
    const serialized = JSON.stringify(body).toLowerCase();
    for (const forbidden of ['operator', 'phone', 'email', 'line', 'contact', 'host']) {
      expect(serialized).not.toContain(forbidden);
    }
    expect(mockExecuteGetCampDetail).toHaveBeenCalledWith({ campSiteId: VALID_UUID });
  });
});

describe('GET /api/ai/camp-detail/[id] — error/validation', () => {
  it('[error/validation] 400 for a non-uuid id — the tool is never called', async () => {
    const res = await GET(makeRequest('not-a-uuid'), makeContext('not-a-uuid'));
    const body = await res.json();

    expect(res.status).toBe(400);
    expect(body).toEqual({ error: 'invalid_id' });
    expect(mockExecuteGetCampDetail).not.toHaveBeenCalled();
  });

  it('[null/empty] 404 for an unknown (but valid-uuid) camp — the tool\'s own not_found signal forwarded as-is', async () => {
    mockExecuteGetCampDetail.mockResolvedValueOnce({ ok: false, code: 'not_found' });

    const res = await GET(makeRequest(), makeContext());
    const body = await res.json();

    expect(res.status).toBe(404);
    expect(body).toEqual({ ok: false, code: 'not_found' });
  });

  it('[error/validation] 500 generic body on an unexpected tool throw — no stack/internal leaked', async () => {
    mockExecuteGetCampDetail.mockRejectedValueOnce(new Error('connection refused: 10.0.0.5:5432'));

    const res = await GET(makeRequest(), makeContext());
    const body = await res.json();

    expect(res.status).toBe(500);
    expect(body).toEqual({ error: 'internal_error' });
    expect(JSON.stringify(body)).not.toContain('10.0.0.5');
  });
});

describe('GET /api/ai/camp-detail/[id] — rate limit (boundary/ordering)', () => {
  it('[boundary] 429 + Retry-After once the 30/15min per-IP budget is exhausted; the 31st never reaches the tool', async () => {
    mockExecuteGetCampDetail.mockResolvedValue(fullOkResult());

    for (let i = 0; i < 30; i++) {
      const res = await GET(makeRequest(), makeContext());
      expect(res.status).toBe(200);
    }

    const limited = await GET(makeRequest(), makeContext());
    const retryAfter = Number(limited.headers.get('Retry-After'));

    expect(limited.status).toBe(429);
    expect(retryAfter).toBeGreaterThan(0);
    expect(mockExecuteGetCampDetail).toHaveBeenCalledTimes(30);
  });

  it('[ordering] the rate limiter runs BEFORE id validation — 30 invalid-uuid GETs still exhaust the budget', async () => {
    for (let i = 0; i < 30; i++) {
      const res = await GET(makeRequest('not-a-uuid'), makeContext('not-a-uuid'));
      expect(res.status).toBe(400);
    }
    expect(mockExecuteGetCampDetail).not.toHaveBeenCalled();

    const limited = await GET(makeRequest(), makeContext());

    expect(limited.status).toBe(429);
    expect(limited.headers.get('Retry-After')).toBeTruthy();
    expect(mockExecuteGetCampDetail).not.toHaveBeenCalled();
  });
});
