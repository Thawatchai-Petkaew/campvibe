#!/usr/bin/env bash
# CAM-690 — PreToolUse(Bash) hook: refuse npm install/update/ci/add/dedupe/
# prune before it starts, inside a worktree whose node_modules still
# symlinks a @scope namespace directory or .bin into the main tree (the
# exact CAM-687 write-through vector).
#
# Real contract (measured, NOT the dead `$CLAUDE_TOOL_INPUT_command` pattern
# the repo's other two hooks used their whole life — see tech.md's
# BLOCKER section): JSON on stdin carrying `.cwd` / `.tool_input.command`;
# JSON on stdout carrying `hookSpecificOutput.permissionDecision`. All of
# the actual decision logic (verb match, the CAMPVIBE_ALLOW_SHARED_NPM=1
# bypass, `cd <dir> &&` target resolution, the shared-tree predicate) lives
# in scripts/guard-shared-node-modules.mjs, which is unit-tested directly
# (__tests__/cam-690-npm-guard.test.ts) — this file is a thin exec so the
# real PreToolUse stdin/stdout contract is exercised too.
#
# CAM-690 follow-up (measured): this wrapper used to read $CLAUDE_PROJECT_DIR
# to locate the repo. MEASURED: that variable is NOT present in a real
# tool-call hook environment (the vars that ARE present: AGENT_SDK_VERSION,
# CODE_ENABLE_TASKS, CODE_ENTRYPOINT, CODE_ENABLE_SDK_FILE_CHECKPOINTING,
# CODE_EXECPATH, CLAUDECODE, CODE_SESSION_ID, CODE_CHILD_SESSION, PID,
# EFFORT — not PROJECT_DIR). Under `set -u` that died at the exec line with
# exit 1 — a NON-blocking PreToolUse result (only exit 2 blocks) — so the
# guard failed OPEN, silently, on every real invocation.
# `session-start.sh`'s use of $CLAUDE_PROJECT_DIR in settings.json is NOT
# evidence it is exported: that substitution happens harness-side in the
# command STRING before the shell ever starts, which is exactly why that
# hook works while a reference INSIDE a script does not.
#
# Fix: no environment dependency at all, in either direction — the repo
# root is derived from this script's own location (.claude/hooks/<this
# file> -> up two -> repo root) and any $CLAUDE_PROJECT_DIR in the
# environment is ignored entirely, correct or bogus. No `set -e`/`set -u`
# either: every step that could plausibly fail is checked explicitly and
# falls through to an explicit `exit 2` (deny) rather than an uncontrolled
# non-2 exit — a guard whose failure mode is "exit non-2" fails open.

self_path="${BASH_SOURCE[0]:-$0}"
hook_dir="$(cd "$(dirname "$self_path")" >/dev/null 2>&1 && pwd)"
repo_root="$(cd "$hook_dir/../.." >/dev/null 2>&1 && pwd)"
guard_script="$repo_root/scripts/guard-shared-node-modules.mjs"

if [ -z "$repo_root" ] || [ ! -f "$guard_script" ]; then
  echo "npm-shared-node-modules-guard.sh: could not locate scripts/guard-shared-node-modules.mjs from $self_path (hook_dir=$hook_dir repo_root=$repo_root) — denying by default (fail-closed wrapper)." >&2
  exit 2
fi

exec node "$guard_script"
# exec only falls through to here if it FAILED to launch node at all.
echo "npm-shared-node-modules-guard.sh: exec node failed to start — denying by default (fail-closed wrapper)." >&2
exit 2
