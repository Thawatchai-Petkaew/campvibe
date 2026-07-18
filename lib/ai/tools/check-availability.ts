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
 */
import { z } from 'zod';
import {
  getRemainingCapacity,
  AvailabilityRangeTooWideError,
  type RemainingCapacityResult,
} from '@/lib/campsite-availability';
import type { ToolDefinition } from '@/lib/ai/tool-registry';

const isoDate = z.string().refine((value) => !Number.isNaN(new Date(value).getTime()), {
  message: 'Invalid date',
});

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
