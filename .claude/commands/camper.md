---
description: Hand a free-form request to the Camper delivery team (ad-hoc, beyond the fixed commands)
---
`/camper "<anything>"` — give the orchestrator a free-form request that the three fixed commands (`/new-feature`, `/status`, `/release`) don't cover: investigate, fix, refactor, analyze, plan, or a small change.

The orchestrator (`.claude/agents/orchestrator.md`):
1. reads the request + project context (`docs/project/*`, `CLAUDE.md`, relevant `.claude/rules/*`)
2. runs lightweight Discovery to scope it → proposes/acts via the normal gates G1–G5
3. respects the **Camper Agent** autopilot flag (`npm run camper status` — auto-decide G1–G4 if ON) and the **cost rule** (any monetary cost → stop and ask)

For a brand-new feature with a clear requirement, `/new-feature` is still the front door; use `/camper` for everything in between.

**Also from Telegram:** any message to the bot that isn't a gate reply is routed here as an ad-hoc request (via `repository_dispatch` → `camper-adhoc` workflow → headless orchestrator, draft PR only).

---

## Linear delivery convention — orchestrator MUST follow when creating/tracking/breaking-down work
The `/status` dashboard reads team **CAM** issues **live** (`lib/linear.ts` `fetchStatusIssues` + `buildModel` in `app/status/page.tsx`). Structure every piece of work so it shows correctly:

- **Epic** = a hierarchy **parent issue**: `parentId` empty, title has **no `·`**, and it **has a Linear project**. (Legacy alt: a `·`-prefixed title.) Shows on /status even with 0 stories.
- **Story** = a child issue with **`parentId` = the epic issue** → appears as a *task inside the epic* on the /status **Epic tab**. (This is the level the owner expects to see "inside" an epic.)
- **Current role on a story** = put the role doing it **right now** in the title as **`[<role>]`**, using the LONG tokens /status maps to icon + Design→Build→Verify→Ship stage: `[architect]` `[ux-designer]` (Design) · `[frontend-engineer]` `[backend-engineer]` (Build) · `[qa-engineer]` `[security-reviewer]` (Verify) · `[devops-release]` (Ship) · `[product-owner]` `[analyst]`. **UPDATE the `[role]` as the story moves** (Designer → Frontend → QA → Security → DevOps) so /status always shows who is on it. (This answers "which role is this story being worked on?" without a sub-task tree.)
- **Role sub-tasks** (only when a story genuinely needs a granular per-role breakdown) = child issues of the STORY, each `[role]`-titled. Usually the rotating `[role]` on the story is enough — don't over-scaffold.
- **persona label** = one of `host | camper | admin | platform` (drives persona grouping). **feature** = the Linear project name.
- **Ticket body** = the STORY-TICKET template (`.claude/templates/STORY-TICKET.md`): `## ทำไม / ## Story (ในฐานะ <persona> … เพื่อ …) / ## AC` (table `# | Given | When | ผลที่ผู้ใช้เห็น (copy ไทย verbatim) | ผลเชิงข้อมูล/ระบบ`) `/ ## Rules / ## Data / ## Out of scope / ## Self-verify / ## Links`. No event-codes/class/testid/tech-jargon/em-dash in AC. Verify with `node scripts/linear-sync.mjs audit` (needs at least `## Story` + `## AC`).
- **Create issues via the Linear MCP** (`save_project` for the epic's project, `save_issue` for epic + stories). `scripts/linear-sync.mjs` has **no create** — only `set/list/gates/audit/notify/release/pull`; use it for state/label transitions + status feed.
- **Tracking / gate movement**: set `In Progress` when a story starts, `Done` after merge+staging-verify, add label `released` after G5. Move state at **every** gate so the /status Epic tab shows live movement. In **autonomous mode** the Overview (gates `awaiting-you`) is intentionally quiet — progress is on the **Epic tab**.
- **Role handoff (MUST use `linear-sync handoff`)**: when a story moves between roles, the orchestrator MUST run `node scripts/linear-sync.mjs handoff <id> --role <role> [--state "In Progress"] [--note "..."]`. This command: (1) swaps the `[role]` tag in the title so /status always reflects the current actor, (2) adds a persistent `role:<role>` label that **accumulates — never removed** so workload attribution (`role:*` labels) builds a complete history, (3) fires a Telegram notification to the owner. Do NOT use bare MCP `save_issue` title changes for handoffs — that skips the label and Telegram.
- **Telegram notify policy** (fired from `scripts/linear-sync.mjs`, both local + headless): every role **handoff** (`handoff` command) · every **gate** (`awaiting-you` label added via `set --add-label awaiting-you`) · every **story done** (`set --state Done` on a completed-type state). `notifyTelegram` is no-throw; requires `TELEGRAM_BOT_TOKEN` + `TELEGRAM_CHAT_ID` in `.env`.
- **Comms**: prefix every message to the owner with the active role + `(The Camper)` — e.g. `Orchestrator (The Camper)`, `Designer (The Camper)`. No emoji. Actually dispatch to role agents (`subagent_type` designer/frontend/qa/security/devops) — never run the whole epic solo.
