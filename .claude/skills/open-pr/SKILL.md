---
name: open-pr
description: Create branch + commit (Conventional Commits) + open a PR based on `staging` with a checklist via the gh CLI — 1 PR per 1 atomic story. Use when a story is ready to send for review/merge toward Done. Do NOT use when promoting `staging`→`main` to prod (use /promote-release --to prod)
---
# open-pr — close an atomic story with branch+commit+PR into `staging` (=toward Done)
Read first: CLAUDE.md (Git) · std/ops.md (3-env, Done vs Released) · std/code.md (PR size)

## Input / preconditions
- A referenceable ticket/story exists (Linear issue at story level, with ## Story + ## AC) — no spec → stop
- Code is actually complete for 1 atomic story (code + states + validation + self-test), no dead code / no future-proofing
- quality-gate is fully green (lint · typecheck · test+coverage ≥80% · build · audit · design gate if UI)
- `gh` is authenticated; working on a feature branch (do not commit directly into `staging`/`main`)

## Workflow
1. branch `<type>/<kebab>` — `feature/ fix/ chore/ refactor/ docs/ test/ release/ hotfix/`
2. commit with Conventional Commits (`type(scope): subject`) — traceable back to ticket/AC
3. open the PR: `gh pr create --base staging` (feature → `staging` = toward **Done**)
4. Fill the PR body completely: ticket link · AC covered · quality-gate result · self-verify checklist · Vercel Preview URL
5. Wait for CI (`.github/workflows/ci.yml`) to be green before requesting merge (`staging`/`main` protected)

## Watch for / Anti-patterns
- **1 PR = 1 atomic story, ≤ ~400 lines** — over that / multiple stories → split the PR
- base must always be `staging` (never `main`) — releasing to prod = PR `staging`→`main` via `/promote-release --to prod`, not this skill
- No secret / env value may leak in the diff/commit message
- Merging into `staging` is **not yet Done** until AC is verified on the real Staging URL

## Output / postconditions
- 1 open PR based on `staging` with a complete body + Preview URL + CI running
- 1 branch + Conventional Commits commit traceable to the ticket
- After merge: auto deploy → Staging + smoke → then verify AC on the Staging URL → state `Done`

## Verify
- `gh pr view` shows base=`staging`, body has ticket/AC/gate result/Preview URL complete
- CI green · diff ≤ ~400 lines · no secret in the diff
- `node scripts/linear-sync.mjs audit` passes (ticket has ## Story + ## AC)
