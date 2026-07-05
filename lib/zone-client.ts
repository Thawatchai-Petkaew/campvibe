// CAM-362 — small client-side fetch facade over /api/campsites/[id]/zones,
// shared by components/spot-management-section.tsx (the zone manager area)
// and components/spot-form-dialog.tsx (the inline "create new zone" flow
// inside the spot zone <Select>). Extracted as a standalone module (no
// React) so the status-code mapping gets a real behavioral unit test
// (__tests__/cam-362-zone-client.test.ts) instead of only source-inspection,
// same rationale as lib/spot-zone-grouping.ts.

import type { ZoneDTO } from "@/types/api";

export type CreateZoneResult =
  | { ok: true; zone: ZoneDTO }
  | { ok: false; reason: "duplicate" | "forbidden" | "other" };

/** POST /api/campsites/[id]/zones (tech.md §3.2). */
export async function createZone(campSiteId: string, name: string): Promise<CreateZoneResult> {
  try {
    const res = await fetch(`/api/campsites/${campSiteId}/zones`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ name }),
    });

    if (res.status === 409) return { ok: false, reason: "duplicate" };
    if (res.status === 403) return { ok: false, reason: "forbidden" };
    if (!res.ok) return { ok: false, reason: "other" };

    const zone: ZoneDTO = await res.json();
    return { ok: true, zone };
  } catch {
    return { ok: false, reason: "other" };
  }
}

export type DeleteZoneResult =
  | { ok: true; detachedSpotCount: number }
  | { ok: false; reason: "notFound" | "forbidden" | "other" };

/** DELETE /api/campsites/[id]/zones/[zoneId] (tech.md §3.3). */
export async function deleteZone(campSiteId: string, zoneId: string): Promise<DeleteZoneResult> {
  try {
    const res = await fetch(`/api/campsites/${campSiteId}/zones/${zoneId}`, { method: "DELETE" });

    if (res.status === 404) return { ok: false, reason: "notFound" };
    if (res.status === 403) return { ok: false, reason: "forbidden" };
    if (!res.ok) return { ok: false, reason: "other" };

    const data: { success: true; detachedSpotCount: number } = await res.json();
    return { ok: true, detachedSpotCount: data.detachedSpotCount };
  } catch {
    return { ok: false, reason: "other" };
  }
}
