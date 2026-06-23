---
name: api-and-backend-standards
description: Standard for designing and building CampVibe's API/backend contracts. Use when adding or changing an endpoint, server action, or mutation. Use when writing zod validation, authz/ownership checks, or Prisma queries. Use when designing response shapes or writing a Prisma migration. Memory for the Backend role; pairs with .claude/rules/security.md, .claude/rules/ux.md, .claude/rules/architecture.md, .claude/rules/performance.md, types/api.ts.
paths:
  - app/api/**
  - lib/**
---

# API & Backend Standards

## Overview

The server owns the truth (server-authoritative): client validation exists only for UX — never trust data from the client. Every endpoint is a verifiable contract — input crossing the boundary has a fixed shape, output matches `types/api.ts`, and every side-effect is tied to a verified session. Data is atomic (independently queryable, joined by ID), never several facts crammed into one string.

## Quick Reference

Per-endpoint checklist — run top to bottom for every route handler / server action / mutation:

| # | Step | Do | On failure |
|---|---|---|---|
| 1 | **validate** | zod-parse body/query/params via `lib/validations/*` before any logic | `400` + field error |
| 2 | **authz** | read user from the NextAuth session (server); ownership/role check before mutate | `401` not logged in · `403` not owner |
| 3 | **query** | Prisma only, parameterized — `where:{id, ownerId: session.user.id}`; `$transaction` for all-or-nothing | `404` not found · `409` conflict |
| 4 | **shape** | return the `types/api.ts` success/error shape; atomic fields (never merged strings) | — |
| 5 | **errors** | cover the full set: `400 · 401 · 403 · 404 · 409 · 500`; generic message on 500, log detail separately | `500` internal (no stack/secret) |

## When to Use

- Adding or changing any endpoint, server action, route handler, or mutation
- Writing zod schemas at an input boundary (`lib/validations/*`)
- Adding authz / ownership checks tied to a NextAuth session
- Writing or reviewing a Prisma query or a Prisma migration (up/down)
- Designing a success/error response shape or an error-code set
- Reference the real artifacts before writing: `schema/api-schema.json` + `types/api.ts` + `lib/api-client.ts` + `lib/validations/*` (zod)

**NOT for:**

- AuthN/secret handling, injection, and threat-model details — read `.claude/rules/security.md` alongside this file, always
- Field-validation catalog + PDPA masking (shared client/server zod schema) — see `.claude/rules/ux.md`
- Latency budgets and profiling — see `.claude/rules/performance.md`
- Deprecation plans and architectural decisions — see `.claude/rules/architecture.md` (ADR)

## Prerequisites

Read before working: `.claude/rules/security.md` (always, alongside this file). Reference the real artifacts before writing: `schema/api-schema.json` · `types/api.ts` · `lib/api-client.ts` · `lib/validations/*` (zod) · `prisma/schema.prisma`. Know the endpoint's session/ownership model and the existing error-code set before defining the contract.

## Standards

### 1. Validate at the boundary with zod (every endpoint)

- Schemas live in `lib/validations/*`; parse input (body/query/params) before touching logic.
- Parse failure → `400` + field error (do not leak stack/internal).

### 2. Authz on every mutation

- Read the user from the session (NextAuth) on the server; never accept `userId`/`role` from the client payload.
- **Ownership check** before update/delete (cannot edit someone else's record → `403`/`404`).
- Guard on the server always — never rely on the UI hiding a button.

### 3. DB through Prisma only (parameterized)

- No raw string concatenation in a query.
- If raw is unavoidable, use `$queryRaw` as a tagged template (parameterized) only.

### 4. Response shape per `types/api.ts`

- Atomic fields (`firstName`/`lastName`, `amount`+`currency`, `provinceId`) — never merged into one string.
- Consistent success/error shape across the whole API.

### 5. Never leak secrets/internal

- Secrets never appear in a response/log/fixture.
- Error messages returned to the client are human-readable — no SQL/path/env/stack.
- Log internal detail separately from the client error.

### 6. Reversible migrations

- Every migration has a paired up/down.
- **Test migrate on the Staging DB before prod** always (run `prisma migrate deploy` per env; `DATABASE_URL` separated staging/prod).
- No data-destroying drop/rename without a backfill.

### 7. Idempotent & atomic write

- Operations that must be all-or-nothing use `prisma.$transaction`; prevent partial writes.

### 8. Audit important events

- Mutations affecting permissions/money/user data record an audit (no secret leakage).
- Event-code lives in the spec `tech`, not in the AC.

### 9. Error-code set (complete)

- Every endpoint covers: 400 (validation failed) · 401 (not logged in) · 403 (no permission / not owner) · 404 (not found) · 409 (duplicate / state conflict) · 500 (internal, generic message).
- Error shape consistent across the whole API.

### 10. Contract-first

- Define input/output (zod + `types/api.ts`) before writing the implementation; the contract is the spec.

### 11. Discriminated union + branded id

- **Discriminated union** for multi-outcome results (e.g. `{status:'ok',data} | {status:'error',code}`) so the type can be narrowed.
- **Branded type** for ids (`CampId`/`UserId`) to prevent passing the wrong id kind (caught at compile time).

### 12. Backward-compatible by addition

- Change a contract by adding an optional field — never remove/change the type of an existing one.
- Retiring a field needs a deprecation plan (link `.claude/rules/architecture.md` ADR).

### 13. Latency target

- Hot endpoints p95 < 200ms (link `.claude/rules/performance.md`).

## Examples

✅ **Validated + authz'd mutation** — parse at the boundary, read the session, ownership-scoped query, `types/api.ts` shape:

```ts
// app/api/camps/[id]/route.ts (PATCH)
const session = await auth();
if (!session?.user) return json({ status: 'error', code: 401 }, 401);

const parsed = updateCampSchema.safeParse(await req.json()); // lib/validations/camp.ts
if (!parsed.success) return json({ status: 'error', code: 400 }, 400);

const camp = await prisma.camp.update({
  where: { id: params.id, ownerId: session.user.id }, // ownership in the where
  data: parsed.data,
}); // P2025 → map to 404
return json({ status: 'ok', data: camp } satisfies CampResponse); // types/api.ts
```

❌ **Unguarded** — trusts the client, no validation, no ownership, raw concat, leaks the error:

```ts
// trusts body.userId, no zod, edits anyone's record, string-built query, stack to client
const { userId, id, name } = await req.json();
await prisma.$queryRawUnsafe(`UPDATE "Camp" SET name='${name}' WHERE id='${id}'`);
return json({ ok: true, fullName: `นายสมชาย ${name}` }); // merged string, off-contract
```

## Reference Files

- `.claude/rules/architecture.md` — data model, contracts, ADRs, deprecation plans
- `.claude/rules/security.md` — authN/secrets, injection, threat model (read alongside, always)
- `.claude/rules/qa.md` — contract/endpoint tests + coverage
- `.claude/rules/observability.md` — audit events, structured logging, latency signals
- `prisma/schema.prisma` — the data model + migration source
- `types/api.ts` — the canonical success/error response shape

## Next Steps

Backend implements the endpoint to this standard → qa writes contract + happy/error-path tests → security reviews the diff (authz/secrets/injection) → run the quality gate (lint/typecheck/test ≥80% new code/build/`npm audit`) before the PR into `staging`.

## Common Rationalizations

| Rationalization | Reality |
|---|---|
| "Trust `role`/`userId` from the request body." | Read from the server-side session only. |
| "Client validation is enough." | Re-parse with zod at the server boundary. |
| "`update where:{id}` is fine without an owner check." | Use `where:{id, ownerId: session.user.id}`. |
| "Return the Prisma error/stack straight to the client." | Map it to a safe error shape. |
| "Migration without a down / never tried rollback is OK." | Test up→down→up on Staging first. |
| "Cram `fullName: \"นายสมชาย\"`, `price: \"฿1,250\"`." | Atomic fields per `types/api.ts`. |

## Verify (exit criteria)

- [ ] zod validates every input boundary + safe error shape
- [ ] authz + ownership check on every mutation (tied to session)
- [ ] all queries through Prisma parameterized (no raw concat)
- [ ] response matches `types/api.ts` (atomic) + contract test passes
- [ ] **run the real endpoint** — check happy + error path; no secret leaked in response/log
- [ ] migration up/down tested on Staging successfully (reversible)
- [ ] passes the quality gate (lint/typecheck/test ≥80% new code/build/`npm audit`) before PR into `staging`
