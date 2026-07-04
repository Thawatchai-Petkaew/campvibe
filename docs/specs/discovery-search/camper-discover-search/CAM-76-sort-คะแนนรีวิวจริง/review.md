---
artifact: review
ticket: CAM-76
feature: discovery-search
epic: camper-discover-search
story: sort-คะแนนรีวิวจริง
version: v1
updated: 2026-06-23
status: pass
reviewer: security (The Camper)
verdict: PASS — no Critical findings; 0 blockers; 2 moderate npm advisories (dev-chain, no fix without breaking change)
---

# Security Review — CAM-76 Sort คะแนนรีวิวจริง

## Verdict: PASS

No Critical findings. Merge to `staging` is unblocked.

---

## 1. Diff scope

| File | Change |
|---|---|
| `app/page.tsx` | Sort-param allowlist sanitization + rating branch + reviews include + strip |
| `lib/sort-utils.ts` | NEW — pure sort/avg helpers, no I/O |
| `__tests__/sort-utils.test.ts` | NEW — unit tests + source-inspection tests |
| `docs/delivery/…/CAM-76-…/` | Delivery artifacts (no executable code) |

---

## 2. Six-Area Audit

### Area 1 — Input / Injection [OWASP A03]

**PASS**

The `sort` query param is sanitized against a hardcoded `VALID_SORT` tuple (`['related', 'price_asc', 'price_desc', 'rating'] as const`) **before** any branch is entered (`app/page.tsx` lines 77–82). The allowlist check is:

```ts
typeof sort === 'string' && (VALID_SORT as readonly string[]).includes(sort)
  ? (sort as SortParam)
  : 'related'   // fallback for undefined / injected / unknown values
```

The sanitized value (`sanitizedSort`) is then used only in conditional branches that select hardcoded Prisma `orderBy` objects (`{ priceLow: 'asc' }`, `{ createdAt: 'desc' }`) or the `rating` path — the raw param never reaches the DB or any template string.

No `$queryRaw` / `$queryRawUnsafe` / string-concat SQL introduced in either file (grep confirmed: 0 matches).

No mass-assignment: the rating path uses an explicit `select: { rating: true }` and the non-rating path uses an explicit `include` — `req.body` never reaches Prisma.

**Verdict: PASS — injection surface closed.**

---

### Area 2 — Auth / Authz [OWASP A01 · A07]

**PASS**

This is the public search/list page (read-only, no mutations). The `auth()` session is read server-side and forwarded only as `session?.user` to `<Navbar>` and `!!session?.user?.id` to `<CampgroundGrid>` (boolean flag for wishlist state). No role or identity value is taken from the client.

The wishlist fetch uses `{ where: { userId: session.user.id } }` — ownership-scoped to the session user, not to a client-supplied id.

`buildCampSiteWhere` (the filter) is reused without widening in both branches: the `where` variable produced server-side is passed unchanged to both `findMany` calls. No additional rows are returned in the rating branch — the same filter applies, only the sort/order changes.

No authorization bypass introduced.

**Verdict: PASS — no auth bypass; read-only public surface; ownership on wishlist scoped to session.**

---

### Area 3 — Data / Information Disclosure [OWASP A02 · A09]

**PASS**

**Reviews stripped before client forwarding.** The rating branch fetches `reviews: { where: { deletedAt: null }, select: { rating: true } }` for the in-memory sort, then immediately strips the array before assigning to `campSites`:

```ts
campSites = sorted.map(({ reviews: _reviews, ...rest }) => rest);
```

The grid receives the same shape as the non-rating path — no `rating` rows, no `authorId`, no review PII reaches the page payload.

The catch block logs `console.error("Database connection error:", error)` server-side (Next.js server log) and returns `campSites = []` to the client. The error object is not serialized into the response — no stack, schema, or internal detail leaks to the client.

Secret scan on the diff: 0 secrets / tokens / keys / PII values found in any new or modified file.

**Verdict: PASS — reviews stripped; DB error is server-side-only; no PII/secret in diff.**

---

### Area 4 — Infra / Config [OWASP A05]

**PASS (in scope)**

This diff does not touch security headers, CSP, cookie config, or middleware — those remain unchanged from prior stories.

Seed/bulk-seed/scrape-seed route guard re-checked: all three routes import `assertSeedAllowed` from `lib/seed-guard.ts`, which blocks in `NODE_ENV === 'production'` unless `ALLOW_DANGEROUS_SEED=1` is explicitly set, then requires an authenticated ADMIN session. Guard is intact and unchanged by this diff.

**Verdict: PASS — seed routes guarded; no config regression introduced.**

---

