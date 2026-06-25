---
linear: CAM-179
feature: ai-workflow
epic: ai-delivery-workflow-the-camper (CAM-138)
artifact: tech
owner: frontend
status: Done
version: v1
updated: 2026-06-25
---
# CAM-179 — Tech Spec: fix Production card link in EnvPickerPanel

## Root cause

In `app/status/map/campsite-overlays.tsx` the `EnvPickerPanel` declared:

```ts
const PROD_URL = process.env.NEXT_PUBLIC_PROD_URL ?? "";
```

`??` (nullish coalescing) only replaces `null` / `undefined`; it passes an empty string `""` through unchanged. Because `NEXT_PUBLIC_PROD_URL` is not set in the Vercel environment, the runtime value is `undefined`, which `??` replaces with `""`. The Production card href then used:

```ts
href={(PROD_URL || STAGING_URL) + ENV_PATH}
```

`PROD_URL` was `""` (falsy), so the `||` expression fell back to `STAGING_URL` (`https://campvibe-staging.vercel.app`). The Production card opened Staging instead of Production.

The Staging card (`href={STAGING_URL + ENV_PATH}`) was correct and unaffected.

## Fix — two-line change, surgical

### Line 1: PROD_URL initialisation

```ts
// Before
const PROD_URL = process.env.NEXT_PUBLIC_PROD_URL ?? "";

// After
const PROD_URL = process.env.NEXT_PUBLIC_PROD_URL || "https://campvibe.vercel.app";
```

`||` collapses both `undefined` and `""` to the hard-coded canonical prod URL, following the same pattern as `STAGING_URL` (a module-level constant with no env dependency).

### Line 2: Production card href

```ts
// Before
href={(PROD_URL || STAGING_URL) + ENV_PATH}

// After
href={PROD_URL + ENV_PATH}
```

`PROD_URL` is now always a non-empty string, so the `|| STAGING_URL` fallback expression is removed. The Staging card (`href={STAGING_URL + ENV_PATH}`) is left untouched.

## Files touched

| File | Change |
|---|---|
| `app/status/map/campsite-overlays.tsx` | Line 2156: `?? ""` → `\|\| "https://campvibe.vercel.app"`; line 2210: `(PROD_URL \|\| STAGING_URL) + ENV_PATH` → `PROD_URL + ENV_PATH` |
| `__tests__/cam-179-env-picker-prod-link.test.ts` | New file — 7 source-inspection assertions guarding the fix |

## Guard test (7 assertions)

Added `__tests__/cam-179-env-picker-prod-link.test.ts` using the source-inspection pattern established by the status-map suite (node-only Vitest, no jsdom).

1. PROD_URL declaration uses `||` not `?? ""`.
2. PROD_URL default contains the canonical prod URL (`campvibe.vercel.app`).
3. PROD_URL default does NOT contain the staging URL (`campvibe-staging`).
4. Production card href is `PROD_URL + ENV_PATH` (no `|| STAGING_URL` fallback).
5. Production card href does NOT contain the `(PROD_URL || STAGING_URL)` expression.
6. Staging card href still uses `STAGING_URL + ENV_PATH` (no regression).
7. `ENV_PATH` is still `""` (both cards open the home page of their env).

## Self-verify results

| Check | Result |
|---|---|
| `npm run lint` | 0 errors, 246 warnings (0 new in changed files) |
| `npm run typecheck` | clean (0 errors) |
| `npm test` | 2592 passed (7 new CAM-179 assertions, all green) |
| `npm run check:palette` | PASS (0 violations) |
| `npm run check:ds` | PASS (0 violations) |
| `npm run build` | clean — /status/map builds as dynamic route |

## CWV scorecard

| Metric | Value |
|---|---|
| LCP | not measured (no visual change) |
| CLS | not measured (no layout change) |
| INP | not measured (href attribute change only; no interaction path altered) |

No regressions introduced. The change is a string constant and a href attribute — zero runtime cost.

## QA targets (hand-off)

- **AC-1**: open /status/map on Staging, open the "ผลผลิต Scout Team" modal (HUD env picker button). Click the Production card. Confirm the new tab opens `https://campvibe.vercel.app` (the production app), NOT `https://campvibe-staging.vercel.app`.
- **AC-2**: in the same modal, click the Staging card. Confirm the new tab opens `https://campvibe-staging.vercel.app`.
- **AC-3**: both cards must open the root (home) path — no sub-path appended.
- Regression: modal open/close, focus trap, close button, backdrop click, and all other HUD overlays must be visually and behaviourally unchanged.
