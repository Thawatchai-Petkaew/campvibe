# CAM-690 — tech

Measured 2026-08-06 in a sandbox under `/private/tmp`. Nothing was run against the owner's tree or any real worktree. Every claim below is a measurement, not an inference — do not re-derive them, and do not substitute a "more obvious" mechanism for one recorded here as disproven.

## Root cause (proven)

`scripts/worktree-setup.sh:69-77` symlinks **every** top-level `node_modules` entry (`shopt -s dotglob`), which includes the **55 scoped directories** (`@babel`, `@radix-ui`, `@types`, …) plus `.bin` and `.package-lock.json`.

- **Unscoped package** → the symlink IS the node path, so npm's reify "retire" step renames the *link*. Main tree untouched. (semver, chalk, nanoid all survived.)
- **Scoped package** → the node path is `node_modules/@scope/pkg`, which **traverses the symlinked `@scope`**, so retire/extract lands on the **real directory inside the main tree**.

`ls -d node_modules/@*` = 55 scope dirs; `ls -d node_modules/@*/*` = **222 packages**. That is the "~150 packages" of CAM-687. `.bin` is the same bug one level down.

The `@prisma` carve-out at `scripts/worktree-setup.sh:84-92` **already encodes the correct shape** (real scope dir + per-child symlinks). It was applied to exactly 1 of 55 scopes.

### Sandbox reproductions

| What | Result |
|---|---|
| `npm update` in a faithful worktree | MAIN `@isaacs` → `[.cliui-leuiBaa6]`; `require.resolve('@isaacs/cliui')` **fails from the main tree** |
| plain `npm install`, lockfile in sync | MAIN `@isaacs` → `[.cliui-gcs3phIZ]` — not just `update` |
| `.bin` vector | MAIN `.bin` `[glob node-which rimraf]` → `[glob node-which rimraf uuid]` |
| `npm ci` alone | did **not** damage the main tree (it deletes the symlink dir, which does not follow links) |

### Live exposure right now

96 `git worktree list` entries (main + 95). Predicate dry-run over the real trees: **46 worktrees carry the shared symlink farm** (608 top-level links, `.bin` and `.package-lock.json` pointing at the main tree), 46 have a real `node_modules`, 3 have none.

The owner's tree is currently **healthy** (`next@16.2.11` and `@prisma/client@5.22.0` both resolve) — CAM-687's damage was genuinely repaired. The 213 `@scope/.pkg-XXXX` retired dirs still present all date Jun 20 / Jun 26 / Jun 27 / Jul 7, i.e. **before** CAM-687. Older residue; do not claim them as CAM-687 damage.

## Mechanisms tested — build on the ones that passed

| Mechanism | Verdict |
|---|---|
| `package.json` `preinstall` | **Fires too late** on `npm install` (guard saw `@isaacs = [.cliui-UubOSSAd]`, already retired; exit 9 did not undo it) and **never fires at all on `npm update`** — the exact verb CAM-687 used. Cannot satisfy AC-1 alone. |
| `PreToolUse` Bash hook | **The only mechanism that runs before npm starts** and covers every verb. |
| project `.npmrc` `dry-run=true` | Prevents the damage (zero writes on install/update/ci) but **REJECTED**: npm prints "added 9 packages" and exits 0 while doing nothing, and `npx --yes <uninstalled-pkg>` fails with a bare "command not found" and rc=0. Trading a loud incident for a silent one is the wrong trade. Recorded so it is not re-proposed. |
| Structural fix (real scope dirs + per-child symlinks) | **Eliminates write-through entirely** — `npm update` in the worktree left MAIN at 594 → 594 files with `@isaacs/cliui` intact. Zero collateral. |

## BLOCKER — the repo's existing hooks are dead no-ops

`.claude/settings.json:26` uses `$CLAUDE_TOOL_INPUT_command` and `.claude/hooks/palette-guard.sh:6` uses `$CLAUDE_TOOL_INPUT_file_path`. **`CLAUDE_TOOL_INPUT` appears 0 times** in the Claude Code 2.1.185 binary (vs `CLAUDE_PROJECT_DIR` 11, `hook_event_name` 12, `tool_input` 50, `PreToolUse` 80). Both expand empty — **the git-commit lint/typecheck gate has never fired.**

