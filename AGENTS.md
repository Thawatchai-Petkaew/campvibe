# AGENTS.md — CampVibe

CampVibe is a Thai campground marketplace connecting campers and hosts (Next.js App Router, TypeScript, Prisma/Postgres). This is the cross-vendor entry point (agents.md convention) for any AI coding agent working in this repo — thin by design: every standard it points to lives once, in one place, not copied here.

## Setup

- `npm install` (fresh worktree: `npm ci` — Turbopack rejects a symlinked `node_modules`).
- DB: Postgres via `prisma/schema.prisma`; `npx prisma generate` runs on `postinstall`.
- Env: see `docs/SETUP-ENVS.md` for the 3-env var matrix (Local/Staging/Prod, separate `DATABASE_URL` each).

## Build / test / lint

| Command | What |
|---|---|
| `npm run dev` | local dev server |
| `npm run lint` | ESLint — 0 errors before handoff |
| `npm run typecheck` | `tsc --noEmit`, strict |
| `npm test` | Vitest unit/integration (coverage ≥80% on new code) |
| `npm run test:e2e` | Playwright e2e |
| `npm run build` | production build (also runs `prisma generate` + delivery-index generation) |
| `npm audit --omit=dev` | dependency scan — 0 high/critical before merge |
| `node scripts/ticket-sync.mjs list\|show\|create\|set\|handoff\|audit` | the delivery ticket DB (tracker); see `.claude/commands/camper.md` |

## Conventions (pointers only — read the source; it is not repeated here)

- `CLAUDE.md` — iron rules + quality gates + the 3-env Definition of Done. Overrides everything else.
- `.claude/rules/<domain>.md` — the standard per domain (code, api, security, qa, architecture, discovery, ops, observability, performance, seo, ux, loading, efficiency). Read that file's **Quick Reference** always; open the full file only when your work triggers that domain.
- `DESIGN.md` — the design system (tokens, components, states, Design Gate). Required for any UI task.
- `docs/specs/<feature>/<epic>/<story>/` — durable story content (spec/design/tech/test/review); the delivery ticket DB (`/status`) is the live-status source of truth, files are the content source of truth.
- `.claude/agents/*.md` — the 10 role playbooks (product-owner, analyst, architect, designer, frontend, backend, qa, security, devops, orchestrator). Each carries a `## Dispatch contract` — read once, applies to every dispatch of that role.

## Repo etiquette

- Branch `<type>/<kebab>` (`feature/ fix/ chore/ refactor/ docs/ test/ release/ hotfix/`) off `dev`; Conventional Commits.
- 1 PR = 1 atomic story, target ≤ ~400 lines.
- PR into `dev` (= Done, once merged + quality-gate green + AC verified on localhost against the dev DB); batched promote `dev`→`staging` (label `on-staging`); promote `staging`→`main` (= Released) only via `/promote-release`.
- Pre-flight `git status` before branching; stage explicit paths — never `git add -A` (a shared tree can carry another agent's WIP).
- `main` + `staging` + `dev` are protected; CI must pass before merge.

## STOP RULES (universal — every agent, every dispatch)

1. **Repo reality contradicts the ticket/spec** → stop that thread, report the contradiction; never improvise a redesign.
2. **Same error twice** → record it and move on, or report; never loop on the same failing command.
3. **Never touch a file outside your dispatch's stated file surface.**
4. **No new dependency, endpoint, or schema change unless the ticket says so** → if one seems needed, stop and report; never add it silently.

Full dispatch mechanics (git flow, self-verify commands, ship ritual, gate policy) live once, per role, in `.claude/agents/*.md` under `## Dispatch contract` — this file is a pointer, not a copy.
