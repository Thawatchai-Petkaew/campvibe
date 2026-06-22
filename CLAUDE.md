# CLAUDE.md — CampVibe (AI Delivery Team)

Central memory for the AI agent team, auto-loaded every session. **Every rule in this file overrides convenience and speed.**

> Full team operating manual: `ai-planning/AI-TEAM-PLAYBOOK.md`. This file is the binding, condensed enforcement copy.

## Stack

Next.js (App Router) · TypeScript (strict) · Prisma + PostgreSQL · Tailwind v4 + shadcn/ui (new-york) · NextAuth · Vercel · Linear (tracker)

## Iron Rules (every agent)

1. **Spec-first** — no code without a spec; every piece of code must trace back to a ticket/AC. If the prompt is ambiguous → stop and write the spec first.
2. **One atomic story at a time** — finish it for real (code + states + validation + self-test) before moving on. Never write for the future or leave dead code.
3. **Self-verify before handoff** — run the real commands for your own domain (lint/type/test/scan). Never hand off work you have not verified.
4. **Read memory before working** — every agent reads `.claude/rules/<own>.md` + `DESIGN.md` (for UI work) before starting, every time.
5. **Never skip a gate** — stop for human approval at G1 Scope · G2 Design · G3 Merge→staging · G4 Staging sign-off · G5 Go-live (prod).
6. **Lean** — anything you add must answer how it makes the work better; otherwise cut it.

## Standards (details in .claude/rules/)

- Code → `.claude/rules/code.md` · API/Backend → `.claude/rules/api.md` · Security → `.claude/rules/security.md`
- QA/Test → `.claude/rules/qa.md` · Architecture → `.claude/rules/architecture.md` · Discovery → `.claude/rules/discovery.md` · Ops → `.claude/rules/ops.md`
- Observability → `.claude/rules/observability.md` · Performance → `.claude/rules/performance.md`
- Design system → `DESIGN.md` **v2 (AI-First, agent-readable)** — read before every UI task: brand POV · token tables (usage context) · scales (radius/size/spacing/motion) · component decision matrix · named anti-patterns · Design Gate (blocks PR) · SEO/AEO → `.claude/rules/seo.md` · UX Validation + PDPA → `.claude/rules/ux.md`

## Project context (read for decisions)

- `docs/project/*` — business/product source-of-truth (why / for whom / worth it): master-plan · business (cost list) · market-size · user-research · product-strategy.
- `docs/context/*` — the owner's stable context / **Second Brain** (principles, non-negotiables, decision heuristics); the orchestrator + camper-agent read it before any autonomous decision.

## Quality gates (mandatory before merge — `/quality-gate`)

`npm run lint` · `npm run typecheck` · `npm test` (coverage ≥80% on new code) · `npm run build` · `npm audit --omit=dev` (0 high/critical) · design gate (UI work)

## Env & Definition of Done (3-env — details in `.claude/rules/ops.md`)

Local Dev → **Staging** (`staging` branch, auto deploy) → **Production** (`main`, promote + tag) · separate staging/prod DBs

- **Done** = merge into `staging` + quality-gate green + **verify AC on the real Staging URL** → Linear state `Done`
- **Released** = promote `staging`→`main` + prod deploy + smoke + tag + changelog → label `released` (a label, not a state) · multiple stories may reach Done before being released together in one batch

## Git

Branch `<type>/<kebab>` (`feature/ fix/ chore/ refactor/ docs/ test/ release/ hotfix/`) · Conventional Commits · **feature → PR into `staging` (= Done) → promote `staging`→`main` (= Released)** · `main` + `staging` protected · must pass CI before merge

## Commands

`/new-feature "<requirement>"` start the loop · `/status` view status · `/promote-release --to <staging|prod>` promote across envs
