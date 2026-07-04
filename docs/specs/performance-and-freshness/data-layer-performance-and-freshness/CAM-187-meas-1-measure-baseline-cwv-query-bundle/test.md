---
linear: CAM-187
feature: performance-and-freshness
epic: data-layer-performance-and-freshness (CAM-186)
persona: platform
artifact: test
owner: qa-engineer
status: In Progress
version: v1
updated: 2026-06-26
---
# Test — MEAS-1 measure baseline (CWV / query / bundle) (CAM-187)

## AC→test matrix

| AC | test-id | layer | file | pass/fail |
|---|---|---|---|---|
| AC-1 (vitals payload schema) | schema--vitals-valid-lcp | unit | `__tests__/cam-187-meas-1.test.ts` | pass |
| AC-1 (vitals payload schema) | schema--vitals-all-metrics | unit | `__tests__/cam-187-meas-1.test.ts` | pass |
| AC-1 (vitals payload schema — reject) | schema--vitals-reject-unknown | unit | `__tests__/cam-187-meas-1.test.ts` | pass |
| AC-1 (vitals payload schema — boundary) | schema--vitals-boundary-nan | unit | `__tests__/cam-187-meas-1.test.ts` | pass |
| AC-1 (vitals payload schema — boundary) | schema--vitals-boundary-negative | unit | `__tests__/cam-187-meas-1.test.ts` | pass |
| AC-1 (vitals payload schema — rating) | schema--vitals-reject-rating | unit | `__tests__/cam-187-meas-1.test.ts` | pass |
| AC-1 (vitals payload schema — rating) | schema--vitals-all-ratings | unit | `__tests__/cam-187-meas-1.test.ts` | pass |
| AC-1 (vitals payload schema — id) | schema--vitals-reject-long-id | unit | `__tests__/cam-187-meas-1.test.ts` | pass |
| AC-1 (vitals payload schema — routeTemplate) | schema--vitals-reject-long-route | unit | `__tests__/cam-187-meas-1.test.ts` | pass |
| AC-1 (vitals payload schema — optional) | schema--vitals-no-nav-type | unit | `__tests__/cam-187-meas-1.test.ts` | pass |
| AC-1 (vitals payload schema — boundary) | schema--vitals-reject-nav-type-long | unit | `__tests__/cam-187-meas-1.test.ts` | pass |
| AC-1 (vitals payload schema — null/empty) | schema--vitals-missing-fields | unit | `__tests__/cam-187-meas-1.test.ts` | pass |
| AC-1 (POST /api/vitals 204) | form--vitals-post-valid | integration | `__tests__/cam-187-meas-1.test.ts` | pass |
| AC-1 (POST /api/vitals 400 bad name) | form--vitals-post-bad-name | integration | `__tests__/cam-187-meas-1.test.ts` | pass |
| AC-1 (POST /api/vitals 400 NaN) | form--vitals-post-nan | integration | `__tests__/cam-187-meas-1.test.ts` | pass |
| AC-1 (POST /api/vitals 400 invalid JSON) | form--vitals-post-invalid-json | integration | `__tests__/cam-187-meas-1.test.ts` | pass |
| AC-1 (POST /api/vitals 400 oversized) | form--vitals-post-oversized | integration | `__tests__/cam-187-meas-1.test.ts` | pass |
| AC-1 (POST /api/vitals 429 rate-limit) | alert--vitals-rate-limit | integration | `__tests__/cam-187-meas-1.test.ts` | pass |
| AC-1 (204 no PII in response) | form--vitals-no-pii-response | integration | `__tests__/cam-187-meas-1.test.ts` | pass |
| AC-1 (rate-limit per IP) | form--vitals-ip-independence | integration | `__tests__/cam-187-meas-1.test.ts` | pass |
| AC-1 (withTiming result) | form--timing-result | unit | `__tests__/cam-187-meas-1.test.ts` | pass |
| AC-1 (withTiming re-throw) | form--timing-rethrow | unit | `__tests__/cam-187-meas-1.test.ts` | pass |
| AC-1 (withTiming success log) | form--timing-success-log | unit | `__tests__/cam-187-meas-1.test.ts` | pass |
| AC-1 (withTiming error log) | form--timing-error-log | unit | `__tests__/cam-187-meas-1.test.ts` | pass |
| AC-1 (withTiming no PII) | form--timing-no-pii | unit | `__tests__/cam-187-meas-1.test.ts` | pass |
| AC-1 (toRouteTemplate slug strip) | input--route-template-slug | unit | `__tests__/cam-187-meas-1-gaps.test.ts` | pass |
| AC-1 (toRouteTemplate numeric) | input--route-template-numeric | unit | `__tests__/cam-187-meas-1-gaps.test.ts` | pass |
| AC-1 (toRouteTemplate UUID) | input--route-template-uuid | unit | `__tests__/cam-187-meas-1-gaps.test.ts` | pass |
| AC-1 (toRouteTemplate preserves short) | input--route-template-short | unit | `__tests__/cam-187-meas-1-gaps.test.ts` | pass |
| AC-1 (toRouteTemplate multi-segment) | input--route-template-multi | unit | `__tests__/cam-187-meas-1-gaps.test.ts` | pass |
| AC-1 (toRouteTemplate root) | input--route-template-root | unit | `__tests__/cam-187-meas-1-gaps.test.ts` | pass |
| AC-1 (toRouteTemplate camp slug example) | input--route-template-camp | unit | `__tests__/cam-187-meas-1-gaps.test.ts` | pass |
| AC-1 (toRouteTemplate static multi-segment) | input--route-template-static | unit | `__tests__/cam-187-meas-1-gaps.test.ts` | pass |
| AC-1 (toRouteTemplate AC example) | input--route-template-ac-example | unit | `__tests__/cam-187-meas-1-gaps.test.ts` | pass |
| AC-1 (VitalsReporter renders null) | page--vitals-reporter-null | unit | `__tests__/cam-187-meas-1-gaps.test.ts` | pass |
| AC-1 (VitalsReporter sendBeacon call) | page--vitals-reporter-beacon | unit | `__tests__/cam-187-meas-1-gaps.test.ts` | pass |
| AC-1 (VitalsReporter all 5 metrics) | page--vitals-reporter-5-metrics | unit | `__tests__/cam-187-meas-1-gaps.test.ts` | pass |
| AC-1 (VitalsReporter no PII in payload) | page--vitals-reporter-no-pii | unit | `__tests__/cam-187-meas-1-gaps.test.ts` | pass |
| AC-1 (sendBeacon SSR guard) | page--vitals-reporter-ssr | unit | `__tests__/cam-187-meas-1-gaps.test.ts` | pass |
| AC-1 (POST /api/vitals no userId) | form--vitals-no-userid | integration | `__tests__/cam-187-meas-1-gaps.test.ts` | pass |
| AC-1 (POST /api/vitals no email) | form--vitals-no-email | integration | `__tests__/cam-187-meas-1-gaps.test.ts` | pass |
| AC-1 (POST /api/vitals no phone) | form--vitals-no-phone | integration | `__tests__/cam-187-meas-1-gaps.test.ts` | pass |
| AC-1 (POST /api/vitals no x-forwarded-for) | form--vitals-no-ip-header | integration | `__tests__/cam-187-meas-1-gaps.test.ts` | pass |
| AC-1 (POST /api/vitals no content-length) | form--vitals-no-content-length | integration | `__tests__/cam-187-meas-1-gaps.test.ts` | pass |
| AC-1 (POST /api/vitals cwv log) | form--vitals-cwv-log | integration | `__tests__/cam-187-meas-1-gaps.test.ts` | pass |
| AC-1 (POST /api/vitals IP not in log) | form--vitals-ip-not-logged | integration | `__tests__/cam-187-meas-1-gaps.test.ts` | pass |
| AC-1 (withTiming reference equality) | form--timing-ref-equal | unit | `__tests__/cam-187-meas-1-gaps.test.ts` | pass |
| AC-1 (withTiming single log line) | form--timing-single-log | unit | `__tests__/cam-187-meas-1-gaps.test.ts` | pass |
| AC-1 (withTiming error single log) | form--timing-error-single-log | unit | `__tests__/cam-187-meas-1-gaps.test.ts` | pass |
| AC-1 (withTiming original error instance) | form--timing-error-instance | unit | `__tests__/cam-187-meas-1-gaps.test.ts` | pass |
| AC-2 (loader no deleteMany) | form--loader-no-delete | unit | `__tests__/cam-187-meas-1-gaps.test.ts` | pass |
| AC-2 (loader upsert by email) | form--loader-upsert-email | unit | `__tests__/cam-187-meas-1-gaps.test.ts` | pass |
| AC-2 (loader upsert by nameThSlug) | form--loader-upsert-slug | unit | `__tests__/cam-187-meas-1-gaps.test.ts` | pass |
| AC-2 (loader createMany skipDuplicates) | form--loader-skip-duplicates | unit | `__tests__/cam-187-meas-1-gaps.test.ts` | pass |
| AC-2 (JSON: 65 hosts in meta) | table--loader-host-meta | unit | `__tests__/cam-187-meas-1-gaps.test.ts` | pass |
| AC-2 (JSON: 128 camps in meta) | table--loader-camp-meta | unit | `__tests__/cam-187-meas-1-gaps.test.ts` | pass |
| AC-2 (JSON: hosts array 65) | table--loader-host-count | unit | `__tests__/cam-187-meas-1-gaps.test.ts` | pass |
| AC-2 (JSON: total camps 128) | table--loader-camp-count | unit | `__tests__/cam-187-meas-1-gaps.test.ts` | pass |
| AC-2 (JSON: all slugs non-empty) | table--loader-slugs-present | unit | `__tests__/cam-187-meas-1-gaps.test.ts` | pass |
| AC-2 (JSON: all slugs unique) | table--loader-slugs-unique | unit | `__tests__/cam-187-meas-1-gaps.test.ts` | pass |
| AC-2 (JSON: all emails unique) | table--loader-emails-unique | unit | `__tests__/cam-187-meas-1-gaps.test.ts` | pass |
| AC-3 (baseline capture) | — | staging only | Staging URL verify | not run yet — AC-3 requires real Staging measurement |

