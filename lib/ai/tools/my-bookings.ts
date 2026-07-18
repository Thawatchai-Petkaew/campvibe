/**
 * CAM-418 (ADR-013 §D5, S5a) — the two authed-tier personal booking tools.
 *
 * Identity source (CAM-417 invariant, reused not forked): the ONLY way either
 * tool learns who is asking is `ctx.userId`, built server-side from the
 * NextAuth session by the registry/route layer. `bookingId` IS a model arg on
 * `getMyBookingDetail` (zod-validated), but OWNERSHIP is enforced by
 * `getOwnedBooking`'s `where: { id, userId }` — never by trusting the model.
 * Neither tool's zod `parameters` nor its `jsonSchema` contains a `userId` (or
 * any caller-identity) field (asserted for the whole real registry by
 * `__tests__/cam-417-tool-registry-tiers.test.ts`'s security-invariant test).
 *
 * getMyBookings wraps the same userId-scoped query `GET /api/bookings` uses
 * (app/api/bookings/route.ts) — same `where: { userId }` + `orderBy:
 * { createdAt: 'desc' }` — but with a summary `select` (no campSite/spot
 * join needed; the crystallized `snapshotCampName` already carries the name)
 * and a tighter cap (BR-1) than that route's own `BOOKING_LIST_LIMIT`.
 *
 * getMyBookingDetail wraps `getOwnedBooking` (lib/bookings.ts) unchanged — the
 * exact same owner-scoped query + "same 404 for not-found and not-owned, no
 * existence leak" convention `app/api/bookings/[id]/route.ts` (CAM-61) uses.
 *
 * No card/rich-block rendering here — results feed the assistant as plain
 * text; the assistant links to `/bookings/[id]` for the real detail page.
 */
import { z } from 'zod';
import { Prisma } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { getOwnedBooking } from '@/lib/bookings';
import { serializeDecimals } from '@/lib/serialize';
import type { ToolDefinition, ToolContext } from '@/lib/ai/tool-registry';

/** BR-1: hard cap — the newest N bookings only. No arg exists to request more. */
export const MY_BOOKINGS_MAX_RESULTS = 10;

const myBookingsSelect = {
  id: true,
  status: true,
  checkInDate: true,
  checkOutDate: true,
  snapshotCampName: true,
  totalPrice: true,
} satisfies Prisma.BookingSelect;

type MyBookingsRow = Prisma.BookingGetPayload<{ select: typeof myBookingsSelect }>;

export interface MyBookingSummary {
  id: string;
  status: MyBookingsRow['status'];
  checkInDate: Date;
  checkOutDate: Date;
  snapshotCampName: string | null;
  /** Mapped from the Booking.totalPrice Decimal column (BR-5) — always a plain number. */
  totalAmount: number;
}

function toSummary(row: MyBookingsRow): MyBookingSummary {
  return {
    id: row.id,
    status: row.status,
    checkInDate: row.checkInDate,
    checkOutDate: row.checkOutDate,
    snapshotCampName: row.snapshotCampName,
    // Single Decimal field → plain number (BR-5). serializeDecimals is for whole-object
    // recursion (used below on the full getMyBookingDetail payload); Decimal.toNumber()
    // is the direct conversion for one already-typed field.
    totalAmount: row.totalPrice.toNumber(),
  };
}

// ---------------------------------------------------------------------------
// getMyBookings — no model args at all (the caller's own bookings, period).
// ---------------------------------------------------------------------------

export const getMyBookingsArgsSchema = z.object({});
export type GetMyBookingsArgs = z.infer<typeof getMyBookingsArgsSchema>;

export interface GetMyBookingsResult {
  /** Never omitted — a caller with zero bookings gets [] (EC-1), not an error. */
  bookings: MyBookingSummary[];
}

const getMyBookingsJsonSchema = {
  type: 'object',
  properties: {},
  required: [],
  additionalProperties: false,
} as const;

export async function executeGetMyBookings(ctx: ToolContext): Promise<GetMyBookingsResult> {
  // BR-4 defense-in-depth: dispatchTool already refuses an authed tool with no
  // ctx.userId before execute() ever runs (CAM-417), but this tool never issues
  // an unscoped query either way — a missing userId returns an empty list.
  if (!ctx.userId) return { bookings: [] };

  const rows = await prisma.booking.findMany({
    where: { userId: ctx.userId },
    select: myBookingsSelect,
    orderBy: { createdAt: 'desc' },
    take: MY_BOOKINGS_MAX_RESULTS,
  });

  return { bookings: rows.map(toSummary) };
}

export const getMyBookingsTool: ToolDefinition<GetMyBookingsArgs, GetMyBookingsResult> = {
  name: 'getMyBookings',
  description:
    "Get the authenticated camper's own bookings (newest 10 only): status, check-in/out dates, camp name, and total amount. Requires a logged-in session.",
  tier: 'authed',
  parameters: getMyBookingsArgsSchema,
  jsonSchema: getMyBookingsJsonSchema,
  // CAM-417 — ctx is server-bound identity; args carry nothing (no fields exist to validate).
  execute: (_args, ctx) => executeGetMyBookings(ctx),
};

// ---------------------------------------------------------------------------
// getMyBookingDetail — bookingId is a model arg; OWNERSHIP is enforced by
// getOwnedBooking's where:{id,userId}, never by the model-supplied id alone.
// ---------------------------------------------------------------------------

export const getMyBookingDetailArgsSchema = z.object({
  bookingId: z.string().uuid(),
});
export type GetMyBookingDetailArgs = z.infer<typeof getMyBookingDetailArgsSchema>;

export type OwnedBookingDetail = NonNullable<Awaited<ReturnType<typeof getOwnedBooking>>>;

/** Discriminated union (api.md §11) — the caller narrows on `ok` before reading `booking`. */
export type GetMyBookingDetailResult =
  | { ok: true; booking: OwnedBookingDetail }
  | { ok: false; code: 'not_found' };

const getMyBookingDetailJsonSchema = {
  type: 'object',
  properties: {
    bookingId: {
      type: 'string',
      description: "The Booking id (UUID) to look up. Must belong to the current caller's own bookings.",
    },
  },
  required: ['bookingId'],
  additionalProperties: false,
} as const;

export async function executeGetMyBookingDetail(
  args: GetMyBookingDetailArgs,
  ctx: ToolContext
): Promise<GetMyBookingDetailResult> {
  // BR-4 defense-in-depth (see executeGetMyBookings) — never query unscoped.
  if (!ctx.userId) return { ok: false, code: 'not_found' };

  // getOwnedBooking returns null for BOTH "doesn't exist" and "belongs to another
  // user" (CAM-61 no-existence-leak convention) — mapped identically here (EC-3).
  const booking = await getOwnedBooking(args.bookingId, ctx.userId);
  if (!booking) return { ok: false, code: 'not_found' };

  return { ok: true, booking: serializeDecimals(booking) };
}

export const getMyBookingDetailTool: ToolDefinition<GetMyBookingDetailArgs, GetMyBookingDetailResult> = {
  name: 'getMyBookingDetail',
  description:
    "Get full detail for ONE of the authenticated camper's own bookings by id (dates, guests, price, camp + spot info). Returns not_found for an id that doesn't exist or doesn't belong to the caller — never another user's booking.",
  tier: 'authed',
  parameters: getMyBookingDetailArgsSchema,
  jsonSchema: getMyBookingDetailJsonSchema,
  execute: (args, ctx) => executeGetMyBookingDetail(args, ctx),
};
