---
name: ai-chat-improve
description: Weekly, subscription-powered improvement cycle for the น้องกองไฟ AI chat — pull real turn logs, analyze misses in the IDE (no paid API), ship one FIX, prove it, deploy. The SORT+FIX half of the Capability Loop.
---

# ai-chat-improve — weekly AI chat improvement cycle (SORT + FIX)

## Overview

The assistant used to be tuned from owner screenshots. This skill replaces that with a cheap, repeatable weekly loop: real usage is captured by `AssistantTurnLog` (S2/SEE, CAM-509), this skill **pulls** a window of it, **you (Claude, in the IDE, on the flat-rate subscription) analyze** the misses — no paid API call for the analysis — propose and implement **one** FIX, **prove** it with the golden eval, and **deploy** through the normal promote flow. The only paid step is the weekly eval (~$0.05); the runtime chat serving cost is separate and unchanged (the subscription cannot serve production).

Run it about once a week, or sooner after a visible regression.

Read first: `docs/research/ai-chat/campvibe-capability-loop-plan.md` (the SEE→SORT→FIX→PROVE design) · `.claude/rules/qa.md` (verify an LLM change behaviorally, not by a diff read — CAM-500) · `.claude/rules/code.md` (guard Thai substring matching — CAM-501/503).

## Quick Reference

The five steps, in order:

