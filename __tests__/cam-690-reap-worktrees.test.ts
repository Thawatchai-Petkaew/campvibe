/**
 * cam-690-reap-worktrees.test.ts — CAM-690 "A dependency install in an agent
 * worktree can no longer reach the owner's tree"
 *
 * Unit tests for the pure logic in scripts/reap-worktrees.mjs: parsing
 * `git worktree list --porcelain`, and the classify() decision cascade —
 * BR-3 (confirmed-MERGED-PR is the reap key, never merge-base) · BR-5 (fail
 * CLOSED: no PR / gh error both mean keep) · BR-6 (never touches branches,
 * only reports) · EC-4 (uncommitted tracked changes keep + name the
 * worktree) · EC-5 (untracked file count is reported regardless).
 *
 * These tests never call `gh`/`git` for real and never touch a real
 * worktree — `classify()` takes a pre-fetched `merged` map and reads git
 * status from real throwaway fixture directories built under os.tmpdir().
 */
import { describe, it, expect, afterEach } from "vitest";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { parseWorktrees, classify, gitStatusPorcelain } from "../scripts/reap-worktrees.mjs";

const tmpDirs: string[] = [];
function mkTmp(prefix: string): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), prefix));
  tmpDirs.push(dir);
  return dir;
}
afterEach(() => {
  while (tmpDirs.length) {
    const dir = tmpDirs.pop()!;
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

/** A real, throwaway git repo (never the real CAMPVIBE repo) so git status works. */
function mkGitRepo(): string {
  const dir = mkTmp("cam690-reap-repo-");
  execFileSync("git", ["init", "-q"], { cwd: dir });
  execFileSync("git", ["config", "user.email", "test@example.com"], { cwd: dir });
  execFileSync("git", ["config", "user.name", "Test"], { cwd: dir });
  fs.writeFileSync(path.join(dir, "README.md"), "seed\n");
  execFileSync("git", ["add", "README.md"], { cwd: dir });
  execFileSync("git", ["commit", "-q", "-m", "seed"], { cwd: dir });
  return dir;
}

describe("CAM-690 parseWorktrees: `git worktree list --porcelain` parsing", () => {
  it("[normal] parses main + branch worktrees", () => {
    const porcelain = [
      "worktree /repo/main",
      "HEAD abc123",
      "branch refs/heads/dev",
      "",
      "worktree /repo/.claude/worktrees/agent-a1",
      "HEAD def456",
      "branch refs/heads/feature/cam-1-foo",
      "",
    ].join("\n");
    const result = parseWorktrees(porcelain);
    expect(result).toHaveLength(2);
    expect(result[0]).toMatchObject({ path: "/repo/main", branch: "dev" });
    expect(result[1]).toMatchObject({ path: "/repo/.claude/worktrees/agent-a1", branch: "feature/cam-1-foo" });
  });

  it("[boundary] detached HEAD has no branch and detached: true", () => {
    const porcelain = ["worktree /repo/detached", "HEAD abc123", "detached", ""].join("\n");
    const result = parseWorktrees(porcelain);
    expect(result[0].branch).toBeNull();
    expect(result[0].detached).toBe(true);
  });

  it("[boundary] a locked worktree is flagged", () => {
    const porcelain = ["worktree /repo/locked", "HEAD abc123", "branch refs/heads/wip", "locked", ""].join("\n");
    const result = parseWorktrees(porcelain);
    expect(result[0].locked).toBe(true);
  });

  it("[null/empty] empty porcelain output parses to an empty list", () => {
    expect(parseWorktrees("")).toEqual([]);
  });
});

describe("CAM-690 classify: BR-3/BR-5/BR-6/EC-4/EC-5", () => {
  it("AC-4/BR-3: a branch with a confirmed MERGED PR, clean tree, is reapable", () => {
    const repo = mkGitRepo();
    const merged = { ok: true, map: new Map([["feature/x", { url: "https://x/pr/1" }]]) };
    const worktrees = [{ path: repo, branch: "feature/x", locked: false, detached: false, head: "x" }];
    const results = classify({ mainPath: "/does-not-exist-main", worktrees, merged });
    expect(results).toHaveLength(1);
    expect(results[0].keep).toBe(false);
    expect(results[0].prMergedUrl).toBe("https://x/pr/1");
  });

  it("BR-5: no merged PR found -> keep (fail closed)", () => {
    const repo = mkGitRepo();
    const merged = { ok: true, map: new Map() };
    const worktrees = [{ path: repo, branch: "feature/orphan", locked: false, detached: false, head: "x" }];
    const results = classify({ mainPath: "/does-not-exist-main", worktrees, merged });
    expect(results[0].keep).toBe(true);
    expect(results[0].reasons[0]).toMatch(/no merged PR/);
  });

  it("BR-5: gh unavailable -> keep EVERYTHING (fail closed)", () => {
    const repo = mkGitRepo();
    const merged = { ok: false, error: "gh: command not found" };
    const worktrees = [{ path: repo, branch: "feature/x", locked: false, detached: false, head: "x" }];
    const results = classify({ mainPath: "/does-not-exist-main", worktrees, merged });
    expect(results[0].keep).toBe(true);
    expect(results[0].reasons[0]).toMatch(/gh unavailable/);
  });

  it("EC-4: uncommitted tracked changes -> keep and name it, even with a merged PR", () => {
    const repo = mkGitRepo();
    fs.writeFileSync(path.join(repo, "README.md"), "dirtied\n");
    const merged = { ok: true, map: new Map([["feature/x", { url: "https://x/pr/1" }]]) };
    const worktrees = [{ path: repo, branch: "feature/x", locked: false, detached: false, head: "x" }];
    const results = classify({ mainPath: "/does-not-exist-main", worktrees, merged });
    expect(results[0].keep).toBe(true);
    expect(results[0].reasons[0]).toMatch(/uncommitted tracked changes/);
  });

  it("EC-5: untracked files are reported even on a worktree that ends up reapable", () => {
    const repo = mkGitRepo();
    fs.writeFileSync(path.join(repo, "scratch.txt"), "untracked\n");
    const merged = { ok: true, map: new Map([["feature/x", { url: "https://x/pr/1" }]]) };
    const worktrees = [{ path: repo, branch: "feature/x", locked: false, detached: false, head: "x" }];
    const results = classify({ mainPath: "/does-not-exist-main", worktrees, merged });
    expect(results[0].keep).toBe(false); // untracked alone does not block removal
    expect(results[0].untrackedCount).toBe(1);
  });

  it("[boundary] a locked worktree is kept even with a confirmed merged PR", () => {
    const repo = mkGitRepo();
    const merged = { ok: true, map: new Map([["feature/x", { url: "https://x/pr/1" }]]) };
    const worktrees = [{ path: repo, branch: "feature/x", locked: true, detached: false, head: "x" }];
    const results = classify({ mainPath: "/does-not-exist-main", worktrees, merged });
    expect(results[0].keep).toBe(true);
    expect(results[0].reasons[0]).toMatch(/locked/);
  });

  it("[boundary] detached HEAD is kept (no branch to confirm)", () => {
    const repo = mkGitRepo();
    const merged = { ok: true, map: new Map() };
    const worktrees = [{ path: repo, branch: null, locked: false, detached: true, head: "x" }];
    const results = classify({ mainPath: "/does-not-exist-main", worktrees, merged });
    expect(results[0].keep).toBe(true);
    expect(results[0].reasons[0]).toMatch(/detached HEAD/);
  });

  it("BR-6 contract check: classify() never removes anything or touches a branch (read-only)", () => {
    const repo = mkGitRepo();
    const merged = { ok: true, map: new Map([["feature/x", { url: "https://x/pr/1" }]]) };
    const worktrees = [{ path: repo, branch: "feature/x", locked: false, detached: false, head: "x" }];
    classify({ mainPath: "/does-not-exist-main", worktrees, merged });
    // the repo directory and its git metadata are untouched
    expect(fs.existsSync(path.join(repo, ".git"))).toBe(true);
    expect(fs.existsSync(path.join(repo, "README.md"))).toBe(true);
  });

  it("[normal] the main tree itself is excluded from classification", () => {
    const repo = mkGitRepo();
    const merged = { ok: true, map: new Map() };
    const worktrees = [{ path: repo, branch: "dev", locked: false, detached: false, head: "x" }];
    const results = classify({ mainPath: repo, worktrees, merged });
    expect(results).toHaveLength(0);
  });
});

describe("CAM-690 gitStatusPorcelain: tracked vs untracked split", () => {
  it("[normal] splits tracked-dirty from untracked lines", () => {
    const repo = mkGitRepo();
    fs.writeFileSync(path.join(repo, "README.md"), "dirtied\n");
    fs.writeFileSync(path.join(repo, "scratch.txt"), "untracked\n");
    const status = gitStatusPorcelain(repo);
    expect(status.ok).toBe(true);
    expect(status.trackedDirty).toHaveLength(1);
    expect(status.untrackedCount).toBe(1);
  });

  it("[error] a nonexistent directory fails ok:false, never throws", () => {
    const status = gitStatusPorcelain("/no/such/repo/at/all");
    expect(status.ok).toBe(false);
  });
});
