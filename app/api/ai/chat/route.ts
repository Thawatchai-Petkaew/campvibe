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
 *  3. Build the full capped conversation into a REAL multi-turn messages
 *     array (CAM-415, `lib/ai/build-turn-messages.ts` — every user turn
 *     individually fenced, assistant history re-sanitized) and invoke the
 *     CAM-416 bounded agent loop (up to 4 completions, 40s turn deadline)
 *     over that array (BR-4).
 *  4. Map the handled result to a typed response (BR-5/BR-6) — the raw
 *     model error / status body / key is NEVER surfaced in the response or
 *     logs (security.md, CAM-270 BR-6).
 *
 * CAM-420 (ADR-013 D6/D5, S6) — the route's input contract becomes a UNION,
 * tried legacy-FIRST so the exact pipeline above stays byte-identical for
 * the existing `{messages}` shape (guest, stateless — no session ever read,
 * no persistence, no tier change). A NEW `{conversationId?, message}` shape
 * requires a session (401 without one) and adds a second pipeline:
 *   1. The SAME per-IP rate limit above (unconditional, still first).
 *   2. zod-validate the union (still before any model/tool call).
 *   3. `auth()` (read ONLY for this branch — legacy never touches it) ->
 *      401 `unauthenticated` if no session.
 *   4. A SECOND, per-user rate limit (`checkAssistantRateLimitForUser`,
 *      Security forward-flag, HARD AC) — additive to the per-IP guard, the
 *      load-bearing spam control for the persisted-write path specifically.
 *   5. Resolve the conversation: absent `conversationId` -> create; present
 *      -> ownership-scoped `loadWindow` (404 `conversation_not_found` if
 *      absent/not owned) — never a 403/404 split (CAM-421 precedent).
 *   6. Build a REAL `ToolContext{userId}`, offering the `authed`-tier tools
 *      too (openrouter-client's `buildToolSchemas`), and run the SAME
 *      CAM-416 bounded loop over `history + this message`
 *      (`source:'server'` — the history is server-persisted, so a stored
 *      ASSISTANT turn is safe to re-enter unfenced; CAM-415's
 *      `build-turn-messages.ts`).
 *   7. Persist the turn (`appendTurn`) ONLY after the loop succeeds (D2 —
 *      a turn that errors/times out/self-skips persists NOTHING); the
 *      route owns sanitize-before-store (Security forward-flag: the store's
 *      own truncation only bounds length, never strips control
 *      chars/forged delimiter fragments) by reusing the SAME
 *      `sanitizeForPrompt` the prompt boundary already uses.
 */
import { NextRequest, NextResponse } from 'next/server';
import { checkAssistantRateLimit, checkAssistantRateLimitForUser } from '@/lib/ai/rate-limit';
import { runAssistantTurnFromMessages } from '@/lib/ai/openrouter-client';
import { chatRequestUnionSchema, type ChatMessage, type ChatRequest, type ChatRequestV2 } from '@/lib/validations/ai-chat';
import { buildTurnMessages } from '@/lib/ai/build-turn-messages';
import { sanitizeForPrompt } from '@/lib/ai/sanitize';
import { serializeDecimals } from '@/lib/serialize';
import type { ToolContext } from '@/lib/ai/tool-registry';
import {
  appendTurn,
  createConversation,
  loadWindow,
  MAX_CONTENT_TEXT_LENGTH,
  type ConversationMessageView,
} from '@/lib/ai/conversation-store';

/**
 * CAM-416 (ADR-013 D4) — the agent loop can run up to MAX_AGENT_ITERATIONS
 * completions within its TURN_DEADLINE_MS; give the route's own execution
 * ceiling headroom above that (Vercel default is 10s on Hobby/Edge-adjacent
 * runtimes).
 *
 * INVARIANT (Security Info fix, post-merge) — must stay true so a deadline
 * check that JUST passes can never let its one final model call run the
 * route past this ceiling (which would surface a raw Vercel 504 instead of
 * openrouter-client.ts's own graceful 502 `assistant_unavailable`):
 *   TURN_DEADLINE_MS + MODEL_CALL_TIMEOUT_MS < maxDuration * 1000
 *   40_000        +   15_000                = 55_000 < 60_000  ✓ (5s margin)
 * Enforced by __tests__/cam-416-agent-loop.test.ts so it cannot silently regress.
 */
export const maxDuration = 60;

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
 *
 * CAM-427: `options[]` (the card's "first tag") is trimmed the same way —
 * only `{nameTh, nameEn}` reach the wire, matching the declared
 * `AiChatCardTag` type exactly; `code`/`group` are server-internal taxonomy
 * fields, never read client-side. `hasReviews`/`remaining` are already plain
 * booleans/numbers (no Decimal/Date involved) so `serializeDecimals` passes
 * them through unchanged with no extra handling needed here.
 */
function toWireCards(cards: unknown[]): unknown[] {
  const serialised = serializeDecimals(cards);
  return serialised.map((raw) => {
    if (!raw || typeof raw !== 'object') return raw;
    const c = raw as Record<string, unknown>;
    const out: Record<string, unknown> = { ...c };

    if (Array.isArray(c.images)) {
      out.images = (c.images as unknown[]).map((img) =>
        img && typeof img === 'object' ? { url: (img as Record<string, unknown>).url } : img
      );
    }

    if (Array.isArray(c.options)) {
      out.options = (c.options as unknown[]).map((opt) =>
        opt && typeof opt === 'object'
          ? { nameTh: (opt as Record<string, unknown>).nameTh, nameEn: (opt as Record<string, unknown>).nameEn }
          : opt
      );
    }

    return out;
  });
}

/** Same IP-extraction pattern as app/api/campgrounds/route.ts (Vercel proxy header). */
function extractClientIp(request: NextRequest): string {
  return request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'unknown';
}

/**
 * CAM-420 — the route's default window of prior turns loaded for a resumed
 * v2 conversation. Deliberately a FIXED constant, never read from the
 * request (Security forward-flag: "clamp loadWindow/any client-influenced
 * limit to [1,MAX]") — there is no client-influenced limit to clamp here
 * because the caller never supplies one; `conversation-store.loadWindow`'s
 * own default (`DEFAULT_WINDOW_SIZE`) already equals this value.
 */
const HISTORY_WINDOW_SIZE = 10;

/** Legacy USER/ASSISTANT enum (Prisma) -> the lower-case role shape `buildTurnMessages` expects. */
function toChatMessages(history: ConversationMessageView[]): ChatMessage[] {
  return history.map((message) => ({
    role: message.role === 'USER' ? 'user' : 'assistant',
    content: message.contentText,
  }));
}

/**
 * Security forward-flag (v2 binding requirement) — the route owns
 * sanitize-BEFORE-store: `conversation-store`'s own `truncateContentText`
 * only bounds LENGTH, it does not strip control characters or a forged
 * `<user_message>` delimiter fragment. Reuses the SAME sanitizer the prompt
 * boundary already uses (`lib/ai/sanitize.ts`) — one sanitizer, not a
 * parallel one (CAM-410 Seams & refs precedent) — capped at the STORE's own
 * length ceiling (`MAX_CONTENT_TEXT_LENGTH`, 4000) rather than the prompt's
 * shorter 2000-char default, so this call never re-truncates a message the
 * store would otherwise have kept in full.
 */
function sanitizeForStore(text: string): string {
  return sanitizeForPrompt(text, MAX_CONTENT_TEXT_LENGTH);
}

/**
 * Legacy branch (CAM-271/415/416/417) — byte-identical to before CAM-420.
 * No session is ever read; guest-tier tools only; nothing is persisted.
 */
async function handleLegacyTurn(data: ChatRequest): Promise<NextResponse> {
  // BR-4 — the full capped conversation becomes a real multi-turn messages
  // array (CAM-415): every user turn (history + current) is individually
  // sanitized + fenced in <user_message> DATA tags, and assistant history
  // re-enters as re-sanitized plain content. Drives CAM-416's bounded agent
  // loop over that array.
  const turnMessages = buildTurnMessages(data.messages);
  const result = await runAssistantTurnFromMessages(turnMessages);

  // BR-5 — handled-failure mapping. `skipped` only appears on an ok:true
  // result (key unset, no network call made); check it first so it is
  // never mistaken for the ok:false branch below.
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

/**
 * V2 branch (CAM-420, ADR-013 D6/D5) — session-bound, persisted, tiered.
 * Error-code set: 401 `unauthenticated` · 404 `conversation_not_found` ·
 * 429 `rate_limited` · 500 `internal_error` · 502 `assistant_error` ·
 * 503 `assistant_disabled`.
 */
async function handleV2Turn(data: ChatRequestV2): Promise<NextResponse> {
  // SESSION -> TIER — `@/lib/auth` (next-auth) is loaded + read ONLY on this
  // branch, via a dynamic import (same pattern as
  // `lib/auth-utils.ts`'s `requireCampSiteOwnership`). Legacy requests never
  // trigger this import at all, so the legacy path stays byte-identical —
  // it never touches the session, and the next-auth module graph is never
  // even loaded for a guest turn.
  const { auth } = await import('@/lib/auth');
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) {
    return NextResponse.json({ code: 'unauthenticated' }, { status: 401 });
  }

  // Security forward-flag (HARD AC) — a SECOND rate limit, per-user,
  // additive to the per-IP guard already run in POST() below: the
  // load-bearing spam control for this persisted-write path specifically,
  // BEFORE any paid model call (and before the conversation read/write
  // below).
  const userRl = checkAssistantRateLimitForUser(userId);
  if (!userRl.allowed) {
    return NextResponse.json(
      { code: 'rate_limited' },
      { status: 429, headers: { 'Retry-After': String(userRl.retryAfterSec) } }
    );
  }

  // Resolve the conversation: absent `conversationId` creates a new one;
  // a supplied one must be owned by this session — `loadWindow` is
  // ownership-scoped (a missing/not-owned id returns `not_found`, mapped to
  // 404, never a 403/404 split — same precedent as CAM-421's conversation
  // routes).
  let conversationId: string;
  let history: ConversationMessageView[] = [];

  if (data.conversationId) {
    const loaded = await loadWindow(data.conversationId, userId, HISTORY_WINDOW_SIZE);
    if (!loaded.ok) {
      if (loaded.code === 'not_found') {
        return NextResponse.json({ code: 'conversation_not_found' }, { status: 404 });
      }
      return NextResponse.json({ code: 'internal_error' }, { status: 500 });
    }
    conversationId = data.conversationId;
    history = loaded.data;
  } else {
    const created = await createConversation(userId);
    if (!created.ok) {
      return NextResponse.json({ code: 'internal_error' }, { status: 500 });
    }
    conversationId = created.data.id;
  }

  // Tiered registry (ADR-013 D5) — a real ToolContext offers the `authed`
  // tools too (openrouter-client's `buildToolSchemas`), and the system
  // prompt gains its signed-in-camper line (CAM-419). `source:'server'`
  // (build-turn-messages.ts, CAM-420's documented caller) — this history is
  // server-persisted, so a stored ASSISTANT turn re-enters as a real,
  // unfenced assistant-role message; the new user turn is fenced as DATA
  // exactly like the legacy path.
  const ctx: ToolContext = { userId };
  const combined: ChatMessage[] = [...toChatMessages(history), { role: 'user', content: data.message }];
  const turnMessages = buildTurnMessages(combined, { source: 'server' });

  const result = await runAssistantTurnFromMessages(turnMessages, ctx);

  if (result.skipped) {
    return NextResponse.json({ code: 'assistant_disabled' }, { status: 503 });
  }
  if (!result.ok) {
    // D2 — a turn that errors/times out/self-skips persists NOTHING;
    // `appendTurn` is never reached on this path (zero rows written).
    return NextResponse.json({ code: 'assistant_error' }, { status: 502 });
  }

  const answerText = result.answer ?? '';
  const body: { answer: string; cards: unknown[]; suggestions?: string[]; conversationId?: string } = {
    answer: answerText,
    cards: toWireCards(result.cards ?? []),
  };
  if (result.suggestions && result.suggestions.length > 0) {
    body.suggestions = result.suggestions;
  }

  // D2 — atomic append, AFTER success only. `blocks` is deliberately NOT
  // populated here (binding requirement: "do NOT migrate cards/suggestions
  // into blocks now" — that migration is explicitly out of scope for this
  // story), so this turn persists as a plain answer (`blocks: null`).
  const appended = await appendTurn(conversationId, userId, {
    userText: sanitizeForStore(data.message),
    assistantText: sanitizeForStore(answerText),
  });

  if (appended.ok) {
    body.conversationId = conversationId;
  } else {
    // The camper's already-billed answer is NEVER dropped for a storage
    // hiccup — `conversationId` is simply omitted (this turn specifically
    // did not land on the persisted path). Logged internally only, no
    // PII/content (observability.md field hygiene).
    console.error(
      JSON.stringify({ level: 'error', event: 'ai_chat_persist_failed', code: appended.code })
    );
  }

  return NextResponse.json(body, { status: 200 });
}

export async function POST(request: NextRequest) {
  // 1. BR-2 — per-IP rate limit FIRST, before body validation, before any
  //    paid call — unconditional, for EVERY request shape (legacy or v2).
  const ip = extractClientIp(request);
  const rl = checkAssistantRateLimit(ip);
  if (!rl.allowed) {
    return NextResponse.json(
      { code: 'rate_limited' },
      { status: 429, headers: { 'Retry-After': String(rl.retryAfterSec) } }
    );
  }

  // 2. BR-3 / ADR-013 D6 — zod-validate the request UNION at the boundary,
  //    before any model/tool call. A malformed body (not JSON, or matching
  //    neither shape) fails the same way as a cap breach: 400 `invalid_request`.
  let rawBody: unknown;
  try {
    rawBody = await request.json();
  } catch {
    return NextResponse.json({ code: 'invalid_request' }, { status: 400 });
  }

  const parsed = chatRequestUnionSchema.safeParse(rawBody);
  if (!parsed.success) {
    return NextResponse.json({ code: 'invalid_request' }, { status: 400 });
  }

  // Narrow on `messages` — the two shapes share no field name, so this is a
  // sound discriminant (legacy has `messages`; v2 has `message`, never
  // `messages`).
  if ('messages' in parsed.data) {
    return handleLegacyTurn(parsed.data);
  }
  return handleV2Turn(parsed.data);
}
