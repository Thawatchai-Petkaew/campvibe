# e2e — Playwright Visual Regression + Axe A11y (CAM-230 B4)

Advisory mechanical reviewer that catches visual/spacing/a11y drift that grep
guards and prose review miss. **Never blocks a merge gate** — the CI job runs
with `continue-on-error: true`.

## What is in here

| File | Purpose |
|---|---|
| `preview.visual.spec.ts` | Screenshot regression of `/preview` (full-page + viewport) |
| `preview.a11y.spec.ts` | Axe wcag2a/wcag2aa audit of `/preview` and `/` |

## Running locally

```bash
# Install Playwright browsers (one-time):
npx playwright install chromium

# Run all e2e tests (builds the app first, then starts it):
npm run test:e2e

# Run only the a11y tests (faster — no screenshots):
npx playwright test e2e/preview.a11y.spec.ts

# Update visual baselines after intentional design changes:
npx playwright test --update-snapshots
```

> `npm run test:e2e` is separate from `npm test` (vitest). They do not share
> config or pick up each other's specs.

## Baseline workflow (cross-OS)

Screenshots generated on macOS differ from CI Linux due to sub-pixel
anti-aliasing and font hinting, and `toHaveScreenshot()` running with
`CI=true` (set in `.github/workflows/ci.yml`) hard-fails — rather than
auto-creating — when no baseline exists for the current OS/project. Since
only macOS (`-darwin`) baselines are committed today, CI (Linux, `-linux`)
has no baseline to compare against.

**CAM-261: `preview.visual.spec.ts` handles this automatically.** Each
screenshot assertion checks whether the platform-correct baseline file
exists first (`test.info().snapshotPath(name, { kind: 'screenshot' })`):

- **Baseline present** → real pixel comparison runs; a genuine visual
  regression still fails the check (advisory, `continue-on-error: true`).
- **Baseline absent** (today's state on CI) → the assertion is skipped and a
  report-only screenshot is captured instead, so a missing cross-OS baseline
  never fails the job. This does not touch `preview.a11y.spec.ts` — a11y
  assertions always run for real.

To upgrade from report-only to a real Linux comparison, commit a Linux
baseline:

1. **Preferred — generate baselines in CI/Linux** (eliminates the OS gap):
   - Push a branch; the `visual-a11y` CI job runs Playwright in Linux.
   - Download `playwright-report` from the CI artifacts.
   - Copy the generated `.png` files from `e2e/preview.visual.spec.ts-snapshots/`
     into the repo and commit them.

2. **Acceptable — commit macOS baselines now, rely on advisory nature**:
   The existing macOS baseline (if generated locally with
   `npx playwright test --update-snapshots`) is committed as-is. CI will
   report pixel diffs as advisory failures (non-blocking). A teammate running
   on Linux can refresh the baselines at any time.

## Configuration

`playwright.config.ts` at the project root:

- `testDir: 'e2e'` — scoped to this directory only.
- `webServer` — builds + starts the production Next.js app (`npm run build && npm run start`).
- `maxDiffPixelRatio: 0.02` — up to 2% of pixels may differ.
- `threshold: 0.2` — per-pixel colour distance tolerance.
- `animations: 'disabled'` — CSS transitions/animations frozen for stable shots.
- Single `chromium` project — keeps the advisory job lean.

## Known a11y findings

As of CAM-261, both `/` and `/preview` clear the advisory axe scan with no
critical/serious violations:

- `/` (home) `select-name` (critical) — fixed in CAM-231 (`aria-label` added
  to `SortDropdown`'s `SelectTrigger`).
- `/preview` `select-name` (critical) — fixed in CAM-261 (`aria-label` added
  to the 3 example `SelectTrigger`s) + `aria-prohibited-attr` (serious) on the
  color-swatch `<div aria-label>` — fixed by adding `role="img"` (a generic
  `<div>`/`role="generic"` does not support `aria-label`; `role="img"` does).

Any new violation surfaced going forward is a real regression — check the
`playwright-report` artifact.

## CI job

The `visual-a11y` job in `.github/workflows/ci.yml`:
- Runs independently of `quality-gate` (does not block merge).
- `continue-on-error: true` — a flake or pixel diff produces a warning, not
  a gate failure.
- Uploads `playwright-report/` as a CI artifact so diffs are reviewable.
