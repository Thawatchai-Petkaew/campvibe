/**
 * CAM-419 (ADR-013 D5) — the `getMyProfile` and `getMyWishlist` `authed`-tier
 * AI tools. Both wrap an ALREADY-SCOPED existing query (ADR-009
 * no-forked-data-path) and both learn who is asking ONLY from the
 * server-bound `ctx.userId` (CAM-417) — never from a model-supplied
 * argument, so neither tool's zod `parameters`/`jsonSchema` carries a
 * `userId` field (the CAM-417 registry invariant test enforces this across
 * every registered tool, including these two).
 *
 * SECURITY FORWARD-FLAG (ADR-013 D5, PII): `getMyProfile` returns exactly
 * four fields to the model — `name` and `email` PLAIN (email is the
 * user-editable "do not mask" field per ux.md §3), `createdAtIso` PLAIN
 * (non-sensitive), and `phoneMasked` — the RAW `User.phone` value is read
 * from Prisma but is masked via `maskPhoneForModel` before it is ever placed
 * on the returned object; the raw digits never cross into the tool result or
 * the model's context window.
 */
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { campCardSelect, type CampCardPayload } from '@/lib/read-models/camp-card';
import type { ToolContext, ToolDefinition } from '@/lib/ai/tool-registry';

/**
 * ux.md §3 PDPA masking table — mobile number: keep first 3 + last 2 digits,
 * mask glyph `•` (U+2022), verbatim shape `081-•••-••XX` (ADR-013 D5). This
 * is the ONLY place a `User.phone` value is read for the AI layer — every
 * caller of this module receives the masked string, never the raw one.
 */
export function maskPhoneForModel(phone: string): string {
  const digits = phone.replace(/\D/g, '');
  if (digits.length !== 10) {
    // Defensive fallback for any legacy/malformed value that doesn't match
    // the ^0[689]\d{8}$ shape validated at input time — mask entirely rather
    // than guess a split that could leak more than the intended 5 digits.
    return '•'.repeat(digits.length);
  }
  return `${digits.slice(0, 3)}-•••-••${digits.slice(8)}`;
}

/**
 * Defense-in-depth (mirrors the CAM-417 `dispatchTool` tier guard): the
 * registry already refuses an `authed`-tier tool call before `execute()` is
 * ever invoked when `ctx.userId` is absent, so this only fires if a caller
 * invokes the exported `execute*` function directly, bypassing the registry
 * (e.g. a test) — it must never silently proceed as if a session existed.
 */
function requireUserId(ctx: ToolContext, toolName: string): string {
  if (!ctx.userId) {
    throw new Error(`${toolName} requires an authenticated ctx.userId`);
  }
  return ctx.userId;
}

const noArgsSchema = z.object({});
type NoArgs = z.infer<typeof noArgsSchema>;
const noArgsJsonSchema = { type: 'object', properties: {}, additionalProperties: false } as const;

/* -------------------------------------------------------------------------- */
/* getMyProfile                                                               */
/* -------------------------------------------------------------------------- */

/**
 * Discriminated union (api.md §11) — `ok:false` only for the pathological
 * case where a session outlives its User row (e.g. a concurrent account
 * deletion); never thrown, so the agent loop's turn completes normally.
 */
export type GetMyProfileResult =
  | { ok: true; name: string | null; email: string; phoneMasked: string | null; createdAtIso: string }
  | { ok: false; code: 'not_found' };

export async function executeGetMyProfile(_args: NoArgs, ctx: ToolContext): Promise<GetMyProfileResult> {
  const userId = requireUserId(ctx, 'getMyProfile');

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { name: true, email: true, phone: true, createdAt: true },
  });
  if (!user) return { ok: false, code: 'not_found' };

  return {
    ok: true,
    name: user.name,
    email: user.email,
    phoneMasked: user.phone ? maskPhoneForModel(user.phone) : null,
    createdAtIso: user.createdAt.toISOString(),
  };
}

export const getMyProfileTool: ToolDefinition<NoArgs, GetMyProfileResult> = {
  name: 'getMyProfile',
  description:
    "Get the signed-in camper's own profile: name, email, and member-since date. The phone number is masked for privacy (never shown in full) and omitted entirely when none is on file.",
  tier: 'authed',
  parameters: noArgsSchema,
  jsonSchema: noArgsJsonSchema,
  execute: executeGetMyProfile,
};

/* -------------------------------------------------------------------------- */
/* getMyWishlist                                                              */
/* -------------------------------------------------------------------------- */

/** Bounded like `searchCampsites` (BR-2 there) — an AI tool result feeds directly into the model's prompt context, so it is never an unbounded fetch regardless of the underlying route's own shape. */
export const GET_MY_WISHLIST_MAX_RESULTS = 10;

export interface GetMyWishlistResult {
  /** Never null — an empty wishlist returns [] so the caller can render an empty state. */
  cards: CampCardPayload[];
}

export async function executeGetMyWishlist(_args: NoArgs, ctx: ToolContext): Promise<GetMyWishlistResult> {
  const userId = requireUserId(ctx, 'getMyWishlist');

  const rows = await prisma.wishlist.findMany({
    where: { userId },
    select: { campSite: { select: campCardSelect } },
    orderBy: { createdAt: 'desc' },
    take: GET_MY_WISHLIST_MAX_RESULTS,
  });

  return { cards: rows.map((row) => row.campSite) };
}

export const getMyWishlistTool: ToolDefinition<NoArgs, GetMyWishlistResult> = {
  name: 'getMyWishlist',
  description: `Get the signed-in camper's own saved (wishlisted) campsites as cards, most recently saved first. Returns at most ${GET_MY_WISHLIST_MAX_RESULTS} cards.`,
  tier: 'authed',
  parameters: noArgsSchema,
  jsonSchema: noArgsJsonSchema,
  execute: executeGetMyWishlist,
};