## Validation cases (coverage matrix)

### AC-1 — vitals endpoint + VitalsReporter

| Bucket | Test | Result |
|---|---|---|
| normal | valid LCP/INP/CLS/TTFB/FCP payload → 204 | pass |
| null/empty | missing required fields → 400 | pass |
| boundary | value=0 (nonnegative boundary) → 204 | pass |
| boundary | routeTemplate 200 chars → 400 | pass |
| boundary | id 64+ chars → 400 | pass |
| error/validation | invalid metric name → 400 | pass |
| error/validation | NaN value → 400 | pass |
| error/validation | body > 2KB → 400 | pass |
| error/validation | invalid JSON → 400 | pass |
| error/validation | 429 + Retry-After when rate-limited | pass |
| PII | userId/email/phone stripped, never echoed | pass |
| PII | IP never logged | pass |
| slug strip | /campgrounds/my-camp-abc-12345678 → /campgrounds/[slug] | pass |
| slug strip | UUID segment → [id] | pass |
| slug strip | numeric segment → [id] | pass |
| slug strip | static paths unchanged | pass |
| concurrent | different IPs rate-limited independently | pass |

### AC-2 — loader idempotency + data counts

| Bucket | Test | Result |
|---|---|---|
| normal | 65 hosts / 128 camps verified in JSON | pass |
| safety | no deleteMany call in loader source | pass |
| normal | upsert by email (host) / nameThSlug (camp) | pass |
| normal | createMany skipDuplicates for images | pass |
| boundary | all nameThSlug values unique (no duplicate key conflict) | pass |
| boundary | all host emails unique | pass |

