---
artifact: review
ticket: CAM-59
title: หน้ายืนยันการจองและรหัสการจอง — Security Review
status: Done
version: v1
date: 2026-06-23
reviewer: Security (The Camper)
verdict: PASS
---

# Security Review — CAM-59 หน้ายืนยันการจองและรหัสการจอง

**Verdict: PASS** — 0 Critical findings. Safe to merge into `staging`.

---

## Diff scope reviewed

| File | Change |
|---|---|
| `components/CampgroundDetailClient.tsx` | post-booking redirect: `setTimeout/window.location.href` → `router.push(/bookings/${data.id}/confirmation)` |
| `locales/translations.json` | i18n keys added (TH + EN): confirmation/ref/not-found strings |
| `app/bookings/[id]/confirmation/page.tsx` | NEW — Server Component; authz + owner-scoped fetch |
| `app/bookings/[id]/confirmation/BookingConfirmationClient.tsx` | NEW — display-only client island |
| `app/bookings/[id]/confirmation/not-found.tsx` | NEW — 404 UI |
| `lib/booking-ref.ts` | NEW — pure `formatBookingRef` util |
| `__tests__/cam-59-confirmation.test.ts` | NEW — unit + source-inspection tests |

---

## 6-Area Audit

### 1. Input (OWASP A03 Injection)

| Check | Result |
|---|---|
| Prisma parameterized only (no raw SQL) | PASS — `findFirst({ where: { id, userId: session.user.id } })` is parameterized |
| No mass-assignment | PASS — `select` clause is explicit (id, status, dates, guests, totalPrice, campSite name fields only) |
| `formatBookingRef` injection risk | PASS — pure `string.slice(0,8).toUpperCase()`; no eval, no exec, no output sink |
| URL param `id` used only in the where-clause | PASS — `id` from `params` flows into `where: { id, userId: session.user.id }` only; nothing else is built from it |

No injection surface in the diff.

### 2. Auth / Authz (OWASP A01 Access Control · A07 Auth Failures)

**Primary risk: IDOR on the confirmation page.**

