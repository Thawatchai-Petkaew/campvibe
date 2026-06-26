# Retro — <CAM-###> <story title>

Per-story retrospective produced by the `retro` skill. Optional artifact: lands at `docs/delivery/<feature>/<epic>/<story>/retro.md` and feeds `docs/delivery/LESSONS.md`. Keep it short — it is a distillation, not a report.

- **Story / outcome:** <one line — what shipped, Done date, PR #>
- **Evidence read:** <git diff / PR / Linear comments / artifacts that were mined>

## What we learned

One row per lesson. Drop one-offs and anything already in the ledger.

| # | Role(s) | Type (data/perf/image/writing/security/a11y/process) | Mistake → better rule | Generality | Destination |
|---|---|---|---|---|---|
| 1 | | | | reusable / one-off / worldview / visual / process-gap | rule file · memory · docs/context · DESIGN.md · skill |

## Gate feedback (highest-value source)

- **Rejections + owner comments:** <what was sent back and why — the rule that prevents it next time, or `none`>

## Routed this run

- **Promoted to rules (owner-approved):** <`.claude/rules/<role>.md` rows added, each citing CAM-###, or `none`>
- **To orchestrator memory / docs/context / DESIGN / skill:** <list, or `none`>
- **Ledger:** <N rows appended to `docs/delivery/LESSONS.md`>

## Self-verify

- [ ] Lessons mined from durable sources (git/PR/Linear/artifacts), not the live session
- [ ] Each kept lesson has role · type · mistake→rule · CAM provenance · generality
- [ ] Deduped against the ledger (strengthened an existing row instead of twinning where possible)
- [ ] Rule promotions raised to the owner as a diff; ledger statuses set (`proposed`/`promoted`)
