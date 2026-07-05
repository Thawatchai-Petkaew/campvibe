---
artifact: epic
feature: platform-core
epic: e2e-regression-harness (CAM-46)
status: In Progress
version: v1
updated: 2026-07-05
---
# E2E Regression Harness (CAM-46)

## Why

CampVibe has **zero behavioral tests of the real create/update flows**. Every current Vitest test is
node-env unit / source-inspection — none drives a real form → API → DB → re-render round-trip. That
gap has already cost production-adjacent escapes that a single happy-path E2E would have caught:
`groundType` object-vs-string serialization (CAM-356), the album `images.split` shape break (S4b), and
the upload URL contract (CAM-358). Source-inspection tests cannot see these because the bug lives in
the seam between layers, not inside one function.

The fix is a Playwright E2E harness that logs in as a real seeded host and exercises the actual
host-facing forms against a **local** database, wired into CI as an **advisory** gate first (never a
merge blocker until stability is proven, per `.claude/rules/ops.md` §Gate policy v2). The harness is
deliberately localhost-bound: the main `.env` currently points at the STAGING database, and a
create/delete E2E must never mutate a shared env — a non-negotiable safety guard enforces that.

## KPI

- Behavioral coverage of the host create/update flows: 0 flows → 6 flows guarded (this epic's first
  suite). Regression escapes of the guarded flows after this ships: target 0 (not measured — no
  baseline instrumentation yet).

## Stories

- **CAM-359 — E2E regression suite (harness + first 6 specs + advisory CI)** — stand up the harness
  (Playwright dev-server project · storageState login helper · localhost-only DB guard · idempotent
  seed) and the first 6 regression specs, plus an advisory `e2e-regression` CI job. `status: Todo`.
  class: full.

## Out of scope (epic level)

- Flipping the E2E CI job to blocking (a separate future decision, gated on a stability criterion).
- Visual-regression baselines / cross-browser matrix / prod smoke.
- Suites beyond the first 6 flows (booking, review, search) — follow-on stories under this epic.
