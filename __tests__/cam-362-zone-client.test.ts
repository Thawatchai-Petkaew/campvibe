/**
 * cam-362-zone-client.test.ts — CAM-362
 *
 * Real behavioral tests (not source-inspection) for lib/zone-client.ts, the
 * status-code mapping shared by components/spot-management-section.tsx (the
 * zone manager area) and components/spot-form-dialog.tsx (the inline
 * "create new zone" flow). Mocks only the fetch boundary; the mapping logic
 * itself runs for real (same rationale as lib/spot-zone-grouping.ts's own
 * suite — a pure module gets real coverage instead of only grep-matching).
 */

import { afterEach, describe, expect, it, vi } from 'vitest';
import { createZone, deleteZone, fetchZonesSafe } from '../lib/zone-client';

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

describe('CAM-362 zone-client — createZone (POST /api/campsites/[id]/zones)', () => {
  it('201 -> ok:true with the created ZoneDTO', async () => {
    const zone = { id: 'z1', campSiteId: 'c1', name: 'โซน A', sortOrder: 0 };
    mockFetchOnce(201, zone);

    const result = await createZone('c1', 'โซน A');

    expect(result).toEqual({ ok: true, zone });
  });

  it('409 -> ok:false, reason "duplicate" (BR §3.2 dup rule)', async () => {
    mockFetchOnce(409, { error: 'มีโซนชื่อนี้อยู่แล้ว' });

    const result = await createZone('c1', 'โซน A');

    expect(result).toEqual({ ok: false, reason: 'duplicate' });
  });

  it('403 -> ok:false, reason "forbidden" (no CAMPSITE_UPDATE)', async () => {
    mockFetchOnce(403, { error: 'Forbidden' });

    const result = await createZone('c1', 'โซน A');

    expect(result).toEqual({ ok: false, reason: 'forbidden' });
  });

  it('500 -> ok:false, reason "other" (generic server failure)', async () => {
    mockFetchOnce(500, { error: 'Failed to create zone' });

    const result = await createZone('c1', 'โซน A');

    expect(result).toEqual({ ok: false, reason: 'other' });
  });

  it('network failure (fetch throws) -> ok:false, reason "other"', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('network down')));

    const result = await createZone('c1', 'โซน A');

    expect(result).toEqual({ ok: false, reason: 'other' });
  });

  it('POSTs to the camp-scoped path with the trimmed name in the body', async () => {
    const zone = { id: 'z2', campSiteId: 'c1', name: 'โซน B', sortOrder: 1 };
    mockFetchOnce(201, zone);

    await createZone('c1', 'โซน B');

    expect(fetch).toHaveBeenCalledWith(
      '/api/campsites/c1/zones',
      expect.objectContaining({
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ name: 'โซน B' }),
      })
    );
  });
});

describe('CAM-362 zone-client — deleteZone (DELETE /api/campsites/[id]/zones/[zoneId])', () => {
  it('200 -> ok:true with detachedSpotCount (tech.md §3.3)', async () => {
    mockFetchOnce(200, { success: true, detachedSpotCount: 3 });

    const result = await deleteZone('c1', 'z1');

    expect(result).toEqual({ ok: true, detachedSpotCount: 3 });
  });

  it('200 with 0 detached spots -> ok:true, detachedSpotCount 0 (boundary)', async () => {
    mockFetchOnce(200, { success: true, detachedSpotCount: 0 });

    const result = await deleteZone('c1', 'z1');

    expect(result).toEqual({ ok: true, detachedSpotCount: 0 });
  });

  it('404 -> ok:false, reason "notFound" (already deleted / cross-camp)', async () => {
    mockFetchOnce(404, { error: 'Zone not found' });

    const result = await deleteZone('c1', 'z1');

    expect(result).toEqual({ ok: false, reason: 'notFound' });
  });

  it('403 -> ok:false, reason "forbidden"', async () => {
    mockFetchOnce(403, { error: 'Forbidden' });

    const result = await deleteZone('c1', 'z1');

    expect(result).toEqual({ ok: false, reason: 'forbidden' });
  });

  it('500 -> ok:false, reason "other"', async () => {
    mockFetchOnce(500, { error: 'Failed to delete zone' });

    const result = await deleteZone('c1', 'z1');

    expect(result).toEqual({ ok: false, reason: 'other' });
  });

  it('DELETEs the camp+zone-scoped path (no body)', async () => {
    mockFetchOnce(200, { success: true, detachedSpotCount: 1 });

    await deleteZone('c1', 'z9');

    expect(fetch).toHaveBeenCalledWith('/api/campsites/c1/zones/z9', { method: 'DELETE' });
  });
});

