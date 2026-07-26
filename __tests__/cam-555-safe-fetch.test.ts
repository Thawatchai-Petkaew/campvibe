/**
 * cam-555-safe-fetch.test.ts — CAM-555
 *
 * Real behavioral tests (not source-inspection) for lib/safe-fetch.ts's
 * fetchJsonSafe — the generic never-throw GET+JSON fetch extracted while
 * root-causing the intermittent ac6-spot-lifecycle flake. Mocks only the
 * fetch boundary (the outer network edge); the wrapping logic itself runs
 * for real — same rationale as __tests__/cam-362-zone-client.test.ts, whose
 * fetchZonesSafe this generalizes.
 */

import { afterEach, describe, expect, it, vi } from 'vitest';
import { fetchJsonSafe } from '../lib/safe-fetch';

function mockFetchOnce(status: number, body: unknown) {
  vi.stubGlobal(
    'fetch',
    vi.fn().mockResolvedValue({
      status,
      ok: status >= 200 && status < 300,
      json: async () => body,
    })
  );
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('CAM-555 safe-fetch — fetchJsonSafe (generic never-throw GET+JSON)', () => {
  // normal
  it('[normal] 200 with a JSON object -> ok:true with the parsed data', async () => {
    const result = await (async () => {
      mockFetchOnce(200, { operatorId: 'op-1' });
      return fetchJsonSafe<{ operatorId: string }>('/api/campsites/c1');
    })();

    expect(result).toEqual({ ok: true, data: { operatorId: 'op-1' } });
  });

  it('[normal] 200 with a nested shape (session-like) -> ok:true, data preserved as-is', async () => {
    mockFetchOnce(200, { user: { id: 'u1', role: 'ADMIN' } });

    const result = await fetchJsonSafe<{ user: { id: string; role: string } }>('/api/auth/session');

    expect(result).toEqual({ ok: true, data: { user: { id: 'u1', role: 'ADMIN' } } });
  });

  // null/empty
  it('[null/empty] 200 with an empty object body -> ok:true, data: {}', async () => {
    mockFetchOnce(200, {});

    const result = await fetchJsonSafe<Record<string, never>>('/api/auth/session');

    expect(result).toEqual({ ok: true, data: {} });
  });

  it('[null/empty] 200 with a null body (e.g. no active session) -> ok:true, data: null', async () => {
    mockFetchOnce(200, null);

    const result = await fetchJsonSafe<null>('/api/auth/session');

    expect(result).toEqual({ ok: true, data: null });
  });

  // boundary
  it('[boundary] 200 but res.json() itself throws (malformed body) -> ok:false, never rejects', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        status: 200,
        ok: true,
        json: async () => {
          throw new SyntaxError('Unexpected token in JSON');
        },
      })
    );

    await expect(fetchJsonSafe('/api/campsites/c1')).resolves.toEqual({ ok: false });
  });

  // error/validation
  it('[error] 404 -> ok:false (not found / not viewable)', async () => {
    mockFetchOnce(404, { error: 'Camp site not found' });

    const result = await fetchJsonSafe('/api/campsites/c1');

    expect(result).toEqual({ ok: false });
  });

  it('[error] 500 -> ok:false (generic server failure)', async () => {
    mockFetchOnce(500, { error: 'Internal Server Error' });

    const result = await fetchJsonSafe('/api/auth/session');

    expect(result).toEqual({ ok: false });
  });

  it('[Prove-It] a network-level rejection resolves to { ok: false } — never propagates as a rejected promise (the exact failure mode CAM-555 reproduced)', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('network down')));

    await expect(fetchJsonSafe('/api/auth/session')).resolves.toEqual({ ok: false });
  });

  // concurrent/ordering — the actual bug shape in loadData's Promise.all
  it('[concurrent] can sit inside a Promise.all alongside a rejecting fetch without the WHOLE batch rejecting (the real loadData bug shape)', async () => {
    // Simulates loadData's real Promise.all: spots resolves fine, the
    // session fetch's underlying fetch rejects. Promise.all only rejects if
    // ANY entry rejects — fetchJsonSafe's internal catch is what prevents
    // that here (this is exactly what was missing before CAM-555: campRes/
    // sessionRes were plain `fetch()` calls that COULD reject the batch).
    const spotsFetch = Promise.resolve({ ok: true, status: 200, json: async () => [{ id: 's1' }] });
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('session endpoint unreachable')));

    const [spotsRes, sessionResult] = await Promise.all([spotsFetch, fetchJsonSafe('/api/auth/session')]);

    expect(spotsRes.ok).toBe(true);
    expect(sessionResult).toEqual({ ok: false });
  });

  it('GETs the given path with no-store caching (fresh read every load)', async () => {
    mockFetchOnce(200, {});

    await fetchJsonSafe('/api/campsites/c1');

    expect(fetch).toHaveBeenCalledWith('/api/campsites/c1', { cache: 'no-store' });
  });
});
