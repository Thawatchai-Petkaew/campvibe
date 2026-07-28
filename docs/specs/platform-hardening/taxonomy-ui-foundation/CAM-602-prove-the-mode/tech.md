---
feature: platform-hardening
epic: taxonomy-ui-foundation
persona: admin
artifact: tech
owner: backend-engineer
status: in-progress
version: v1
updated: 2026-07-28
---
# Tech — A query param an older server does not understand is silently ignored (CAM-602)

## The shape of the bug, restated precisely

CAM-595 added `?mode=gate|audit` as a targeted server-side read. The zod boundary
(`listTicketsQuerySchema`) is a plain (non-strict) `z.object` — by design, any key it does not
declare is silently stripped by `safeParse`. That is correct, friendly behavior for a schema
guarding a public, browser-reachable endpoint. It is the wrong default here: `GET /api/tickets`
has exactly two real callers, `scripts/ticket-sync.mjs` and `scripts/parity-check.mjs`, both
internal tooling, never a browser (confirmed by grep — see "Reader/writer inventory" below). A
server that predates the `mode` param entirely (its route.ts never reads `url.searchParams.get
("mode")` at all — the OLD code, not this one) returns the general, unfiltered list with a
plain HTTP 200. The new client — having correctly stopped filtering client-side, because
trusting the server was the whole point of CAM-595 — has no way to tell "the server honoured
`mode=gate` and found nothing" from "the server never saw `mode` and handed back everything."
That ambiguity, not the truncation cap CAM-595 already fixed, is CAM-602's actual defect.

Two separate defenses are needed for two separate moments in time, and conflating them is the
single most important thing to get right in this fix:

1. **Right now, against an already-deployed server this code cannot change** (the historical
   incident, and any future recurrence of the same class): the CLIENT must refuse to trust an
   unproven response. Nothing server-side, however carefully designed, can retroactively
   protect against code that already shipped without this concept — the only lever left is
   the caller's own skepticism.
2. **Going forward, against the NEXT param added the same way `mode` was** (the systemic ask —
   "the next param inherits it, not need it re-derived"): the SERVER should say, loudly and
   generically, "I don't recognize part of this request" the moment it can, rather than
   quietly discarding it. This protects every future param this endpoint ever grows, for free,
   without anyone remembering to redo this specific fix.

Both are implemented below. Neither substitutes for the other.

## Decision — should an unrecognized query key be `400` instead of silently dropped?

**Yes, `.strict()` on `listTicketsQuerySchema` — deliberately, not by zod's default.**
`app/api/tickets/route.ts`'s GET handler now reflects the *entire* query string (not four
manually-named `.get()` calls) into the schema, after removing the one deliberate exception:
`token` (the `?token=` STATUS_TOKEN auth transport, `lib/status-auth.ts`) is stripped from the
reflected object before validation — it is an authorization concern already checked by
`isStatusRequestAuthorized`, not a data field the endpoint's *contract* owns, and folding it
into the same strict schema would make every legitimate token-bearing request 400.

The trade-off, named explicitly per the dispatch:

