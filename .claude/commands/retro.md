---
description: Run a retrospective on a closed story — distill lessons into the ledger and propose rule promotions (the Scout team's continuous-learning loop)
---
`/retro <CAM-###>` — run the `retro` skill (`.claude/skills/retro/SKILL.md`) on a **closed** story so the Scout sub-agents actually get smarter.

- `/retro CAM-201` — one story · `/retro CAM-201 CAM-198` — a batch · `/retro` — stories Done since the last ledger entry.
- Also reachable via `/camper "retro <CAM-###>"`.

What it does (manual only — no auto-trigger; the owner runs it and approves promotions):

1. Mines durable evidence — `git diff`/PR, the Linear issue + **comments** (owner gate feedback), `docs/delivery/<…>/<story>/` artifacts.
2. The orchestrator distills 0–N lessons (`role · type · mistake→rule · CAM provenance · generality`).
3. Appends each to the `docs/delivery/LESSONS.md` ledger.
4. Proposes promotions into `.claude/rules/<role>.md` (`## Common Rationalizations` row / `## Standards` bullet, citing the CAM) → **owner approves** → applied; ledger flips to `promoted`.

Then Iron Rule #4 closes the loop: the next dispatch of that role reads the updated rule before working.
