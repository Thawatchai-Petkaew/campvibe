---
name: performance-optimization
description: Standard for frontend + backend performance — measure before you fix, never guess the bottleneck. Use when touching render paths, public pages, or hot endpoints. Use when Core Web Vitals or a performance budget are at stake. Use when fixing measured slowness (N+1, unbounded fetch, re-renders). Memory for the Frontend, Backend, and QA roles; pairs with .claude/rules/seo.md (public page/CWV), .claude/rules/code.md, .claude/rules/architecture.md (N+1), and DESIGN.md.
---

# Performance Optimization (Frontend + Backend)

## Overview

Code that feels slow loses users before they ever reach the value. Performance is a budget with a hard ceiling, not a vibe — you measure first, find the real bottleneck with a profiler, fix that exact spot, measure again, and add a guard so it never silently regrows.

## When to Use

- Touching anything that affects render, a public-facing page, or a hot endpoint
- Working on a page where Core Web Vitals matter (pairs with `.claude/rules/seo.md`)
- Fixing measured slowness — N+1 queries, unbounded fetches, excess re-renders
- A route or image risks exceeding the performance budget

**NOT for:**

- Diagnosing a failure happening right now — use the debugging methodology in `.claude/rules/code.md`
- Making production behavior visible (logging/metrics/tracing) — use `.claude/rules/observability.md`
- Query shape and data-access architecture in general — use `.claude/rules/architecture.md`

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

## Common Rationalizations

| Rationalization | Reality |
|---|---|
| "I know where the bottleneck is, just optimize it." | Guessing wastes effort on the wrong spot. Profile to find the real one first. |
| "It feels faster now / the CWV improved." | No evidence is not a result. State measured vs potential explicitly. |
| "Memo/useCallback everywhere is safer." | Blanket memoization adds cost and bugs. Only where a profile says it pays off. |
| "Fixed it, shipping it." | A fix with no re-measure or guard silently regresses. Verify + Guard. |

## Verify (exit criteria)

- [ ] Public pages touched: CWV meet targets (actually measured), or state "not measured" honestly
- [ ] No N+1 / unbounded fetch in the path you changed
- [ ] Images optimized + the touched route's bundle is within budget
- [ ] Measured before-and-after + a guard (test/monitor) prevents regression
