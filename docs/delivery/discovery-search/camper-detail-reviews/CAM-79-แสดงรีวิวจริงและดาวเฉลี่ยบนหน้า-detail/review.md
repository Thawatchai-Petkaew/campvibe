---
linear: CAM-79
feature: discovery-search
epic: camper-detail-reviews
persona: Camper
artifact: review
owner: security-reviewer
status: In Review
version: v1
updated: 2026-06-23
---
# Security review — แสดงรีวิวจริงและดาวเฉลี่ยบนหน้า detail (CAM-79)

## Verdict

**PASS** — 0 Critical, 0 High findings. Gate is clear for merge to staging.

## Scope

Uncommitted working-tree diff on branch `feat/cam-79-detail-reviews`:
- `lib/review-summary.ts` (NEW — pure DTO mapper + helpers)
- `app/campgrounds/[slug]/page.tsx` (MODIFIED — adds review aggregate + findMany queries)
- `components/CampgroundDetailClient.tsx` (MODIFIED — renders reviews section)
- `locales/translations.json` (MODIFIED — adds `reviews` namespace TH/EN)
- `__tests__/review-summary.test.ts` (NEW — unit + source-inspection tests)

Read-only story — no mutations, no auth routes, no new endpoints, no new dependencies.

## 6-area findings

### 1. Input [OWASP A03 Injection] — PASS

- `campSiteId` used in both Prisma queries is sourced from `campSite.id` (the server-resolved DB row), **not** from any user-supplied value. The slug is used only to resolve the campsite via `findFirst`; the resulting DB `id` (not the slug) drives the review queries. No raw SQL. No string concatenation.
- No new form input or boundary input added by this diff; all data flows server-to-client as props.
- Prisma parameterized throughout: `aggregate({ where: { campSiteId, deletedAt: null } })` and `findMany({ where: { campSiteId, deletedAt: null } })`.

**Finding:** none.

### 2. Auth / Authz [OWASP A01 Access Control, A07 Auth Failures] — PASS

- This is a **public read** story. Reviews are publicly visible on the camp detail page; no auth is required to view them. No mutation is introduced.
- No auth bypass risk: the page does not grant access to anything that requires a session. Session is read via `await auth()` at the top of the page for unrelated features (wishlist, owner check) — not touched by the review diff.
- `campSiteId` comes from the server-resolved campSite row; there is no path where a user-supplied id is used unscoped to read another user's private data.
- No IDOR risk: reviews are public by design. No user-private review data is exposed.

**Finding:** none.

### 3. Data — information disclosure / PII [OWASP A02 Crypto, A09 Logging] — PASS (the primary risk area for this story)

**authorId exposure verdict: CLEAN.**

Evidence:

- `lib/review-summary.ts` `toReviewListItem` mapper: the Prisma include is `author: { select: { name: true } }` — only `name` is fetched from the User table. `authorId`, `author.id`, `email`, and all other User fields are not selected.
- `ReviewListItem` interface (`lib/review-summary.ts:7-12`) has exactly four fields: `name`, `rating`, `content`, `createdAt`. `authorId` and `author` are explicitly absent; the comment on line 6 and line 51 document the exclusion as an intentional security rule.
- `toReviewListItem` returns `{ name, rating, content, createdAt }` — the `author` relation object is consumed only to extract `author?.name`; the relation itself and any id are dropped.
- The test `[security] DTO shape has exactly the four expected keys: name, rating, content, createdAt` (`__tests__/review-summary.test.ts:257-265`) machine-verifies this at the type level.
- `CampgroundDetailClient.tsx` receives `reviews: ReviewListItem[]` and renders only `review.name`, `review.rating`, `review.content`, `review.createdAt` — no `authorId`, no `author.id`, no email reaches the client.
- No PII in the translations diff. No secret in any file in the diff. No `NEXT_PUBLIC_*` misuse.

**Finding:** none.

### 4. Infra / config [OWASP A05 Misconfig] — PASS (pre-existing; diff does not regress)

- Seed/scrape routes (`app/api/seed`, `app/api/bulk-seed`, `app/api/scrape-seed`) are all guarded by `assertSeedAllowed` from `lib/seed-guard.ts`, which blocks in production unless `ALLOW_DANGEROUS_SEED=1` is explicitly set. The diff does not touch these routes.
- Security headers (CSP, HSTS, etc.) are a global next.config concern — not changed by this diff.
- No new cookies, no new session handling introduced.

**Finding:** none introduced by this diff. Seed guard confirmed active.

### 5. 3rd-party / dependencies [OWASP A06 Vulnerable Deps] — PASS (0 high/critical)

`npm audit --omit=dev` result (run 2026-06-23):
- **2 moderate severity vulnerabilities** (PostCSS < 8.5.10, XSS via unescaped `</style>` in CSS stringify; affects `next@16.x` canary dependency chain).
- **0 high severity vulnerabilities.**
- **0 critical severity vulnerabilities.**
- The PostCSS moderate finding is a pre-existing transitive dep of Next.js. The fix (`npm audit fix --force`) would downgrade Next to 9.3.3, a breaking change. This is a known Next.js ecosystem issue, not introduced by this diff, and is below the gate threshold.
- No new dependencies added by this diff.

**Gate result: 0 high/critical — passes the gate.**

### 6. AI / LLM — N/A

This diff touches no LLM, prompt, or agent code. Not applicable.

## STRIDE notes

| Threat | Surface | Assessment |
|---|---|---|
| **Spoofing** | Public read; no session required | No new auth surface; no impersonation risk |
| **Tampering** | Read-only queries | No mutation; Prisma parameterized; `deletedAt: null` prevents soft-deleted data from surfacing |
| **Repudiation** | No write operations | N/A for this story |
| **Information disclosure** | `author.id`, `authorId`, PII | `select: { name: true }` on the Prisma include; `toReviewListItem` strips relation; DTO enforced by TypeScript type and unit test |
| **DoS** | `take: 10` cap on findMany | Bounded; aggregate does not fan out; isolated try/catch prevents review failure from breaking the page |
| **Elevation** | No role escalation path | Public read only; no privileged action |

## Soft-delete correctness

Both queries apply `deletedAt: null`:
- `prisma.review.aggregate({ where: { campSiteId, deletedAt: null } })` — line 81 `page.tsx`
- `prisma.review.findMany({ where: { campSiteId, deletedAt: null } })` — line 86 `page.tsx`

Soft-deleted reviews are excluded from both the count/average and the display list. The source-inspection test (`AC-6`) asserts `deletedAt: null` appears at least twice in `page.tsx`.

## Secret scan

Grep run against all diff files (modified + new untracked). Result: **CLEAN** — no hardcoded secrets, tokens, API keys, connection strings, or PII values in any file in the diff.

## npm audit

```
2 moderate severity vulnerabilities
0 high
0 critical
```

Gate threshold: 0 high/critical — **SATISFIED**.

## Links

`story.md` · `tech.md` · `.claude/rules/security.md`

## Changelog

- v1 (2026-06-23) — initial review, PASS verdict
