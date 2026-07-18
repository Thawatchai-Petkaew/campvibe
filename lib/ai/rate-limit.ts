/**
 * CAM-270 BR-8 — the shared per-IP guard contract for any live-call surface
 * that invokes an assistant turn. This module fixes the concrete numbers
 * (30 requests / 15 min) on top of the existing `checkRateLimit` helper
 * (lib/rate-limit.ts) so every caller uses the identical key shape + limit —
 * it does NOT wire the enforcement point itself (extracting the caller's IP
 * from a request and returning 429). That wiring lives at the chat endpoint
 * (CAM-271); this story only fixes the reusable contract (EC-8 self-verify).
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
