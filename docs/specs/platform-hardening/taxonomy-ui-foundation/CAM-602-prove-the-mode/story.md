---
linear: CAM-602
feature: platform-hardening
epic: taxonomy-ui-foundation
persona: admin
artifact: story
owner: backend-engineer
status: in-progress
version: v1
updated: 2026-07-28
---
# A query param an older server does not understand is silently ignored, and the client reads the result as a real answer (CAM-602)

## Story
As the **Admin** (the owner reading `/status` and running `node scripts/ticket-sync.mjs`), I want a `mode`-scoped ticket read to carry proof that the server actually applied the requested filter, and the CLI to refuse to report a count when that proof is missing, so that a client which has correctly stopped filtering client-side (CAM-595) can never mistake "the server ignored my filter and handed back everything" for "the server honoured it and found nothing."
Why: CAM-595's own rollout reproduced the exact silent-degradation class it was built to eliminate. `ticket-sync.mjs` has no `APP_BASE_URL` set and defaults to the deployed staging app; while CAM-595 sat merged-but-not-promoted, that deployed app did not yet know `mode=gate`, `listTicketsQuerySchema` silently dropped the unrecognized key, the server returned the general 500-row list, and the CLI printed "0 waiting on you, 500 cleared" while five stories actually waited. This codebase deploys client tooling and server on different schedules by design, so a client running ahead of the server is the normal case here, not the edge one — and it is not specific to `mode`; the next param added the same way inherits the identical risk unless the fix generalizes.
Scope: `app/api/tickets/route.ts` (GET), `lib/delivery/validations.ts` (`listTicketsQuerySchema`), `lib/delivery/tickets.ts` (`listTickets`/`TicketListResult`), `scripts/ticket-sync.mjs` (`getGateTickets`/`getActiveOrEpicTickets`), `scripts/lib/ticket-sync-mode-proof.mjs` (new, pure decision logic). Does not touch the ticket state machine, `prisma/**`, or `app/status/**` UI — this is a read-path hardening, not a new feature.
Depends on: CAM-595.

## AC
<!-- Internal delivery-tooling surface (CLI + API), not end-user-facing copy -- "Then" is the exact dev-facing output/behavior, same framing CAM-595's story.md used for this same tool. -->
| # | Given | When | Then (dev-facing, plain language) | System effect | Neg/edge |
|---|---|---|---|---|---|
| AC-1 | The server actually applied `mode=gate` (or `mode=audit`) to build its query | The Admin runs `node scripts/ticket-sync.mjs gates` (or `audit`) | The command reports the real waiting/cleared (or audit) results exactly as CAM-595 left them — nothing changes on the happy path | `GET /api/tickets?mode=gate` response carries `appliedMode:"gate"`; the CLI checks it, finds a match, and proceeds normally | EC-1 |
| AC-2 | A `GET /api/tickets?mode=gate` response comes back HTTP 200 with no `appliedMode` field at all (the exact shape a pre-CAM-595 server produces) | The Admin runs `node scripts/ticket-sync.mjs gates` | The command states plainly that it **cannot tell** whether the returned list is really the gate set — never a fabricated "0 waiting on you" count — and exits with a distinct non-zero code | The CLI refuses to interpret `data.tickets` as the gate/audit set; no waiting/cleared count is printed | AC-2 is the recovered failure twin of CAM-602's own root cause |
| AC-3 | A request to `GET /api/tickets` carries a query key the schema does not declare (anything other than `state`/`epicId`/`archived`/`mode`, and not the `token` auth param) | The request is made | It is rejected — `400 invalid_query` — never silently served with the key dropped | The zod boundary (`.strict()`) rejects before the query ever reaches Prisma | — (this IS the failure-twin case) |
| AC-4 | `mode=gate` / `mode=audit` requested as before | The Admin runs `gates` / `audit` | The returned set is still exactly the AWAITING_GATE-or-changesRequested (or non-Done-or-EPIC) tickets — unchanged from CAM-595 | `buildTicketWhere`'s targeted `where` clauses are untouched by this story | EC-4 |

