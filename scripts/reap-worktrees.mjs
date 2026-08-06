#!/usr/bin/env node
/**
 * reap-worktrees.mjs — CAM-690: dry-run-only worktree reaper.
 *
 * The reap key is a CONFIRMED GitHub-side MERGED pull request per branch
 * (BR-3). `git merge-base --is-ancestor` MUST NOT be used — measured
 * (tech.md): TRUE for 0 of 92 actually-merged branches, because this repo
 * squash-merges (the merge commit's parent is never an ancestor of the
 * feature branch tip). This script fetches the merged-PR list in ONE `gh pr
 * list` call (the same method tech.md's own measurement used — far cheaper
 * and less rate-limit-prone than one `gh pr view` per branch, and produces
 * the identical fact: a confirmed `state: MERGED` per `headRefName`) and
 * joins it against `git worktree list --porcelain` locally.
 *
 * Fails CLOSED (BR-5): no merged PR found, a `gh` error, or an
 * unauthenticated `gh` all mean KEEP. Never deletes branches (BR-6) —
 * removal is `git worktree remove --force` only, and only under --apply.
 *
 * --apply performs the actual removal and re-checks each worktree's git
 * status LIVE, immediately before removing it (EC-4 — never from the dry-run
 * snapshot; another session may be writing in these trees). This script
 * ships with --apply CODED but the agent that authored it must NEVER
 * invoke it with --apply — the orchestrator runs that, after reading the
 * dry-run report.
 *
 * Usage:
 *   node scripts/reap-worktrees.mjs             # dry run (default, safe, read-only)
 *   node scripts/reap-worktrees.mjs --json       # dry run, machine-readable
 *   node scripts/reap-worktrees.mjs --apply      # ACTUALLY removes worktrees — orchestrator only, never the authoring agent
 */

import { execFileSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const GH_PR_LIST_LIMIT = 1000;

function sh(cmd, args) {
  // stderr piped (not inherited) so a failing lookup (e.g. `git -C
  // <gone-worktree> status`) reports through the normal ok:false/error
  // path instead of leaking a raw `fatal: ...` line to the terminal.
  return execFileSync(cmd, args, {
    encoding: "utf8",
    maxBuffer: 64 * 1024 * 1024,
    stdio: ["ignore", "pipe", "pipe"],
  });
}

export function mainTreePath() {
  const gitCommonDir = sh("git", ["rev-parse", "--path-format=absolute", "--git-common-dir"]).trim();
  return path.dirname(gitCommonDir);
}

/** Parse `git worktree list --porcelain` output into structured entries. */
export function parseWorktrees(porcelain) {
  const blocks = porcelain
    .split("\n\n")
    .map((b) => b.trim())
    .filter(Boolean);
  return blocks
    .map((block) => {
      const lines = block.split("\n");
      const entry = { path: null, head: null, branch: null, locked: false, prunable: false, detached: false };
      for (const line of lines) {
        if (line.startsWith("worktree ")) entry.path = line.slice("worktree ".length).trim();
        else if (line.startsWith("HEAD ")) entry.head = line.slice("HEAD ".length).trim();
        else if (line.startsWith("branch ")) {
          const ref = line.slice("branch ".length).trim();
          entry.branch = ref.startsWith("refs/heads/") ? ref.slice("refs/heads/".length) : ref;
        } else if (line === "detached") entry.detached = true;
        else if (line === "locked" || line.startsWith("locked ")) entry.locked = true;
        else if (line === "prunable" || line.startsWith("prunable ")) entry.prunable = true;
      }
      return entry;
    })
    .filter((e) => e.path);
}

/** BR-3: fetch every MERGED PR's headRefName in one call, never per-branch, never merge-base. */
export function fetchMergedBranches() {
  try {
    const raw = sh("gh", [
      "pr",
      "list",
      "--state",
      "merged",
      "--limit",
      String(GH_PR_LIST_LIMIT),
      "--json",
      "headRefName,number,url",
    ]);
    const list = JSON.parse(raw);
    if (list.length >= GH_PR_LIST_LIMIT) {
      process.stderr.write(
        `reap-worktrees: WARNING gh pr list returned >= ${GH_PR_LIST_LIMIT} rows, possible truncation.\n`
      );
    }
    const map = new Map();
    for (const pr of list) map.set(pr.headRefName, pr);
    return { ok: true, map };
  } catch (err) {
    return { ok: false, error: err?.message ?? String(err) };
  }
}

/** Tracked-vs-untracked split of `git status --porcelain` for one worktree. */
export function gitStatusPorcelain(dir) {
  try {
    const raw = sh("git", ["-C", dir, "status", "--porcelain"]);
    const lines = raw.split("\n").filter(Boolean);
    const untracked = lines.filter((l) => l.startsWith("??"));
    const tracked = lines.filter((l) => !l.startsWith("??"));
    return { ok: true, trackedDirty: tracked, untrackedCount: untracked.length };
  } catch (err) {
    return { ok: false, error: err?.message ?? String(err) };
  }
}

export function duKB(dir) {
  try {
    const raw = sh("du", ["-sk", dir]);
    const kb = parseInt(raw.split("\t")[0], 10);
    return Number.isFinite(kb) ? kb : 0;
  } catch {
    return 0;
  }
}

/**
 * Classify every worktree (except the main tree) as reapable or kept, with
 * a stated reason. Pure of side effects other than the read-only git/gh/du
 * calls above — never removes anything.
 */
export function classify({ mainPath, worktrees, merged }) {
  const results = [];
  for (const w of worktrees) {
    if (path.resolve(w.path) === path.resolve(mainPath)) continue;

    const row = {
      path: w.path,
      branch: w.branch,
      locked: w.locked,
      keep: true,
      reasons: [],
      untrackedCount: null,
      prMergedUrl: null,
    };

    const status = gitStatusPorcelain(w.path);
    if (status.ok) row.untrackedCount = status.untrackedCount;

    if (!merged.ok) {
      row.reasons.push(`gh unavailable — failing closed (BR-5): ${merged.error}`);
      results.push(row);
      continue;
    }

    if (w.detached || !w.branch) {
      row.reasons.push("detached HEAD — no branch to confirm via a merged PR");
      results.push(row);
      continue;
    }

    const pr = merged.map.get(w.branch);
    if (!pr) {
      row.reasons.push(`no merged PR found for branch "${w.branch}" (BR-5: fail closed)`);
      results.push(row);
      continue;
    }
    row.prMergedUrl = pr.url;

    if (w.locked) {
      row.reasons.push("worktree is locked (git worktree lock)");
      results.push(row);
      continue;
    }

    if (!status.ok) {
      row.reasons.push(`git status failed — failing closed: ${status.error}`);
      results.push(row);
      continue;
    }

    if (status.trackedDirty.length > 0) {
      row.reasons.push(`uncommitted tracked changes (EC-4): ${status.trackedDirty.length} file(s)`);
      results.push(row);
      continue;
    }

    row.keep = false; // reapable: confirmed merged PR, not locked, tracked-clean
    results.push(row);
  }
  return results;
}

function printHumanReport({ reapable, kept, totalGB }) {
  console.log(
    `reap-worktrees (dry run): ${reapable.length} worktree(s) would be reaped, ~${totalGB.toFixed(2)} GB reclaimed.\n`
  );
  console.log("Would reap:");
  for (const r of reapable) {
    const gb = ((r.sizeKB || 0) / (1024 * 1024)).toFixed(2);
    console.log(`  - ${r.path} [${r.branch}] ${gb} GB, untracked files: ${r.untrackedCount}, PR: ${r.prMergedUrl}`);
  }
  console.log(`\nKept (${kept.length}):`);
  for (const r of kept) {
    const untracked = r.untrackedCount != null ? ` (untracked: ${r.untrackedCount})` : "";
    console.log(`  - ${r.path} [${r.branch ?? "detached"}]: ${r.reasons.join("; ")}${untracked}`);
  }
}

function runApply(reapable) {
  // BR-6: never delete branches. EC-4: re-check status LIVE, immediately
  // before each removal — never from the dry-run snapshot above (another
  // session may be writing in these trees).
  for (const r of reapable) {
    const live = gitStatusPorcelain(r.path);
    if (!live.ok || live.trackedDirty.length > 0) {
      process.stderr.write(`reap-worktrees: SKIP ${r.path} — dirtied since the dry-run scan.\n`);
      continue;
    }
    sh("git", ["worktree", "remove", "--force", r.path]);
    process.stdout.write(`reap-worktrees: removed ${r.path}\n`);
  }
}

function main() {
  const args = process.argv.slice(2);
  const APPLY = args.includes("--apply");
  const JSON_OUT = args.includes("--json");

  const mainPath = mainTreePath();
  const porcelain = sh("git", ["worktree", "list", "--porcelain"]);
  const worktrees = parseWorktrees(porcelain);
  const merged = fetchMergedBranches();

  const results = classify({ mainPath, worktrees, merged });
  const reapable = results.filter((r) => !r.keep);
  const kept = results.filter((r) => r.keep);

  if (APPLY) {
    runApply(reapable);
    return;
  }

  let totalKB = 0;
  for (const r of reapable) {
    r.sizeKB = duKB(r.path);
    totalKB += r.sizeKB;
  }
  const totalGB = totalKB / (1024 * 1024);

  if (JSON_OUT) {
    process.stdout.write(
      JSON.stringify(
        { mainTree: mainPath, reapableCount: reapable.length, reclaimGB: Number(totalGB.toFixed(2)), reapable, kept },
        null,
        2
      ) + "\n"
    );
    return;
  }

  printHumanReport({ reapable, kept, totalGB });
}

const isMain = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) main();
