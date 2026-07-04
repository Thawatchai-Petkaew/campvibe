# Model-Tier Trial — 4-tier assignment vs single-tier baseline

> Owner decision 2026-07-04: adopt the 4-tier model assignment as a **trial over the next 2-3 stories**, score every story on the dimensions below, then compare against the pre-trial baseline and decide whether to lock, adjust, or revert. Reversal cost = frontmatter lines only.

## Tier assignment (in effect from this commit)

| Tier | Assignment | Rationale |
|---|---|---|
| **Claude Fable 5** (inherit, no override) | Orchestrator · ADR/architecture trade-off analysis · gate-reject & rework analysis · retro → rule promotions | Errors here have no deterministic downstream check and the widest blast radius |
| **Opus 4.8** (`model: opus`) | product-owner · analyst · architect · designer · security (spec authoring, G2 design, security review, G3 reviewer duty) | Judgment-heavy but bounded; independent verifier should be ≥ the builder (PatchDiff: ~30% of plausible patches behaviorally wrong) |
| **Sonnet 5** (`model: sonnet`) | frontend · backend · qa · devops (build execution on v2-spec stories) | Proven track record: entire pre-trial estate was Sonnet-built under tight specs — CI first-pass green throughout, 3 proactive spec-vs-reality catches |
| **Haiku 4.5** (per-dispatch `model` param only) | Genuinely mechanical agent tasks only (log scans, file inventories, format sweeps) | Narrow slot — most mechanical work here is scripted, not agent-run; do not force usage |

**Escalation ladder:** a story that trips the circuit breaker (2 gate rejections) or whose spec fails audit escalates the build one tier. The `effort` dial is the cheaper first lever before changing tiers.

## Scorecard — fill one row per story (trial and baseline)

| Dim | Metric | Source |
|---|---|---|
| Cost | subagent tokens (per tier + total) · $/story | task usage / OTel |
| Speed | dispatch→PR wall time · PR→Done lead time | timestamps |
| Outcome quality | CI first-pass per check · rework rounds (`regressionRound`) · reviewer findings (count × severity) · escaped defects ≤7 days post-Done · tests added + coverage-on-diff | CI, ticket DB, PR |
| Judgment quality | proactive spec-vs-reality catches · STOP-rule invocations (appropriate y/n) · deviations self-reported vs discovered later | agent report vs post-hoc |
| Owner burden | taps/questions per story · packet time-to-decision | gate log |

## Baseline (pre-trial, role agents = Sonnet via legacy frontmatter; annotate caveats)

| Story | Build time | Tokens | CI 1st pass | Rework | Proactive catches | Taps | Notes |
|---|---|---|---|---|---|---|---|
| CAM-269 verified-stay gate | ~19 min | ~254k | ✓ | 0 | 1 (ticket premise wrong — gate pre-existed, real gap elsewhere) | 1 | migration up/down tested |
| CAM-268 price/fee/policy | ~25 min | ~311k | ✓ | 0 | 1 (feeInfo free-text vs atomic; stale pricing invariant) | 1 | honest split (edit UI → CAM-341) |
| CAM-56 blocked dates | ~19 min | ~323k | ✓ | 1 | 1 (`createdBy` field in ticket absent from schema) | 2 | rework = AC-6 product decision (warn→reject), not model fault |
| CAM-55 month calendar | ~18 min | ~238k | ✓ | 0 | 1 (stale 3-source comment vs final spec; verified CAM-302/303 unbuilt) | 1 | ran with explicit `model: sonnet` (the "pilot") |

## Trial rows (next 2-3 stories — fill as they complete)

| Story | Tier map | Build time | Tokens/tier | CI 1st pass | Rework | Findings | Catches | Taps | Escaped defects | Notes |
|---|---|---|---|---|---|---|---|---|---|---|
| CAM-342 model tier on map | spec=opus · build=sonnet · orch=fable | spec ~5 min · build ~23 min · G1→Done same day | opus 133k · sonnet 279k · total ~412k | ✓ all checks | 0 | 0 blocking | **1 major** (spec Seams missed 4 pipeline files — builder traced render path, extended additively, disclosed) | 3 (G1 · G3 packet · staging visual) | 0 (7-day window open) | first run of full new machinery: files-as-SoT spec PR, pointer dispatch, G3 exception-first packet, standard-class G2 fold-in. Process bug found: agents lack STATUS_TOKEN for gate-raise → moved to orchestrator |

## Decision criteria (compare trial vs baseline)

- Quality must not regress: CI first-pass rate, rework rounds, escaped defects — no worse than baseline.
- Judgment behaviors preserved: proactive catches + appropriate STOP usage still occur.
- Cost/speed: report the deltas honestly; the owner weighs them.
- Any single severe escape attributable to tier choice → demote that tier assignment immediately (don't wait for the trial to end).