## Rules
- BR-1 `listTickets()` attaches `appliedMode: "gate" | "audit" | null` as an extra own property on the returned array (same `Object.assign`-onto-array pattern CAM-595 established for `.total`/`.truncated`) — `filter.mode` echoed back, or `null` for a genuine general (no-mode) read. (proves AC-1, AC-2)
- BR-2 `GET /api/tickets` projects `appliedMode` into the JSON response (`{tickets, total, truncated, appliedMode}`), additive and backward-compatible: a caller whose test double mocks `listTickets` to a plain array never sees the key (`JSON.stringify` drops `undefined`) — the same compat behavior CAM-595 already relies on for `.total`/`.truncated`. (proves AC-1, AC-2)
- BR-3 `scripts/ticket-sync.mjs`'s `getGateTickets()`/`getActiveOrEpicTickets()` check `data.appliedMode` against the mode they requested (via the pure `checkModeApplied()` in `scripts/lib/ticket-sync-mode-proof.mjs`) before trusting `data.tickets`. A mismatch (missing, `null`, or naming the other mode) prints an unmistakable `CANNOT TELL` message to stderr naming the mode requested and the value actually received, and exits a distinct code (13) — never a fabricated waiting/cleared count. (proves AC-2)
- BR-4 `listTicketsQuerySchema` becomes `.strict()` — any query key it does not declare fails validation (`400 invalid_query`) instead of being silently stripped. `token` (the STATUS_TOKEN auth transport, `lib/status-auth.ts`) is deliberately NOT part of this schema; the route deletes it from the reflected query object before parsing, so it is never treated as an "unrecognized" data key. This is the general, forward-looking half of the fix — the next query param added to this endpoint inherits "unrecognized = 400" with no per-field re-derivation. (proves AC-3)
- BR-5 The `mode=gate`/`mode=audit` where-clauses (`buildTicketWhere`) are unchanged by this story — this story adds a proof signal on top of CAM-595's read, it does not change what is fetched. (proves AC-4)

## Edge cases
- EC-1 IF the service layer is replaced by a test double that resolves a plain array (no `.appliedMode` own property) THEN the response degrades to the pre-CAM-602 shape (`appliedMode` absent, never a false `null`/mode value) (BR-2).
- EC-2 IF a general (no-`mode`) read is requested THEN no `appliedMode` check is performed client-side at all — `getAllTickets()` carries no mode expectation to verify; only the two mode-scoped getters are gated by BR-3.
- EC-3 IF the query carries `mode` together with `state`/`epicId` (the pre-existing CAM-595 conflict) THEN it is still rejected `400 invalid_query` — `.strict()` is additive to, not a replacement for, the existing mutual-exclusivity `.refine()` (BR-4).
- EC-4 IF `mode=gate`/`mode=audit` is requested and honoured THEN the returned ticket set is byte-for-byte the set CAM-595 already proved correct (BR-5) — this story adds proof, it does not change what is fetched.
- EC-5 IF a genuinely unrecognized `mode` VALUE is sent (e.g. `mode=bogus`) THEN it is rejected `400 invalid_query` by the existing `z.enum` check — unchanged, pre-existing CAM-595 behavior, not something this story needed to add.

## Data
No schema/DB change, no migration. `appliedMode` is a code-level, derived, non-persisted field — computed from the request's own already-validated `filter.mode`, never stored.

## Seams & refs
- Reuse: the exact `Object.assign`-onto-array pattern CAM-595 established for `.total`/`.truncated` (`TicketListResult`) is extended with one more property, not a parallel mechanism. `scripts/lib/ticket-sync-mode-proof.mjs` follows the same pure-module-for-testability pattern already used by `scripts/lib/ticket-sync-audit.mjs` / `scripts/lib/ticket-sync-mapping.mjs` (vitest can unit-test the decision without booting the whole CLI, which does top-level env/network work on import).
- Refs: `.claude/rules/api.md`'s CAM-595/CAM-602 rationalization row (already promoted, states the shape of the fix expected here) · `docs/specs/platform-hardening/taxonomy-ui-foundation/CAM-595-ticket-list-truncation/tech.md` (the story this one follows up on) · no ADR — a read-path defensive hardening within the existing ADR-010 self-hosted-ticket design, not a new architectural decision.

## Out of scope
- Retroactively fixing an already-deployed pre-CAM-595 server — not possible from this story's code; the client-side refusal (BR-3) is what protects the operator against that server TODAY, and the `.strict()` schema (BR-4) protects against the NEXT param's version of this same problem going forward. See tech.md for why these are two different defenses for two different moments in time.
- Extending the `appliedMode`-style explicit proof field to `state`/`epicId`/`archived` — those filters were never the ones that silently vanished; only a brand-new param name (`mode`) hitting a server built before it existed can vanish this way. → follow-up ticket if a similar gap is ever found on an existing filter.

## Self-verify
- AC-1..AC-4 → `__tests__/cam-602-mode-proof.test.ts` (pure decision unit) · `__tests__/cam-602-tickets-route.test.ts` (API projection + `.strict()` 400 + compat) · `__tests__/cam-602-tickets-service.test.ts` (service-layer `appliedMode` + unchanged targeted sets) · `__tests__/cam-602-cli-mode-proof.test.ts` (real spawn of `ticket-sync.mjs gates` against a simulated pre-CAM-595 server response — behavioral, not source-inspection-only).
- Story-specific: no migration (N/A) · a real behavioral check against a simulated older-server response is required, not just a source-inspection guard — see the CLI spawn test above and tech.md's "Real-DB behavioral proof".
- Gate = `/quality-gate` · Done = every AC verified on localhost (dev DB) before merge into `dev`.

## Changelog
- v1 (2026-07-28) — created.
