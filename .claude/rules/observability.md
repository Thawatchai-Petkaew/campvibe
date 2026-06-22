---
name: observability-and-instrumentation
description: Standard for making CampVibe's production behavior visible and diagnosable. Use when adding logging, metrics, tracing, or alerting; when shipping any feature that runs in production and you need evidence it works; or when an incident was hard to diagnose from the data on hand. Memory for the Backend and DevOps roles; pairs with .claude/rules/ops.md, .claude/rules/api.md, .claude/rules/security.md.
paths:
  - app/api/**
  - lib/**
---

# Observability & Instrumentation

## Overview

Code you can't observe is code you can't operate. Telemetry is written alongside the feature, the same way tests are — ship a feature without it and the first user-reported bug becomes archaeology instead of a query.

## Quick Reference

Instrument in this order — each step answers the previous one's gap:

| Step | Do | Rule |
|---|---|---|
| 1 | Write the 2–4 questions on-call asks when this breaks | No question → no signal |
| 2 | Structured JSON logs + correlation ID, propagated across boundaries | Never log secrets/tokens/PII; allowlist fields |
| 3 | RED (rate/errors/duration) + USE metrics, latency as p95/p99 | Never averages; keep labels bounded (no `userId`/`email`/`id`) |
| 4 | OpenTelemetry traces, context propagated across async + outbound | Keep secrets/PII out of span attributes |
| 5 | 2-tier alerts — **page** (act now) / **ticket** (act this week) | Alert on symptoms + link a runbook; never on CPU/disk |
| 6 | Pre-prod observability gate (`.claude/rules/ops.md`) before promote | Logs flow · metrics appear · alerts tested · tracing end-to-end |

## When to Use

- Building any feature with a side-effect: API route, server action, background job, cron, external integration
- Adding or reviewing alerting rules
- Reviewing a PR that adds I/O, retries, queues, or cross-service calls
- Before any deploy (the pre-prod observability gate in `.claude/rules/ops.md`)

**NOT for:**

- Diagnosing a failure happening right now — use the debugging methodology in `.claude/rules/code.md` (observability is what makes that fast next time)
- Profiling measured slowness — use `.claude/rules/performance.md`
- Release rollout / rollback triggers — see `.claude/rules/ops.md`

## Prerequisites

Read first: this file · `.claude/rules/security.md` (what must never be logged — secrets/tokens/PII) · `.claude/rules/ops.md` (the pre-prod observability gate this feeds). Know the side-effect surface you're instrumenting (`app/api/**`, `lib/**`) and the 2–4 on-call questions it must answer before writing a single signal.

## Process

### 1. Define "working" before instrumenting

Telemetry without a question is noise. Before adding anything, write the 2–4 questions an on-call engineer will ask when this breaks; every signal must answer one of them. If you can't name the questions, you'll log everything and learn nothing.

### 2. Pick the right signal for each question

Metrics tell you **that** something is wrong, traces tell you **where**, logs tell you **why**.

| Signal | Answers | Example |
|---|---|---|
| Structured log | "What happened in this specific case?" | `booking_failed` with a reason code |
| Metric | "How often / how fast, in aggregate?" | p99 latency of an endpoint |
| Trace | "Where did the time go?" | one slow request, broken down by hop |

### 3. Structured logging

- Emit JSON with stable, queryable field names — never string interpolation. Consistent levels (error/warn/info/debug).
- Attach a **correlation ID** to every line and propagate it on every outbound call.
- Never log secrets, tokens, or PII (see `.claude/rules/security.md`). Allowlist fields; never dump whole request/response bodies.

### 4. Metrics

- **RED** per endpoint/dependency: Rate, Errors, Duration. **USE** per resource: Utilization, Saturation, Errors.
- Record latency as histograms with **p95/p99 percentiles** — never averages (averages hide the tail). Keep label values bounded; never label by `userId`/`email`/`id` (cardinality explosion).

### 5. Tracing and alerting

- Use OpenTelemetry. Propagate context across async boundaries and outbound calls; keep secrets/PII out of span attributes.
- Two alert severities only: **page** (user-facing, act now) and **ticket** (degradation, act this week). Every alert is actionable and links a runbook. Alert on symptoms, never on CPU/disk.

## Examples

Structured log — correlation ID, allowlisted fields, no PII:

```jsonc
// ✅ queryable, correlated, safe
{ "level": "error", "event": "booking_failed", "correlationId": "req_8f3c", "campsiteId": "cs_42", "reason": "slot_taken" }

// ❌ string interpolation + leaked token + raw PII
log.error(`booking failed for user ${email} token=${authToken}`)
```

Alerting — page on the user-facing tail, not the average:

```text
✅ page: p95 latency of POST /api/bookings > 800ms for 5m   → links runbook
❌ alert: avg latency > 500ms                               → average hides the p99 tail; not a symptom users feel
```

## Reference Files

- `.claude/rules/performance.md` — profiling measured slowness (this rule makes it visible; that one fixes it)
- `.claude/rules/ops.md` — the pre-prod observability gate + release rollout / rollback triggers
- `.claude/rules/security.md` — what must never be logged or traced (secrets/tokens/PII)
- `.claude/rules/api.md` — where side-effect routes/actions get instrumented

## Next Steps

Observability is part of the **pre-prod observability gate** in `.claude/rules/ops.md`: before promoting `staging`→`main`, confirm logs flow · metrics appear · alerts are configured and tested · tracing works end-to-end. The gate blocks the promote until those pass.

## Common Rationalizations

| Rationalization | Reality |
|---|---|
| "I'll add logging/metrics later." | Later never comes; the first incident is blind. Instrument with the feature. |
| "The average latency looks fine." | Averages hide the p99 tail where users actually hurt. Use percentiles. |
| "Label by user ID so we can drill in." | Unbounded labels explode cardinality and cost. Keep labels bounded. |
| "Log the whole request to be safe." | That leaks secrets/PII and floods storage. Allowlist fields + correlation ID. |
| "Alert when CPU is high." | CPU isn't a symptom users feel; it pages all night. Alert on user-facing latency/errors. |

## Verify (exit criteria)

- [ ] New side-effect code emits JSON logs with a correlation ID and zero secrets/PII
- [ ] Each endpoint/job exposes RED metrics (rate / errors / duration p95) that are actually queryable
- [ ] No high-cardinality labels
- [ ] Before prod: logs flow · metrics appear · alerts configured and tested · tracing works end-to-end
