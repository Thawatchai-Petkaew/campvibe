---
description: Hand a free-form request to the Camper delivery team (ad-hoc, beyond the fixed commands)
---
`/camper "<anything>"` — give the orchestrator a free-form request that the three fixed commands (`/new-feature`, `/status`, `/release`) don't cover: investigate, fix, refactor, analyze, plan, or a small change.

The orchestrator (`.claude/agents/orchestrator.md`):
1. reads the request + project context (`docs/project/*`, `CLAUDE.md`, relevant `std/*`)
2. runs lightweight Discovery to scope it → proposes/acts via the normal gates G1–G5
3. respects the **Camper Agent** autopilot flag (`npm run camper status` — auto-decide G1–G4 if ON) and the **cost rule** (any monetary cost → stop and ask)

For a brand-new feature with a clear requirement, `/new-feature` is still the front door; use `/camper` for everything in between.

**Also from Telegram:** any message to the bot that isn't a gate reply is routed here as an ad-hoc request (via `repository_dispatch` → `camper-adhoc` workflow → headless orchestrator, draft PR only).