### Area 5 — 3rd-Party / Deps [OWASP A06 · A10]

**ADVISORY — not a blocker**

`npm audit --omit=dev` result (real run):

```
postcss  <8.5.10 — Severity: moderate
PostCSS XSS via Unescaped </style> in CSS Stringify Output (GHSA-qx2v-qp2m-jg93)
  next 9.3.4-canary.0 – 16.3.0-canary.5 depends on vulnerable postcss

2 moderate severity vulnerabilities
0 high / 0 critical
```

**High/critical count: 0.** The 2 moderate advisories are in `next`'s bundled `postcss`; the only fix is `npm audit fix --force` which would downgrade `next` to 9.3.3 — a breaking change that is out of scope for this story. This is a pre-existing advisory, not introduced by CAM-76, and is moderate (not high/critical).

No new dependencies were added by this diff. No client-supplied URLs are fetched (no SSRF surface).

**Verdict: PASS — 0 high/0 critical; 2 pre-existing moderate advisories in the Next.js dep chain (out of scope for this story).**

---

### Area 6 — AI / LLM

**N/A**

This diff does not touch any LLM integration, prompt, model output, or agent workflow.

**Verdict: N/A**

---

## 3. STRIDE Notes

| Threat | Assessment |
|---|---|
| **Spoofing** | Not applicable — public read-only page; no identity claim from client used in queries. |
| **Tampering** | `sort` param cannot tamper with query results — allowlist + hardcoded branches prevent injection into `orderBy`. |
| **Repudiation** | DB error is logged server-side (`console.error`). No audit event required (read-only, non-sensitive). |
| **Information Disclosure** | Reviews stripped before forwarding; DB internals not returned to client. PASS. |
| **DoS** | In-memory sort fetches unbounded matching campsites before the 40-cap (see scale guard note below). Acceptable at current scale (<200 campsites). |
| **Elevation of Privilege** | No role/permission change. Public read-only. No elevation possible. |

---

## 4. Scale Guard Note (DoS / Unbounded Fetch — not a blocker)

The rating branch does not apply `take: 40` to the Prisma query (all matching campsites are loaded into memory for sorting, then sliced to 40 after). The code documents this:

```ts
// SCALE GUARD: in-memory sort is valid up to ~200 published campsites.
// When the catalog exceeds that threshold, replace with a stored
// CampSite.avgRating column updated by a background job (C-2.5).
```

At the current catalog size (well under 200 campsites), this is acceptable. The architect flagged this as constraint C-2.5 in `tech.md`. This is **not a security blocker** but is flagged for the backlog: when the catalog approaches ~200 published campsites, replace with a `CampSite.avgRating` stored column (C-2.5).

**Severity: Info (scale threshold not yet reached).**

---

## 5. Findings Summary

| # | Severity | File:Line | Risk | Fix |
|---|---|---|---|---|
| 1 | Info | `app/page.tsx:97` | Unbounded fetch for rating sort (in-memory sort before 40-cap) | Acceptable at current scale; track C-2.5 for the ~200-campsite threshold |
| — | — | npm audit | 2 moderate (postcss via next) — 0 high/critical | Pre-existing; no fix without breaking Next.js upgrade |

**Critical findings: 0. High findings: 0.**

---

## 6. npm audit result

```
2 moderate severity vulnerabilities
0 high / 0 critical
```

Run: `npm audit --omit=dev` (real run, 2026-06-23).

---

## 7. Self-verify checklist

- [x] Diff scanned across all 6 areas (input · auth · data · infra · 3rd-party · AI/LLM)
- [x] Sort param sanitized against allowlist before any DB branch — raw param never reaches Prisma
- [x] No `$queryRaw` / string-concat / mass-assignment introduced
- [x] Auth/ownership: read-only public page; wishlist scoped to `session.user.id`
- [x] `buildCampSiteWhere` reused unchanged in both branches — no filter widening
- [x] Reviews `select: { rating: true }` only; `deletedAt: null` excludes soft-deleted reviews
- [x] Reviews array stripped via destructure before forwarding to grid
- [x] DB error logged server-side only (`console.error`), not returned to client
- [x] Secret scan: 0 secrets/tokens/keys in diff
- [x] Seed/bulk-seed/scrape-seed routes confirmed guarded (`assertSeedAllowed`)
- [x] `npm audit --omit=dev` run for real: 0 high/critical

---

## 8. Verdict

**PASS — merge to `staging` is unblocked.**

No Critical or Important findings. One Info note (scale guard, tracked as C-2.5). Pre-existing moderate npm advisories unrelated to this diff.

Next: hand off to `devops` / merge gate for G3 (merge → `staging`).
