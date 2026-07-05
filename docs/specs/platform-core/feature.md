---
artifact: feature
feature: platform-core (Platform Core & Delivery Quality)
personas: [platform]
status: active
version: v1
updated: 2026-07-05
---
# Platform Core & Delivery Quality

## Overview

Cross-cutting engineering-quality work that has no single end-user persona but protects every
persona's experience: the test harness, CI gates, delivery tooling, and regression safety nets that
keep CampVibe shippable as it grows. The beneficiary is the delivery team (and, transitively, every
Camper/Host/Admin who never meets the bug that was caught before merge).

This feature exists because quality infrastructure is real deliverable work — it carries AC, is gated,
and is tracked on `/status` — but it does not belong under a customer-facing feature lane
(discovery-search, bookings-trips, …). Per `.claude/rules/discovery.md`, tooling/config with no AC
stays a plain PR; work here is carded only when it has testable AC and value (a regression suite, a
new CI gate).

## Scope

- Behavioral regression coverage of the real create/update flows (host forms, spot lifecycle) — the
  E2E harness and its suites.
- CI gate wiring for those suites (advisory-first, per the `.claude/rules/ops.md` §Gate policy v2
  report-mode → clear-to-0 → flip rollout).
- Localhost-only safety guards that keep destructive test runs off shared (staging/prod) databases.

## Epics

- **e2e-regression-harness (CAM-46)** — stand up a Playwright E2E regression harness that drives the
  real create/update flows against a local database, plus the first suite of specs. Starts with
  CAM-359.

## Out of scope

- The pre-merge quality gate mechanics (lint/typecheck/unit-test/build/audit) — owned by
  `/quality-gate` per `CLAUDE.md`.
- The advisory visual-regression + axe job (`design-system-v2` / CAM-230) — a sibling mechanical
  reviewer, kept separate from behavioral E2E.
- Release/promote/env-promotion tooling — `.claude/rules/ops.md` + the `promote-release` skill.
