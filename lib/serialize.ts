import { Prisma } from "@prisma/client";

/**
 * Buffet serialization (Atomic Data Framework / ADR-002): convert Prisma.Decimal → number
 * for client-facing JSON. Money is stored as Decimal(12,2) in the DB; the read layer hands
 * the client a plain number so components render via Intl.NumberFormat without Decimal types.
 * Recurses arrays/objects; leaves Date and primitives untouched.
 */
export function serializeDecimals<T>(value: T): T {
  if (value == null) return value;
  if (value instanceof Prisma.Decimal) return value.toNumber() as unknown as T;
  if (value instanceof Date) return value;
  if (Array.isArray(value)) return value.map((v) => serializeDecimals(v)) as unknown as T;
  if (typeof value === "object") {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      out[k] = serializeDecimals(v);
    }
    return out as T;
  }
  return value;
}
