#!/usr/bin/env node
/**
 * guard-shared-node-modules.mjs — CAM-690: the PreToolUse guard that refuses
 * `npm install|i|add|update|up|ci|dedupe|prune` inside a worktree whose
 * node_modules still symlinks a `@scope` namespace directory or `.bin` into
 * the main tree. That is the exact write-through vector that emptied ~150
 * real packages in the owner's live dev tree (CAM-687) — see
 * docs/specs/ai-workflow/agent-safety/CAM-690-worktree-install-guard/tech.md
 * for the measured root cause.
 *
 * Two ways to run this file:
 *
 *  1. As the PreToolUse hook (`.claude/hooks/npm-shared-node-modules-guard.sh`
 *     execs `node scripts/guard-shared-node-modules.mjs` with no args): reads
 *     the real hook contract from stdin — JSON carrying `.cwd` and
 *     `.tool_input.command` — and on a refusal prints
 *     `{ hookSpecificOutput: { hookEventName, permissionDecision: "deny",
 *     permissionDecisionReason } }` to stdout (the confirmed real contract,
 *     see tech.md), the same reason to stderr, and exits 2. On a yield it
 *     prints NOTHING and exits 0 (AC-2/AC-3: no warning at all).
 *
 *  2. As the `preinstall` REPORT-ONLY reporter (`--preinstall-report`):
 *     checks the current directory, prints a non-blocking warning to stderr
 *     if it is a shared/unsafe tree, and ALWAYS exits 0 — this layer REPORTS,
 *     it never PREVENTS (decision #3), and it fails OPEN when node_modules
 *     is absent (decision #4) so a first-time CI/Vercel `npm ci` is never
 *     bricked by this script.
 *
 * The exported functions below are the pure, independently unit-tested
 * logic (see __tests__/cam-690-npm-guard.test.ts) — BR-1 verb matching,
 * BR-2 the CAMPVIBE_ALLOW_SHARED_NPM=1 bypass, EC-2 `cd <dir> &&` target
 * resolution, and the BR-4 shared-tree predicate.
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const GUARDED_VERBS = ["install", "i", "add", "update", "up", "ci", "dedupe", "prune"];

// BR-1: fires on `npm <verb>`, optionally preceded by inline env assignments
// (so `CAMPVIBE_ALLOW_SHARED_NPM=1 npm update` still counts as a match, which
// BR-2 then separately bypasses). Anchored at the start of a shell segment so
// `npm run <anything>` / `npm test` / `npx ...` never match (BR-1).
const NPM_COMMAND_RE = new RegExp(
  `^(?:[A-Za-z_][A-Za-z0-9_]*=\\S*\\s+)*npm\\s+(${GUARDED_VERBS.join("|")})(\\s|$)`
);

const ALLOW_ENV_RE = /\bCAMPVIBE_ALLOW_SHARED_NPM=1\b/;

const REFUSAL_MESSAGE_TH =
  "คำสั่งถูกปฏิเสธก่อนเริ่มทำงาน: ห้ามติดตั้งแพ็กเกจ (npm install/update/ci/add/dedupe/prune) " +
  "ในสำเนา (worktree) ที่ใช้ node_modules ร่วมกับต้นฉบับ";

const REFUSAL_MESSAGE_EN =
  "CAM-690 guard: this worktree's node_modules still symlinks a @scope namespace directory " +
  "or .bin into the main tree — npm install/update/ci/add/dedupe/prune here can silently " +
  "empty real packages in the owner's live dev tree (the exact CAM-687 incident). Run " +
  "dependency work where node_modules is real (its own `npm ci`), or set " +
  "CAMPVIBE_ALLOW_SHARED_NPM=1 to override deliberately. " +
  "docs/specs/ai-workflow/agent-safety/CAM-690-worktree-install-guard/tech.md";

/** Split a shell command into independently-checkable segments (&&, ||, ;, |). */
export function splitSegments(command) {
  return command
    .split(/&&|\|\||;|\|/)
    .map((s) => s.trim())
    .filter(Boolean);
}

/** BR-1: does any segment of `command` invoke a guarded npm verb? */
export function matchesGuardedVerb(command) {
  if (typeof command !== "string" || !command.trim()) return false;
  return splitSegments(command).some((segment) => NPM_COMMAND_RE.test(segment));
}

/**
 * BR-2: CAMPVIBE_ALLOW_SHARED_NPM=1, either ambient env or inline in the command text.
 * @param {string} command
 * @param {Record<string, string | undefined>} [env]
 */
export function hasAllowBypass(command, env = process.env) {
  if (env && env.CAMPVIBE_ALLOW_SHARED_NPM === "1") return true;
  return typeof command === "string" && ALLOW_ENV_RE.test(command);
}

/**
 * EC-2: if the command is prefixed `cd <dir> && ...`, resolve the target
 * from that `cd`, not from the payload's `.cwd`.
 */
export function resolveTargetDir(command, cwd) {
  const base = cwd ?? process.cwd();
  if (typeof command === "string") {
    const trimmed = command.trim();
    const cdMatch = trimmed.match(/^cd\s+(?:"([^"]+)"|'([^']+)'|(\S+))\s*&&/);
    if (cdMatch) {
      const rawPath = cdMatch[1] ?? cdMatch[2] ?? cdMatch[3];
      return path.resolve(base, rawPath);
    }
  }
  return base;
}