Real contract, confirmed from the same binary: the payload is **JSON on stdin** carrying `cwd`, `session_id`, `hook_event_name`, `tool_input`; `PreToolUse` supports `permissionDecision` / `permissionDecisionReason`. Read it with `jq -r '.tool_input.command'` and `jq -r '.cwd'`.

`palette-guard.sh` is **out of scope here — CAM-691** owns it, because switching it on may surface a violation backlog and `ops.md` requires report-mode → clear to 0 → flip to blocking.

## Reap — measured

`git worktree list` 96 · `du -sk` sum **28.60 GB** · `git worktree prune` finds 0 prunable.
`gh pr list --state all --limit 1000` = 769 PRs (763 MERGED, 6 CLOSED, 0 OPEN). Join on `headRefName`:

- **92 worktrees have a MERGED PR = 27.38 GB reapable**, all with zero uncommitted **tracked** changes
- 0 open, 0 closed
- **3 kept, no PR** (1.23 GB): `fix/cam-550-mobile-assistant-v2` 91 MB · `test/cam-664-spot-viewer-verify` 690 MB · `cam-550-local` 478 MB

`git merge-base --is-ancestor <branch> origin/main` returned TRUE for **0 of 92** — the repo squash-merges, so BR-3's `gh pr view` key is the only one that works. Removal does **not** follow symlinks (proved in a real `git worktree add` sandbox: MAIN 594 → 594 files, `@isaacs/cliui` intact) for both `git worktree remove --force` and `rm -rf`.

Space profile: `.next` 12.20 GB · `public` 6.20 GB · `node_modules` 6.14 GB · `prisma` 2.05 GB · `docs` 0.84 GB.

## Decisions (orchestrator, 2026-08-06 — these are settled, do not re-litigate)

1. **Ship all three layers.** L1 the `PreToolUse` hook (primary), L2 the structural fix, L3 the `preinstall` reporter.
2. **L2 is IN scope**, not deferred. It is the only layer that makes the hazard structurally impossible rather than policy-blocked, and it preserves the CAM-579 speed win (55 mkdir + 222 symlinks instead of 55 symlinks).
3. **L3 must be labelled in its own output and in the story as REPORTS, does not PREVENT** — so nobody later mistakes it for the guard.
4. **L3 fails OPEN when `node_modules` is absent.** Getting this backwards bricks CI and the Vercel build. The reap fails **CLOSED**. That inversion is the single easiest thing to get wrong.
5. **Fix `.claude/settings.json`'s dead commit gate in this PR** — same file, same wrong contract. Safe to switch on: lint and typecheck are already green under CI.
6. **`.npmrc dry-run` is rejected.** Recorded above with the measurement.
7. **The reap ships dry-run only.** Do NOT run `--apply`. The orchestrator executes it after reading the report.
8. **Do not delete branches** in the reap pass — `ops.md`'s CAM-504/CAM-680 rule is exactly this shape. Branch cleanup is a separate later opt-in flag.

## Risks to carry into the PR

- **The hook layer is unproven in this repo precisely because the existing hooks are dead.** Shipping a third hook on faith repeats `ops.md`'s "the conditional job skips gracefully = silent" failure. **The PR must contain a captured first-run proof that the hook actually fired and actually blocked** — not an assertion that it should.
- Reaping is a **27 GB irreversible delete**. The clean-status check covers TRACKED files only; any untracked scratch a past agent left dies with it. **Report untracked counts in the dry-run.**
- Another session is writing in this tree. Re-read the worktree list and re-check `git status` **inside the apply loop, immediately before each removal** — never from a snapshot.
- L2 residue, **unproven rather than covered**: a nested `node_modules` inside a symlinked package (`strip-ansi-cjs/node_modules` exists here). npm hoists by default so nested placement needs a version conflict; it did not fire in testing. State it as unproven.
- Nothing existing pins any of this (`scripts/worktree-setup.sh` has no test file), so nothing can break — but nothing will catch a regression except the new tests.
