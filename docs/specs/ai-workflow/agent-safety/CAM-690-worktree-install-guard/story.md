# CAM-690 — A dependency install in an agent worktree can no longer reach the owner's tree

version 2 · 2026-08-06

## Story

As a **platform** maintainer, I want a dependency install inside an agent worktree to fail loudly instead of writing through into the main tree, so that routine dependency work can never damage the owner's live dev environment again.

Why: CAM-687's `npm update` inside a worktree emptied ~150 real packages in the owner's running dev server. The mechanism is now measured — see `tech.md`. 46 worktrees carry that exposure today.

Scope: `scripts/worktree-setup.sh` · a new `PreToolUse` hook · `.claude/settings.json` · a `preinstall` reporter · a dry-run reap script · tests. Depends on: —

## AC

| # | Given | When | Then (user sees, Thai verbatim) | System effect | Neg/edge |
|---|---|---|---|---|---|
| AC-1 | A worktree whose node_modules is a symlink farm into the main tree | An agent runs `npm install`, `npm update`, `npm ci`, `npm add`, `npm dedupe` or `npm prune` in it | คำสั่งถูกปฏิเสธก่อนเริ่มทำงาน พร้อมข้อความว่าห้ามติดตั้งแพ็กเกจในสำเนาที่ใช้ node_modules ร่วมกับต้นฉบับ | npm never starts; the main tree's `node_modules` is byte-identical before and after | EC-1, EC-2 |
| AC-2 | The same worktree, and the caller has deliberately opted out | The command carries `CAMPVIBE_ALLOW_SHARED_NPM=1` | คำสั่งทำงานตามปกติ | The guard yields; the install proceeds | — |
| AC-3 | A fresh worktree created by the updated setup script | An agent runs `npm update` in it | ไม่มีข้อความเตือน คำสั่งทำงานจบตามปกติ | The main tree's file count and every `@scope/pkg` are unchanged — the write-through path no longer exists | EC-3 |
| AC-4 | 95 worktrees registered, branches squash-merged | The reap runs without `--apply` | รายงานจำนวนสำเนาที่จะถูกลบ พื้นที่ที่จะได้คืน และรายการที่จะเก็บไว้พร้อมเหตุผล | Nothing is removed. Every candidate is confirmed individually via `gh pr view --json state` = MERGED | EC-4, EC-5 |

## Rules

- BR-1 The guard fires on `npm` followed by `install|i|add|update|up|ci|dedupe|prune`. It must NOT fire on `npm run`, `npm test`, or `npx`.
- BR-2 `CAMPVIBE_ALLOW_SHARED_NPM=1` present in the command bypasses the guard.
- BR-3 The reap key is a confirmed `gh pr view <branch> --json state` = `MERGED`. `git merge-base --is-ancestor` MUST NOT be used — measured: TRUE for 0 of 92 merged branches, because the repo squash-merges.
- BR-4 Shared-tree predicate: `node_modules` exists AND at least one maxdepth-1 entry is a symlink whose target is outside this directory. Validated read-only against all 96 real trees, zero false positives or negatives. The main tree resolves as isolated, so the owner's `npm ci` is never touched.
- BR-5 The `preinstall` reporter fails **OPEN** when `node_modules` is absent (a fresh CI checkout and the Vercel build both have none). The reap fails **CLOSED** — no PR, a `gh` error, or an unauthenticated `gh` all mean keep.
- BR-6 The reap does not delete branches. Removal is `git worktree remove --force`.

## Edge cases

- EC-1 IF the worktree has its own real `node_modules` THEN the guard does not fire (46 worktrees are already in this state).
- EC-2 IF the command is prefixed `cd <dir> && …` THEN the guard resolves the target from that `cd`, not from the payload's `cwd`.
- EC-3 IF a package needs a nested `node_modules` under a real scope dir THEN behaviour is UNPROVEN — npm hoists by default, and it did not fire in testing. Say so; do not claim it covered.
- EC-4 IF a worktree has uncommitted tracked changes at the moment of removal THEN keep it and name it. Re-check inside the apply loop, never from a snapshot — another session is writing in this tree.
- EC-5 IF a worktree has untracked files THEN still report their count in the dry-run: the clean-status check covers tracked files only, and untracked scratch dies with the directory.

## Data

None. No schema change, no migration.

## Seams & refs

`scripts/worktree-setup.sh:69-77` (the link loop) and `:84-92` (the `@prisma` carve-out that already encodes the correct shape) · `.claude/settings.json:26` (dead commit gate, same wrong contract, fixed here) · `.claude/hooks/palette-guard.sh` is **CAM-691, not this story** · `.claude/rules/ops.md` carries the promoted rationalization row from CAM-687.

## Out of scope

- `palette-guard.sh` — CAM-691. Switching it on may surface a violation backlog, and `ops.md` requires report-mode → clear to 0 → flip to blocking.
- Running the reap with `--apply`. The orchestrator does that after reading the report.
- Changing the symlink strategy itself — CAM-579's speed win is real and its reasoning stands.

## Self-verify

- **Capture a real first-run proof in the PR** that the hook fired and blocked. The repo's two existing hooks were dead no-ops for their whole life; an assertion that it "should" fire is exactly the failure mode `ops.md` names. Paste the actual blocked output.
- Prove AC-3 by file count: build a sandbox pair under the scratchpad (never a real worktree), run `npm update` in the child, and show the main count unchanged with a scoped package intact.
- `npm run lint` · `npm run typecheck` · `npm test`. Skip the local `next build` (Turbopack fails on cross-filesystem symlinks) and note "build verified by CI".
