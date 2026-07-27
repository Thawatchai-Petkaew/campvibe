---
linear: CAM-577
feature: platform-hardening
epic: taxonomy-ui-foundation
persona: platform
artifact: story
owner: devops-release
status: in-progress
version: v1
updated: 2026-07-27
---
# Let agents read their own ticket from a worktree (CAM-577)

## Story
As the **platform** (every agent dispatched into a `.claude/worktrees/agent-*` checkout), I want `node scripts/ticket-sync.mjs show|list|audit` to work from inside a worktree, and to fail loudly (never silently) when it genuinely cannot reach the ticket DB, so that an agent always either reads its ticket's comments (owner rulings, re-scopings, corrections recorded mid-flight) or knows unmistakably that it is missing them — instead of quietly working from dispatch text alone and not knowing it.
Why: reported by CAM-569's Frontend — `show`/`audit` failed inside its worktree with `STATUS_TOKEN missing in .env`, and it worked around this by luck (dispatch text + neighbouring story.md files happened to be enough), not by design. Several tickets already carry owner decisions recorded only in comments; an agent that can't read them doesn't know it's missing anything.
Scope: `scripts/ticket-sync.mjs` env resolution (`loadEnv`) and the STATUS_TOKEN-missing failure path only. Does not add a scoped/read-only server-side token (would touch `lib/status-auth.ts` + `app/api/tickets/*`, out of this story's file surface) — the existing STATUS_TOKEN remains the one shared secret for both read and write; this story only fixes how a worktree process locates it and how loudly it fails when it still can't.
Depends on: none.

## AC
| # | Given | When | Then (dev-facing, plain language — no end-user copy change) | System effect | Neg/edge |
|---|---|---|---|---|---|
| AC-1 | An agent is running `ticket-sync.mjs` from inside a `git worktree` checkout (e.g. `.claude/worktrees/agent-*`) whose own directory has no `.env`/`.env.local`, but the main repo checkout's `.env` has a valid `STATUS_TOKEN` | The agent runs `show <CAM-id>` / `list` / `audit` | The command runs normally — ticket detail (incl. its last comments) prints, exactly as it would from the main checkout | `loadEnv` reads `STATUS_TOKEN` (and `APP_BASE_URL`/`TICKET_SYNC_ACTOR` if set) from the main checkout's `.env`/`.env.local`, found by following the worktree's `.git` pointer file back to `<main-repo>/.git`; nothing is copied or written into the worktree | EC-1 |
| AC-2 | The worktree's own `.env`/`.env.local` DOES define `STATUS_TOKEN` (a deliberate local override) | The agent runs any ticket-sync command | The worktree-local value is used, not the main checkout's | Worktree-local `.env`/`.env.local` values are read after (so they win over) the main-checkout fallback | EC-2 |
| AC-3 | No `STATUS_TOKEN` can be found in the worktree, the main checkout, nor `process.env` | The agent runs any ticket-sync command | The command prints an unmistakable, multi-line failure naming every file path it checked and stating plainly that ticket comments (owner rulings/re-scopes/corrections) are INVISIBLE right now and this must not be read as "the ticket has nothing to add" | Process exits with a distinct code (`12`, separate from the generic `1` and the existing `gates`=10/`audit`=11 codes) so the failure is distinguishable from an ordinary API/validation error; no file path's contents nor the token value is ever printed | — (this IS the failure-twin case) |
| AC-4 | (regression guard) `STATUS_TOKEN` is set directly in the process environment (e.g. exported by CI) | The agent runs any ticket-sync command from any directory | The command runs normally, exactly as before this change | `process.env` still wins over both `.env` file locations (unchanged precedence: file values loaded first, then spread under `process.env`) | EC-3 |

## Rules
- BR-1 Env-file read order (lowest → highest priority, later wins on key collision): main-checkout `.env` → main-checkout `.env.local` → worktree-cwd `.env` → worktree-cwd `.env.local` → `process.env`. The main-checkout fallback is skipped entirely when `cwd` is not a linked worktree (i.e. running from the main checkout itself, where `.git` is a real directory, not a pointer file) — no redundant re-read of the same files. (proves AC-1/AC-2/AC-4)
- BR-2 The main checkout is located by reading the worktree's `.git` file (git's own `gitdir: <main-repo>/.git/worktrees/<name>` pointer format) and deriving `<main-repo>` from it — never by shelling out to `git`, never by assuming a fixed path. If the pointer doesn't match this shape, resolution yields nothing extra (falls back to worktree-only, i.e. today's behavior) rather than guessing a wrong path. (proves AC-1)
- BR-3 On a still-missing `STATUS_TOKEN`, the process prints every `(dir, file)` path it checked (paths only, never file contents or the token value — `.claude/rules/security.md`) and exits `12`. (proves AC-3)
- BR-4 No secret is ever created, copied, or committed by this fix: no new `.env` file is written into any worktree, and `.env*` remains gitignored except the two tracked example files (`.gitignore` unchanged).

## Edge cases
- EC-1 IF the worktree's `.git` file exists but doesn't match the `gitdir: .../worktrees/<name>` shape (an unexpected/future git internal format) THEN `resolveMainRepoDir` returns null and resolution silently falls back to worktree-cwd-only lookup (today's pre-fix behavior, not a crash) (BR-2).
- EC-2 IF a worktree-local `.env.local` sets `STATUS_TOKEN` to a different value than the main checkout's THEN the worktree-local value is what's actually sent on the `x-status-token` header (BR-1).
- EC-3 IF `STATUS_TOKEN` is exported in `process.env` AND also present in `.env` files THEN `process.env` wins (unchanged precedence — `ENV = { ...loadEnv(), ...process.env }`) (BR-1).

## Data
- No schema/DB change. No migration. No new files committed other than this spec + `.env.example`'s clarifying comment (if the tooling permission allowed; otherwise the same guidance lives in `scripts/ticket-sync.mjs`'s header comment).

## Seams & refs
- Reuse: `scripts/ticket-sync.mjs`'s existing `loadEnv()` (extended in place, no parallel env-loading path added) · the same file's existing exit-code convention (`10`=gates cleared, `11`=audit drift; this adds `12`=ticket-DB-unreachable).
- Refs: none (no ADR; this is a CLI-tooling env-resolution fix, not an architecture change).

## Out of scope
- A genuinely scoped read-only STATUS_TOKEN (separate from the write-capable one) at the API layer — would require touching `lib/status-auth.ts` + `app/api/tickets/*`, both out of this story's file surface; follow-up ticket if the owner wants that stronger boundary.
- Fixing any OTHER script's env resolution (e.g. `scripts/db-sync-from-staging.mjs`) — this story is scoped to `ticket-sync.mjs` only.

## Self-verify
- AC-1..AC-4 → manual reproduction from inside the actual worktree (`node scripts/ticket-sync.mjs show <CAM-id-with-comments>` before/after the fix) — a CLI env-resolution fix exercised in its real failing environment, per the dispatch's own instruction; no new automated test file is in this story's file surface.
- Story-specific: prove a REAL ticket comment is readable from inside the worktree post-fix (not just that the command exits 0); prove the loud-failure path (AC-3) by simulating a directory with no reachable `.env` anywhere.
- Gate = `/quality-gate` · Done = verified AC on localhost (dev DB) before merge into `dev`.

## Changelog
- v1 (2026-07-27) — created.
