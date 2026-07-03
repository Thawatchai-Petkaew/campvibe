---
description: Hand a free-form request to the Camper delivery team (ad-hoc, beyond the fixed commands)
---
`/camper "<anything>"` — give the orchestrator a free-form request that the three fixed commands (`/new-feature`, `/status`, `/release`) don't cover: investigate, fix, refactor, analyze, plan, or a small change.

The orchestrator (`.claude/agents/orchestrator.md`):
1. reads the request + project context (`docs/project/*`, `CLAUDE.md`, relevant `.claude/rules/*`)
2. runs lightweight Discovery to scope it → proposes/acts via the normal gates G1–G5
3. **always raises gates to the human** (no autopilot — there is no autonomous gate approval) and respects the **cost rule** (any monetary cost → stop and ask)

For a brand-new feature with a clear requirement, `/new-feature` is still the front door; use `/camper` for everything in between.

**Also from Telegram:** any message to the bot that isn't a gate reply is routed here as an ad-hoc request (via `repository_dispatch` → `camper-adhoc` workflow → headless orchestrator, draft PR only).

---

## Ticket delivery convention — orchestrator MUST follow when creating/tracking/breaking-down work
The `/status` dashboard reads the self-hosted delivery ticket DB **live** (`lib/delivery/status-adapter.ts` → `/api/tickets` → `buildModel` in `app/status/page.tsx`). Every piece of work is a row in that ticket DB (identifiers still `CAM-###`, one global sequence). Structure every piece of work so it shows correctly:

