/**
 * cam-690-npm-guard.test.ts — CAM-690 "A dependency install in an agent
 * worktree can no longer reach the owner's tree"
 *
 * Unit tests for the pure logic in scripts/guard-shared-node-modules.mjs:
 * BR-1 (guarded npm verbs) · BR-2 (CAMPVIBE_ALLOW_SHARED_NPM=1 bypass) ·
 * BR-4 (the refined shared-tree predicate) · EC-1 (a worktree with its own
 * real node_modules never fires) · EC-2 (`cd <dir> && ...` resolves the
 * target from that `cd`, not the payload's cwd).
 *
 * Every fixture tree here is built fresh under os.tmpdir() and torn down
 * after each test — never a real worktree, never scripts/worktree-setup.sh
 * run against the real main tree (HARD SAFETY RULE: no npm install/update
 * anywhere in this suite; only fs.mkdirSync/symlinkSync fixtures).
 */
import { describe, it, expect, afterEach } from "vitest";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import {
  matchesGuardedVerb,
  hasAllowBypass,
  resolveTargetDir,
  isSharedTree,
  evaluateGuard,
} from "../scripts/guard-shared-node-modules.mjs";

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

describe("CAM-690 BR-1: matchesGuardedVerb fires on the guarded npm verbs only", () => {
  it.each([
    ["npm install"],
    ["npm i"],
    ["npm add lodash"],
    ["npm update"],
    ["npm up"],
    ["npm ci"],
    ["npm dedupe"],
    ["npm prune"],
  ])("[unit] fires on '%s'", (command) => {
    expect(matchesGuardedVerb(command)).toBe(true);
  });

  it.each([["npm run build"], ["npm run npm-update"], ["npm test"], ["npx tsc --noEmit"], ["npx --yes cowsay hi"]])(
    "[unit] does NOT fire on '%s' (BR-1 negative)",
    (command) => {
      expect(matchesGuardedVerb(command)).toBe(false);
    }
  );

  it("[unit] fires on a guarded verb chained after a benign command", () => {
    expect(matchesGuardedVerb("npm run lint && npm update")).toBe(true);
  });

  it("[null/empty] non-string or empty command never fires", () => {
    expect(matchesGuardedVerb("")).toBe(false);
    expect(matchesGuardedVerb(undefined as unknown as string)).toBe(false);
  });
});

describe("CAM-690 BR-2: CAMPVIBE_ALLOW_SHARED_NPM=1 bypass", () => {
  it("[unit] bypasses via ambient env", () => {
    expect(hasAllowBypass("npm update", { CAMPVIBE_ALLOW_SHARED_NPM: "1" })).toBe(true);
  });

  it("[unit] bypasses via an inline assignment in the command text", () => {
    expect(hasAllowBypass("CAMPVIBE_ALLOW_SHARED_NPM=1 npm update", {})).toBe(true);
  });

  it("[boundary] does NOT bypass on a falsy/wrong value", () => {
    expect(hasAllowBypass("npm update", { CAMPVIBE_ALLOW_SHARED_NPM: "0" })).toBe(false);
    expect(hasAllowBypass("npm update", {})).toBe(false);
  });
});

describe("CAM-690 EC-2: resolveTargetDir resolves from a leading `cd <dir> &&`", () => {
  it("[unit] resolves the target from the cd prefix, not the payload cwd", () => {
    expect(resolveTargetDir("cd ../other-worktree && npm update", "/a/b/here")).toBe(
      path.resolve("/a/b/here", "../other-worktree")
    );
  });

  it("[unit] falls back to the payload cwd with no cd prefix", () => {
    expect(resolveTargetDir("npm update", "/a/b/here")).toBe("/a/b/here");
  });

  it("[unit] handles a quoted cd path", () => {
    expect(resolveTargetDir('cd "../my worktree" && npm update', "/a/b/here")).toBe(
      path.resolve("/a/b/here", "../my worktree")
    );
  });
});

