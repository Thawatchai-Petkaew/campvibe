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
anti-aliasing and font hinting. The advisory CI job handles this gracefully
(`continue-on-error: true`), but for clean committed baselines:

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

3. **First CI run with no baseline** — Playwright creates the snapshots on
   the first run and then fails with "screenshot is missing" on the
   _next_ comparison run. To bootstrap from CI:
   - Set `UPDATE_SNAPSHOTS=true` once in the CI job (or run locally and commit).
   - After that, the job compares against committed baselines.

## Configuration

`playwright.config.ts` at the project root:

- `testDir: 'e2e'` — scoped to this directory only.
- `webServer` — builds + starts the production Next.js app (`npm run build && npm run start`).
- `maxDiffPixelRatio: 0.02` — up to 2% of pixels may differ.
- `threshold: 0.2` — per-pixel colour distance tolerance.
- `animations: 'disabled'` — CSS transitions/animations frozen for stable shots.
- Single `chromium` project — keeps the advisory job lean.

## Known a11y findings (as of CAM-230 B4 first run)

These are real findings surfaced by the advisory check. They do not block CI
but should be tracked as follow-up work:

| Page | Impact | Rule | Description |
|---|---|---|---|
| `/` (home) | critical | `select-name` | One or more Radix `<select>` trigger buttons have no accessible label. The Select component renders a `role="combobox"` without `aria-label` or a wrapping `<label>`. Follow-up: add `aria-label` props to all standalone Select inputs (sort/filter controls on the home page). |

`/preview` passed with no critical/serious violations on first run.

## CI job

The `visual-a11y` job in `.github/workflows/ci.yml`:
- Runs independently of `quality-gate` (does not block merge).
- `continue-on-error: true` — a flake or pixel diff produces a warning, not
  a gate failure.
- Uploads `playwright-report/` as a CI artifact so diffs are reviewable.
