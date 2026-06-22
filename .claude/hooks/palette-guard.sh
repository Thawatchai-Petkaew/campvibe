#!/usr/bin/env bash
# PostToolUse(Edit|Write) hook — when a UI file changes, run the palette guard so
# DESIGN.md token violations surface immediately instead of at PR/CI time.
# Fail-safe: no-ops (exit 0) for non-UI files; only blocks (exit 2) when
# `npm run check:palette` actually fails after editing a UI file.
set -u
fp="${CLAUDE_TOOL_INPUT_file_path:-}"
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