describe("CAM-690 BR-4: isSharedTree (refined shared-tree predicate)", () => {
  it("[normal] a scope namespace dir symlinked OUTSIDE the tree is shared/unsafe", () => {
    const main = mkTmp("cam690-main-");
    const child = mkTmp("cam690-child-");
    fs.mkdirSync(path.join(main, "node_modules", "@scope", "pkg"), { recursive: true });
    fs.mkdirSync(path.join(child, "node_modules"), { recursive: true });
    fs.symlinkSync(path.join(main, "node_modules", "@scope"), path.join(child, "node_modules", "@scope"));
    expect(isSharedTree(child)).toBe(true);
  });

  it("[normal] .bin symlinked OUTSIDE the tree is shared/unsafe", () => {
    const main = mkTmp("cam690-main-");
    const child = mkTmp("cam690-child-");
    fs.mkdirSync(path.join(main, "node_modules", ".bin"), { recursive: true });
    fs.mkdirSync(path.join(child, "node_modules"), { recursive: true });
    fs.symlinkSync(path.join(main, "node_modules", ".bin"), path.join(child, "node_modules", ".bin"));
    expect(isSharedTree(child)).toBe(true);
  });

  it("[normal] a REAL @scope dir (per-child symlinks only) is NOT shared — AC-3's fixed shape", () => {
    const main = mkTmp("cam690-main-");
    const child = mkTmp("cam690-child-");
    fs.mkdirSync(path.join(main, "node_modules", "@scope", "pkg"), { recursive: true });
    fs.mkdirSync(path.join(child, "node_modules", "@scope"), { recursive: true });
    fs.symlinkSync(path.join(main, "node_modules", "@scope", "pkg"), path.join(child, "node_modules", "@scope", "pkg"));
    // unscoped package still a plain top-level symlink — proven safe, unaffected
    fs.mkdirSync(path.join(main, "node_modules", "chalk"), { recursive: true });
    fs.symlinkSync(path.join(main, "node_modules", "chalk"), path.join(child, "node_modules", "chalk"));
    expect(isSharedTree(child)).toBe(false);
  });

  it("[EC-1] a worktree with its own REAL node_modules (no symlinks at all) never fires", () => {
    const dir = mkTmp("cam690-real-");
    fs.mkdirSync(path.join(dir, "node_modules", "@scope", "pkg"), { recursive: true });
    fs.mkdirSync(path.join(dir, "node_modules", ".bin"), { recursive: true });
    expect(isSharedTree(dir)).toBe(false);
  });

  it("[null/empty] no node_modules at all is NOT shared (nothing to protect, never bricks first-time setup)", () => {
    const dir = mkTmp("cam690-empty-");
    expect(isSharedTree(dir)).toBe(false);
  });

  it("[boundary] a broken symlink (target since removed) still reads as the unsafe shape", () => {
    const dir = mkTmp("cam690-broken-");
    fs.mkdirSync(path.join(dir, "node_modules"), { recursive: true });
    fs.symlinkSync("/no/such/path/ever", path.join(dir, "node_modules", "@scope"));
    expect(isSharedTree(dir)).toBe(true);
  });

  it("[boundary] a nonexistent directory resolves to not-shared, never throws", () => {
    expect(isSharedTree("/no/such/worktree/at/all")).toBe(false);
  });
});

describe("CAM-690 evaluateGuard: the full decision (AC-1/AC-2/AC-3 integration)", () => {
  it("AC-1: blocks a guarded verb in a shared tree, message includes the Thai copy", () => {
    const main = mkTmp("cam690-main-");
    const child = mkTmp("cam690-child-");
    fs.mkdirSync(path.join(main, "node_modules", "@scope", "pkg"), { recursive: true });
    fs.mkdirSync(path.join(child, "node_modules"), { recursive: true });
    fs.symlinkSync(path.join(main, "node_modules", "@scope"), path.join(child, "node_modules", "@scope"));

    const result = evaluateGuard({ command: "npm update", cwd: child, env: {} });
    expect(result.blocked).toBe(true);
    expect(result.message).toContain(
      "ห้ามติดตั้งแพ็กเกจ (npm install/update/ci/add/dedupe/prune) ในสำเนา (worktree) ที่ใช้ node_modules ร่วมกับต้นฉบับ"
    );
  });

  it("AC-2: yields when CAMPVIBE_ALLOW_SHARED_NPM=1 is present, even in a shared tree", () => {
    const main = mkTmp("cam690-main-");
    const child = mkTmp("cam690-child-");
    fs.mkdirSync(path.join(main, "node_modules", "@scope", "pkg"), { recursive: true });
    fs.mkdirSync(path.join(child, "node_modules"), { recursive: true });
    fs.symlinkSync(path.join(main, "node_modules", "@scope"), path.join(child, "node_modules", "@scope"));

    const result = evaluateGuard({ command: "npm update", cwd: child, env: { CAMPVIBE_ALLOW_SHARED_NPM: "1" } });
    expect(result.blocked).toBe(false);
    expect(result.reason).toBe("allow-bypass");
  });

  it("AC-3: yields for a fixed-shape tree (real @scope, per-child symlinks)", () => {
    const main = mkTmp("cam690-main-");
    const child = mkTmp("cam690-child-");
    fs.mkdirSync(path.join(main, "node_modules", "@scope", "pkg"), { recursive: true });
    fs.mkdirSync(path.join(child, "node_modules", "@scope"), { recursive: true });
    fs.symlinkSync(path.join(main, "node_modules", "@scope", "pkg"), path.join(child, "node_modules", "@scope", "pkg"));

    const result = evaluateGuard({ command: "npm update", cwd: child, env: {} });
    expect(result.blocked).toBe(false);
    expect(result.reason).toBe("isolated-tree");
  });

  it("[unit] a non-guarded command never even reaches the tree check", () => {
    const result = evaluateGuard({ command: "npm run build", cwd: "/does/not/matter", env: {} });
    expect(result.blocked).toBe(false);
    expect(result.reason).toBe("not-a-guarded-verb");
  });
});
