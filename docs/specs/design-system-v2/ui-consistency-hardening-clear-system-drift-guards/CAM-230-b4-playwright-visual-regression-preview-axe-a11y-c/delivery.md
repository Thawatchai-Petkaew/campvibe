---
linear: CAM-230
feature: design-system-v2
epic: ui-consistency-hardening-clear-system-drift-guards (CAM-221)
artifact: delivery
owner: devops
status: In Progress
version: v1
updated: 2026-06-27
---
# Delivery — B4 Playwright visual regression + axe a11y CI (CAM-230)

## Summary

Playwright visual-regression + axe a11y infra wired as an advisory (non-blocking)
CI job. No app/component code was changed — infra and test files only.

## Deps added (devDependencies — no cost)

| Package | Version | Purpose |
|---|---|---|
| `@playwright/test` | ^1.61.1 | Visual snapshot + e2e runner |
| `@axe-core/playwright` | ^4.12.1 | WCAG axe audit inside Playwright |

`npm audit --omit=dev --audit-level=high`: 0 high/critical (3 pre-existing moderate
in postcss/next/next-auth, not introduced by these deps).

## Files created

| Path | Purpose |
|---|---|
| `playwright.config.ts` | Playwright config: `testDir: 'e2e'`, single chromium project, tolerant snapshot thresholds, webServer builds + starts prod app |
| `e2e/preview.visual.spec.ts` | Full-page + viewport screenshot of `/preview`; CSS animations frozen |
| `e2e/preview.a11y.spec.ts` | Axe wcag2a/wcag2aa/best-practice audit of `/preview` and `/`; blocks on critical/serious, logs moderate/minor |
| `e2e/README.md` | Baseline workflow, cross-OS guidance, known a11y findings |
| `e2e/preview.visual.spec.ts-snapshots/preview-full-chromium-darwin.png` | macOS baseline (full-page) |
| `e2e/preview.visual.spec.ts-snapshots/preview-viewport-chromium-darwin.png` | macOS baseline (viewport) |

## Files modified

| Path | Change |
|---|---|
| `package.json` | Added `"test:e2e": "playwright test"` script + `@playwright/test` + `@axe-core/playwright` devDeps |
| `vitest.config.ts` | Added `'e2e/**'` to `exclude` so vitest never picks up Playwright specs |
| `.github/workflows/ci.yml` | Added `visual-a11y` job with `continue-on-error: true` |

## CI job diff summary

New job `visual-a11y` in `.github/workflows/ci.yml`:
- Runs independently (no `needs:` — does not block on quality-gate, does not block quality-gate).
- `continue-on-error: true` — pixel diffs and a11y findings produce a warning annotation + artifact, never a merge gate failure.
- Steps: checkout → setup-node 20 → `npm install` → `npx playwright install --with-deps chromium` → `npm run build` → `npx playwright test` (with `SKIP_BUILD=1` so Playwright's webServer only starts, not rebuilds) → `upload-artifact` of `playwright-report/` (14-day retention).

## Baseline handling

Baselines committed: macOS/darwin chromium (generated locally with `--update-snapshots`).

Cross-OS reality: macOS baselines will produce pixel diffs in CI Linux due to font hinting
and sub-pixel AA. This is expected and handled by `continue-on-error: true`. The diff images
are uploaded as CI artifacts and reviewable. To get Linux-native baselines (cleaner CI signal):
download the `playwright-report` artifact after the first CI run, copy the generated PNGs into
`e2e/preview.visual.spec.ts-snapshots/`, and commit. See `e2e/README.md` for the full workflow.

## Self-verify results

| Check | Result |
|---|---|
| `npm run lint` | 0 errors (242 pre-existing warnings, unchanged) |
| `npm run typecheck` | Clean |
| `npm run check:ds` | PASS (0 violations — `e2e/` is outside the scan path) |
| `npm test` (vitest 76 files) | 3775 tests passed |
| `npm audit --omit=dev --audit-level=high` | 0 high/critical |
| `npx playwright test e2e/preview.visual.spec.ts` | 2 passed (baselines generated, then verified) |
| `npx playwright test e2e/preview.a11y.spec.ts` | 1/2 passed — see a11y findings below |

## A11y findings surfaced (real, advisory)

| Page | Impact | Rule | Finding |
|---|---|---|---|
| `/preview` | none | wcag2a/wcag2aa | PASSED — no critical/serious violations |
| `/` (home) | critical | `select-name` | Radix Select trigger (`role=combobox`) rendered without accessible label on sort/filter controls. Follow-up work needed: add `aria-label` props to unlabeled Select components on the home page. |

The home-page finding is a real a11y gap surfaced by this advisory check. It does not block
the B4 story (advisory-only) but should be tracked as a follow-up story in the
UI Consistency Hardening epic (CAM-221).

## Rollback plan

These are infra/test-only changes. Rollback = revert:
1. `playwright.config.ts` — delete.
2. `e2e/` — delete the directory.
3. `package.json` / `package-lock.json` — remove `@playwright/test` + `@axe-core/playwright` entries; run `npm install`.
4. `vitest.config.ts` — remove `'e2e/**'` from exclude list.
5. `.github/workflows/ci.yml` — remove the `visual-a11y` job block.

No app code, no migrations, no DB changes — rollback has zero risk.

## Next

- AC verified locally per story self-verify criteria.
- Ready for G3 (merge into `staging`) — quality-gate green, CI advisory job confirmed non-blocking.
- After staging deploy: verify `/preview` and CI artifact visible on the PR.
- Follow-up: open a story for the home-page `select-name` a11y violation.
