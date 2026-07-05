import { NextResponse } from 'next/server';
import { serializeDecimals } from './serialize';
import { prisma } from './prisma';

/**
 * Standardized API error response helper
 */
export function apiError(message: string, status: number = 500, details?: unknown) {
  // Log full details server-side always; only EXPOSE them to the client on 4xx
  // (e.g. zod validation). Never serialize raw errors on 5xx — they can leak
  // Prisma internals / stack / connection strings to the caller.
  console.error(`[API Error ${status}]:`, message, details);
  const response: { error: string; details?: unknown } = { error: message };
  if (details && status < 500) {
    response.details = details;
  }
  return NextResponse.json(response, { status });
}

/**
 * Standardized API success response helper
 */
export function apiSuccess<T>(data: T, status: number = 200) {
  // Buffet boundary (ADR-002): convert any Prisma.Decimal (money) → number so every API
  // response honors the numeric contract instead of leaking Decimal-as-string JSON.
  return NextResponse.json(serializeDecimals(data), { status });
}

/**
 * Convert array to CSV string (for database storage)
 */
export function arrayToCsv(arr: string[] | undefined | null): string | undefined {
  if (!arr || arr.length === 0) return undefined;
  return arr.join(',');
}

/**
 * Convert CSV string to array (for frontend use)
 */
export function csvToArray(csv: string | null | undefined): string[] {
  if (!csv) return [];
  return csv.split(',').filter(Boolean);
}

/**
 * S4a (ADR-003): flatten the multi-select taxonomy arrays (accessTypes/facilities/equipment/…)
 * into a deduped, VALIDATED `{ code }[]` for a Prisma `options` connect/set on CampSite.
 * Codes are MasterData PKs (globally unique). Unknown codes are dropped here rather than
 * passed to Prisma `connect` — a single bad code would otherwise throw P2025 and 500 the
 * entire save. Returns only codes that actually exist in MasterData.
 */
export async function resolveOptionConnect(
  arrays: (string[] | undefined | null)[]
): Promise<{ code: string }[]> {
  const wanted = new Set<string>();
  for (const arr of arrays) {
    for (const code of arr ?? []) {
      if (code) wanted.add(code);
    }
  }
  if (wanted.size === 0) return [];
  const valid = await prisma.masterData.findMany({
    where: { code: { in: [...wanted] } },
    select: { code: true },
  });
  return valid.map((v) => ({ code: v.code }));
}

/**
 * S4b: build a nested Prisma write for the polymorphic Image gallery from a list of
 * image inputs. Order is preserved via sortOrder. imageCreateNested for POST;
 * imageReplaceNested for PUT (clears the existing gallery then recreates it from the
 * submitted order).
 *
 * CAM-352 groundwork: widened to accept EITHER a bare `string` url (legacy shape —
 * every un-migrated caller keeps compiling and behaving identically) OR `{url, kind}`
 * (the new shape once the zod boundary normalizes `imageInputSchema`). `kind` persists
 * to the `Image.kind` column; omitted `kind` still lands as `PHOTO` (the column
 * default), so a caller that never learns about `kind` is still correct.
 */
type ImageWriteInput = string | { url: string; kind?: 'PHOTO' | 'PANORAMA' };

function normalizeImages(items: ImageWriteInput[] | undefined | null) {
  return (items ?? [])
    .map((it) => (typeof it === 'string' ? { url: it, kind: 'PHOTO' as const } : it))
    .filter((it) => Boolean(it.url))
    .map((it, i) => ({ url: it.url, sortOrder: i, kind: it.kind ?? ('PHOTO' as const) }));
}

export function imageCreateNested(items: ImageWriteInput[] | undefined | null) {
  return { create: normalizeImages(items) };
}
export function imageReplaceNested(items: ImageWriteInput[] | undefined | null) {
  return { deleteMany: {}, create: normalizeImages(items) };
}

/**
 * CAM-362 — resolve a spot write's zone fields (POST + PUT share this exact
 * resolution rule, tech.md §4.2). `zoneId` takes precedence when present:
 * validated against THIS campsite + live (no cross-camp IDOR, no linking a
 * soft-deleted zone), then mirrored into the legacy `Spot.zone` display
 * string (T1 denormalize-on-write, tech.md §0.3-B) so the four un-migrated
 * read consumers (booking list/detail, operator bookings, public detail)
 * keep showing a zone label with zero code change to them. When only the
 * legacy `zone` string is sent, behavior is unchanged (zoneId stays
 * untouched). Returns only the fields that should be merged into the
 * Prisma `data` object — callers spread `...fields`.
 */
export type ZoneWriteResolution =
  | { ok: true; fields: { zoneId?: string; zone?: string } }
  | { ok: false; status: 404; message: string };

export async function resolveSpotZoneWrite(
  campSiteId: string,
  input: { zone?: string; zoneId?: string }
): Promise<ZoneWriteResolution> {
  if (input.zoneId !== undefined) {
    const zone = await prisma.zone.findFirst({
      where: { id: input.zoneId, campSiteId, deletedAt: null },
      select: { name: true },
    });
    if (!zone) {
      // No cross-camp IDOR + no linking a soft-deleted/nonexistent zone.
      return { ok: false, status: 404, message: 'Zone not found' };
    }
    return { ok: true, fields: { zoneId: input.zoneId, zone: zone.name } };
  }
  if (input.zone !== undefined) {
    return { ok: true, fields: { zone: input.zone } };
  }
  return { ok: true, fields: {} };
}

/**
 * Calculate number of nights between two dates
 */
export function calculateNights(checkIn: Date, checkOut: Date): number {
  const diffTime = Math.abs(checkOut.getTime() - checkIn.getTime());
  return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
}
