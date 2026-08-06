#!/usr/bin/env bash
# PostToolUse(Edit|Write) hook — when a UI file changes, run the palette guard so
# DESIGN.md token violations surface immediately instead of at PR/CI time.
#
# CONTRACT (CAM-691): Claude Code does NOT set CLAUDE_TOOL_INPUT_* env vars —
# those never existed, so a hook that reads them exits 0 unconditionally and
# never actually runs. The real payload is a JSON object delivered on STDIN,
# carrying (at least) cwd, session_id, hook_event_name, tool_input. The file
# path for an Edit/Write call lives at .tool_input.file_path. Verified against
# session-start.sh, which is wired via the (real) $CLAUDE_PROJECT_DIR env var
# and fires every session — env vars ARE real for some fields, just not
# CLAUDE_TOOL_INPUT_*; stdin is the only channel for tool_input.
#
# Fail-safe, always: no-ops (exit 0) for a non-UI file, no stdin, empty/
# malformed JSON, a payload with no file_path, or a missing `jq` (best-effort
# regex fallback is tried first; if that also can't find a path, exit 0).
# Only blocks (exit 2) when `npm run check:palette` actually fails after
# editing a UI file — never blocks the tool call on a hook-plumbing problem.
set -u

# Read the whole stdin payload (Claude Code always provides one for
# PostToolUse; an empty/absent payload is treated as "nothing to do").
payload="$(cat 2>/dev/null || true)"
[ -z "$payload" ] && exit 0

fp=""
if command -v jq >/dev/null 2>&1; then
  fp="$(printf '%s' "$payload" | jq -r '.tool_input.file_path // empty' 2>/dev/null || true)"
else
  # No jq on PATH — best-effort regex extraction so the guard still runs.
  # Does not handle escaped/unicode path characters; good enough for the
  # plain repo-relative paths Edit/Write report. Falls through to exit 0
  # (fail-safe) if this can't find a file_path either.
  fp="$(printf '%s' "$payload" \
    | grep -o '"file_path"[[:space:]]*:[[:space:]]*"[^"]*"' \
    | head -1 \
    | sed -E 's/.*:[[:space:]]*"(.*)"$/\1/')"
fi
[ -z "$fp" ] && exit 0

case "$fp" in
  *app/*|*components/*)
    case "$fp" in
      *.tsx|*.ts|*.jsx|*.css)
        if ! npm run --silent check:palette >/dev/null 2>&1; then
          echo "palette-guard: 'npm run check:palette' FAILED after editing $fp — fix hardcoded color/spacing; use tokens only (DESIGN.md)." >&2
          exit 2
        fi
        ;;
    esac
    ;;
esac
exit 0
