---
linear: CAM-534
feature: platform-hardening
epic: taxonomy-ui-foundation
persona: platform
artifact: story
owner: backend-engineer
status: in-progress
version: v1
updated: 2026-07-26
---
# Rate-limit the public catalog list endpoint per IP (CAM-534)

## Story
As the **platform** (protects every Camper browsing the public catalog), I want `GET /api/campsites` — the live, unauthenticated public list endpoint — to carry a per-IP rate limit, so that a single client cannot hammer the catalog with unbounded requests while normal browsing (paging + filtering) is never disrupted.
Why: CAM-527 deleted the now-orphaned legacy `app/api/campgrounds` GET route, which had carried both an IP rate limit and a take cap. Nothing called that route, so deleting it removed no real protection — but CAM-535's independent audit reconfirmed (`grep checkRateLimit app/api/campsites/route.ts` → 1 hit, POST-only) that the LIVE public list endpoint has the take cap (`take: PAGE_SIZE + 1`) but never had an IP rate limit at all. This story closes that genuine gap on the live route.
Scope: `app/api/campsites/route.ts` GET handler only. Does not touch POST (already has its own `campsite:create:<userId>` limit), `[id]` routes, filters/taxonomy libs, or Prisma schema.
Depends on: CAM-527 (`docs/specs/platform-hardening/taxonomy-ui-foundation/CAM-527-dead-code-removal/story.md`) · CAM-535 (`docs/specs/platform-hardening/taxonomy-ui-foundation/CAM-535-restore-dropped-coverage/story.md`, the audit that pointed here)

## AC
| # | Given | When | Then (dev-facing, plain language — no end-user copy change) | System effect | Neg/edge |
|---|---|---|---|---|---|
| AC-1 | A client IP has made fewer than 300 requests to `GET /api/campsites` in the last 15 minutes | The client makes another request | Request is served normally (`200` with the existing `{items, nextCursor}` shape) | `checkRateLimit` counter for that IP key increments; no behavior change to the response body | EC-1 |
| AC-2 | A client IP has made 300 requests to `GET /api/campsites` in the last 15 minutes | The client makes a 301st request within the same window | `429` with header `Retry-After: <seconds>` and body `{"error":"rate_limited","message":"คำขอมากเกินไป กรุณาลองใหม่อีกครั้งในภายหลัง"}` | No Prisma query executed; response returned before any DB work | EC-2 |
| AC-3 | Two different client IPs are both near/over the limit | Each makes a request | Each IP's allow/deny outcome depends only on its own counter | Independent `catalog:list:<ip>` keys in the rate-limit store | EC-3 |
| AC-4 | The rate limiter itself throws (e.g. a bug in `checkRateLimit`) | A request arrives | The request is served normally (fail-open) — the public catalog is never taken offline by a limiter defect | Error is logged server-side only (`console.error`, no PII), request proceeds to normal validation/query | EC-4 |

## Rules
- BR-1 Limit = 300 requests / 15 minutes per client IP, keyed as `catalog:list:<ip>` via the existing `checkRateLimit` helper (`lib/rate-limit.ts`) — no second limiter implementation. This is wider than the general ~100/15min baseline in `.claude/rules/security.md` by design: the catalog is a public browse endpoint a real Camper hits repeatedly while infinite-scrolling (one fetch per `PAGE_SIZE`=24-item page) and adjusting filters/sort/keyword (one fetch per change) — a limit tight enough to interrupt that browsing pattern would be worse than no limit, while 300/15min still caps a scraper doing bulk/unbounded requests. (proves AC-1/AC-2)
- BR-2 IP is derived by reading the first hop of the `x-forwarded-for` header (`request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'unknown'`) — the same pattern already used everywhere else in this codebase (`lib/auth.ts` login limiter, `app/api/vitals/route.ts`, `app/api/tickets/*`, `lib/ai/rate-limit.ts`). Vercel's edge proxy sets this header and prepends the real client IP as the first value; a client can append fake values after it but cannot remove Vercel's own leading entry, so reading index 0 is the correct trust boundary for this deployment target — not a new parsing scheme. (proves AC-3)
- BR-3 On limiter error, fail OPEN: the request is served as if allowed, and the error is logged (never surfaced to the client, never blocks the response). The limiter call itself is a single bounded call (no per-request loop introduced) per the CAM-344 lesson that a try/catch bounds errors, not CPU. (proves AC-4)
- BR-4 The existing `take: PAGE_SIZE + 1` cap on the Prisma query is unchanged by this story (already asserted at `__tests__/cam-196-keyset-cursor.test.ts:443-445`, reconfirmed by CAM-535's audit — no new assertion needed here).

## Edge cases
- EC-1 IF the 300th request in-window arrives THEN it is still allowed (at-the-limit, not over) (BR-1).
- EC-2 IF the limit is exceeded THEN the response carries a `Retry-After` header with a positive integer seconds value AND the Prisma `findMany` is never called for that request (BR-1/BR-3).
- EC-3 IF one IP is rate-limited THEN a different IP's very next request is unaffected (independent counters) (BR-2).
- EC-4 IF `checkRateLimit` throws THEN the request still returns its normal `200`/`400` outcome (fail-open), never a `500` caused by the limiter itself (BR-3).

## Data
- No schema/DB change. No migration. Uses the existing in-memory `lib/rate-limit.ts` store (module-level `Map`, already documented as best-effort/per-instance on serverless — unchanged by this story).

## Seams & refs
- Reuse: `checkRateLimit` (`lib/rate-limit.ts`) — the single shared limiter used by every other rate-limited route in this codebase (auth login, bookings, reviews, wishlist, upload, campsite create, vitals, tickets, AI assistant, status endpoints). No parallel limiter implementation added.
- Refs: CAM-344 (fail-open-bounds-errors-not-CPU lesson, `.claude/rules/security.md`) · CAM-527 (route deletion that surfaced this gap) · CAM-535 (the audit ticket that confirmed the gap and pointed here).

## Out of scope
- Distributed/shared-store rate limiting (Redis/Upstash) across serverless instances — `lib/rate-limit.ts`'s header explicitly defers this as a cost decision; not this ticket.
- Any change to the POST create limiter, `[id]` routes, or the take cap value.

## Self-verify
- AC-1..AC-4 → integration tests in `__tests__/cam-534-catalog-rate-limit.test.ts` (real route handler + real in-process `checkRateLimit`, per qa.md §6 — never mock the layer under test).
- Story-specific: Prove-It case asserts the limiter store key `catalog:list:<ip>` is actually populated/consulted (fails if the `checkRateLimit` call is removed from the route, not just a source grep).
- Gate = `/quality-gate` · Done = AC verified on localhost (dev DB) before merge into `dev`.

## Changelog
- v1 (2026-07-26) — created.
