# CAM-691 — The palette-guard hook has never once run

version 1 · 2026-08-06

## Story

As an **Admin** (the AI delivery team relying on the design-token gate), I want the `palette-guard` PostToolUse hook to actually read the file Claude Code just edited, so that a hardcoded-color/spacing violation in a UI file is caught and blocked at edit time, the way it was always meant to — not silently waved through on every single Edit/Write since the hook was written, with the signal only ever surfacing later at PR/CI time.

Why: `.claude/hooks/palette-guard.sh:7` read `${CLAUDE_TOOL_INPUT_file_path:-}` — an env var Claude Code never sets. It always expanded empty, `[ -z "$fp" ] && exit 0` fired every time, and the hook has exited 0 unconditionally on every Edit/Write since it shipped. It has never once run. Repo-wide `npm run check:palette` was already measured PASS (0 violations) before this fix — CI enforcement is why nobody noticed the hook was dead; this story moves that same signal from PR time to edit time, as designed.

Scope: `.claude/hooks/palette-guard.sh` only — read the real stdin JSON payload instead of the nonexistent env var, keep the existing case-match + `npm run check:palette` decision logic unchanged. Does not touch `.claude/settings.json` (owned by CAM-690, PR #773, in flight) or `scripts/check-palette.mjs`.

Depends on: —

**Note on the "Then (user sees, Thai verbatim)" column:** this hook has no end-user/product screen — it is an internal CLI tool that talks to the Claude Code agent (and, via its terminal, the engineer) on stderr only. The Thai-copy requirement is N/A here for a stated reason (discovery.md AC-granularity note); the "Then" column below carries the literal operator-facing message instead.

## AC

| # | Given | When | Then (what the operator/agent sees) | System effect | Neg/edge |
|---|---|---|---|---|---|
| AC-1 | A UI file (path contains `app/` or `components/`, extension `.tsx`/`.ts`/`.jsx`/`.css`) was just edited and now fails `npm run check:palette` | The hook receives the real PostToolUse stdin JSON payload naming that file | stderr prints `palette-guard: 'npm run check:palette' FAILED after editing <path> — fix hardcoded color/spacing; use tokens only (DESIGN.md).` and the hook exits non-zero (2) | No file is changed by the hook; Claude Code surfaces the block to the agent immediately (edit-time, not PR-time) | EC-1 |
| AC-2 | A UI file was just edited and `check:palette` passes clean | The hook receives the payload | No output; exit 0 | Nothing | EC-2 |
| AC-3 | A non-UI file was just edited (outside `app/`/`components/`, or a non-matching extension) | The hook receives the payload | No output; exit 0; `check:palette` is never invoked | Nothing | EC-3 |
| AC-4 | The stdin payload has no `tool_input.file_path` (e.g. a Bash tool call), is empty, or is not valid JSON | The hook runs | No output; exit 0 | Nothing; the tool call is never blocked by a hook-plumbing failure | EC-4 |

## Rules

- BR-1 The hook reads exactly one field — `.tool_input.file_path` — from the JSON object Claude Code delivers on **stdin** for every PostToolUse invocation (payload carries at minimum `cwd`, `session_id`, `hook_event_name`, `tool_input`). It must never read any `CLAUDE_TOOL_INPUT_*` env var — those do not exist and never have (the CAM-691 bug). Verified against `.claude/hooks/session-start.sh`, which fires every session and is wired through the real `$CLAUDE_PROJECT_DIR` env var — proving env vars work for hooks in general, just not the specific `CLAUDE_TOOL_INPUT_*` shape this script assumed.
- BR-2 Parse with `jq -r '.tool_input.file_path // empty'` when `jq` is on PATH. When `jq` is absent, fall back to a best-effort `grep`+`sed` regex extraction of `"file_path":"..."`. If neither yields a non-empty path (missing jq AND fallback finds nothing, empty stdin, or malformed JSON), exit 0 — fail-safe, never blocks the tool call on a hook-plumbing problem.
- BR-3 "UI file" match is unchanged from the pre-fix script: path contains `app/` or `components/` AND ends in `.tsx`, `.ts`, `.jsx`, or `.css`.
- BR-4 The hook blocks (`exit 2` + the stderr message) only when `npm run check:palette` itself exits non-zero after a matching UI file was edited. Every other case — non-UI file, no file path, no stdin, malformed JSON, jq missing and fallback also empty — exits 0 with no output.

## Edge cases

- EC-1 IF the stdin payload names a UI file that currently violates `check:palette` THEN the hook exits 2 and prints the file path + fix hint to stderr (BR-4).
- EC-2 IF the matched UI file is clean THEN the hook exits 0 with no stdout/stderr (BR-4).
- EC-3 IF the edited file is outside `app/**`/`components/**` or has a non-matching extension THEN the hook exits 0 immediately, `check:palette` is never invoked (BR-3).
- EC-4 IF stdin is empty/unset/not valid JSON, OR the payload has a `tool_input` with no `file_path` (e.g. a Bash tool's `command` field) THEN the hook exits 0 silently — never throws, never blocks the tool call (BR-2).
- EC-5 IF `jq` is not installed on the host THEN the regex fallback is used; if that also can't find a path, the hook exits 0 (BR-2).

## Data

- None. No schema or migration — this is a hook-script contract fix only.

## Seams & refs

- Reuse: the case-match (`*app/*|*components/*` → `*.tsx|*.ts|*.jsx|*.css`) and the `npm run check:palette` invocation are unchanged from the original (buggy) script — only the input-reading contract changes.
- Refs: `.claude/hooks/session-start.sh` (the sibling hook that proves `$CLAUDE_PROJECT_DIR` is real and PostToolUse/SessionStart hooks do fire) · `.claude/settings.json` (the wiring — owned by CAM-690/PR #773, not touched here; it also has a PreToolUse Bash hook reading `$CLAUDE_TOOL_INPUT_command`, almost certainly the same dead-env-var bug — flagged below, not fixed here).

## Out of scope

- `.claude/settings.json`'s PreToolUse Bash hook (`$CLAUDE_TOOL_INPUT_command`) — same bug class, but `.claude/settings.json` is explicitly owned by CAM-690 (PR #773, in flight). Flagged for a follow-up ticket if CAM-690 doesn't already carry the fix.
- Report-mode rollout — not needed here: `npm run check:palette` was already measured PASS repo-wide (0 violations, CI-enforced) before this fix, so there is no backlog; the guard goes straight to blocking.

## Self-verify

- AC-1..4 → verified by hand-feeding the shipped script real JSON payloads on stdin (not via a live Edit/Write tool call — see the PR notes: Read/Write/Edit tools were unavailable for the whole session, so evidence here is manual-payload only, stated plainly rather than conflated with a live tool-call observation). A real UI file was temporarily made to violate the palette guard, fed through the script, and reverted (not committed) to prove AC-1; a clean real UI file proved AC-2; a doc file proved AC-3; an empty/malformed/no-file-path payload proved AC-4. A stubbed PATH with `jq` removed proved the BR-2 fallback (EC-5).
- Story-specific: no ownership/migration to test (no data touched); the fail-safe direction (never block on a hook-plumbing error) was verified for empty stdin and malformed JSON.
- Gate = `/quality-gate` · Done = every AC verified (this story has no product screen, so "the real Staging URL" verification does not apply — verification is the hand-fed-payload evidence above, on the shipped script, in this PR).

## Changelog

- v1 (2026-08-06) — created
