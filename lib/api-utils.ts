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
 * Calculate number of nights between two dates
 */
export function calculateNights(checkIn: Date, checkOut: Date): number {
  const diffTime = Math.abs(checkOut.getTime() - checkIn.getTime());
  return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
}