/**
 * G3 fix (I-1) — Prove-It regression suite: before this fix,
 * components/spot-management-section.tsx's loadData did
 * `if (!zonesRes.ok) throw new Error("Failed to load zones")` INSIDE the
 * same try/catch as the spots fetch, so a zones failure set the SHARED
 * `loadError` and blanked the whole spots section even though spots had
 * already loaded successfully. fetchZonesSafe is the extracted, real-tested
 * fix: it must resolve to `{ ok: false }` for every failure mode (bad
 * status, network rejection) and NEVER throw/reject — the property the
 * component's Promise.all now depends on for isolation.
 */
describe('CAM-362 zone-client — fetchZonesSafe (GET /api/campsites/[id]/zones) — G3 fix I-1', () => {
  it('200 -> ok:true with the live zones array', async () => {
    const zones = [
      { id: 'z1', campSiteId: 'c1', name: 'โซน A', sortOrder: 0 },
      { id: 'z2', campSiteId: 'c1', name: 'โซน B', sortOrder: 1 },
    ];
    mockFetchOnce(200, zones);

    const result = await fetchZonesSafe('c1');

    expect(result).toEqual({ ok: true, zones });
  });

  it('200 with an empty list -> ok:true, zones: [] (boundary)', async () => {
    mockFetchOnce(200, []);

    const result = await fetchZonesSafe('c1');

    expect(result).toEqual({ ok: true, zones: [] });
  });

  it('a non-array body coerces to zones: [] rather than crashing the caller', async () => {
    mockFetchOnce(200, { error: 'unexpected shape' });

    const result = await fetchZonesSafe('c1');

    expect(result).toEqual({ ok: true, zones: [] });
  });

  it('[Prove-It] 500 -> resolves to { ok: false } — does NOT throw (the exact failure mode that used to blank the spots section)', async () => {
    mockFetchOnce(500, { error: 'Internal Server Error' });

    await expect(fetchZonesSafe('c1')).resolves.toEqual({ ok: false });
  });

  it('404 -> ok:false (camp not found / not viewable)', async () => {
    mockFetchOnce(404, { error: 'Camp site not found' });

    const result = await fetchZonesSafe('c1');

    expect(result).toEqual({ ok: false });
  });

  it('[Prove-It] a network-level rejection resolves to { ok: false } — never propagates as a rejected promise', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('network down')));

    await expect(fetchZonesSafe('c1')).resolves.toEqual({ ok: false });
  });

  it('can sit inside a Promise.all alongside a rejecting fetch without the WHOLE batch rejecting (the actual bug shape)', async () => {
    // Simulates loadData's real Promise.all: spots resolves fine, zones'
    // underlying fetch rejects. Promise.all only rejects if ANY entry
    // rejects — fetchZonesSafe's internal catch is what prevents that here.
    const spotsFetch = Promise.resolve({ ok: true, status: 200, json: async () => [] });
    vi.stubGlobal(
      'fetch',
      vi.fn().mockRejectedValue(new Error('zones endpoint unreachable'))
    );

    const [spotsRes, zonesResult] = await Promise.all([spotsFetch, fetchZonesSafe('c1')]);

    expect(spotsRes.ok).toBe(true);
    expect(zonesResult).toEqual({ ok: false });
  });

  it('GETs the camp-scoped path with no-store caching (fresh zone list every load)', async () => {
    mockFetchOnce(200, []);

    await fetchZonesSafe('c1');

    expect(fetch).toHaveBeenCalledWith('/api/campsites/c1/zones', { cache: 'no-store' });
  });
});
