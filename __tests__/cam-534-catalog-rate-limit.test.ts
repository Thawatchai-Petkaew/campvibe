/**
 * cam-534-catalog-rate-limit.test.ts — CAM-534
 *
 * "Public catalog list endpoint has no IP rate limit" — closes the gap
 * CAM-527's audit (CAM-535) reconfirmed: `GET /api/campsites` (the live,
 * unauthenticated public catalog list) had a take cap (`take: PAGE_SIZE + 1`,
 * already proven at __tests__/cam-196-keyset-cursor.test.ts:443-445) but zero
 * IP-based rate-limiting.
 *
 * AC → test matrix (docs/specs/platform-hardening/taxonomy-ui-foundation/
 * CAM-534-catalog-rate-limit/story.md):
 *
 *   AC-1/EC-1  requests at/under the 300/15min limit are served normally (200).
 *   AC-2/EC-2  the 301st request in-window → 429 + Retry-After; no Prisma call.
 *   AC-3/EC-3  different IPs have independent counters.
 *   AC-4/EC-4  a throwing limiter fails OPEN — request still served normally.
 *   BR-4       the pre-existing take:PAGE_SIZE+1 cap is unchanged (reconfirmed
 *              here by source-inspection; the live assertion of record stays
 *              at cam-196-keyset-cursor.test.ts).
 *
 * Layer: integration — direct route invocation (GET) with mocked Prisma +
 * the REAL in-process `checkRateLimit` store (never mock the layer under
 * test, per qa.md §6). Established precedent for invoking this route
 * directly: __tests__/cam-344-availability-badge.test.ts,
 * __tests__/security-hotfix.test.ts.
 *
 * Coverage matrix per qa.md: normal · boundary · error/validation ·
 * concurrent(independent-IP) · fail-open.
 */

import * as fs from 'fs';
import * as path from 'path';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

// ---------------------------------------------------------------------------
// Module mocks — same shape as cam-344-availability-badge.test.ts (established
// precedent for invoking this exact route's GET handler directly).
// ---------------------------------------------------------------------------
vi.mock('@/lib/prisma', () => ({
  prisma: {
    campSite: {
      findMany: vi.fn(),
    },
    booking: {
      findMany: vi.fn(),
    },
    blockedDate: {
      findMany: vi.fn(),
    },
    internalHold: {
      findMany: vi.fn(),
    },
    spot: {
      findMany: vi.fn(),
    },
  },
}));

vi.mock('@/lib/auth-utils', () => ({
  requireAuth: vi.fn(),
}));
vi.mock('@/lib/auth', () => ({
  auth: vi.fn(),
}));

import { prisma } from '@/lib/prisma';
import { GET as campsiteGET } from '@/app/api/campsites/route';
import { _store } from '@/lib/rate-limit';
import * as rateLimitModule from '@/lib/rate-limit';

const mockFindMany = prisma.campSite.findMany as unknown as ReturnType<typeof vi.fn>;

function makeRequest(ip: string, extraHeaders: Record<string, string> = {}): NextRequest {
  return new NextRequest('http://localhost/api/campsites', {
    headers: { 'x-forwarded-for': ip, ...extraHeaders },
  });
}

/** Pre-fill the shared rate-limit store so the next call for `key` is over the limit. */
function fillStore(key: string, count: number) {
  const now = Date.now();
  _store.set(key, Array.from({ length: count }, (_, i) => now - i));
}

beforeEach(() => {
  vi.clearAllMocks();
  _store.clear();
  mockFindMany.mockResolvedValue([]);
});

// ═══════════════════════════════════════════════════════════════════════════
// AC-1/EC-1 — allowed at/under the limit
// ═══════════════════════════════════════════════════════════════════════════

