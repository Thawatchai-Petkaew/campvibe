---
name: performance-optimization
description: Standard for frontend + backend performance — measure before you fix, never guess the bottleneck. Use when touching render paths, public pages, or hot endpoints. Use when Core Web Vitals or a performance budget are at stake. Use when fixing measured slowness (N+1, unbounded fetch, re-renders). Memory for the Frontend, Backend, and QA roles; pairs with .claude/rules/seo.md (public page/CWV), .claude/rules/code.md, .claude/rules/architecture.md (N+1), and DESIGN.md.
---

# Performance Optimization (Frontend + Backend)

## Overview

Code that feels slow loses users before they ever reach the value. Performance is a budget with a hard ceiling, not a vibe — you measure first, find the real bottleneck with a profiler, fix that exact spot, measure again, and add a guard so it never silently regrows.

## Quick Reference

**The loop (always in order):**

1. **Measure** — synthetic (Lighthouse/PageSpeed) + real-user (web-vitals). No number? Write "not measured".
2. **Identify** — find the real bottleneck with a profile, not a guess.
3. **Fix** — change that exact spot only.
4. **Verify** — re-measure; compare before/after.
5. **Guard** — add a test/monitor so it cannot silently regrow.

**Core Web Vitals (field p75 targets):**

| Metric | Target |
|---|---|
| LCP | ≤ 2.5s |
| INP | ≤ 200ms |
| CLS | ≤ 0.1 |

**Performance budget (defaults):**

| Budget | Ceiling |
|---|---|
| JS bundle / route | < 200KB gzipped |
| CSS | < 50KB |
| Image | < 200KB/image |
| API p95 | < 200ms |

**Metric honesty:** no data from a tool → label "not measured" / "potential". Never fabricate a number.

## When to Use

- Touching anything that affects render, a public-facing page, or a hot endpoint
- Working on a page where Core Web Vitals matter (pairs with `.claude/rules/seo.md`)
- Fixing measured slowness — N+1 queries, unbounded fetches, excess re-renders
- A route or image risks exceeding the performance budget

**NOT for:**

- Diagnosing a failure happening right now — use the debugging methodology in `.claude/rules/code.md`
- Making production behavior visible (logging/metrics/tracing) — use `.claude/rules/observability.md`
- Query shape and data-access architecture in general — use `.claude/rules/architecture.md`

## Prerequisites

Read first: this file · `.claude/rules/seo.md` (for any public page where CWV apply) · `.claude/rules/api.md` (for the API p95 budget) · `DESIGN.md` (image/layout idioms that protect CLS). Have a measurement tool ready before you start — web-vitals in the app and Lighthouse/PageSpeed for synthetic; without one you can only report "not measured".

## Principles

- **Measure → Identify → Fix → Verify → Guard** — measure (synthetic + real-user) → find the real bottleneck with a profile → fix the exact spot → re-measure → guard against regression (test/monitor).
- **Metric honesty** — if you have no data from a tool, write "not measured" and label it "potential". Never fabricate result numbers.
- **There is a performance budget** — the ceiling is explicit. Hitting the ceiling means fix it, not let it grow quietly.

## Standards

### 1. Core Web Vitals (public / user-visible pages)

- **LCP ≤ 2.5s · INP ≤ 200ms · CLS ≤ 0.1** (field p75 targets). Measure with web-vitals + Lighthouse/PageSpeed before calling it passing.

### 2. Performance budget (defaults — tune to reality)

- JS bundle per route < 200KB gzipped · CSS < 50KB · image < 200KB/image · API p95 < 200ms (see `.claude/rules/api.md`).

### 3. Anti-patterns to profile and hunt down

- **N+1 query** → `include`/`select`/batch (see `.claude/rules/architecture.md`).
- **unbounded fetch** → always paginate + limit.
- **unoptimized image** → `next/image` + explicit width/height (prevents CLS) + responsive sizes + lazy.
- **excess re-render** → stabilize ref/props; use `React.memo`/`useMemo` **only where a profile proves it pays off** (don't memo blindly).
- **missing cache** for static / frequently-read data → cache-control + revalidate.

### 4. Fix framework

- Know the rendering model before recommending an idiom — Next.js App Router: Server Component is the default, stream/Suspense, `dynamic()` import for client-heavy code; always re-measure after the fix and add a guard.

## Examples

**N+1 → batched query**

```ts
// ❌ N+1: one query per campsite to load its reviews
const sites = await prisma.campsite.findMany();
for (const s of sites) {
  s.reviews = await prisma.review.findMany({ where: { campsiteId: s.id } });
}

// ✅ one query, relation included
const sites = await prisma.campsite.findMany({
  include: { reviews: true },
});
```

**Metric honesty — measured vs guessed**

- ✅ "LCP = 2.1s (Lighthouse mobile, p75 field via web-vitals), under the 2.5s target."
- ❌ "LCP is around 2s now, feels much faster." (no tool, no number = fabricated; write "not measured / potential" instead.)

## Reference Files

- `.claude/rules/observability.md` — making the runtime behavior measurable (logging/metrics/tracing) that feeds real-user numbers.
- `.claude/rules/api.md` — the API p95 < 200ms budget and endpoint contracts.
- `.claude/rules/code.md` — debugging methodology for a failure happening right now (vs optimizing a measured-slow path).
- `.claude/rules/seo.md` — Core Web Vitals on public pages.
- `DESIGN.md` — image (`next/image` width/height), layout, and motion idioms that protect CLS/INP.

## Next Steps

A verified performance budget (CWV measured against targets, route bundle and API p95 within budget, before/after + guard in place) is an input to the pre-prod gate — it feeds the `quality-gate` performance scorecard before the story is promoted toward Released.

## Common Rationalizations

| Rationalization | Reality |
|---|---|
| "Import the icon/util lib with `import * as X`." | A wildcard/barrel import ships the whole library into the client bundle (lucide = 1414 icons / 173 KB = 53% of the route's First-Load JS). Use named imports; confirm the heavy chunk with `ANALYZE=1 build` before guessing (CAM-200). |
| "We moved to `next/image`, so images are optimized." | `next/image` lazy-loads by default — the LCP/above-the-fold image needs `priority` (eager + fetchpriority) or LCP stalls on resource-load-delay. Set it on the first ~N cards only, never all (CAM-199). |
| "I know where the bottleneck is, just optimize it." | Guessing wastes effort on the wrong spot. Profile to find the real one first. |
| "It feels faster now / the CWV improved." | No evidence is not a result. State measured vs potential explicitly. |
| "Memo/useCallback everywhere is safer." | Blanket memoization adds cost and bugs. Only where a profile says it pays off. |
| "Fixed it, shipping it." | A fix with no re-measure or guard silently regresses. Verify + Guard. |
| "Static images/sprites don't need cache tuning." | Assets swapped at runtime (e.g. `background-image` frame cycling) under the `/public` default `Cache-Control: max-age=0, must-revalidate` revalidate over the network on every swap → a blank flash, visible on deployed envs but not localhost. Serve runtime-swapped static assets `immutable` (long max-age) via `next.config` headers and preload+decode animated frames (CAM-201). |

## Verify (exit criteria)

- [ ] Public pages touched: CWV meet targets (actually measured), or state "not measured" honestly
- [ ] No N+1 / unbounded fetch in the path you changed
- [ ] Images optimized + the touched route's bundle is within budget
- [ ] Measured before-and-after + a guard (test/monitor) prevents regression