| Check | Result | Evidence |
|---|---|---|
| Session checked before any data fetch | PASS | `const session = await auth()` is the first call; `if (!session?.user?.id) redirect("/login")` guards before `await params` |
| `userId` comes from the server session only | PASS | `where: { id, userId: session.user.id }` — `session.user.id` is read from NextAuth, never from URL/body/query |
| Owner-scope on fetch | PASS | `prisma.booking.findFirst({ where: { id, userId: session.user.id } })` — wrong-owner returns `null` |
| Wrong-owner → 404 (no existence leak) | PASS | `if (!booking) { notFound(); }` — unified null-path; no separate 403 branch; no "this booking belongs to someone else" signal |
| Non-existent id → same 404 (no existence leak) | PASS | Same `notFound()` branch covers both cases (AC#5 + AC#7) |
| No 403/existence-split | PASS | Source confirmed no `status: 403`, no `code: 403`, no `NextResponse.json` in the page; both wrong-owner and non-existent hit identical `null → notFound()` |
| Unauthenticated → redirect `/login` | PASS | Guard fires before `await params` and before any DB call (AC#6) |
| Default-deny | PASS | Any session check failure redirects; no fallthrough to data fetch |

The IDOR check is clean. The where-clause is `{ id, userId: session.user.id }` — a user cannot retrieve another user's booking by guessing a booking id.

**Redirect id source (CampgroundDetailClient):** `router.push(\`/bookings/${data.id}/confirmation\`)` — `data.id` is the booking id returned from the `/api/bookings` POST response (server-created). The id is not supplied by the user; it is received from the server after a successful `201` creation. This is acceptable: the page re-validates ownership against the session when loaded.

### 3. Data / Information Disclosure (OWASP A02 Crypto · A09 Logging)

| Check | Result |
|---|---|
| `userId` NOT in the serialized payload to the client | PASS — serialized object contains: `id, status, checkInDate, checkOutDate, guests, totalPrice, campSite.{nameTh,nameEn,nameThSlug}`. No `userId`, no email, no phone, no PII beyond display fields. |
| No PII in `not-found.tsx` | PASS — renders generic copy from i18n; no session/user data |
| No secrets/tokens in any new file | PASS — grep confirmed no `NEXT_PUBLIC_*`, no env vars, no tokens in confirmation page, client component, or `booking-ref.ts` |
| No console.log with PII | PASS — no logging in new files |
| `robots: { index: false }` on the confirmation page | PASS — auth-gated page correctly marked noindex (per `.claude/rules/seo.md §8`) |
| Decimal and Date serialization | PASS — `Number(booking.totalPrice)` and `.toISOString()` prevent Prisma object leakage across server/client boundary |

### 4. Infra / Config (OWASP A05 Misconfig)

| Check | Result |
|---|---|
| Security headers | Not in diff scope — headers are set globally in `next.config`/middleware, unchanged by this story. Re-checked separately. |
| Seed routes guarded | PASS — `app/api/seed`, `bulk-seed`, `scrape-seed` all import and call `assertSeedAllowed` (confirmed in place, unchanged by this diff) |
| No debug/stack to client | PASS — no `try/catch` exposing stack in the new server page; `not-found.tsx` renders only i18n copy |
| Cookie security | Not touched by this diff |

### 5. 3rd-Party / Deps (OWASP A06 · A10 SSRF)

| Check | Result |
|---|---|
| `npm audit --omit=dev` run | DONE |
| High/critical count | **0 high, 0 critical** |
| Moderate vulnerabilities | 2 moderate (PostCSS < 8.5.10 via `next` dependency chain) — not high/critical; fix requires a breaking Next.js downgrade (`npm audit fix --force` would install Next.js 9.3.3); not actionable in this story |
| No new dependencies added | PASS — diff adds no new packages |
| No client-supplied URL fetch | PASS — no SSRF surface in this diff |

### 6. AI / LLM

Not applicable — this story has no LLM/prompt/agent surface. No finding required.

---

## STRIDE

| Threat | Surface in diff | Finding |
|---|---|---|
| **Spoofing** | `session.user.id` is server-side only; no client-supplied identity | No risk |
| **Tampering** | Booking data: server fetches with ownership scope; client receives serialized read-only display data | No risk |
| **Repudiation** | No audit-log addition in this diff; booking creation audit is on the POST route (pre-existing) | Acceptable — confirmation page is read-only |
| **Information Disclosure** | Unified `notFound()` for wrong-owner + non-existent prevents existence leak; client payload contains display fields only | No risk |
| **DoS** | No rate-limiting on the confirmation GET page (Server Component, authenticated); low risk (auth wall, no expensive DB scan) | No risk for this story scope |
| **Elevation** | `session.user.id` from NextAuth; no role escalation path in the diff | No risk |

---

## npm audit

Run: `npm audit --omit=dev`
Result: **0 high, 0 critical** (2 moderate — PostCSS XSS in `next` dependency chain, not directly exploitable here, fix would require breaking Next.js downgrade)

---

## Findings

0 Critical · 0 High · 0 Important · 0 Suggestion

No findings. All six areas clear.

---

## Summary

Reviewed: CAM-59 confirmation page diff (server page + client island + not-found + booking-ref util + redirect change + i18n keys).

The primary risk (IDOR/owner-scope) is handled correctly: `prisma.booking.findFirst({ where: { id, userId: session.user.id } })` scopes to the session owner; both wrong-owner and non-existent id resolve to the same `notFound()` (404) with no existence leak. `userId` is read from NextAuth server-side, never from URL or body. The client payload contains display fields only — no `userId`, email, or PII beyond what is needed to render the page.

`npm audit --omit=dev` = **0 high, 0 critical**.

**Verdict: PASS** — safe to merge into `staging`.

---

## Next

Hand off to merge gate (G3). After merge, QA verifies AC on the real Staging URL to move to Linear state `Done`.
