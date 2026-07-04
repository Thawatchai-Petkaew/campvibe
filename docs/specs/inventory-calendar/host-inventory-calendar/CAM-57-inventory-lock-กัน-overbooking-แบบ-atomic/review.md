---
artifact: review
ticket: CAM-57
title: Inventory lock กัน overbooking แบบ atomic — Security Review
status: In Review
version: 1
date: 2026-06-24
reviewer: Security (The Camper)
verdict: PASS
---

# Security Review — CAM-57 Inventory lock กัน overbooking แบบ atomic

**Verdict: PASS** — No Critical findings. Zero High/Critical npm vulnerabilities. Safe to merge into `staging`.

---

## Diff scope

| File | Change |
|---|---|
| `app/api/bookings/route.ts` | POST refactored into `withBookingTransaction` + Serializable isolation + P2034 bounded retry |
| `lib/campsite-availability.ts` | New `checkDateAvailabilityInTx` (transactional variant) |
| `__tests__/cam-57-atomic-lock.test.ts` | New — unit/integration tests for retry logic, capacity math, 409 string contracts |
| `docs/adr/ADR-006-*` | New ADR — informational, not security surface |

Excluded from this review (owner WIP, not this story): `docs/mock-data-*`, `docs/research/`, `prisma/data/mock-*.json`.

---

## 6-Area Audit

### Area 1 — Input (OWASP A03 Injection)

**Finding: PASS**

- `bookingSchema` (zod) validates every input field at the boundary before any logic. `campSiteId` and `spotId` are UUID-typed; `guests` is `number.min(1)`; dates are validated against `Invalid Date`.
- No `$queryRaw` / `$executeRaw` / string-concatenated SQL introduced anywhere in the diff. All DB access is parameterized Prisma calls inside the `tx` client.
- No mass-assignment: `tx.booking.create({ data: { userId, campSiteId, ... } })` — only explicitly named, whitelisted fields are written. `req.body` is never spread directly into Prisma.
- `blockedDateFilter` uses `Prisma.BlockedDateWhereInput` typed filter object — no injection surface.

**Note (documentation smell, Suggestion severity):** `lib/validations/booking.ts` line 16 has the comment `"For testing, we might pass userId manually"` on the `userId` field. The field accepts a client-supplied value, but the route at line 213 spreads `{ ...body, userId }` with the session `userId` as the last key, so it overwrites any body-supplied value. The schema comment is misleading and should be removed to avoid future confusion. **This is not an injection vulnerability** because the override is in place.

### Area 2 — Auth / Authz (OWASP A01 Access Control, A07 Auth Failures)

**Finding: PASS**

- `requireAuth()` runs at the top of POST before any body parsing; unauthenticated calls are rejected before any logic.
- `const userId = session?.user?.id` is extracted from the NextAuth session server-side (line 204). If undefined, the handler returns 401 immediately (line 205-207) — no DB is touched.
- The `userId` passed to `withBookingTransaction` is exclusively from the session. The new booking is created with `tx.booking.create({ data: { userId, ... } })` — the session-derived value, not a client-supplied one.
- The `where` clauses on all reads inside `tx` are scoped to `campSiteId: data.campSiteId` and `spotId: data.spotId` (both validated UUIDs from zod). No unscoped cross-user reads.
- Default-deny: unauthenticated, missing session, or missing userId all halt before any Prisma operation.
- No role escalation introduced. The booking-create path is consumer-only (creates for the authenticated user themselves).

### Area 3 — Data / Information Disclosure (OWASP A02 Crypto, A09 Logging)

**Finding: PASS with one Suggestion**

`apiError` in `lib/api-utils.ts` (unchanged, but called by this diff) correctly gates detail exposure:

```
if (details && status < 500) { response.details = details; }
```

Consequence per call site in the diff:

