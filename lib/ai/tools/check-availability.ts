/**
 * CAM-270 AC-2, BR-1/BR-4 — the `checkAvailability` read-only AI tool.
 *
 * Wraps `getRemainingCapacity` (lib/campsite-availability.ts) as a LIVE query
 * on every call — never cached, never embedded (ADR-009). That function
 * already reuses the shipped `MAX_STATUS_RANGE_NIGHTS` guard one layer down
 * (via `getCampSiteDailyAvailability`), throwing `AvailabilityRangeTooWideError`
 * for an over-wide range; this tool is the ONE place that maps that throw
 * into a handled, discriminated result (EC-4) — the registry/model never see
 * a raw exception.
 *
 * CAM-469 (security fix, BR-1/BR-2/BR-3) — `getRemainingCapacity` itself does
 * `findUnique({ where: { id } })` with NO public-visibility gate, and stays
 * that way (it is shared by operator/booking-preview callers that legitimately
 * query their own unpublished camp). This TOOL is the boundary the model/
 * guest-supplied campSiteId crosses, so the gate lives HERE: before calling
 * getRemainingCapacity, the id must pass the SAME public-visibility predicate
 * `getCampDetail` already uses (lib/ai/tools/get-camp-detail.ts — `isActive:
 * true, isPublished: true, deletedAt: null`, BR-2, reused verbatim, not
 * reinvented). A camp that fails the gate (or does not exist at all)
 * short-circuits to the EXACT "no data" shape `getRemainingCapacity` already
 * returns for a nonexistent id (BR-3, `NO_DATA_RESULT` below) — no new error
 * type, nothing that lets a caller distinguish "unpublished" from
 * "nonexistent" (no existence oracle, AC-2/AC-3).
 */
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import {
  getRemainingCapacity,
  AvailabilityRangeTooWideError,
  type RemainingCapacityResult,
} from '@/lib/campsite-availability';
import type { ToolDefinition } from '@/lib/ai/tool-registry';

const isoDate = z.string().refine((value) => !Number.isNaN(new Date(value).getTime()), {
  message: 'Invalid date',
});

/**
 * CAM-469 BR-3 — the exact "no data" shape `getRemainingCapacity` returns
 * today when `prisma.campSite.findUnique` can't find the id (lib/campsite-
 * availability.ts, the `!campSite` branch). Reused verbatim so a gated
 * (unpublished/inactive/deleted) camp is byte-identical to an unknown one.
 */
const NO_DATA_RESULT: RemainingCapacityResult = {
  capacity: null,
  bookedGuests: 0,
  heldGuests: 0,
  remaining: null,
  blockedByHost: false,
};

export const checkAvailabilityArgsSchema = z.object({
  campSiteId: z.string().uuid(),
  startDate: isoDate,
  endDate: isoDate,
});

export type CheckAvailabilityArgs = z.infer<typeof checkAvailabilityArgsSchema>;

/** Discriminated union (api.md §11) — the caller narrows on `ok` before reading fields. */
export type CheckAvailabilityResult =
  | ({ ok: true } & RemainingCapacityResult)
  | { ok: false; code: 'RANGE_TOO_WIDE' };

const jsonSchema = {
  type: 'object',
  properties: {
    campSiteId: { type: 'string', description: 'The CampSite id (UUID) to check' },
    startDate: { type: 'string', description: 'Stay start date, ISO 8601 (e.g. 2026-08-01)' },
    endDate: { type: 'string', description: 'Stay checkout date (exclusive), ISO 8601' },
  },
  required: ['campSiteId', 'startDate', 'endDate'],
  additionalProperties: false,
} as const;

export async function executeCheckAvailability(args: CheckAvailabilityArgs): Promise<CheckAvailabilityResult> {
  const startDate = new Date(args.startDate);
  const endDate = new Date(args.endDate);

  // CAM-469 BR-1/BR-2 — public-visibility gate BEFORE getRemainingCapacity
  // (which has no such gate itself). One extra indexed lookup (EC-2 perf
  // note); a failing/missing camp short-circuits to NO_DATA_RESULT so it is
  // indistinguishable from a nonexistent id (BR-3, no existence oracle).
  const visibleCamp = await prisma.campSite.findFirst({
    where: { id: args.campSiteId, isActive: true, isPublished: true, deletedAt: null },
    select: { id: true },
  });
  if (!visibleCamp) {
    return { ok: true, ...NO_DATA_RESULT };
  }

  try {
    const result = await getRemainingCapacity(args.campSiteId, startDate, endDate);
    return { ok: true, ...result };
  } catch (err) {
    if (err instanceof AvailabilityRangeTooWideError) {
      // EC-4/BR-4: the shipped guard's safe result — no per-night loop, no throw to the caller.
      return { ok: false, code: 'RANGE_TOO_WIDE' };
    }
    throw err;
  }
}

export const checkAvailabilityTool: ToolDefinition<CheckAvailabilityArgs, CheckAvailabilityResult> = {
  name: 'checkAvailability',
  description:
    'Check LIVE remaining capacity for a published CampVibe campsite over a date range (capacity, bookedGuests, heldGuests, remaining, blockedByHost). Never cached.',
  // CAM-417 (ADR-013 D5) — offered to every caller, session or not.
  tier: 'guest',
  parameters: checkAvailabilityArgsSchema,
  jsonSchema,
  // CAM-417 — this tool needs no caller identity; `_ctx` is server-bound and unused here.
  execute: (args, _ctx) => executeCheckAvailability(args),
};
