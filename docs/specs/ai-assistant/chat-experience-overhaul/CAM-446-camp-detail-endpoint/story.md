---
linear: CAM-446
feature: ai-assistant
epic: chat-experience-overhaul
persona: camper
artifact: story
owner: backend-engineer
status: In Progress
version: v1
updated: 2026-07-19
---
# Camp-detail data foundation for the floating detail card (CAM-446)

<!-- Gate class: new API contract (a new HTTP route) — routes to the full G1/G2 path per ops.md Gate policy v2, not spec-lite. No schema/migration; no new UI (backend-only data-foundation story, S5 for CAM-447's floating detail card). -->

## Story
As a **Camper**, I want the assistant's floating detail card to load a campsite's amenities, verified reviews, and upcoming weekend availability, so that I can see richer detail on a camp the assistant showed me without leaving the chat.
Why: `getCampDetail` (CAM-427) already exists as a guest-safe, read-only AI tool but is dispatched ONLY through the model's tool-call round-trip inside `POST /api/ai/chat` — the floating detail card (CAM-447) needs a plain HTTP GET it can call directly on open/refresh, independent of a chat turn.
Scope: `app/api/ai/camp-detail/[id]/route.ts` (new GET route) · `lib/api-client.ts` (`aiChatAPI.getCampDetail` facade). No new Prisma select, no new schema, no UI in this story (CAM-447 builds the card that consumes this).
Depends on: CAM-427 (`executeGetCampDetail` + `GetCampDetailResult`, the guest-safe select/caps this route reuses unchanged) · CAM-420/CAM-271 (`checkAssistantRateLimit`, the same per-IP guard/window this route reuses).

## AC
| # | Given | When | Then (user sees, Thai verbatim) | System effect | Neg/edge |
|---|---|---|---|---|---|
| AC-1 | a published, active campsite exists | the client calls `GET /api/ai/camp-detail/{id}` with that campsite's id | the floating card can render amenities, reviews, and upcoming weekend dates (this story ships the data only — CAM-447 wires the render) | `200` with the `GetCampDetailResult` shape (`amenities`, `reviews`, `reviewSummary`, `availableWeekendDates`); no operator/host/contact/phone/email/LINE field anywhere in the body (PDPA — reuses CAM-427's select unchanged) | EC-1 |
| AC-2 | the `id` path segment is not a valid UUID | the client calls the route with that malformed id | — (client-internal; the card shows its own "unavailable" state, no user-facing copy in this backend story) | `400 invalid_id`; the tool is never invoked, no DB read | — |
| AC-3 | no published/active/non-deleted campsite matches the id (unknown, unpublished, or soft-deleted) | the client calls the route with that (valid-uuid) id | — (client-internal; same "unavailable" state as AC-2, no existence leak) | `404` — the tool's own single `{ok:false, code:'not_found'}` signal is forwarded as-is; unpublished/inactive/soft-deleted/nonexistent are indistinguishable | EC-2 |
| AC-4 | a caller has already made 30 requests to this route from the same IP within 15 minutes (the same budget `POST /api/ai/chat` shares) | the caller makes a 31st request | — (client-internal; the card treats it the same as "unavailable") | `429` with a `Retry-After` header; the tool is never invoked on the 31st call | EC-3 |

## Rules
- BR-1 The route reuses `executeGetCampDetail` + `GetCampDetailResult` (`lib/ai/tools/get-camp-detail.ts`, CAM-427) AS-IS — no new Prisma `select`, no operator/host/contacts/phone/email/LINE field added; the existing bounded caps (`WEEKEND_LOOKAHEAD_COUNT=8`, `MAX_REVIEWS_RETURNED=10`) apply unchanged. (proves AC-1)
- BR-2 The `[id]` path param is zod-validated as `z.string().uuid()` BEFORE any DB read; a non-UUID never reaches `executeGetCampDetail`. (proves AC-2)
- BR-3 A per-IP rate limit (`checkAssistantRateLimit`, `lib/ai/rate-limit.ts` — the SAME 30-requests/15-minute contract `POST /api/ai/chat` already uses) runs FIRST, before param validation and before any DB read. (proves AC-4)
- BR-4 The tool's single `not_found` failure signal is forwarded as the route's `404` body unchanged — unpublished/inactive/soft-deleted/nonexistent campsites are indistinguishable from each other (no existence leak), matching the CAM-421 conversation-route precedent (no 403/404 split). (proves AC-3)
- BR-5 Any unexpected internal failure (a DB/Prisma error surfacing from `executeGetCampDetail`) is caught and mapped to a generic `500 internal_error` body — the raw error message/stack is logged server-side only (structured, no secret/PII), never returned to the client.