### AC-3 — baseline measurement

Justification: AC-3 requires running Lighthouse + recording real query timings on the Staging URL after merge. This AC cannot be proven by automated unit/integration tests — it is a human-verified Staging observation. Status: not measured (see `story.md` self-verify).

## Coverage

On **importable MEAS-1 code** (files testable without a live DB or DOM runtime):

| File | Statements | Branches | Functions | Lines |
|---|---|---|---|---|
| `app/api/vitals/route.ts` | 100% | 93.75% | 100% | 100% |
| `lib/validations/vitals.ts` | 100% | 100% | 100% | 100% |
| `lib/route-timing.ts` | 100% | 100% | 100% | 100% |
| `lib/rate-limit.ts` | 100% | 100% | 100% | 100% |
| `lib/prisma.ts` | 81.25% | 47.05% | 50% | 80% |
| **aggregate** | **95.38%** | **77.27%** | **85.71%** | **95.23%** |

**Overall aggregate on importable files: 95.38% statements — above the 80% gate.**

Untestable paths (honest justification, not skipped silently):

- `route.ts` line 70 — `?? 'Invalid payload'` fallback: zod always returns at least one issue on failure; this branch is a defensive dead-branch that cannot be triggered by any real input. Classified: Info.
- `lib/prisma.ts` lines 26-29 — `$on('query', ...)` callback body: only reachable with `PRISMA_QUERY_LOG=1` AND a live Prisma client connected to a DB. Cannot be tested without a real DB connection. Classified: Info.
- `components/vitals-reporter.tsx` — `"use client"` React component using `useEffect` + dynamic `import('web-vitals')`: not importable in a node test environment (no jsdom, no web-vitals browser runtime). Behavioral contracts (slug stripping, sendBeacon call, renders null, no PII) are proven via source-inspection tests in `cam-187-meas-1-gaps.test.ts` — consistent with the existing project pattern (cam-181/182/184 all use readFileSync). Classified: Info.
- `scripts/load-mock-staging.mjs` — executes Prisma+bcrypt, requires a live DB. Static contracts (no deleteMany, upsert keys, fixture counts) proven via source-inspection + JSON parse in `cam-187-meas-1-gaps.test.ts`. Classified: Info.

## Links

`story.md` · `tech.md` · `.claude/rules/qa.md` · `__tests__/cam-187-meas-1.test.ts` · `__tests__/cam-187-meas-1-gaps.test.ts`

## Changelog

- v1 (2026-06-26) — created; 69 gap-fill tests added; full suite 2849/2849 green; coverage 95.38% on importable files
