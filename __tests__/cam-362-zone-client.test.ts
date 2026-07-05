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
import { createZone, deleteZone } from '../lib/zone-client';

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
