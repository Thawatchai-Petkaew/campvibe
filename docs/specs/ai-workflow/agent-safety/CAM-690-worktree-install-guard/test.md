# CAM-690 — test

version 1 · 2026-08-06

## Sandbox proof (self-verify's headline requirement)

Built entirely under the scratchpad (never a real worktree, never `npm install/update/ci/add/
dedupe/prune` against this repo's own tree — HARD SAFETY RULE #1). Two throwaway `main` trees
(`main-A`, `main-C`) were seeded with a real `npm install` of `@isaacs/cliui@8.0.2`, `glob`,
`which`, `rimraf` — the exact package tech.md's own sandbox reproduction used. `child-old` was
built with the OLD (pre-fix) symlink loop extracted verbatim from `git show HEAD:scripts/
worktree-setup.sh`; `child-new-verbatim` was built with the ACTUAL shipped `worktree-setup.sh`
(lines 87-159 extracted via `sed` from the real file post-fix, not a hand-copied approximation).
Both children then ran the identical two commands: `npm update` then `npm install uuid`.

| | main-A (OLD script) BEFORE | main-A AFTER | main-C (NEW/fixed script) BEFORE | main-C AFTER |
|---|---|---|---|---|
| file count | 730 | **731** | 730 | **730 (unchanged)** |
| `@isaacs/cliui` | resolvable | **renamed to `.cliui-XXXX`, `require.resolve` FAILS** | resolvable | **resolvable, unchanged** |
| `.bin` | `glob node-which rimraf` | **`glob node-which rimraf uuid`** (wrote through) | `glob node-which rimraf` | **`glob node-which rimraf`** (unchanged) |
| `.package-lock.json` md5 | — | unchanged (npm broke the top-level symlink on write rather than following it, but this was UNPROVEN before the run — the fix copies the file locally regardless, closing the doubt) | — | real local copy from the start |

Reproduced BOTH measured vectors from tech.md (`@scope` traversal + `.bin` write-through) against
the real npm reify engine, then proved the fix eliminates both against the byte-for-byte real
shipped script content. Full transcript: session scratchpad
`cam690-sandbox/{build-old.sh,build-new-verbatim-body.sh,reap-dry-run-output.txt}` (disposable,
not part of this PR).

## PreToolUse hook — captured real output (not a claim it would fire)

Invoked the actual `.claude/hooks/npm-shared-node-modules-guard.sh` directly via stdin, with a
realistic PreToolUse JSON payload (`cwd`/`tool_input.command`, the confirmed real contract per
tech.md) — never through a live Bash-tool call in this session, since editing `.claude/
settings.json` mid-session and then testing it live against a real `npm update` in this actual
shared worktree would risk the exact CAM-687 damage if hook hot-reload turned out not to be live
yet (HARD SAFETY RULE #1 has no carve-out for "testing the guard"). This is still a REAL
invocation of the REAL shipped file with a REAL representative payload — the interception point
under test is entirely inside the hook script, before any npm process would ever start.

| Case | cwd | command | stdout | stderr | exit |
|---|---|---|---|---|---|
| AC-1 block | this (shared) worktree | `npm update` | `{"hookSpecificOutput":{...,"permissionDecision":"deny",...}}` | Thai + English refusal | **2** |
| EC-2 inverse | main tree (safe) | `cd <this shared worktree> && npm update` | same deny JSON | same message | **2** (target resolved from `cd`, not payload cwd) |
| BR-1 negative | this worktree | `npm run build` | *(empty)* | *(empty)* | **0** |
| BR-1 negative | this worktree | `npm test` | *(empty)* | *(empty)* | **0** |
| BR-1 negative | this worktree | `npx tsc --noEmit` | *(empty)* | *(empty)* | **0** |
| main tree | main tree (safe) | `npm update` | *(empty)* | *(empty)* | **0** |
| AC-2 bypass | this worktree | `CAMPVIBE_ALLOW_SHARED_NPM=1 npm update` | *(empty)* | *(empty)* | **0** |
| EC-2 | this worktree | `cd <fixed-shape sandbox dir> && npm update` | *(empty)* | *(empty)* | **0** (target resolved from `cd`) |

This worktree, right now (still on the OLD symlink shape at test time, before it re-runs `bash
scripts/worktree-setup.sh` on the new script), is genuinely the shared/unsafe shape — the block
case above is not a synthetic fixture, it is this real tree.

## AC→test matrix

| AC/BR | risk | type | test file | status |
|---|---|---|---|---|
| AC-1 (BR-1 verb match) | H | unit | `__tests__/cam-690-npm-guard.test.ts` | pass |
| AC-1 (BR-4 shared-tree predicate, incl. `.bin`) | H | unit | `__tests__/cam-690-npm-guard.test.ts` | pass |
| AC-1 real hook, captured | H | manual (documented above) | `.claude/hooks/npm-shared-node-modules-guard.sh` | pass |
| AC-2 (BR-2 bypass, env + inline) | M | unit + manual | `__tests__/cam-690-npm-guard.test.ts` | pass |
| AC-3 (fixed-shape tree reads safe) | H | unit + sandbox (real npm) | `__tests__/cam-690-npm-guard.test.ts` + sandbox proof above | pass |
| AC-4 (reap dry-run report shape) | H | unit + real dry-run against 98 live worktrees | `__tests__/cam-690-reap-worktrees.test.ts` | pass |
| BR-3 (gh-confirmed MERGED, never merge-base) | H | unit + real `gh pr list` join | `__tests__/cam-690-reap-worktrees.test.ts` | pass |
| BR-5 (fail closed: no PR / gh error) | H | unit | `__tests__/cam-690-reap-worktrees.test.ts` | pass |
| BR-6 (never deletes branches) | M | unit (contract check) | `__tests__/cam-690-reap-worktrees.test.ts` | pass |
| EC-1 (own real node_modules never fires) | M | unit | `__tests__/cam-690-npm-guard.test.ts` | pass |
| EC-2 (`cd <dir> &&` target resolution) | H | unit + manual (both directions) | `__tests__/cam-690-npm-guard.test.ts` + hook table above | pass |
| EC-3 (nested node_modules) | — | **unproven, stated as such** — tech.md: npm hoists by default, did not fire in testing | — | not covered |
| EC-4 (uncommitted tracked changes keep+name) | H | unit | `__tests__/cam-690-reap-worktrees.test.ts` | pass |
| EC-5 (untracked count reported) | M | unit | `__tests__/cam-690-reap-worktrees.test.ts` | pass |
| L3 preinstall reporter (reports, never blocks; fails open) | M | manual | `scripts/guard-shared-node-modules.mjs --preinstall-report` | pass (both a shared tree → warns, exit 0; and no `node_modules` → silent, exit 0) |

Type mix: unit-heavy (matches "pure logic, no UI/route" scope), backed by real-process manual
capture for the two claims that a mock cannot prove (the actual npm reify engine's write-through
behavior; the actual hook script's stdin/stdout contract).

## Live dry-run reap (real repo, read-only, never `--apply`)

`node scripts/reap-worktrees.mjs` against the real 98-worktree tree: **92 reapable, ~27.38 GB**,
**5 kept** (this in-progress worktree — no merged PR yet; `fix/cam-550-mobile-assistant-v2`,
`test/cam-664-spot-viewer-verify`, `cam-550-local` — no merged PR, matching tech.md's independent
measurement exactly; `fix/cam-688-language-first-paint` — grown since tech.md was written).
`--json` output validated as parseable JSON. Nothing was removed.

## Coverage

`__tests__/cam-690-npm-guard.test.ts` (26 tests) + `__tests__/cam-690-reap-worktrees.test.ts` (21
tests) = 47/47 pass. Full suite: `npm test` → 459 files / 12065 tests pass, 5 files / 25 tests
skipped (pre-existing, unrelated), 0 failures. `npm run lint`: 0 errors (353 pre-existing
warnings, none from the new files). `npm run typecheck`: clean. `npm audit --omit=dev`: 0
vulnerabilities. Local `next build` skipped (Turbopack fails on cross-filesystem symlinks in a
worktree) — build verified by CI.

## Links

`story.md` · `tech.md` · `.claude/rules/qa.md` · `.claude/rules/ops.md` ·
`scripts/worktree-setup.sh` · `scripts/guard-shared-node-modules.mjs` ·
`scripts/reap-worktrees.mjs` · `.claude/hooks/npm-shared-node-modules-guard.sh` ·
`.claude/settings.json`

## Changelog
- v1 (2026-08-06) — built + self-verified all three layers (L1 hook, L2 structural fix, L3
  reporter) + the dry-run reap; captured real sandbox + hook evidence per tech.md's Risks section.