| | Lenient (today's default, drop unknown keys) | Strict (`.strict()`, reject unknown keys) |
|---|---|---|
| Friendly to | Browsers — an incidental tracking/cache-busting query param never breaks the request | Tooling — a stale client, a typo'd param, or a client one version ahead of the server gets an explicit, actionable `400` instead of an ambiguous `200` |
| Hostile to | Tooling — exactly this incident: a new, unrecognized key is silently absorbed and the caller cannot tell | Browsers — a public endpoint would 400 on any incidental extra param a browser or proxy tacks on |
| Right default when | The endpoint is genuinely public / browser-reachable | The endpoint's *only* callers are internal, version-controlled-alongside-the-server tooling |

`GET /api/tickets` is 100% in the second bucket — grep-confirmed (see inventory below), zero
browser consumers. There is no "friendly to browsers" upside to weigh here at all, so the
choice is not close: strict wins. This is the **general** half of the fix (AC-3/BR-4) — it
protects the *next* param, not just `mode`, because it is not a `mode`-specific check; it is a
property of the schema itself, inherited by every future field added to it.

**What `.strict()` deliberately does NOT do:** it cannot retroactively teach an
already-deployed pre-CAM-595 server to reject `mode` — that server's route.ts literally never
reads the `mode` key off the URL into ANY object, strict schema or not; the omission is at the
call site, not the validator, and no code shipped today can edit code already running
elsewhere. That is exactly why the client-side refusal (BR-3, below) is the primary defense
for the incident as described, and `.strict()` is the primary defense for its *next*
occurrence, once this fix itself is the one running.

An unrecognized **value** for `mode` (e.g. `mode=bogus`) was already rejected before this story
(`z.enum(["gate","audit"])` fails validation) — nothing to add there (EC-5); this decision was
only ever about unrecognized *keys*.

## The proof mechanism — `appliedMode`

`lib/delivery/tickets.ts`'s `listTickets()` already attaches `.total`/`.truncated` as extra own
properties on the returned array (`TicketListResult`, CAM-595's `Object.assign` pattern). This
story adds one more, following the identical mechanism:

```ts
export type TicketListResult = Ticket[] & {
  readonly total: number;
  readonly truncated: boolean;
  readonly appliedMode: "gate" | "audit" | null;
};
```

`appliedMode` is simply `filter.mode ?? null` — the service layer echoing back the mode it
actually used to build `buildTicketWhere`'s query, `null` for a genuine general (no-mode) read.
`app/api/tickets/route.ts` projects it into the response: `{tickets, total, truncated,
appliedMode}`. The same compat mechanism CAM-595 relies on for `.total`/`.truncated` carries
forward unedited: `JSON.stringify` drops an `undefined`-valued key, so a caller whose test
double mocks `listTickets` to resolve a *plain array* (no `.appliedMode` own property, per
`__tests__/delivery-tickets-api.test.ts`'s compat contract) still gets exactly `{tickets}` with
no `appliedMode` key at all — never a false `null`.

**Why this proves what it needs to and nothing more:** `total`/`truncated` (CAM-595) prove
"how much of the matching set came back" — they are computed identically whether or not `mode`
was honoured, so they cannot distinguish "the gate set, complete" from "the general list,
complete" (both would show `truncated:false` with a small enough total). `appliedMode` proves
the ONE thing CAM-595's own signal cannot: which `where`-shape actually ran. A response that
has it and it matches → trustworthy. Missing, `null`, or naming the other mode → the client
must refuse to interpret, per BR-3.

## The client-side refusal — `scripts/lib/ticket-sync-mode-proof.mjs`

A pure, dependency-free module (same extraction pattern as `ticket-sync-audit.mjs` /
`ticket-sync-mapping.mjs`, so vitest can unit-test the decision without booting the whole CLI,
which does top-level env/network work on import):

```js
export function checkModeApplied(data, mode) {
  const appliedMode = data && typeof data === "object" ? data.appliedMode : undefined;
  return { ok: appliedMode === mode, appliedMode };
}
```

`scripts/ticket-sync.mjs`'s `getGateTickets()`/`getActiveOrEpicTickets()` call this immediately
after the existing `status !== 200` check and before `warnIfTruncated` (there is no point
reporting a truncation signal for a set that cannot even be trusted to be the right set at
all). On a mismatch, `assertModeApplied()` prints an unmistakable `✗ CANNOT TELL (<label>): ...`
line naming the mode requested and the `appliedMode` value actually received, and exits `13` —
a new, distinct code (existing: `1` generic fail, `10` gates cleared, `11` audit drift, `12`
STATUS_TOKEN missing) so a wrapper script can tell "the CLI refused to guess" apart from every
other failure mode. `getAllTickets()` (the general, no-mode read) is untouched — there is no
mode expectation for it to verify (EC-2).

## Reader/writer inventory — mandatory sweep (architecture.md §15b)

**Search method:** `grep -n "listTickets(" app lib scripts` (every caller of the changed
service function) + `grep -rln "'/api/tickets'\|\"/api/tickets\"\|/api/tickets\`\|/api/tickets?"
app components lib scripts` (every consumer of the changed response shape) + reading
`lib/status-auth.ts` (the `token` query-param mechanism this story must not break).

| Reader/writer | Touches the changed surface how | Action this story | Why |
|---|---|---|---|
| `lib/delivery/tickets.ts` `listTickets`/`TicketListResult` | the read itself | **NOW** | the fix (BR-1) |
| `app/api/tickets/route.ts` GET | calls `listTickets`, builds the query object, returns the JSON body | **NOW** — full-query reflection (minus `token`) into a `.strict()` schema; projects `appliedMode` | the fix (BR-2, BR-4) |
| `lib/delivery/validations.ts` `listTicketsQuerySchema` | the schema itself | **NOW** — `.strict()` added | the fix (BR-4) |
| `scripts/ticket-sync.mjs` `getGateTickets`/`getActiveOrEpicTickets` | the only two callers that request `mode` | **NOW** — gated on `checkModeApplied` before trusting `data.tickets` | the fix (BR-3) |
| `scripts/ticket-sync.mjs` `getAllTickets` | the general (no-mode) read | **NO-CHANGE** | no mode expectation to verify (EC-2) |
| `scripts/lib/ticket-sync-mode-proof.mjs` | new pure module | **NOW** (new file) | testable decision logic, same pattern as sibling `scripts/lib/*` modules |
| `scripts/parity-check.mjs` | its own separate `GET /api/tickets?archived=false` (no `mode`, no unrecognized keys) | **VERIFIED, NO-CHANGE NEEDED** | unaffected by `.strict()` (only sends `archived`) and has no mode expectation |
| `lib/status-auth.ts` `isStatusRequestAuthorized` | reads `?token=` directly off the URL, independent of the zod schema | **VERIFIED, NO-CHANGE** | this story's route.ts explicitly deletes `token` from the object handed to the now-strict schema, so the auth mechanism is unaffected — confirmed by the existing `__tests__/delivery-tickets-api.test.ts` and `__tests__/cam-595-tickets-route.test.ts` fixtures, which always place `token` in the query string and continue to pass unedited |
| `app/status/**`, `lib/delivery/status-adapter.ts` | render `StatusIssue[]`; `fetchTicketsFromDbRaw` is a SEPARATE `db.ticket.findMany`, never calls `listTickets` or `GET /api/tickets` | **VERIFIED, NO-CHANGE** | out of this defect's blast radius entirely (confirmed CAM-595's own inventory; unchanged here) |
| `prisma/**`, the 9 ADR-010 state-machine verbs | unrelated to reads | **VERIFIED, NO-CHANGE** | read-only defect; no mutation/verb logic touched |

**Seam invariant:** every existing `GET /api/tickets` caller that sends only `state`/`epicId`/
`archived`/`mode`/`token` is unaffected by `.strict()`; every caller relying on `.total`/
`.truncated` continues to see them; every caller NOT computing `appliedMode` (test doubles)
degrades to the pre-CAM-602 shape rather than a false value — confirmed by
`__tests__/cam-602-tickets-route.test.ts`'s compat case, mirroring the existing CAM-595 compat
test unedited.

## API contract

`GET /api/tickets?state=&epicId=&archived=&mode=` (query-key set unchanged from CAM-595)

- Query validation: **`.strict()`** — any key other than `state`/`epicId`/`archived`/`mode`
  (with `token` excluded before parsing, see above) → `400 invalid_query`. `mode`'s existing
  `.refine()` mutual-exclusivity with `state`/`epicId` is unchanged and still fires.
- Response (additive, backward-compatible): `{ tickets: Ticket[], total?: number, truncated?:
  boolean, appliedMode?: "gate" | "audit" | null }`. `appliedMode` is present whenever the
  service layer computes it (always, in production, exactly like `total`/`truncated`); a caller
  whose own test double mocks `listTickets` to a plain array simply never sees it.
- Error codes unchanged: `400` invalid query (now also: any unrecognized key) · `401`
  unauthorized · `429` rate-limited · `500` internal (generic, no stack).
- No authz change: same `STATUS_TOKEN` gate as every other `/api/tickets*` route
  (`isStatusRequestAuthorized`), unedited; `token` is explicitly carved out of the now-strict
  data schema rather than folded into it.

## ADRs

No new ADR — a read-path defensive hardening within the existing self-hosted-ticket design
(ADR-010), not a new architectural decision. `.claude/rules/performance.md`'s bounded-read rule
and CAM-595's truncation-signal design are both upheld, not superseded.

## Real-DB / real-behavior proof (before / after)

Simulated, not against the live shared ticket DB (this story changes no query logic CAM-595
didn't already prove correct against the real DB — see that story's tech.md for the DB-level
before/after). The exact class of server this story defends against — one that predates `mode`
entirely — no longer exists as a deployable target (the real staging app has had CAM-595's
code since 2026-07-28), so the honest way to prove BR-3 behaviorally is a throwaway local HTTP
server standing in for "a server shaped like the old one," per the dispatch's explicit
instruction ("point the CLI at a server that predates the parameter, or simulate one").

`__tests__/cam-602-cli-mode-proof.test.ts` does exactly this: spawns the real
`node scripts/ticket-sync.mjs gates` process (not an import — a real child process, real
argv/exit-code/stdout/stderr) against a local `node:http` server that:

```
BEFORE (server shaped like the pre-CAM-595 app: 200 OK, { tickets: [...] }, no appliedMode key)
$ node scripts/ticket-sync.mjs gates      # (APP_BASE_URL pointed at the fake server)
✗ CANNOT TELL (gates): the server did not prove it applied mode=gate (appliedMode=null) ...
exit code: 13
(stdout never prints "waiting on you" / "cleared")

AFTER (server shaped like this story's code: 200 OK, appliedMode:"gate" attached)
$ node scripts/ticket-sync.mjs gates
⏳ CAM-1     WAITING-ON-YOU   ...
1 waiting on you · 0 cleared
exit code: 0
```

This is a behavioral proof (qa.md "prefer a behavioral/measurable assertion over a source
grep"), not a source-inspection guard — it would fail if the client-side check were removed or
miswired, exactly the CAM-201 lesson about guards that only assert the fix's source is present.

## Links
`app/api/tickets/route.ts` · `lib/delivery/validations.ts` · `lib/delivery/tickets.ts` ·
`scripts/ticket-sync.mjs` · `scripts/lib/ticket-sync-mode-proof.mjs` · `lib/status-auth.ts` ·
`.claude/rules/api.md` (CAM-595/CAM-602 rationalization row) ·
`docs/specs/platform-hardening/taxonomy-ui-foundation/CAM-595-ticket-list-truncation/tech.md` ·
`story.md`

## Changelog
- v1 (2026-07-28) — created.
