/**
 * CAM-271 — `POST /api/ai/chat`: PUBLIC (no sign-in, guest Discover funnel,
 * BR-1). No ownership/authz check runs here because the route triggers no
 * mutation and owns no resource (CAM-270's tools are read-only, BR-1);
 * abuse is contained by the per-IP rate limit (BR-2) + the zod input caps
 * (BR-3) below, not by an auth gate.
 *
 * Pipeline (BR-binding order):
 *  1. Per-IP rate limit (BR-2) — runs FIRST, before body validation and
 *     before any model/tool call. Mirrors app/api/campgrounds/route.ts's
 *     IP-extraction + rate-limit-first layering (this route is PUBLIC, so
 *     it drops the auth() step app/api/reviews/route.ts has).
 *  2. zod-validate the posted conversation at the boundary (BR-3) — before
 *     any model/tool call.
 *  3. Serialize the full capped conversation into ONE userText (Seams & refs
 *     — CAM-270's runAssistantTurn takes a single string, not an array) and
 *     invoke CAM-270's single-round turn (BR-4).
 *  4. Map the handled result to a typed response (BR-5/BR-6) — the raw
 *     model error / status body / key is NEVER surfaced in the response or
 *     logs (security.md, CAM-270 BR-6).
 */
import { NextRequest, NextResponse } from 'next/server';
import { checkAssistantRateLimit } from '@/lib/ai/rate-limit';
import { runAssistantTurn } from '@/lib/ai/openrouter-client';
import { chatRequestSchema } from '@/lib/validations/ai-chat';
import { serializeConversation, MAX_PROMPT_CHARS } from '@/lib/ai/serialize-conversation';
import { serializeDecimals } from '@/lib/serialize';

/**
 * CAM-272 QA fix (Critical, contract-reconciliation.test.ts): `cards` carries
 * real `Prisma.Decimal` (priceLow/avgRating) + `Date` (createdAt) columns —
 * the exact `campCardSelect` shape (lib/read-models/camp-card.ts), since
 * `searchCampsites` is the only tool that ever populates `cards`.
 * `serializeDecimals` is the SAME convention every other route uses
 * (app/api/bookings/route.ts, app/api/campsites/route.ts, lib/serialize.ts).
 * Without it, `Prisma.Decimal.toJSON()` ships `priceLow`/`avgRating` as JSON
 * STRINGS and the client's numeric guard silently drops every priced card.
 * avgRating/reviewCount already flow through unchanged (QA Important fix —
 * `AiChatCardResponse` + `AiChatCampCard` now read them, no route change
 * needed for those two fields). Also drops `images[].sortOrder` (an
 * internal ordering key, never read client-side — QA Info finding) — done
 * defensively (only when a card actually has an `images` array) so this
 * never assumes a full `campCardSelect` shape.
 */
function toWireCards(cards: unknown[]): unknown[] {
  const serialised = serializeDecimals(cards);
  return serialised.map((raw) => {
    if (!raw || typeof raw !== 'object' || !Array.isArray((raw as Record<string, unknown>).images)) {
      return raw;
    }
    const c = raw as Record<string, unknown>;
    const images = c.images as unknown[];
    return {
      ...c,
      images: images.map((img) =>
        img && typeof img === 'object' ? { url: (img as Record<string, unknown>).url } : img
      ),
    };
  });
}

/** Same IP-extraction pattern as app/api/campgrounds/route.ts (Vercel proxy header). */
function extractClientIp(request: NextRequest): string {
  return request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'unknown';
}

export async function POST(request: NextRequest) {
  // 1. BR-2 — per-IP rate limit FIRST, before body validation, before any paid call.
  const ip = extractClientIp(request);
  const rl = checkAssistantRateLimit(ip);
  if (!rl.allowed) {
    return NextResponse.json(
      { code: 'rate_limited' },
      { status: 429, headers: { 'Retry-After': String(rl.retryAfterSec) } }
    );
  }

  // 2. BR-3 — zod-validate at the boundary before any model/tool call. A
  //    malformed body (not JSON, or the wrong shape) fails the same way as
  //    a cap breach: 400 `invalid_request`.
  let rawBody: unknown;
  try {
    rawBody = await request.json();
  } catch {
    return NextResponse.json({ code: 'invalid_request' }, { status: 400 });
  }

  const parsed = chatRequestSchema.safeParse(rawBody);
  if (!parsed.success) {
    return NextResponse.json({ code: 'invalid_request' }, { status: 400 });
  }

  // 3. BR-4 — the full capped conversation, serialized, drives CAM-270's
  //    single-round turn (exactly one tool-call round; no agent loop). The
  //    transcript-level cap (MAX_PROMPT_CHARS) is forwarded as the
  //    sanitizer override so a long, already-bounded transcript is not
  //    re-truncated to the single-message default — the newest turn (the
  //    camper's current question) always survives (functional-security fix).
  const userText = serializeConversation(parsed.data.messages);
  const result = await runAssistantTurn(userText, { maxPromptChars: MAX_PROMPT_CHARS });

  // 4. BR-5 — handled-failure mapping. `skipped` only appears on an ok:true
  //    result (key unset, no network call made); check it first so it is
  //    never mistaken for the ok:false branch below.
  if (result.skipped) {
    return NextResponse.json({ code: 'assistant_disabled' }, { status: 503 });
  }
  if (!result.ok) {
    return NextResponse.json({ code: 'assistant_error' }, { status: 502 });
  }

  // BR-6 — success body is { answer, cards } plus the CAM-410 additive,
  // optional `suggestions` (BR-1: absent means no chips — omitted, never a
  // defined empty array, keeping the body's key set unchanged for a turn
  // with no follow-up questions); nothing else leaked.
  const body: { answer: string; cards: unknown[]; suggestions?: string[] } = {
    answer: result.answer ?? '',
    cards: toWireCards(result.cards ?? []),
  };
  if (result.suggestions && result.suggestions.length > 0) {
    body.suggestions = result.suggestions;
  }
  return NextResponse.json(body, { status: 200 });
}