| Call site | Status | Details sent to client? |
|---|---|---|
| `apiError('User ID not found in session', 401)` | 401 | None (no details arg) |
| `apiError('Validation Error', 400, validation.error.format())` | 400 | Zod field errors — acceptable |
| `apiError(result.message, 409, result.detail)` | 409 | Conflict detail strings — human-readable, no internals |
| `apiError('Camp site not found', 404)` | 404 | None |
| `apiError('Failed to create booking', 500)` | 500 | None (details suppressed by apiError) |
| `apiError('Failed to create booking', 500, error)` | 500 | `error` object passed but suppressed — apiError does not expose details on 5xx |

The 409 detail strings are human-readable and free of Postgres error codes, P2034 codes, internal schema names, or stack traces:
- `"Selected dates overlap with an existing booking."` — safe
- `"Selected dates are blocked by the host."` — safe
- `"Selected dates are unavailable (conflict). Please try again."` (retry-exhausted) — safe
- `"Date YYYY-MM-DD: Exceeds maximum guests per day (N)"` (capacity) — leaks the date and the configured cap value. The date is derived from the booking input the user submitted, and the cap is a business rule (not a secret). Acceptable.

**Suggestion:** The two `apiError('Failed to create booking', 500, error)` calls at lines 240 and 272 pass the raw `error` object as the third argument. While `apiError` correctly suppresses it from the HTTP response, the full error is still logged to `console.error` server-side (line 12 of api-utils.ts). This is intentional per the design, but if the error carries a connection string or Prisma internals in its message, those will appear in server logs. This is an acceptable trade-off for debuggability and matches the existing pattern throughout the codebase; no PII is in this path. Flag as **Suggestion** — consider structured error logging (event code + sanitized message) per `.claude/rules/observability.md` as a follow-up.

No secrets, PII, or Prisma internals reach the HTTP response. No new `NEXT_PUBLIC_*` variables introduced. No new fixtures with sensitive data.

### Area 4 — Infra / Config / DoS Integrity (OWASP A05 Misconfig — STRIDE: Tampering, DoS)

**Finding: PASS**

**Bounded retry — no infinite loop risk:**

The `withBookingTransaction` recursive retry has `attempt` starting at 1, cap condition `attempt <= 3`:
- Attempt 1 (P2034): retries with attempt=2
- Attempt 2 (P2034): retries with attempt=3
- Attempt 3 (P2034): retries with attempt=4
- Attempt 4 (P2034): `4 <= 3` is false → falls to the second `isSerializationError` check → returns `type: 'conflict'` (409)

This is effectively 4 total DB transaction attempts (the comment says "3 total" — off by one in the description, not in the logic). The backoff is additive: 50ms + 100ms + 150ms = 300ms total sleep, plus 4 Prisma `$transaction` calls. Well within the 10s timeout.

**Non-P2034 errors do not retry:** the first `if` guard checks both `isSerializationError(err) && attempt <= 3`. A `Error('ECONNRESET')` or any other non-Prisma error will not satisfy `isSerializationError` and is immediately re-thrown to the outer `catch`, returning 500 with no retry.

**No partial write on failure:** all availability checks and `booking.create` are inside a single `prisma.$transaction` with `isolationLevel: Serializable`. Postgres rolls back the entire transaction on any failure, including P2034.

**BlockedDate query:** scoped to `campSiteId: data.campSiteId` (validated UUID). The `OR` filter correctly covers `{ spotId: null }` (whole-camp blocks) and `{ spotId: data.spotId }` (spot-level blocks). `deletedAt: null` guards soft-deleted records. No cross-campsite data exposure.

**Seed/bulk-seed/scrape-seed routes:** all three import `assertSeedAllowed` from `@/lib/seed-guard` — guard is in place and unchanged by this diff.

**Security headers and cookie settings:** unchanged by this diff (set in `next.config` / middleware).

### Area 5 — 3rd-Party / Dependencies (OWASP A06 Vulnerable Deps, A10 SSRF)

**Finding: PASS**

`npm audit --omit=dev` result (run 2026-06-24):

```
2 moderate severity vulnerabilities
0 high
0 critical
```

