---
name: api-and-backend-standards
description: Standard for designing and building CampVibe's API/backend contracts. Use when adding or changing an endpoint, server action, or mutation. Use when writing zod validation, authz/ownership checks, or Prisma queries. Use when designing response shapes or writing a Prisma migration. Memory for the Backend role; pairs with .claude/rules/security.md, .claude/rules/ux.md, .claude/rules/architecture.md, .claude/rules/performance.md, types/api.ts.
---

# API & Backend Standards

## Overview

The server owns the truth (server-authoritative): client validation exists only for UX — never trust data from the client. Every endpoint is a verifiable contract — input crossing the boundary has a fixed shape, output matches `types/api.ts`, and every side-effect is tied to a verified session. Data is atomic (independently queryable, joined by ID), never several facts crammed into one string.

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
