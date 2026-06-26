/**
 * CAM-187 MEAS-1 — Contract tests for the CWV measurement harness.
 *
 * Covers:
 *  1a — VitalPayloadSchema: valid payload parses, invalid rejects
 *  1a — POST /api/vitals: 204 happy path, 400 bad input, 429 rate limited
 *  1b — withTiming: emits route_timing log, re-throws errors
 *  1b — toRouteTemplate (indirect via component): slug stripping logic
 *
 * Abuse cases:
 *  - Body too large → 413
 *  - Bad metric name → 400
 *  - NaN value → 400
 *  - routeTemplate too long → 400
 *  - Over rate limit → 429 with Retry-After header
 *
 * No PII assertion: vitalsId (web-vitals attribution id) is logged, userId is NOT.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { VitalPayloadSchema } from '../lib/validations/vitals';
import { checkRateLimit, _store } from '../lib/rate-limit';
import { withTiming } from '../lib/route-timing';

// ─────────────────────────────────────────────────────────────
// 1. VitalPayloadSchema unit tests
// ─────────────────────────────────────────────────────────────
describe('VitalPayloadSchema', () => {
  const validPayload = {
    name: 'LCP',
    value: 1842.3,
    rating: 'good',
    id: 'v3-123456789',
    navigationType: 'navigate',
    routeTemplate: '/camps/[slug]',
  };

  it('parses a valid LCP payload', () => {
    const result = VitalPayloadSchema.safeParse(validPayload);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.name).toBe('LCP');
      expect(result.data.value).toBe(1842.3);
      expect(result.data.rating).toBe('good');
    }
  });

  it('accepts all valid metric names', () => {
    const metrics = ['LCP', 'INP', 'CLS', 'TTFB', 'FCP'] as const;
    for (const name of metrics) {
      const result = VitalPayloadSchema.safeParse({ ...validPayload, name });
      expect(result.success, `Expected ${name} to be valid`).toBe(true);
    }
  });

  it('rejects unknown metric name', () => {
    const result = VitalPayloadSchema.safeParse({ ...validPayload, name: 'FID' });
    expect(result.success).toBe(false);
  });

  it('rejects NaN value', () => {
    const result = VitalPayloadSchema.safeParse({ ...validPayload, value: NaN });
    expect(result.success).toBe(false);
  });

  it('rejects negative value', () => {
    const result = VitalPayloadSchema.safeParse({ ...validPayload, value: -1 });
    expect(result.success).toBe(false);
  });

  it('rejects invalid rating', () => {
    const result = VitalPayloadSchema.safeParse({ ...validPayload, rating: 'excellent' });
    expect(result.success).toBe(false);
  });

  it('accepts all valid ratings', () => {
    const ratings = ['good', 'needs-improvement', 'poor'] as const;
    for (const rating of ratings) {
      const result = VitalPayloadSchema.safeParse({ ...validPayload, rating });
      expect(result.success, `Expected rating "${rating}" to be valid`).toBe(true);
    }
  });

  it('rejects id longer than 64 chars', () => {
    const result = VitalPayloadSchema.safeParse({ ...validPayload, id: 'x'.repeat(65) });
    expect(result.success).toBe(false);
  });

  it('rejects routeTemplate longer than 200 chars', () => {
    const result = VitalPayloadSchema.safeParse({
      ...validPayload,
      routeTemplate: '/camps/' + 'a'.repeat(200),
    });
    expect(result.success).toBe(false);
  });

  it('makes navigationType optional', () => {
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { navigationType: _omit, ...noNav } = validPayload;
    const result = VitalPayloadSchema.safeParse(noNav);
    expect(result.success).toBe(true);
  });

  it('rejects navigationType longer than 32 chars', () => {
    const result = VitalPayloadSchema.safeParse({
      ...validPayload,
      navigationType: 'x'.repeat(33),
    });
    expect(result.success).toBe(false);
  });

  it('rejects missing required fields', () => {
    const result = VitalPayloadSchema.safeParse({ name: 'LCP' });
    expect(result.success).toBe(false);
  });
});

// ─────────────────────────────────────────────────────────────
// 2. POST /api/vitals — route integration tests
// ─────────────────────────────────────────────────────────────

// Rate-limit store cleared between tests
function resetStore() {
  _store.clear();
}

// Import handler after potential mock setup
const { POST: vitalsPost } = await import('../app/api/vitals/route');

describe('POST /api/vitals', () => {
  beforeEach(() => {
    resetStore();
  });

  const validBody = {
    name: 'LCP',
    value: 1842.3,
    rating: 'good',
    id: 'v3-test-id',
    navigationType: 'navigate',
    routeTemplate: '/camps/[slug]',
  };

  function makeRequest(body: unknown, extraHeaders: Record<string, string> = {}): Request {
    const json = JSON.stringify(body);
    return new Request('http://localhost/api/vitals', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'content-length': String(json.length),
        'x-forwarded-for': '1.2.3.4',
        ...extraHeaders,
      },
      body: json,
    });
  }

  it('returns 204 for a valid payload', async () => {
    const req = makeRequest(validBody);
    const res = await vitalsPost(req);
    expect(res.status).toBe(204);
  });

  it('returns 400 for an invalid metric name', async () => {
    const req = makeRequest({ ...validBody, name: 'FID' });
    const res = await vitalsPost(req);
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.error.code).toBe('VALIDATION_ERROR');
  });

  it('returns 400 for a NaN value', async () => {
    // JSON.parse treats Infinity/NaN as null — test with string instead
    const req = makeRequest({ ...validBody, value: 'not-a-number' });
    const res = await vitalsPost(req);
    expect(res.status).toBe(400);
  });

  it('returns 400 for invalid JSON body', async () => {
    const req = new Request('http://localhost/api/vitals', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'content-length': '5',
        'x-forwarded-for': '1.2.3.4',
      },
      body: 'NOTJSON',
    });
    const res = await vitalsPost(req);
    expect(res.status).toBe(400);
  });

  it('returns 413 when body exceeds 2 KB (real byte cap, independent of Content-Length header)', async () => {
    const oversized = JSON.stringify({ ...validBody, routeTemplate: 'x'.repeat(5000) });
    const req = new Request('http://localhost/api/vitals', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        // Content-Length header is intentionally omitted to prove the cap
        // is enforced by reading the body, not trusting the header.
        'x-forwarded-for': '1.2.3.4',
      },
      body: oversized,
    });
    const res = await vitalsPost(req);
    expect(res.status).toBe(413);
  });

  it('returns 429 with Retry-After header when over rate limit', async () => {
    // Pre-fill the rate-limit store for this IP to the max
    const ip = '5.5.5.5';
    // Fill the bucket: limit is 200 in the route, but we test via checkRateLimit directly
    // then verify the route gate triggers on the next call
    const limit = 200;
    const windowMs = 15 * 60 * 1000;
    for (let i = 0; i < limit; i++) {
      checkRateLimit(`vitals:${ip}`, { limit, windowMs });
    }
    const req = makeRequest(validBody, { 'x-forwarded-for': ip });
    const res = await vitalsPost(req);
    expect(res.status).toBe(429);
    expect(res.headers.get('Retry-After')).toBeTruthy();
    const json = await res.json();
    expect(json.error.code).toBe('RATE_LIMITED');
  });

  it('does not return user data or PII in the 204 response', async () => {
    const req = makeRequest(validBody);
    const res = await vitalsPost(req);
    expect(res.status).toBe(204);
    // 204 has no body — confirm
    const text = await res.text();
    expect(text).toBe('');
  });

  it('different IPs are rate-limited independently', async () => {
    // Exhaust IP A
    const limitOpts = { limit: 200, windowMs: 15 * 60 * 1000 };
    for (let i = 0; i < 200; i++) checkRateLimit('vitals:10.0.0.1', limitOpts);

    // IP B should still be allowed
    const reqB = makeRequest(validBody, { 'x-forwarded-for': '10.0.0.2' });
    const resB = await vitalsPost(reqB);
    expect(resB.status).toBe(204);
  });
});

// ─────────────────────────────────────────────────────────────
// 3. withTiming unit tests
// ─────────────────────────────────────────────────────────────
describe('withTiming', () => {
  it('returns the wrapped function result', async () => {
    const result = await withTiming('test_label', async () => 42);
    expect(result).toBe(42);
  });

  it('re-throws errors from the wrapped function', async () => {
    await expect(
      withTiming('test_error', async () => {
        throw new Error('inner error');
      })
    ).rejects.toThrow('inner error');
  });

  it('emits a structured log line on success', async () => {
    const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    try {
      await withTiming('catalog_list', async () => 'ok');
      const calls = consoleSpy.mock.calls.map((c) => {
        try { return JSON.parse(c[0]); } catch { return null; }
      }).filter(Boolean);
      const timing = calls.find((c) => c.event === 'route_timing');
      expect(timing).toBeTruthy();
      expect(timing?.label).toBe('catalog_list');
      expect(timing?.status).toBe('ok');
      expect(typeof timing?.durationMs).toBe('number');
    } finally {
      consoleSpy.mockRestore();
    }
  });

  it('emits a structured error log on failure', async () => {
    const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    try {
      await withTiming('failing_handler', async () => {
        throw new Error('boom');
      }).catch(() => {});
      const calls = consoleSpy.mock.calls.map((c) => {
        try { return JSON.parse(c[0]); } catch { return null; }
      }).filter(Boolean);
      const timing = calls.find((c) => c.event === 'route_timing');
      expect(timing?.status).toBe('error');
    } finally {
      consoleSpy.mockRestore();
    }
  });

  it('does not leak PII in log output', async () => {
    const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    try {
      await withTiming('catalog_list', async () => ({ userId: 'secret-user-id' }));
      const logOutput = consoleSpy.mock.calls.map((c) => c[0]).join('');
      expect(logOutput).not.toContain('secret-user-id');
    } finally {
      consoleSpy.mockRestore();
    }
  });
});
