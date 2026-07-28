---
linear: CAM-595
feature: platform-hardening
epic: taxonomy-ui-foundation
persona: admin
artifact: story
owner: backend-engineer
status: in-progress
version: v1
updated: 2026-07-28
---
# The gate board silently stops at ticket 561 and hides everything newer (CAM-595)

## Story
As the **Admin** (the owner reading `/status` and running `node scripts/ticket-sync.mjs`), I want `gates`/`audit`/`list` to see every ticket that matters regardless of how high the ticket number climbs, and to be told loudly whenever a read is bounded and something got left out, so that a gate raised on any ticket is never invisible and "no gates open" always means what it says.
Why: measured, not inferred — `GET /api/tickets?archived=false` returned exactly 500 rows (lowest 1, highest 561) while tickets already ran to CAM-595; `gates` printed "no gates open" at the same moment `show CAM-594` printed `state=Awaiting Gate` with `gateRaisedAt` stamped. Two `take: 500` reads ordered `number: asc` (`lib/delivery/tickets.ts`'s `listTickets`, `lib/delivery/status-adapter.ts`'s `fetchTicketsFromDbRaw`) always drop the rows with the HIGHEST number once the project passes 500 unarchived tickets — i.e. always the newest, always the work in flight.
Scope: `lib/delivery/tickets.ts` (`listTickets`), `lib/delivery/status-adapter.ts` (`fetchTicketsFromDbRaw`), `lib/delivery/validations.ts` (the `mode` query param), `app/api/tickets/route.ts` (GET), `scripts/ticket-sync.mjs` (`gates`/`audit`/`list` CLI commands). Does not touch the ticket state machine (`start`/`approve`/`complete`/... verbs are unchanged — this is a READ defect only), `prisma/schema.prisma`, or `app/status/**` UI components (see "Out of scope").
Depends on: none.

## AC
<!-- Internal delivery-tooling surface (CLI + API), not end-user-facing copy — "Then" is the exact dev-facing output/behavior, per the same framing CAM-577's story.md used for this same tool. -->
| # | Given | When | Then (dev-facing, plain language) | System effect | Neg/edge |
|---|---|---|---|---|---|
| AC-1 | A ticket is in state `AWAITING_GATE` (or has `changesRequested=true`), regardless of its ticket number | The Admin runs `node scripts/ticket-sync.mjs gates` | That ticket prints as `WAITING-ON-YOU` (or `CLEARED`) — never silently omitted | `GET /api/tickets?mode=gate` runs a server-side `state=AWAITING_GATE OR changesRequested=true` query with no dependency on the general list's cap or ordering | EC-1 |
| AC-2 | The count of unarchived tickets exceeds the general list's cap | The Admin runs `node scripts/ticket-sync.mjs list` (or `index`/`pull`, or the `/status` board loads) | The tickets shown are the NEWEST ones (highest numbers) up to the cap, and a `⚠ TRUNCATED (...)` line is printed to the CLI naming how many of how many were returned — never a short list that looks complete | `GET /api/tickets` (no `mode`) orders `number: desc` and returns `total`/`truncated` alongside `tickets`; the CLI prints the warning whenever `truncated===true` | AC-2 itself is the recovered failure twin of the original defect — EC-2 covers the still-open residual risk |
| AC-3 | A STORY/TASK ticket is not `DONE` (any number), OR an EPIC ticket exists at all (even one that finished long ago) | The Admin runs `node scripts/ticket-sync.mjs audit` | That ticket's template conformance is checked, and any EPIC it belongs to still resolves a feature/epic name for its `docs/specs/` path | `GET /api/tickets?mode=audit` runs a server-side `type=EPIC OR state!=DONE` query, independent of the general list's cap | EC-3 |
| AC-4 | A request to `GET /api/tickets` supplies `mode` together with `state` or `epicId` | The request is made | It is rejected — `400 invalid_query` (dev-facing; no internals leaked) | The zod boundary (`lib/delivery/validations.ts`) refines the combination as ambiguous before it ever reaches Prisma | — (this IS the failure-twin case) |

