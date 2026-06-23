---
artifact: review
ticket: CAM-61
story: หน้ารายละเอียดการจอง /bookings/[id]
reviewer: Security (The Camper)
date: 2026-06-23
version: v1
status: In Review
verdict: PASS
---

# Security Review — CAM-61 หน้ารายละเอียดการจอง /bookings/[id]

**Verdict: PASS** — 0 Critical, 0 High. 1 Important finding (userId in GET API response). No merge block.

---

## 6-Area Audit

### Area 1 — Input Validation [OWASP A03 Injection]

**Result: PASS**

- `GET /api/bookings/[id]`: `id` comes from `context.params` (Next.js route param, not body). No zod validation of the `id` param itself, but this is a read-only lookup passed directly into a Prisma `findFirst` with parameterized `where: { id, userId }` — Prisma handles parameterization; no string concat, no raw SQL.
- `PATCH /api/bookings/[id]` (pre-existing, unchanged): `status` is parsed by `BookingStatusEnum.safeParse(body.status)` — zod-validated before use. Only the `status` field is written (`data: { status }`), no mass-assignment of the request body.
- No `$queryRawUnsafe` or string-concatenated SQL in the diff.
- No new input boundary was added to the page layer (SSR page reads from `getOwnedBooking` server-side, not from query params).

**OWASP A03 Injection: Clear.**

---

### Area 2 — Authentication and Authorization [OWASP A01 · A07]

**Result: PASS**

**GET /api/bookings/[id] (NEW):**