The 2 moderate findings are a `postcss < 8.5.10` XSS in CSS stringify output (GHSA-qx2v-qp2m-jg93), transitively pulled in by `next`. The fix requires a breaking Next.js downgrade to 9.3.3, which is not viable. These are dev-build artifacts (CSS processing) with no runtime client-facing surface in a Next.js prod build. **0 high/critical — gate passes.**

No new dependencies introduced by this diff. No client-supplied URL fetch (no SSRF surface in this story).

### Area 6 — AI / LLM

**Finding: N/A**

This diff does not touch any LLM, prompt, agent workflow, or AI model integration. No LLM Top 10 surface.

---

## STRIDE per diff

| Threat | Assessment |
|---|---|
| **Spoofing** | Identity from NextAuth session only; no client-controlled identity in the new transaction path. PASS. |
| **Tampering** | Serializable isolation prevents read-phantom writes. `where` clauses are scoped. All fields are whitelisted in `booking.create`. PASS. |
| **Repudiation** | `console.error` logs the 500 error server-side. Booking creation is a DB record. Follow-up: structured audit event for booking creation would strengthen this (existing gap, not introduced by this diff). Noted as Suggestion. |
| **Information Disclosure** | 5xx responses suppressed by `apiError`. 409 detail strings are human-readable, no internals. P2034 code never reaches the client. PASS. |
| **DoS** | Retry capped at 4 DB attempts max (300ms sleep total). Non-P2034 does not retry. No unbounded loop. PASS. |
| **Elevation of Privilege** | userId sourced from session; no client role or userId injection into the booking record. PASS. |

---

## Findings Summary

| Severity | Area | Location | Risk | Fix |
|---|---|---|---|---|
| Suggestion | Input (docs smell) | `lib/validations/booking.ts:16` | Comment implies userId can be client-supplied; misleads future maintainers even though the route override is correct | Remove comment; document that userId is always injected server-side in the route |
| Suggestion | Data / Observability | `app/api/bookings/route.ts:240,272` | Raw `error` object (may include Prisma connection string in `.message`) sent to `console.error`; not exposed in HTTP response | Replace with structured log: event code + sanitized error message per `.claude/rules/observability.md`; follow-up story |
| Info | Retry cap | `app/api/bookings/route.ts:181,182` | Comment says "3 total attempts" but the logic allows 4 (attempt 1 → 2 → 3 → 4 then terminates); no security impact, terminates correctly | Update comment to "up to 4 total DB attempts" for accuracy |

**Critical findings: 0**
**High findings: 0**
**npm audit high/critical: 0** (2 moderate — postcss, unfixable without breaking Next.js version)

---

## npm audit

```
Run: npm audit --omit=dev (2026-06-24)
Result: 2 moderate, 0 high, 0 critical
Gate: PASS (0 high/critical required)
```

---

## Verdict

**PASS — safe to merge into `staging`.**

The CAM-57 diff correctly:
- Sources `userId` exclusively from the NextAuth server session; session userId overwrites any body value in the zod parse spread.
- Uses zero raw SQL; all DB access is parameterized Prisma inside a Serializable `$transaction`.
- Returns no Postgres error codes, P2034 detail, stack traces, or internal schema names to the client on any error path.
- Caps the retry loop (terminates at 4 DB attempts maximum); non-P2034 errors do not trigger retry.
- Guarantees no partial write via transaction rollback.
- Scopes all queries to `campSiteId` (validated UUID); BlockedDate filter includes `deletedAt: null` soft-delete guard and correct `OR` arms for whole-camp and spot-level blocks.
- Seed/scrape routes remain guarded by `assertSeedAllowed`.

Two Suggestions (documentation + observability) are non-blocking and should be addressed as follow-up items.

## Next

- **backend**: address `lib/validations/booking.ts:16` comment removal (Suggestion) and structured error logging on 500 paths (Suggestion) — non-blocking, follow-up story.
- **devops / qa**: proceed with G3 merge → `staging`; verify AC on the real Staging URL (including the concurrent booking test documented in `__tests__/cam-57-atomic-lock.test.ts` staging section) before G4 sign-off.