## Rules
- BR-1 The general (no-`mode`) bounded read orders `number: desc` and caps at `TICKET_LIST_TAKE_CAP` (1000, raised from 500 — measured 2026-07-28: 534 unarchived tickets, highest number 595). If truncated, it still drops rows, but now the OLDEST ones (lowest number), never the newest in-flight work. (proves AC-2)
- BR-2 Every read (general or `mode`-scoped) that hits its cap returns `truncated:true` and the real `total` (the true matching-row count, ignoring the cap) alongside `tickets` in the `/api/tickets` JSON response; the CLI prints an unmistakable warning naming both numbers whenever `truncated===true`. When the count is at/under the cap, `truncated:false` and no warning. (proves AC-2, EC-2)
- BR-3 `mode=gate` — server-side `where: { archivedAt, OR: [{state:"AWAITING_GATE"}, {changesRequested:true}] }`. Mutually exclusive with `state`/`epicId` (400 on conflict, BR-5). (proves AC-1, AC-4)
- BR-4 `mode=audit` — server-side `where: { archivedAt, OR: [{type:"EPIC"}, {NOT:{state:"DONE"}}] }` (every non-Done ticket of any type, plus every epic regardless of its own state). Mutually exclusive with `state`/`epicId` (400 on conflict, BR-5). (proves AC-3, AC-4)
- BR-5 `mode` combined with `state` or `epicId` in the same request is rejected `400 invalid_query` at the zod boundary — a fully different where-shape, not a refinement of the general filter. (proves AC-4)

## Edge cases
- EC-1 IF the gate-relevant set (`AWAITING_GATE` or `changesRequested=true`) itself somehow exceeded `TICKET_LIST_TAKE_CAP` THEN it still carries the same `truncated`/`total` signal — the "must never truncate silently" guarantee is about visibility, not an unconditional promise the set can never be capped (BR-2/BR-3).
- EC-2 IF the total unarchived ticket count is at or under the cap THEN `truncated` is `false` and no CLI warning is printed — the fix must not cry wolf on the common case (BR-1/BR-2).
- EC-3 IF an EPIC ticket is itself `DONE` THEN `mode=audit` still includes it (so `buildEpicIndex` in `ticket-sync.mjs` can resolve its title for a child story's `docs/specs/` path); a `DONE` STORY/TASK is correctly excluded (BR-4).
- EC-4 IF `mode` is supplied together with `state` or `epicId` THEN the request is rejected `400 invalid_query` before any query runs (BR-5).
- EC-5 IF the Prisma client in use has no `count()` (a test double, or a transient error) THEN the read still succeeds using a conservative length-based heuristic for `truncated`, and the failure (if a real error, not just an absent method) is logged structurally — never crashes the primary read (BR-2, defensive; see tech.md).

## Data
- No schema/DB change, no migration. `TICKET_LIST_TAKE_CAP` (a plain exported constant, `lib/delivery/validations.ts`) and the API's `mode`/`total`/`truncated` fields are code-level only.

## Seams & refs
- Reuse: `lib/delivery/tickets.ts`'s `listTickets` remains the ONE read path (`buildTicketWhere` added inside it, no parallel query function) · `scripts/ticket-sync.mjs`'s existing `apiFetch`/`getAllTickets` convention, extended with `getGateTickets`/`getActiveOrEpicTickets` (same shape, new targeted URL) · `lib/delivery/status-adapter.ts`'s cap now imports the SAME `TICKET_LIST_TAKE_CAP` constant `listTickets` uses, so "these two caps match" is enforced by the type system, not a comment's promise (the previous comment's promise is exactly what silently drifted — see tech.md).
- Refs: `.claude/rules/ops.md` "if a workflow bounds coverage, log what was dropped" · `.claude/rules/performance.md` bounded-read rule (kept, not removed) · no ADR (a read-path bug fix within the existing ADR-010 self-hosted-ticket design, not a new architectural decision).

## Out of scope
- True keyset pagination or an unbounded general read for `list`/`index`/`pull`/the `/status` board — the cap is deliberately raised, not removed (performance.md); when the general read next truncates (see tech.md for the measured threshold), the fix is pagination or an archival policy for old `DONE`/`CANCELED` tickets, not this story. → follow-up ticket if/when it next bites.
- An on-screen truncation banner on the `/status` web board itself — `fetchTicketsFromDbRaw` returns `StatusIssue[]` (`lib/linear.ts`), and adding a truncation flag there would require changing that type plus every `app/status/**` consumer, both outside this story's file surface. This story adds a structured server-side log line instead (see tech.md "Known gap"). → follow-up ticket if the owner wants an on-screen indicator.
- The ticket state machine / any of the 9 ADR-010 verbs — untouched; this is a read-only defect.

## Self-verify
- AC-1..AC-4 → integration (`__tests__/cam-595-tickets-truncation.test.ts` — service layer, self-contained fake Prisma client; `__tests__/cam-595-tickets-route.test.ts` — API route layer) + `listTicketsQuerySchema` unit tests (mode/state exclusivity).
- Story-specific: no migration (N/A) · truncation asserted by real ticket NUMBER (`Math.max`/`Math.min` over the returned set), never by non-emptiness · real-DB behavioral proof before/after (`ticket-sync.mjs gates`/`list`/`audit` against the real ticket DB via a throwaway local server on a port other than the owner's — see tech.md for the exact before/after numbers).
- Gate = `/quality-gate` · Done = every AC verified on localhost (dev DB) before merge into `dev`.

## Changelog
- v1 (2026-07-28) — created.
