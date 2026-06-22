---
linear: CAM-127
feature: reviews-reputation
epic: camper-post-trip-review (CAM-35)
persona: camper
artifact: review
owner: security-reviewer
status: Done
version: v1
updated: 2026-06-22
---
# Security review — ปุ่มบันทึกบนหน้า Campground Detail (CAM-127)

## Scope

Branch `feature/wishlist-detail-hardening`. Diff files reviewed:

- `app/campgrounds/[slug]/page.tsx` — Server Component; reads session, resolves wishlist state, passes props to client
- `components/CampgroundDetailClient.tsx` — Client Component; renders toggle button, calls wishlist API, shows toast/LoginModal
- `lib/wishlist-toggle.ts` — pure toggle state-machine extracted into a testable module
- `locales/translations.json` — Thai copy for toast and aria keys
- `__tests__/wishlist-detail-toggle.test.ts` — unit test suite (AC-1..5, BR-1..5)

API surface in scope: the pre-existing `/api/wishlist` route (CAM-18, ownership-scoped; not modified by this story). Booking flow (`/api/bookings`, `/api/campsites/[id]/availability`) passes through the client component but is not new in this diff.

STRIDE scope applied to the diff: Spoofing (session identity), Tampering (wishlist row ownership, mass-assignment), Repudiation (wishlist toggle), Information-disclosure (operator PII, secret/PII in response), DoS (unbounded toggle requests), Elevation (owner-only edit path).

---

## 6-area findings

### 1. Input — OWASP A03 Injection

No raw SQL or string-concatenated queries in the diff. The wishlist lookup in `page.tsx` (line 59) uses a Prisma `findUnique` with a compound key `{ userId_campSiteId: { userId: session.user.id, campSiteId: campSite.id } }` — fully parameterized. The toggle client calls the pre-existing `/api/wishlist` route (CAM-18) which is zod-validated at the boundary.

`campSiteId` passed to `runWishlistToggle` originates from `campground.id` which was loaded server-side; it is passed as a prop and never taken from the request body.

Finding: none.

### 2. Auth / Authz — OWASP A01 Access Control, A07 Auth Failures

**Wishlist lookup (page.tsx lines 14, 57–66):** session is read from `auth()` on the server. The lookup is guarded with `if (session?.user?.id)` before any DB call. The Prisma query binds `userId: session.user.id` — IDOR is not possible; a user cannot resolve another user's saved state.

**Guest path:** when `!session`, `initialSaved` stays `false` and `isLoggedIn=false` is passed to the client. The client-side guard in `runWishlistToggle` (`isLoggedIn=false` → `loginModalOpened=true`, no API call) is defense-in-depth only — the authoritative gate remains `/api/wishlist` (CAM-18, checked server-side).

**Owner edit path (CampgroundDetailClient.tsx line 354):** `isOwner` is computed in the server component at page.tsx line 53 as `session.user.id === campSite.operatorId` — both values come from server-side sources (session and DB). The edit button is conditionally rendered client-side, but the actual authorization check on the edit endpoint is not part of this diff.

**Rate limiting:** no rate limit on the wishlist toggle endpoint. This is a pre-existing gap not introduced by this diff. Noted as a follow-up (see Verdict).

Finding: none Critical or Important in this diff.

### 3. Data (PII / Secrets) — OWASP A02 Crypto, A09 Logging

**Operator PII — pre-existing exposure, now remediated (Important — fixed on this branch):**

Prior to this branch, the `operator` field was loaded with a broad `include: { operator: true }`, which serialized the full `User` row to the client via `serializeDecimals(campSite)`. That row contains `email`, a hashed `password`, `phone`, `taxId`, and `kyc` fields — all unnecessary for the detail page and a data-minimization violation under PDPA.

The current `page.tsx` (lines 27–35) narrows the Prisma select to `operator: { select: { id, name, image, createdAt } }`. Only display-safe fields reach the client. `isOwner` is computed server-side via `campSite.operatorId === session.user.id` (line 53), so the operator `email` is never fetched.

Verified: the remediation is present in the current file on this branch.

No secret, token, or PII is present in the diff, test fixtures, or translation strings. The `console.error` on line 42 (DB error) and line 88 (availability API error) logs the raw error server-side; neither leaks to the client response — `notFound()` is called instead.

Finding: operator-PII exposure is remediated. No remaining data findings.

### 4. Infra / Config — OWASP A05 Misconfig

Security headers (CSP, HSTS, `X-Content-Type-Options`, `Referrer-Policy`) are project-wide and set in `next.config` / middleware — no regression introduced by this diff, which adds no new route or middleware. Cookies are managed by NextAuth (unchanged).

Seed / bulk-seed / scrape-seed route guard: not touched by this diff; re-check required at G5 per standard pre-prod gate.

Finding: none.

### 5. 3rd-party / Dependencies — OWASP A06 Vulnerable Deps, A10 SSRF

`npm audit --omit=dev` was run on the branch. Result: **0 high, 0 critical**. There are 2 moderate-severity findings (PostCSS `<8.5.10` via `next`'s internal dependency). Moderate findings do not block the gate per the project threshold (0 high/critical). The fix requires a breaking downgrade of Next.js and is not appropriate to apply here; it should be tracked as a separate dependency-upgrade ticket.

No new external fetch of a client-supplied URL was introduced. The availability fetch in `CampgroundDetailClient.tsx` (line 81) calls `/api/campsites/[id]/availability` — an internal relative URL, not a client-supplied external URL; SSRF is not applicable.

Finding: none blocking. Moderate PostCSS advisory noted (pre-existing, tracked separately).

### 6. AI / LLM

No LLM, prompt, or agent surface introduced by this diff. Not applicable.

---

## npm audit

Run: `npm audit --omit=dev` on branch `feature/wishlist-detail-hardening`

- **High:** 0
- **Critical:** 0
- **Moderate:** 2 (PostCSS `<8.5.10` via `next`'s bundled internal dep — pre-existing; fix requires a breaking Next.js downgrade; does not meet the block threshold)

Gate threshold (0 high/critical): **met**.

---

## Verdict

**PASS** — no Critical or Important open findings. The diff may merge into `staging`.

### Finding log

| Severity | File | Risk | Status |
|---|---|---|---|
| Important (remediated) | `app/campgrounds/[slug]/page.tsx` (operator include) | Full `User` row — email, hashed password, phone, taxId, kyc — serialized to client via `serializeDecimals`; PDPA data-minimization violation [OWASP A02 / A09] | Fixed on this branch: `select: { id, name, image, createdAt }` only. Tracked as CAM-128. |
| Suggestion | `/api/wishlist` (pre-existing, CAM-18) | No rate limit on wishlist toggle endpoint; brute-force or abuse of save/remove not currently bounded [OWASP A05, STRIDE DoS] | Pre-existing gap; follow-up ticket recommended. Not introduced by this diff. |
| Info | `package.json` (postcss via next) | 2 moderate PostCSS advisories — fix requires a breaking Next.js downgrade | Pre-existing; track as separate dependency-upgrade ticket. |

---

## Links

`story.md` · `test.md` · `.claude/rules/security.md` · CAM-128 (operator-PII tracking ticket)

---

## Changelog

- v1 (2026-06-22) — created; operator-PII finding verified remediated on this branch; npm audit confirmed 0 high/critical