- `requireAuth()` is called first; returns `{ error: 401 }` if no session — before any data access.
- Owner-scope: `getOwnedBooking(id, session!.user!.id)` → Prisma `findFirst({ where: { id, userId } })`. The `userId` comes from the server-side NextAuth session, never from the URL param or request body.
- Wrong-owner and missing booking both return the same `404 "Booking not found"` — no 403/404 split that would reveal existence (AC#7). Confirmed: the GET handler block contains no `403` code path.
- `session.user.id` is read from the `requireAuth()` return value, which reads from the NextAuth session on the server.

**SSR page (/bookings/[id]/page.tsx):**

- `await auth()` called first; `!session?.user?.id` → `redirect("/login")` before any data fetch.
- `getOwnedBooking(id, session.user.id)` — `session.user.id` from the NextAuth session. The `id` param is from `params` (URL segment), not from user-supplied body.
- `null` → `notFound()` — both wrong-owner and missing booking surface as the same not-found page (no existence leak).

**PATCH /api/bookings/[id] (pre-existing, unchanged):**

- `requireAuth()` first.
- Permission model: ownership check `booking.userId === session.user.id` (camper) or `booking.campSite.operatorId === session.user.id` (operator) or team-member RBAC lookup. All identity reads from the server session.
- The new code does not weaken or bypass the PATCH authz. The cancel button in `BookingDetailClient` is a UX gate only — the PATCH handler re-authorizes independently on every request.

**Default-deny: confirmed.** No identity or role taken from the request body or URL params.

**OWASP A01 Access Control + A07 Auth Failures: Clear.**

---

### Area 3 — Data / Information Disclosure [OWASP A02 · A09]

**Result: PASS with one Important finding**

**Page serialization (SSR → client props):**

The `serialized` object in `page.tsx` (lines 35–52) is an explicit allow-list of fields passed to `BookingDetailClient`. It does NOT include `userId`, `createdAt`, `checkInTime`, or `checkOutTime` from the raw `getOwnedBooking` result. These fields are selected in the DB query but stripped at the serialization boundary. No other users' data, foreign `userId`, email, or PII is included in the client props.

**GET API response:**

`apiSuccess(booking)` serializes and returns the full `getOwnedBooking` result, which includes `userId: true` and `createdAt: true` in the Prisma `select`. While this endpoint is owner-gated (only the booking owner can fetch their own booking), returning the `userId` back to the client who already owns it is low-risk — the authenticated user's own ID is not sensitive in this context. However it is unnecessary surface.

**Finding — Important (not Critical):**

| Severity | Location | Risk | Fix |
|---|---|---|---|
| Important | `lib/bookings.ts:30` | `userId` is selected and returned by the GET API. The camper's own `userId` is not cross-user PII here, but it is unnecessary surface in the API response — the client does not need it. | Remove `userId: true` from the `select` in `getOwnedBooking`. The SSR page does not pass it to the client. The API response shape should also omit it. `createdAt` is also selected but unused in the page — consider removing unless the API contract needs it. |

**Secrets / logs:**

- `apiError` logs to `console.error` server-side (includes `details` only on 4xx, never on 5xx). No secret or PII leaks into logs or error responses.
- No `NEXT_PUBLIC_*` secrets in the diff.
- No hardcoded credentials, tokens, or connection strings found in the diff.

**noindex:** `page.tsx` exports `metadata: { robots: { index: false } }` — the auth-gated booking detail page is correctly excluded from search indexing.

**OWASP A02 Crypto + A09 Logging: Clear (minus the Important finding above).**

---

### Area 4 — Infra / Config [OWASP A05 Misconfig]

**Result: PASS (not in scope of this diff; re-confirmed seed guards)**

- Security headers (CSP, HSTS, X-Content-Type-Options, Referrer-Policy) are set at the Next.js config/middleware layer — not changed in this diff. No regression introduced.
- Cookies are managed by NextAuth — not changed in this diff.
- **Seed/bulk-seed/scrape-seed routes:** all three routes call `assertSeedAllowed()` (confirmed in `lib/seed-guard.ts`) which blocks in `NODE_ENV === 'production'` unless `ALLOW_DANGEROUS_SEED=1` is set. Guard is intact and was not touched by this diff.
- `robots: { index: false }` on the page prevents accidental indexing of authenticated booking pages.

**OWASP A05 Misconfig: Clear.**

---

### Area 5 — Third-Party Dependencies [OWASP A06 · A10 SSRF]

**Result: PASS (0 high/critical — see npm audit below)**

- No new dependencies added in this diff.
- No client-supplied URL fetched in this diff. The cover image `url` from the DB is rendered via `ImageWithFallback` (a display component), not fetched server-side.
- **npm audit --omit=dev result (real run):** 2 moderate severity vulnerabilities (PostCSS < 8.5.10 via `next`). **0 high, 0 critical.** The fix requires a breaking `next` downgrade to 9.3.3 — not actionable. Moderate vulns do not block this gate per the DoD (0 high/critical required).

**OWASP A06 Vulnerable Deps + A10 SSRF: Clear.**

---

### Area 6 — AI / LLM [LLM Top 10]

**Result: N/A**

This diff does not touch any LLM, prompt, or agent code. No AI/LLM surface introduced.

---

## STRIDE Analysis

| Threat | Relevant to this diff | Assessment |
|---|---|---|
| **Spoofing** | Attacker sends forged `userId` in body to access another user's booking | Not possible — `userId` is read from the server-side NextAuth session, never from the request. |
| **Tampering** | Attacker modifies `id` or `userId` in transit | Not applicable — GET is a read; params are route-level; ownership enforced at DB layer. |
| **Repudiation** | No audit log for booking detail views | Booking read events are not audited — this is consistent with the existing pattern (only mutations are audit-logged). Low risk for a read-only endpoint. |
| **Information Disclosure** | IDOR — user A reads user B's booking | Blocked at DB layer by `where: { id, userId }`. Wrong-owner and not-found both return the same 404. `userId` included in GET API response (Important finding above). |
| **Denial of Service** | No rate limit on the new GET endpoint | Read endpoints are generally lower risk. No rate limit added, consistent with other GET endpoints in the codebase. Flagged as a Suggestion. |
| **Elevation of Privilege** | Camper upgrades their booking status via PATCH to CONFIRMED/COMPLETED | Blocked by PATCH authz: `isCamper && !canHostUpdate && status !== 'CANCELLED'` → 400. Cancel-button visibility is UX only; the server re-checks on every PATCH. |

---

## Findings Summary

| # | Severity | File:Line | Risk | Fix |
|---|---|---|---|---|
| F-1 | Important | `lib/bookings.ts:30` | `userId` selected and returned via GET API response — unnecessary surface even though owner-gated. | Remove `userId: true` (and optionally `createdAt: true`) from the `select` in `getOwnedBooking`. |
| F-2 | Suggestion | `app/api/bookings/[id]/route.ts` (GET) | No per-endpoint rate limit on `GET /api/bookings/[id]`. | Add rate limiting consistent with other GET endpoints when a rate-limit middleware layer is introduced (out of scope for this story). |

**0 Critical. 0 High. 1 Important. 1 Suggestion.**

---

## npm audit

```
npm audit --omit=dev (real run, 2026-06-23)

postcss < 8.5.10 (moderate) via next
2 moderate severity vulnerabilities
0 high
0 critical
```

Gate requirement: 0 high/critical. **Met.**

---

## Secret Scan

Grep of diff for hardcoded secrets, tokens, API keys, connection strings: **None found.**

No `NEXT_PUBLIC_*` secrets, no credentials in fixtures, logs, or client bundle.

---

## Verdict

**PASS** — no Critical findings. The IDOR/owner-scope is correctly enforced at the DB layer for both the GET endpoint and the SSR page. The 404-uniformity (no existence leak) is implemented correctly. The PATCH authz is unchanged and unweakened.

The one Important finding (F-1: `userId` in GET response) is a cleanup item for `backend` but does not block merge.

---

## Next

- **Backend (F-1):** Remove `userId: true` from the `select` in `lib/bookings.ts:getOwnedBooking`. The page serialization already strips it; the API response shape should too.
- **On pass:** Hand off to merge into `staging` (G3).
