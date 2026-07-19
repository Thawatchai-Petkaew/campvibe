/**
 * GET /api/ai/camp-detail/[id] — CAM-446.
 *
 * S5 data foundation for the in-chat floating detail card (CAM-447): exposes
 * the EXISTING guest-safe `getCampDetail` AI tool
 * (lib/ai/tools/get-camp-detail.ts, CAM-427, `tier:'guest'`) over a plain
 * HTTP GET, so the card can fetch amenities/reviews/availability directly
 * instead of round-tripping through the chat/tool-call pipeline.
 *
 * Reuses `executeGetCampDetail` + `GetCampDetailResult` AS-IS — no new
 * `select`, no operator/host/contact fields added here (PDPA): that select
 * already carries no phone/email/LINE/operator relation, and reviews already
 * strip `authorId` (only `author.name` survives, via `toReviewListItem`).
 * The bounded caps (`WEEKEND_LOOKAHEAD_COUNT`, `MAX_REVIEWS_RETURNED`) live
 * in the tool file, unchanged. Deliberately does NOT use `getCampBySlug` —
 * that read returns host contact fields, a PDPA leak for a public route.
 *
 * Pipeline (order matters): per-IP rate limit (the SAME guard/window as
 * `POST /api/ai/chat`) FIRST, before any param parsing or DB read -> zod
 * validates `[id]` as a UUID -> `executeGetCampDetail` -> map its own
 * `not_found` signal to 404.
 *
 * Error-code set: 400 `invalid_id` (not a UUID) · 404 `not_found`
 * (unpublished / inactive / soft-deleted / nonexistent — indistinguishable,
 * no existence leak, mirrors the tool's own single not_found signal) ·
 * 429 `rate_limited` · 500 `internal_error` (generic — no stack/internal
 * leaked; see api.md rule 5).
 */
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { checkAssistantRateLimit } from '@/lib/ai/rate-limit';
import { executeGetCampDetail } from '@/lib/ai/tools/get-camp-detail';

const idSchema = z.string().uuid();

/** Same IP-extraction pattern as app/api/ai/chat/route.ts / app/api/campgrounds/route.ts. */
function extractClientIp(request: NextRequest): string {
  return request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'unknown';
}

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  // Per-IP rate limit FIRST — before param validation, before any DB read
  // (mirrors POST /api/ai/chat's BR-2 ordering; a public read-only route
  // still needs a floor guard against scraping/abuse).
  const ip = extractClientIp(request);
  const rl = checkAssistantRateLimit(ip);
  if (!rl.allowed) {
    return NextResponse.json(
      { error: 'rate_limited' },
      { status: 429, headers: { 'Retry-After': String(rl.retryAfterSec) } }
    );
  }

  const { id } = await context.params;
  const parsedId = idSchema.safeParse(id);
  if (!parsedId.success) {
    return NextResponse.json({ error: 'invalid_id' }, { status: 400 });
  }

  try {
    const result = await executeGetCampDetail({ campSiteId: parsedId.data });
    if (!result.ok) {
      // The tool's ONLY failure signal (not_found) already covers
      // unpublished/inactive/soft-deleted/nonexistent identically — no
      // existence leak to distinguish here.
      return NextResponse.json(result, { status: 404 });
    }
    return NextResponse.json(result, { status: 200 });
  } catch (error) {
    // Never leak the Prisma/internal error to the client (security.md);
    // log server-side only, no secret/PII.
    console.error(
      JSON.stringify({
        level: 'error',
        event: 'ai_camp_detail_failed',
        message: error instanceof Error ? error.message : 'unknown',
      })
    );
    return NextResponse.json({ error: 'internal_error' }, { status: 500 });
  }
}
