---
description: Toggle / inspect the Camper Agent autopilot (on | off | status)
---
Control the **Camper Agent** — the owner's autonomous decision proxy that approves gates G1–G4 on your behalf and escalates G5 / security / irreversible / any-cost (see `.claude/agents/camper-agent.md`).

This is the same flag as the 🧠 **Camper** toggle in the `/status` "Gates need you" pane (DB: `DeliveryConfig` singleton).

- `/camper-agent on` → `npm run camper on` — autopilot ON
- `/camper-agent off` → `npm run camper off` — every gate waits for you
- `/camper-agent status` → `npm run camper status`

Run the matching `npm run camper <arg>`, then confirm the new state back to the user. The script toggles the DB in the configured `DATABASE_URL`; for the deployed system, the `/status` toggle writes the prod DB (single source of truth read by the headless orchestrator).
