---
linear: CAM-179
feature: ai-workflow
epic: ai-delivery-workflow-the-camper (CAM-138)
persona: Admin
artifact: test
owner: qa-engineer
status: Done
version: v1
updated: 2026-06-25
---
# Test — fix Production card link in EnvPickerPanel (CAM-179)

## AC→test matrix

| AC# | test-id | layer | test name | pass/fail |
|---|---|---|---|---|
| AC-1 (prod href = prod URL) | section--env-picker-prod-url-init | unit / source-inspection | PROD_URL is initialised with `\|\|` (not `?? ""`) so an unset env var never resolves to empty string | pass |
| AC-1 (prod href = prod URL) | section--env-picker-prod-url-default | unit / source-inspection | PROD_URL default is the canonical production URL (campvibe.vercel.app) | pass |
| AC-1 (prod href = prod URL) | section--env-picker-prod-url-not-staging | unit / source-inspection | PROD_URL default is NOT the staging URL (campvibe-staging.vercel.app) | pass |
| AC-1 (prod href = prod URL) | section--env-picker-prod-card-href | unit / source-inspection | Production card href is PROD_URL + ENV_PATH (no `\|\| STAGING_URL` fallback) | pass |
| AC-1 (prod href = prod URL) | section--env-picker-prod-no-fallback | unit / source-inspection | Production card href does NOT have the `(PROD_URL \|\| STAGING_URL)` expression | pass |
| AC-2 (staging href unchanged) | section--env-picker-staging-card-href | unit / source-inspection | Staging card href still uses STAGING_URL + ENV_PATH | pass |
| AC-3 / home target (ENV_PATH = "") | section--env-picker-env-path-empty | unit / source-inspection | ENV_PATH is still `""` (both cards open the home page of their env) | pass |

All 7 assertions: pass. 0 failures.

## Validation cases

| Case | AC | what is asserted | result |
|---|---|---|---|
| Normal: PROD_URL uses `\|\|` operator | AC-1 | `envPickerSrc` contains the exact declaration `process.env.NEXT_PUBLIC_PROD_URL \|\| "https://campvibe.vercel.app"` | pass |
| Normal: prod default is canonical prod URL | AC-1 | `envPickerSrc` contains `https://campvibe.vercel.app` | pass |
| Error/validation: prod default is NOT staging URL | AC-1 | the `const PROD_URL` line does not contain `campvibe-staging` | pass |
| Normal: prod card href is direct PROD_URL ref | AC-1 | `envPickerSrc` contains `href={PROD_URL + ENV_PATH}` | pass |
| Error/validation: old `\|\| STAGING_URL` fallback gone | AC-1 | `envPickerSrc` does not contain `(PROD_URL \|\| STAGING_URL)` | pass |
| Normal: staging card href unchanged | AC-2 | `envPickerSrc` contains `href={STAGING_URL + ENV_PATH}` | pass |
| Normal: ENV_PATH is empty string | AC-3 / home | `envPickerSrc` contains `const ENV_PATH = ""` | pass |

No Thai copy assertions required for this fix (no user-visible string changed). No boundary/null/concurrent cases apply — the assertion is against the source constant declarations, not runtime logic with variable input.

## Diff-scope confirmation

`git diff staging -- app/status/map/campsite-overlays.tsx` shows exactly 2 lines changed:

- Line 2156: `const PROD_URL = process.env.NEXT_PUBLIC_PROD_URL ?? ""` → `... || "https://campvibe.vercel.app"`
- Line 2210: `href={(PROD_URL || STAGING_URL) + ENV_PATH}` → `href={PROD_URL + ENV_PATH}`

No visual/CSS/markup/focus-trap change confirmed. No other files in the overlay changed.

## Coverage

Source-inspection tests cover 100% of the 2-line diff (both the constant declaration and the href expression are asserted directly). Runtime coverage is not measured — the Vitest environment is node-only (no jsdom), which is consistent with the rest of the status-map suite. The 7 new assertions fully guard the fix and the staging non-regression; no new uncovered branches were introduced.

## Links

`story.md` (AC/BR) — not present (simple bug fix, no separate story.md authored) · `tech.md` (same folder) · `__tests__/cam-179-env-picker-prod-link.test.ts` · `.claude/rules/qa.md`

## Changelog
- v1 (2026-06-25) — created
