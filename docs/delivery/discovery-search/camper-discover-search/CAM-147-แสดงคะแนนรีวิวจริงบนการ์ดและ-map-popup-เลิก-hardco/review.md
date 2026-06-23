---
linear: CAM-147
feature: discovery-search
epic: camper-discover-search (CAM-33)
artifact: review
owner: security
status: In Review
version: v1
updated: 2026-06-23
---

# Security Review — CAM-147: แสดงคะแนนรีวิวจริงบนการ์ดและ map popup (เลิก hardcode 4.8)

## Verdict: PASS

No Critical findings. 0 high/critical from `npm audit --omit=dev`. The diff is safe to merge into `staging`.

---

## 6-Area Audit

| # | Area | OWASP / LLM | Finding | Severity |
|---|---|---|---|---|
| 1 | Input | A03 Injection | No new input boundary introduced. Query filter values come from `buildCampSiteWhere` (existing, allowlist-validated). Sort param validated against an explicit allowlist before use. No raw SQL added. Prisma parameterized throughout. | Info — clean |
| 2 | Auth / Authz | A01 Access Control · A07 Auth Failures | Public listing/detail pages — read-only, no mutation added. No new auth decision surface. No IDOR vector: the diff fetches only `{ rating: true }` from `Review` rows already scoped with `where: { deletedAt: null }` and no user identity is involved. Ownership check path for `campgrounds/[slug]/page.tsx` (`isOwner = session.user.id === campSite.operatorId`) is unchanged and still correct. `wishlist/page.tsx` is session-gated (`userId: session!.user!.id`) — also unchanged. | Info — clean |
| 3 | Data / Information Disclosure | A02 Crypto · A09 Logging | **Primary risk of this story.** Result: reviews array is correctly stripped in all four affected surfaces (evidence below). Client receives only `avgRating: number\|null` and `reviewCount: number` — never `authorId`, never `content`, never the raw `reviews[]` array. No PII in any log statement added (only `console.error` on DB error, no user data logged). No secret or PII in the diff, translation file, or test file. | Info — clean |
| 4 | Infra / Config | A05 Misconfig | Seed/bulk-seed/scrape-seed routes: all three call `assertSeedAllowed()` at request start. `lib/seed-guard.ts` blocks in `production` unless `ALLOW_DANGEROUS_SEED=1` is set, plus requires an authenticated ADMIN session. No change to these routes in this diff. Security headers and cookie settings are outside this diff's scope (unchanged). | Info — clean |
| 5 | 3rd-party / Deps | A06 Vulnerable Deps · A10 SSRF | `npm audit --omit=dev` result: **0 high, 0 critical**. 2 moderate findings (postcss < 8.5.10 via `next` internal, fix requires a breaking `next` downgrade to v9 — not actionable; pre-existing, not introduced by this diff). No new dependency added by this diff. No client-supplied URL fetch added. | Info — clean |
| 6 | AI / LLM | LLM01–LLM06 | No LLM/prompt/agent surface touched. N/A. | N/A |

---

## Information Disclosure — Reviews-Strip Verification (Primary Risk)

The diff adds `reviews: { where: { deletedAt: null }, select: { rating: true } }` to three Prisma queries. Each surface must strip the array and forward only `avgRating` + `reviewCount`.

| Surface | Evidence | Strip confirmed |
|---|---|---|
| `app/page.tsx` — rating sort branch | Line 118–122: `sorted.map(({ reviews: _reviews, ...rest }) => ({ ...rest, avgRating: roundAvgRating(computeAvgRating(_reviews)), reviewCount: _reviews.length }))` | Yes |
| `app/page.tsx` — all other sort branches (price_asc, price_desc, related) | Line 141–145: identical strip pattern applied to the `rows` result | Yes |
| `app/wishlist/page.tsx` | Line 64: `const { reviews, ...campSite } = row.campSite;` followed by explicit field-by-field construction of the return object (no spread of campSite), with only `avgRating` and `reviewCount` scalars added | Yes |
| `CampgroundDetailClient.tsx` → `MapComponent.tsx` | `avgRating` and `reviewCount` props forwarded as scalars (lines 1106–1107). `MapComponent` interface declares only `avgRating?: number \| null` and `reviewCount?: number`. The reviews array for the detail page is fetched separately via `prisma.review.aggregate` + `findMany`, mapped through `toReviewListItem` (which excludes `authorId`), and forwarded as `ReviewListItem[]` — path unchanged by this diff, pre-existing. | Yes |

### Select + deletedAt confirmation

All three new query additions use exactly:
```
reviews: {
  where:  { deletedAt: null },
  select: { rating: true },
}
```
Only the `rating` integer field is selected. No `authorId`, `content`, `userId`, `createdAt` or any other field is fetched.

---

## STRIDE Summary (diff-scoped)

| Threat | Finding |
|---|---|
| **Spoofing** | No new auth surface; public read. Clean. |
| **Tampering** | No mutation added; read-only queries with Prisma parameterized. Clean. |
| **Repudiation** | No audit-relevant event added (read-only display change). N/A. |
| **Information disclosure** | Primary risk. Reviews array stripped on all four surfaces before forwarding to client components. Only `rating` field selected from DB. Clean. |
| **DoS** | Existing `take: 40` cap retained on the non-rating sort branch. Rating sort branch: `sortByRating` caps at 40 via `.slice(0, 40)` after in-memory sort. Bounded. |
| **Elevation** | No role/permission change. No mutation. Clean. |

---

## Secret Scan

Diff grepped for: `password`, `secret`, `token`, `key`, `api_key`, `auth_token`, `bearer`, `private`. Result: 0 matches in the diff. No secrets or credentials in any modified or new file.

---

## npm audit --omit=dev

Run: 2026-06-23 against the working tree.

```
2 moderate severity vulnerabilities
  postcss < 8.5.10 (via next internal node_modules/next/node_modules/postcss)
  next 9.3.4-canary.0 – 16.3.0-canary.5 depends on vulnerable postcss

0 high  |  0 critical
```

Fix requires `npm audit fix --force` which would downgrade `next` to v9 — a breaking change. Pre-existing, not introduced by this diff. **0 high/critical gate: PASS.**

---

## Findings

0 Critical, 0 High. No blocking findings.

| Severity | File:Location | Risk | Fix |
|---|---|---|---|
| Suggestion | `app/campgrounds/[slug]/page.tsx:87` | `include: { author: { select: { name: true } } }` on the reviews `findMany` — correct (name only, no id), but is outside this diff. Pre-existing, documented in CAM-79 review. | No action required for CAM-147. |

---

## Checks Summary

- Diff scanned across all 6 areas: Input / Auth / Data / Infra / 3rd-party / AI-LLM
- Reviews strip verified on all 4 affected surfaces (both sort branches of `app/page.tsx`, `app/wishlist/page.tsx`, `CampgroundDetailClient` → `MapComponent`)
- `select: { rating: true }` + `where: { deletedAt: null }` confirmed on all three new Prisma query additions
- `authorId` / `content` / raw `reviews[]` confirmed absent from all client-forwarded objects
- Seed/bulk-seed/scrape-seed routes confirmed guarded via `assertSeedAllowed` (blocks prod without override flag + ADMIN role)
- Secret scan: 0 matches
- `npm audit --omit=dev`: 0 high, 0 critical

## Next

PASS. Cleared for merge into `staging`. Handoff to quality-gate / merge.