- **Epic** = a ticket created with `--type epic` and a `featureName` (`node scripts/ticket-sync.mjs create --type epic --title "..." --feature "<feature name>"`). Shows on /status even with 0 stories, grouped by `featureName`.
- **Story** = a ticket created with `--type story --epic <CAM-id-of-the-epic>` (`epicId` FK — a real join, not a title-string match) → appears as a *task inside the epic* on the /status **Epic tab**.
- **Current role on a story** = the `currentRole` column, not a title tag. `/status` still displays it as `[<role>]` in front of the title (synthesized by `lib/delivery/status-adapter.ts`, byte-for-byte the same shape the board already renders) — the STORED title stays clean. Set/change it via `node scripts/ticket-sync.mjs handoff <CAM-id> --role <role> [--state "In Progress"] [--note "..."]`, using the LONG role slugs /status maps to icon + Design→Build→Verify→Ship stage: `architect` `ux-designer` (Design) · `frontend-engineer` `backend-engineer` (Build) · `qa-engineer` `security-reviewer` (Verify) · `devops-release` (Ship) · `product-owner` `analyst`. **UPDATE the role as the story moves** (Designer → Frontend → QA → Security → DevOps) so /status always shows who is on it.
- **Role sub-tasks** (only when a story genuinely needs a granular per-role breakdown) = tickets created with `--type task --epic <the story's own CAM-id>` (a task's "epic" field is really its parent story here — same `epicId` FK, just one level deeper). Usually the rotating role on the story is enough — don't over-scaffold.
- **persona flag** = one of `host | camper | admin | platform` (`--persona <p>` on `create`, drives persona grouping on /status). **feature** = the `--feature "<name>"` string (free text, matches the epic's `featureName`).
- **Ticket body** = the story ticket template (`.claude/templates/story.md`), unchanged: `## Why / ## Story (ในฐานะ <persona> … เพื่อ …) / ## AC` (table `# | Given | When | What the user sees (verbatim Thai copy) | Data/system effect`) `/ ## Rules / ## Data / ## Out of scope / ## Self-verify / ## Links`. No event-codes/class/testid/tech-jargon/em-dash in AC. Verify with `node scripts/ticket-sync.mjs audit` (needs at least `## Story` + `## AC`).
- **Create tickets via `scripts/ticket-sync.mjs create`** (no MCP — there is no Linear MCP call in this loop anymore): `node scripts/ticket-sync.mjs create --type epic|story|task --title "..." [--epic <CAM-id>] [--role <role>] [--persona <persona>] [--feature "<name>"] [--priority <0..4>] [--description-file <path>|--description "..."]`. Pass the filled `story.md` body via `--description-file` so the ticket's `description` matches the template on creation (audit-clean from the start).
- **Tracking / gate movement**: run `node scripts/ticket-sync.mjs set <CAM-id> --state "In Progress"` when a story starts, `--state Done` after merge+staging-verify, `node scripts/ticket-sync.mjs release <CAM-id>` (stamps `releasedAt`) after G5. These legacy-vocabulary `set` calls translate onto the real guarded state machine (`BACKLOG→TODO→IN_PROGRESS→AWAITING_GATE→DONE`, see `scripts/lib/ticket-sync-mapping.mjs`) — move state at **every** gate so the /status Epic tab shows live movement. Each gate is raised to the human with `node scripts/ticket-sync.mjs set <CAM-id> --add-label awaiting-you` (maps to the `raiseGate` verb → state `AWAITING_GATE`); the human clears it — approve via the Telegram tap, the `/status` UI Approve button, or `/status/map` Approve (all converge on the `approve` verb, which flips the ticket back to `IN_PROGRESS`); reject via Telegram "Send Back" or `/status/map` Reject (the `reject` verb — same state, `changesRequested=true`, `regressionRound` bumped, rework by the same role). Ongoing progress shows on the **Epic tab**.
- **Role handoff (MUST use `ticket-sync handoff`)**: when a story moves between roles, the orchestrator MUST run `node scripts/ticket-sync.mjs handoff <CAM-id> --role <role> [--state "In Progress"] [--note "..."]`. This command: (1) sets `currentRole` so /status's synthesized `[role]` tag always reflects the current actor, (2) pushes onto `roleHistory` — an append-only column that **accumulates, never removed**, so workload attribution builds a complete history, (3) fires a Telegram notification to the owner (same call, in-process — no separate step). Do NOT hand-edit the title to fake a role tag — that skips the `roleHistory` write and the Telegram notification, and `ticket-sync audit` flags a `currentRole`/`roleHistory` mismatch as a data-integrity gap.
- **Telegram notify policy** — single source: `lib/delivery/tickets.ts`, the one service module every mutation goes through, calls `buildEventMessage()` (`lib/notify-messages.ts`) and sends the Telegram message **in the same request that mutates the ticket** — there is no webhook to relay from (ADR-010 "single mutation path, no webhook"; the old `app/api/linear-webhook/route.ts` is retired). Copy is English, no emoji. Event matrix is unchanged (from `lib/notify-messages.ts` `NOTIFY_EVENTS`):
  - `started` on — state enters `IN_PROGRESS` for the first time
  - `handoff` on — `currentRole` changes (via `start`/`approve`/`handoff`)
  - `gate` on — `raiseGate` fires (state → `AWAITING_GATE`)
  - `approved` on — `approve` fires (a gate clears, not the terminal one)
  - `rejected` on — the Telegram Approve/Reject button (or `/status/map` Reject) fires `reject`
  - `blocked` on — `setBlocked(true)` fires
  - `done` on — `complete` fires (the terminal gate, state → `DONE`)
  - `released` on — `release` fires (`releasedAt` stamped)
  - `created` off — ticket-create event (default off, no spam)
  - `defect` off — default off
  Use `node scripts/ticket-sync.mjs notify "<text>"` to push free-form messages to Telegram (e.g. CI results). Requires `TELEGRAM_BOT_TOKEN` + `TELEGRAM_CHAT_ID` in `.env`.
- **Comms**: prefix every message to the owner with the active role + `(The Camper)` — e.g. `Orchestrator (The Camper)`, `Designer (The Camper)`. No emoji. Actually dispatch to role agents (`subagent_type` designer/frontend/qa/security/devops) — never run the whole epic solo.
- **Linear MCP (`.mcp.json`) is archive-read-only** — the old 275 legacy issues are kept there for history/reference only. Never call `save_issue`/`save_project`/`create_issue` through it for delivery work; all creates/reads/writes go through `scripts/ticket-sync.mjs` above. `.mcp.json` itself is left as-is by this convention change (untouched wiring, just no longer the write path).
