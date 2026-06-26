/**
 * CAM-187 MEAS-1a — POST /api/vitals
 *
 * Accepts CWV payloads from VitalsReporter (browser sendBeacon).
 * Validates with zod, rate-limits per IP, emits ONE structured log line.
 * Returns 204 No Content — fire-and-forget from the browser's perspective.
 *
 * Security:
 *  - No auth required (public telemetry, no user data accepted).
 *  - IP used only for rate-limit key; never logged.
 *  - routeTemplate must be a pattern string — raw slugs/IDs are rejected
 *    by the 200-char max but never explicitly validated (client sanitises).
 *  - No PII is accepted or stored.
 *  - Body capped at ~2 KB to prevent abuse.
 *
 * Error codes: 204 success · 400 invalid input · 429 rate limited · 500 internal.
 */

import { VitalPayloadSchema } from '@/lib/validations/vitals';
import { checkRateLimit } from '@/lib/rate-limit';

const MAX_BODY_BYTES = 2048;
const RATE_LIMIT = 200;
const RATE_WINDOW_MS = 15 * 60 * 1000; // 15 min

function getIp(req: Request): string {
  return (
    req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ??
    'unknown'
  );
}

export async function POST(req: Request): Promise<Response> {
  // 1. Body-size guard — read body as text and enforce a real byte cap independent
  //    of the Content-Length header (which is optional and can be omitted or forged
  //    by chunked/headerless clients).
  let rawText: string;
  try {
    rawText = await req.text();
  } catch {
    return Response.json(
      { error: { code: 'VALIDATION_ERROR', message: 'Invalid payload' } },
      { status: 400 }
    );
  }
  if (Buffer.byteLength(rawText, 'utf8') > MAX_BODY_BYTES) {
    return Response.json(
      { error: { code: 'VALIDATION_ERROR', message: 'Payload too large' } },
      { status: 413 }
    );
  }

  // 2. Rate limit per IP — key is hashed internally; IP never stored
  const ip = getIp(req);
  const rl = checkRateLimit(`vitals:${ip}`, {
    limit: RATE_LIMIT,
    windowMs: RATE_WINDOW_MS,
  });
  if (!rl.allowed) {
    return Response.json(
      { error: { code: 'RATE_LIMITED', retryAfter: rl.retryAfterSec } },
      { status: 429, headers: { 'Retry-After': String(rl.retryAfterSec) } }
    );
  }

  // 3. Parse + validate — zod schema at the boundary
  let body: unknown;
  try {
    body = JSON.parse(rawText);
  } catch {
    return Response.json(
      { error: { code: 'VALIDATION_ERROR', message: 'Invalid payload' } },
      { status: 400 }
    );
  }

  // F-1: return a fixed generic message — never echo the zod received value
  const parsed = VitalPayloadSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json(
      { error: { code: 'VALIDATION_ERROR', message: 'Invalid metric' } },
      { status: 400 }
    );
  }

  const { name, value, rating, id, navigationType, routeTemplate } = parsed.data;

  // 4. Emit structured log line — no PII, no raw URL, no params
  //    deployShA from VERCEL_GIT_COMMIT_SHA (public build-time env var, not a secret)
  const deployShA = process.env.VERCEL_GIT_COMMIT_SHA ?? 'local';

  console.log(
    JSON.stringify({
      level: 'info',
      event: 'cwv_vital',
      metric: name,
      value,
      rating,
      routeTemplate,
      navigationType: navigationType ?? null,
      deployShA,
      vitalsId: id,
    })
  );

  // 5. 204 No Content — fire-and-forget
  return new Response(null, { status: 204 });
}