## Edge cases
- EC-1 IF the campsite is published/active but has zero verified reviews AND zero available upcoming Saturdays THEN the route still returns `200` with `reviews:[]`, `reviewSummary:{hasReviews:false,...}`, `availableWeekendDates:[]` — an empty result is not an error (BR-1, reuses CAM-427's own null/empty handling)
- EC-2 IF the id is a well-formed UUID but belongs to no row, or to an unpublished/inactive/soft-deleted row THEN `404` — identical body/status in every sub-case (BR-4)
- EC-3 IF the 31st request in the window carries a malformed (non-UUID) id THEN it is STILL rate-limited (`429`) before id validation ever runs — the rate limiter is unconditionally first (BR-3, mirrors CAM-421 BR-7)

## Data
- No schema/migration — no new column, table, or Prisma model. This story only adds an HTTP entry point over an existing read (`CampSite`/`Review`/`MasterData` via `executeGetCampDetail`'s existing `select`, unchanged since CAM-427).

## Seams & refs
- Reuse: `executeGetCampDetail` + `GetCampDetailResult` (`lib/ai/tools/get-camp-detail.ts`, CAM-427) — the tool itself is untouched by this story, only newly reachable over HTTP · `checkAssistantRateLimit` (`lib/ai/rate-limit.ts`, CAM-420/271) — the identical per-IP guard/window `POST /api/ai/chat` already enforces · the `[id]` UUID-param + ownership-free 404-forwarding pattern from `GET /api/ai/conversations/[id]` (`app/api/ai/conversations/[id]/route.ts`, CAM-421) — this route has no ownership dimension (guest-safe, `tier:'guest'`) so it forwards the tool's `not_found` directly rather than distinguishing "not found" from "not yours".
- Refs: ADR-009 (tool-use over normalized data — this route is a deliberate, narrow exception: an HTTP entry point alongside the tool-call path, not a fork of the data access itself) · ADR-013 D5 (tiered tool registry — `getCampDetail` is `tier:'guest'`, consistent with this route requiring no session).

## Out of scope
- The floating detail card's own UI/render (CAM-447 — this story is the data foundation only).
- Any new Prisma `select` field (operator/host/contact) — deliberately never added; `getCampBySlug` (which DOES carry host contacts) is explicitly NOT used here (PDPA).
- A per-user (session-bound) rate-limit variant — this route is guest-only (no session read at all); the per-IP guard is the sole abuse control, matching the tool's own `tier:'guest'` scope.

## Self-verify
- AC-1 → `__tests__/cam-446-camp-detail-route.test.ts` (200 shape + explicit no-PII-field assertion) + `__tests__/cam-446-api-client-camp-detail.test.ts` (client narrows the same shape)
- AC-2 → `__tests__/cam-446-camp-detail-route.test.ts` (400 on non-uuid id, tool never called)
- AC-3 → `__tests__/cam-446-camp-detail-route.test.ts` (404 forwards the tool's own not_found; `__tests__/cam-427-get-camp-detail.test.ts` already proves the tool's own published/active/non-deleted scoping, not re-tested here)
- AC-4 → `__tests__/cam-446-camp-detail-route.test.ts` (429 + Retry-After after 30 requests; ordering test proves the limiter runs before id validation)
- Story-specific: 500 generic-body guard (no stack/internal leaked) + api-client off-contract-body rejection (missing/wrong-typed field never blindly trusted) + non-2xx/network-exception collapse to `{ok:false, code:'not_found'}`
- Gate = /quality-gate · Done = every AC verified on localhost (dev DB) before merge into `dev`

## Changelog
- v1 (2026-07-19) — created (data-foundation story for CAM-447; spec authored alongside the code in the same PR).
