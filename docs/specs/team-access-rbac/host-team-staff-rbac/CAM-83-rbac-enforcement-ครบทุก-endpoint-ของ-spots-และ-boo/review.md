---
linear: CAM-83
feature: team-access-rbac
epic: host-team-staff-rbac (CAM-38)
persona: host
artifact: review
owner: security-reviewer
status: Done
version: v1
updated: 2026-06-23
---
# Security review — RBAC enforcement on spot CRUD endpoints (CAM-83)

## Scope
Diff that swaps owner-only authz for permission-based authz on the spot CRUD surface. Files reviewed:

- `app/api/campsites/[id]/spots/route.ts` — `POST` now gated on `requireCampSitePermission(id, 'CAMPSITE_UPDATE')`; `GET` unchanged (public read).
- `app/api/campsites/[id]/spots/[spotId]/route.ts` — `PUT` gated on `CAMPSITE_UPDATE`, `DELETE` gated on `CAMPSITE_DELETE`; both retain the `findFirst({ id: spotId, campSiteId: id })` IDOR scope before mutation; `GET` unchanged.
- `__tests__/spot-rbac.test.ts` (new) and `__tests__/security-hotfix.test.ts` (updated) — regression coverage.

Authz engine (`lib/auth-utils.ts` `requireCampSitePermission`, `lib/team-permissions.ts`) was already shipped; reviewed as the trust boundary the handlers now delegate to.

STRIDE applied to the diff: Spoofing (session identity), Tampering (spot row, mass-assignment), Repudiation (spot mutation), Information-disclosure (5xx detail leak), DoS (rate limit), Elevation (the core change — owner-only → role-based gate).

---

## 6-area findings

### 1. Input — OWASP A03 Injection
All spot writes go through Prisma parameterized calls (`create`/`update`/`delete`); no raw SQL or string concatenation. Body is zod-parsed (`spotSchema` / `spotSchema.partial()`) before any DB write → `400` on failure. `campSiteId` is taken from the URL param and forced into the create/where, never from the body — no mass-assignment of the relation. Finding: none.

### 2. Auth / Authz — OWASP A01 Access Control, A07 Auth Failures
The change is the gate itself. `requireCampSitePermission(id, code)` reads the user from the NextAuth session server-side (never from body/query/header), enforces the three-tier precedence (platform ADMIN → owner → active team member with the required effective permission), and is **default-deny**: a non-member or a member without the code returns `403`, unauthenticated returns `401`. Confirmed no privilege escalation path: a member's `role`/`permissions` are read from the DB row, not the client; explicit `permissions` are filtered to `ALL_PERMISSIONS` before use. The ADMIN-no-`CAMPSITE_DELETE` asymmetry holds — team ADMIN is correctly `403` on DELETE. Finding: none.

### 3. Data (PII / Secrets) — OWASP A02 Crypto, A09 Logging
No secret, token, or PII in the diff, the tests, or the responses. On 5xx, `apiError` suppresses `details` (verified by `security-hotfix.test.ts` and `spot-rbac.test.ts` 500 cases) so no stack/DB detail leaks to the client; the raw error is logged server-side only. Finding: none in this diff.

### 4. Infra / Config — OWASP A05 Misconfig
No new route, middleware, or header change. Security headers (CSP/HSTS/nosniff/Referrer-Policy) and cookie config are project-wide, unaffected. Rate limit on the spot mutation endpoints is a pre-existing gap, not introduced here (see Finding log). Seed/scrape route guards untouched — re-check at G5 per the standard pre-prod gate. Finding: none blocking.

### 5. 3rd-party / Dependencies — OWASP A06 Vulnerable Deps, A10 SSRF
`npm audit --omit=dev` run on the branch: **0 high, 0 critical**; 2 moderate (PostCSS `<8.5.10` via `next`'s bundled dep — pre-existing; fix needs a breaking Next.js change; tracked separately). No new dependency added. No client-supplied external URL fetched → SSRF not applicable. Gate threshold (0 high/critical) met.

### 6. AI / LLM
No LLM, prompt, or agent surface in this diff. Not applicable.

---

## Explicit confirmations
- Owner of the campsite → **allowed** (passes via `operatorId === session.user.id`).
- Platform ADMIN → **allowed** (passes via `session.user.role === 'ADMIN'`).
- Team member WITH the required permission (e.g. ADMIN with `CAMPSITE_UPDATE` for POST/PUT) → **allowed**.
- Team member WITHOUT it (VIEWER/STAFF/MANAGER for spot CRUD; team ADMIN for DELETE) → **403**.
- Non-member authenticated user → **403**.
- Unauthenticated → **401** (before any spot DB access).
- Cross-campsite IDOR (spot of campsite B via campsite A's URL) → **404**, mutation never reached.
- `npm audit --omit=dev` → **0 high / 0 critical**.

## npm audit
Run: `npm audit --omit=dev` on the CAM-83 branch.

- **High:** 0
- **Critical:** 0
- **Moderate:** 2 (PostCSS `<8.5.10` via `next` bundled dep — pre-existing; does not meet the block threshold)

Gate threshold (0 high/critical): **met**.

---

## Verdict
**PASS** — no Critical or Important open findings introduced by this diff. Default-deny preserved, no privilege escalation, no IDOR, no mass-assignment, no secret/PII/injection. The diff may merge into `staging`.

### Finding log
| Severity | File | Risk | Status / routing |
|---|---|---|---|
| Important | `lib/actions.ts` (registration) | `bcrypt.hash(password, 10)` — cost factor 10, below the project standard of ≥12 [OWASP A02] | **Pre-existing, not from this diff.** Route to a backend follow-up ticket to raise the cost to ≥12. |
| Suggestion | `app/api/campsites/[id]/spots/*` | No structured audit-log on spot create/update/delete; permission-affecting mutations are not currently recorded [OWASP A09 / STRIDE Repudiation] | Follow-up ticket recommended (audit-log on spot mutations). |
| Suggestion | `…/spots/[spotId]/route.ts` (PUT/DELETE) | Defense-in-depth: collapse `campSiteId` into the `update`/`delete` `where` clause (currently a separate `findFirst` guard, which is correct but a single scoped write is tighter) | Optional hardening; non-blocking. |

---

## Links
`story.md` · `tech.md` · `.claude/rules/security.md`

## Changelog
- v1 (2026-06-23) — created; 6-area + STRIDE on the spot RBAC diff; PASS; npm audit 0 high/critical; 1 Important (pre-existing bcrypt) + 2 Suggestions routed to follow-ups
