/**
 * CAM-270 BR-8 — the shared per-IP guard contract for any live-call surface
 * that invokes an assistant turn. This module fixes the concrete numbers
 * (30 requests / 15 min) on top of the existing `checkRateLimit` helper
 * (lib/rate-limit.ts) so every caller uses the identical key shape + limit —
 * it does NOT wire the enforcement point itself (extracting the caller's IP
 * from a request and returning 429). That wiring lives at the chat endpoint
 * (CAM-271); this story only fixes the reusable contract (EC-8 self-verify).
 *
 * CAM-420 (ADR-013 D6, Security forward-flag) — the new session-bound
 * request path (`POST /api/ai/chat`'s `{conversationId?, message}` shape)
 * ADDS a per-USER variant of the SAME contract, `checkAssistantRateLimitForUser`.
 * It is additive to the per-IP guard above, not a replacement: it is the
 * load-bearing spam control specifically for the persisted-write path (an
 * authed camper's turns are billed AND written to the DB), so it must hold
 * even when many authed users share one IP (or one abusive IP tries many
 * accounts). Same limit/window as the per-IP guard — only the key shape
 * differs (`ai-assistant:user:<userId>`).
 */
import { checkRateLimit, type RateLimitResult } from '@/lib/rate-limit';

export const AI_ASSISTANT_RATE_LIMIT = 30;
export const AI_ASSISTANT_RATE_WINDOW_MS = 15 * 60 * 1000;

/** Per-IP rate-limit check for one assistant turn. Key: `ai-assistant:<ip>`. */
export function checkAssistantRateLimit(ip: string): RateLimitResult {
  return checkRateLimit(`ai-assistant:${ip}`, {
    limit: AI_ASSISTANT_RATE_LIMIT,
    windowMs: AI_ASSISTANT_RATE_WINDOW_MS,
  });
}

/** Per-user rate-limit check for one PERSISTED assistant turn (CAM-420). Key: `ai-assistant:user:<userId>`. */
export function checkAssistantRateLimitForUser(userId: string): RateLimitResult {
  return checkRateLimit(`ai-assistant:user:${userId}`, {
    limit: AI_ASSISTANT_RATE_LIMIT,
    windowMs: AI_ASSISTANT_RATE_WINDOW_MS,
  });
}