/**
 * BR-4 (refined so a FRESH, fixed worktree passes AC-3): a tree is
 * shared/unsafe only if node_modules exists AND at least one `@scope`
 * namespace directory OR `.bin` is ITSELF a symlink resolving outside this
 * directory. This is a strict subset of the originally-measured "any
 * maxdepth-1 entry is a symlink" predicate (tech.md) — it classifies all 96
 * real trees measured there IDENTICALLY (every "shared symlink farm"
 * worktree has its @scope dirs and .bin symlinked; every isolated
 * node_modules has neither), and it is the refinement that lets a worktree
 * built by the FIXED setup script (which still symlinks ~600 unscoped
 * packages directly — proven safe, tech.md) read as safe: @scope dirs and
 * .bin become real local directories there, so the predicate no longer
 * fires (EC-1 / AC-3).
 */
export function isSharedTree(dir) {
  let realDir;
  try {
    realDir = fs.realpathSync(dir);
  } catch {
    return false;
  }
  const nodeModules = path.join(realDir, "node_modules");
  if (!fs.existsSync(nodeModules)) return false;

  let entries;
  try {
    entries = fs.readdirSync(nodeModules, { withFileTypes: true });
  } catch {
    return false;
  }

  for (const entry of entries) {
    const name = entry.name;
    if (name !== ".bin" && !name.startsWith("@")) continue;
    const full = path.join(nodeModules, name);
    let stat;
    try {
      stat = fs.lstatSync(full);
    } catch {
      continue;
    }
    if (!stat.isSymbolicLink()) continue;
    try {
      const target = fs.realpathSync(full);
      if (target !== realDir && !target.startsWith(realDir + path.sep)) return true;
    } catch {
      // a broken symlink into a since-removed main tree is still the unsafe shape
      return true;
    }
  }
  return false;
}

/**
 * The full decision: BR-1 verb match -> BR-2 bypass -> EC-2 target
 * resolution -> BR-4 shared-tree predicate.
 * @param {{ command?: string, cwd?: string, env?: Record<string, string | undefined> }} args
 */
export function evaluateGuard({ command, cwd, env = process.env }) {
  if (!matchesGuardedVerb(command)) {
    return { blocked: false, reason: "not-a-guarded-verb" };
  }
  if (hasAllowBypass(command, env)) {
    return { blocked: false, reason: "allow-bypass" };
  }
  const targetDir = resolveTargetDir(command, cwd);
  if (!isSharedTree(targetDir)) {
    return { blocked: false, reason: "isolated-tree", targetDir };
  }
  return {
    blocked: true,
    reason: "shared-tree",
    targetDir,
    message: `${REFUSAL_MESSAGE_TH}\n\n${REFUSAL_MESSAGE_EN}`,
  };
}

// ---------------------------------------------------------------------------
// CLI entry points (not exercised by the pure-function unit tests above).
// ---------------------------------------------------------------------------

async function readStdin() {
  let raw = "";
  for await (const chunk of process.stdin) raw += chunk;
  return raw;
}

async function runPreToolUseHook() {
  const raw = await readStdin();
  let payload;
  try {
    payload = JSON.parse(raw);
  } catch {
    // can't parse the payload -> yield silently; never block on our own failure
    process.exit(0);
  }
  const command = payload?.tool_input?.command;
  const cwd = payload?.cwd;
  const result = evaluateGuard({ command, cwd });
  if (!result.blocked) process.exit(0);

  const output = {
    hookSpecificOutput: {
      hookEventName: "PreToolUse",
      permissionDecision: "deny",
      permissionDecisionReason: result.message,
    },
  };
  process.stdout.write(JSON.stringify(output) + "\n");
  process.stderr.write(result.message + "\n");
  process.exit(2);
}

function runPreinstallReport() {
  // L3 (decision #3/#4): REPORTS, never PREVENTS; fails OPEN when
  // node_modules is absent (a first-time `npm ci` on CI/Vercel has none).
  try {
    if (isSharedTree(process.cwd())) {
      process.stderr.write(
        "guard-shared-node-modules.mjs (preinstall REPORT-ONLY, does not block): this " +
          "worktree's node_modules still shares a @scope/.bin symlink with a main tree. " +
          "Measured (tech.md): this check fires too late on `npm install` and NEVER fires " +
          "on `npm update` — the PreToolUse hook is the real guard. If you are seeing this, " +
          "the hook may be missing or bypassed for this session.\n"
      );
    }
  } catch (err) {
    process.stderr.write(
      `guard-shared-node-modules.mjs: preinstall report error (non-blocking): ${err?.message ?? err}\n`
    );
  }
  process.exit(0);
}

const isMain = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) {
  if (process.argv.includes("--preinstall-report")) {
    runPreinstallReport();
  } else {
    runPreToolUseHook().catch((err) => {
      // fail OPEN on an internal bug: a broken guard must never brick every
      // Bash call, only the npm-verb ones it can actually classify.
      process.stderr.write(
        `guard-shared-node-modules.mjs: internal error, yielding: ${err?.message ?? err}\n`
      );
      process.exit(0);
    });
  }
}