describe('GET /api/campsites — IP rate-limit (catalog:list:<ip>)', () => {
  it('[normal] a fresh IP is served normally (200, {items, nextCursor} shape)', async () => {
    const req = makeRequest('1.1.1.1');
    const res = await campsiteGET(req);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toHaveProperty('items');
    expect(body).toHaveProperty('nextCursor');
  });

  it('[boundary] the 300th request in-window is allowed (at the limit)', async () => {
    // 299 already used → the 300th call (this request) must still pass.
    fillStore('catalog:list:2.2.2.2', 299);
    const req = makeRequest('2.2.2.2');
    const res = await campsiteGET(req);
    expect(res.status).toBe(200);
  });

  // ═════════════════════════════════════════════════════════════════════════
  // AC-2/EC-2 — 429 + Retry-After past the limit; no Prisma call
  // ═════════════════════════════════════════════════════════════════════════

  it('[boundary] the 301st request in-window returns 429 with a Retry-After header', async () => {
    fillStore('catalog:list:3.3.3.3', 300); // 300 used → the next call is over
    const req = makeRequest('3.3.3.3');
    const res = await campsiteGET(req);

    expect(res.status).toBe(429);
    const body = await res.json();
    expect(body.error).toBe('rate_limited');
    // Thai copy, no jargon (.claude/rules/code.md §4) — asserted verbatim.
    expect(body.message).toBe('คำขอมากเกินไป กรุณาลองใหม่อีกครั้งในภายหลัง');
    expect(res.headers.get('Retry-After')).not.toBeNull();
    expect(Number(res.headers.get('Retry-After'))).toBeGreaterThan(0);
  });

  it('[error] a rate-limited request never reaches Prisma (no DB round trip)', async () => {
    fillStore('catalog:list:4.4.4.4', 300);
    const req = makeRequest('4.4.4.4');
    await campsiteGET(req);
    expect(mockFindMany).not.toHaveBeenCalled();
  });

  // ═════════════════════════════════════════════════════════════════════════
  // AC-3/EC-3 — independent per-IP counters
  // ═════════════════════════════════════════════════════════════════════════

  it('[concurrent] a different IP is unaffected by a neighboring IP being over the limit', async () => {
    fillStore('catalog:list:5.5.5.5', 300); // IP A exhausted
    const req = makeRequest('6.6.6.6'); // IP B — fresh
    const res = await campsiteGET(req);
    expect(res.status).toBe(200);
  });

  it('[null/empty] a request with no x-forwarded-for header falls back to the "unknown" key (still rate-limited)', async () => {
    fillStore('catalog:list:unknown', 300);
    const req = new NextRequest('http://localhost/api/campsites'); // no IP header
    const res = await campsiteGET(req);
    expect(res.status).toBe(429);
  });

  // ═════════════════════════════════════════════════════════════════════════
  // AC-4/EC-4 — fail-open on a limiter error
  // ═════════════════════════════════════════════════════════════════════════

  it('[error] a throwing limiter fails OPEN — the request is still served normally', async () => {
    // Force checkRateLimit itself to throw (a real limiter bug), then confirm
    // the route's own try/catch around the call swallows it and still serves
    // the request — never a 500, never blocking the public catalog.
    const spy = vi
      .spyOn(rateLimitModule, 'checkRateLimit')
      .mockImplementationOnce(() => {
        throw new Error('simulated limiter failure');
      });
    const req = makeRequest('7.7.7.7');
    const res = await campsiteGET(req);
    expect(res.status).toBe(200);
    spy.mockRestore();
  });

  // ═════════════════════════════════════════════════════════════════════════
  // Prove-It — the limiter is actually consulted (store key really populated),
  // not merely present as dead source text (CAM-201 lesson: a source grep
  // alone is not proof).
  // ═════════════════════════════════════════════════════════════════════════

  it('[Prove-It] the store key catalog:list:<ip> is populated after real requests, and denies the request right after the limit is reached', async () => {
    const IP = '8.8.8.8';
    const key = `catalog:list:${IP}`;
    expect(_store.has(key)).toBe(false);

    for (let i = 0; i < 300; i++) {
      const res = await campsiteGET(makeRequest(IP));
      expect(res.status).toBe(200);
    }
    // The store must now hold exactly 300 timestamps for this key — proof the
    // route is actually calling checkRateLimit with this key, not merely
    // importing it.
    expect(_store.get(key)?.length).toBe(300);

    // The 301st real call must be denied — FAILS if the checkRateLimit call
    // were ever removed from the route (the store would still be empty from
    // the loop above and this request would return 200, not 429).
    const denied = await campsiteGET(makeRequest(IP));
    expect(denied.status).toBe(429);
  });

  // ═════════════════════════════════════════════════════════════════════════
  // BR-4 — the pre-existing take cap is unchanged (reconfirmed, not re-owned;
  // the live assertion of record is cam-196-keyset-cursor.test.ts).
  // ═════════════════════════════════════════════════════════════════════════

  it('[normal] the route still bounds its Prisma fetch via take: PAGE_SIZE + 1 (unchanged by this story)', () => {
    const routeSrc = fs.readFileSync(
      path.join(process.cwd(), 'app/api/campsites/route.ts'),
      'utf-8'
    );
    expect(routeSrc).toContain('take: PAGE_SIZE + 1');
  });
});
