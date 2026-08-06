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
set -euo pipefail
exec node "$CLAUDE_PROJECT_DIR/scripts/guard-shared-node-modules.mjs"