1. **PULL** — `npm run ai:pull-turns` (or `node scripts/ai-triage/pull-turns.mjs [days]`) → writes `scratch/ai-triage-export.json` (summary + every miss turn + a clean sample). Reads the local dev DB by default; refuses a prod-looking DB unless explicitly overridden.
2. **ANALYZE** — read the export. Open-code the miss turns into groups (wrong tool · no-chain · zero-result the user meant to find · honest "no data" for a table we don't have · off-topic). Rank by frequency. This is your judgment on the subscription — no LLM call, no `ai:eval` yet.
3. **FIX** — pick the **single** highest-frequency, in-scope group. Route it to one FIX lane (see below). Implement it as one small atomic change with a **strictParams golden case** added for the exact miss (behavioral, per CAM-500).
4. **PROVE** — `npm run ai:eval` (paid, ~$0.05). Confirm core correctness moved the right way, **guardrail stays 100%**, no regression. The guardrail gate (`ai-guardrail-gate`, CAM-507) also blocks the PR automatically.
5. **DEPLOY** — normal flow: PR into `dev` (G3) → batched `dev`→`staging` promote (`/promote-release --to staging`) → G4 → release.

## When to Use

- The weekly (~7-day) improvement cadence for the assistant.
- After a visible regression or a spike in one miss flag.

**NOT for:**

- Building new data tables (Phase 3, schema stories) — those are separate G1/G2 stories, ranked by the demand this skill surfaces.
- The eval harness / gate mechanics themselves — that is CAM-457/506/507.
- Changing runtime serving cost — the subscription analyses the logs; it does not and cannot serve production traffic.

## Prerequisites

- **S2 live** — `AssistantTurnLog` exists and is capturing (CAM-509). On the local dev DB it fills from local dev usage; the richer signal is on staging/prod.
- A DB to read: `DATABASE_URL` (local dev, default) or `AI_TRIAGE_DATABASE_URL` for a staging export. **Prod logs are owner-gated** (real user PII) — the pull script refuses a prod-looking host unless `AI_TRIAGE_ALLOW_PROD=1`, which is used only with explicit owner approval.
- The golden eval + guardrail gate green as your regression net.

## Workflow

### 1. PULL
```
npm run ai:pull-turns            # last 7 days from the dev DB → scratch/ai-triage-export.json
npm run ai:pull-turns 14         # a 14-day window
```
To analyze staging usage instead, set `AI_TRIAGE_DATABASE_URL` to the staging connection string for the one command (never commit it). The script prints only scheme+host of the DB it read — never credentials.

### 2. ANALYZE (subscription, $0)
Read `scratch/ai-triage-export.json`. Start from `summary.missCounts` (the cheap deterministic flags: `zero_result`, `deferred_tool`, `no_tool`), then read the `missTurns` themselves — the deterministic flags only find the obvious misses; the **semantic** ones (wrong tool chosen, an honest "no data" that a table would fix, a mis-parsed Thai place name) you find by reading `userText` + `toolCalls` + `assistantText`. Group them (open coding), count each group, and pick the largest **actionable** one. Write the ranked list into the cycle's notes.

### 3. FIX (one lane, one change)
| Lane | When | Touches |
|---|---|---|
| **L1 prompt / tool-desc** | the model has the tool but chose wrong / didn't chain | `lib/ai/openrouter-client.ts` system prompt, tool descriptions |
| **L2 knowledge pack** | a general-knowledge answer (gear, season) with no table needed | a curated `prisma/data/*.json` + a read-only tool |
| **L3 data table** | a real miss needs data we don't store — becomes a **schema story** (G1/G2), ranked by this cycle's demand, not built here | (separate ticket) |
| **L4 deferred tool** | a capability with no tool yet | (separate ticket) |

Implement exactly one L1/L2 change per cycle. Add a `strictParams` golden case reproducing the miss (behavioral proof — a diff read cannot catch an LLM behavior change, CAM-500). Guard any Thai substring/lexicon matching (boundary/context marker + a red test first, CAM-501/503).

### 4. PROVE (paid, ~$0.05)
`npm run ai:eval` → read the report: core correctness moved the intended way, the new golden case passes, **guardrail = 100%**, nothing regressed. If a guardrail dropped, stop and fix — never ship a guardrail regression.

### 5. DEPLOY
One PR into `dev` (the `ai-guardrail-gate` runs the 6 guardrails on the real model automatically). Then the normal batched promote to staging (G4) and release (G5). Record the cycle's ranked misses + the one fix in the PR body so the next cycle sees the trend.

## Cost model (the point of this skill)

- **Analysis / triage:** $0 — done by Claude in the IDE on the flat-rate subscription, reading a file. No automated paid-LLM miner.
- **Eval (PROVE):** ~$0.05 once per cycle (weekly), plus ~$0.005 per lib/ai PR for the guardrail gate.
- **Runtime serving:** unchanged — every real user turn still calls the paid production model; the subscription cannot serve it. Better prompts/fewer tool rounds can lower this *indirectly*.

## PDPA / data handling

`AssistantTurnLog.userText` is real user input (personal data). Handle the export as sensitive: it lives in `scratch/` (gitignored), is never committed, never pasted into an external service, and `userId` is only ever a salted hash in the row. Retention is 90 days (`deleteTurnLogsOlderThan`); run it as part of the cycle if a cron isn't doing it. Prod logs are pulled only with explicit owner approval.

## Reference Files

- `scripts/ai-triage/pull-turns.mjs` — the PULL step (deterministic, no LLM).
- `lib/ai/turn-log.ts` — the S2 capture + `deleteTurnLogsOlderThan` retention helper.
- `scripts/ai-eval/*` + `npm run ai:eval` — the PROVE step (golden eval + core-vs-deferred verdict, CAM-506).
- `.github/workflows/ai-guardrail-gate.yml` — the blocking guardrail gate (CAM-507).
- `docs/research/ai-chat/campvibe-capability-loop-plan.md` — the full loop design.

## Verify (exit criteria)

- [ ] Pulled a real window; ranked the misses by frequency from the actual turns (not a guess).
- [ ] Exactly one atomic FIX shipped, with a strictParams golden case reproducing the miss.
- [ ] `npm run ai:eval`: intended movement + guardrail 100% + no regression.
- [ ] Deployed via the normal PR→dev→staging flow; cycle notes (ranked misses + the one fix) recorded in the PR.
- [ ] No prod log pulled without explicit owner approval; the export stayed in `scratch/`, uncommitted.
