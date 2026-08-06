/**
 * cam-690-guard-hook-env-independence.test.ts — CAM-690 follow-up
 * "the wrapper fails open when $CLAUDE_PROJECT_DIR is absent"
 *
 * MEASURED (coordinator, 2026-08-06): `.claude/hooks/npm-shared-node-modules-guard.sh`
 * read `$CLAUDE_PROJECT_DIR` under `set -u` to locate the repo. That variable is
 * NOT present in a real PreToolUse hook environment (only AGENT_SDK_VERSION,
 * CODE_ENABLE_TASKS, CODE_ENTRYPOINT, CODE_ENABLE_SDK_FILE_CHECKPOINTING,
 * CODE_EXECPATH, CLAUDECODE, CODE_SESSION_ID, CODE_CHILD_SESSION, PID, EFFORT
 * are) — so the wrapper died at the exec line with exit 1, a NON-blocking
 * PreToolUse result (only exit 2 blocks). The guard failed OPEN, silently, on
 * every real invocation. Fix: the wrapper self-locates the repo root from its
 * own path (`${BASH_SOURCE[0]}`, up two directories) and never reads
 * `$CLAUDE_PROJECT_DIR` at all — so it behaves identically whether that
 * variable is absent, correct, or bogus.
 *
 * This suite executes the REAL shipped shell script as a subprocess (never a
 * mock of it) with tightly controlled environments, so a future refactor that
 * quietly reintroduces an env dependency shows up as a real red test, not a
 * missed code-review comment.
 *
 * Prove-It (done by hand, not just claimed): temporarily reintroduced
 * `exec node "$CLAUDE_PROJECT_DIR/scripts/guard-shared-node-modules.mjs"` in
 * place of the self-locating lines -> every test below in the "env
 * independence" describe block went RED (unbound variable under `set -u`,
 * wrong exit code) -> restored the fixed content -> the whole file went GREEN
 * again. See the PR body for the exact before/after test run this produced.
 */
import { describe, it, expect, afterEach, beforeAll } from "vitest";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { execFileSync } from "node:child_process";

const HOOK_PATH = path.join(__dirname, "..", ".claude", "hooks", "npm-shared-node-modules-guard.sh");

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

/** A real fixture: node_modules/@scope symlinked OUTSIDE this dir — the unsafe shape. */
function mkSharedWorktree(): string {
  const main = mkTmp("cam690-env-main-");
  const child = mkTmp("cam690-env-child-");
  fs.mkdirSync(path.join(main, "node_modules", "@fakescope", "pkg"), { recursive: true });
  fs.mkdirSync(path.join(child, "node_modules"), { recursive: true });
  fs.symlinkSync(path.join(main, "node_modules", "@fakescope"), path.join(child, "node_modules", "@fakescope"));
  return child;
}

/** A real fixture with its own node_modules (no symlink pointing outside it) — the safe shape. */
function mkIsolatedTree(): string {
  const dir = mkTmp("cam690-env-isolated-");
  fs.mkdirSync(path.join(dir, "node_modules", "@fakescope", "pkg"), { recursive: true });
  return dir;
}

function runHook(payload: object, env: NodeJS.ProcessEnv): { status: number; stdout: string; stderr: string } {
  try {
    const stdout = execFileSync(HOOK_PATH, [], {
      input: JSON.stringify(payload),
      encoding: "utf8",
      env,
    });
    return { status: 0, stdout, stderr: "" };
  } catch (err) {
    const e = err as { status?: number | null; stdout?: string; stderr?: string };
    return { status: e.status ?? -1, stdout: e.stdout ?? "", stderr: e.stderr ?? "" };
  }
}

function envWithout(...keys: string[]): NodeJS.ProcessEnv {
  const env = { ...process.env };
  for (const k of keys) delete env[k];
  return env;
}

function envWithBogus(value: string): NodeJS.ProcessEnv {
  return { ...process.env, CLAUDE_PROJECT_DIR: value };
}

beforeAll(() => {
  // the hook script must exist and be a real file before any test below runs
  expect(fs.existsSync(HOOK_PATH)).toBe(true);
});

describe("CAM-690 follow-up: guard hook does not depend on $CLAUDE_PROJECT_DIR", () => {
  it("static pin: the shipped hook has no LIVE shell reference to CLAUDE_PROJECT_DIR", () => {
    const source = fs.readFileSync(HOOK_PATH, "utf8");
    // allow it to appear in a `#`-comment describing the historical bug (the
    // fix's own header explains what broke), but never as an executable
    // shell reference ($CLAUDE_PROJECT_DIR or ${CLAUDE_PROJECT_DIR}) on a
    // non-comment line.
    const codeLines = source.split("\n").filter((line) => !line.trim().startsWith("#"));
    const codeOnly = codeLines.join("\n");
    expect(codeOnly).not.toMatch(/\$\{?CLAUDE_PROJECT_DIR\}?/);
  });

  it("CLAUDE_PROJECT_DIR unset + a shared worktree payload -> denies with exit 2 and the message", () => {
    const sharedDir = mkSharedWorktree();
    const result = runHook(
      { cwd: sharedDir, hook_event_name: "PreToolUse", tool_input: { command: "npm update" } },
      envWithout("CLAUDE_PROJECT_DIR")
    );
    expect(result.status).toBe(2);
    expect(result.stdout).toContain('"permissionDecision":"deny"');
    expect(result.stderr).toContain("ห้ามติดตั้งแพ็กเกจ");
  });

  it("CLAUDE_PROJECT_DIR unset + a main-tree (isolated) payload -> yields with exit 0, no output", () => {
    const isolatedDir = mkIsolatedTree();
    const result = runHook(
      { cwd: isolatedDir, hook_event_name: "PreToolUse", tool_input: { command: "npm update" } },
      envWithout("CLAUDE_PROJECT_DIR")
    );
    expect(result.status).toBe(0);
    expect(result.stdout).toBe("");
    expect(result.stderr).toBe("");
  });

  it("CLAUDE_PROJECT_DIR set to a BOGUS path + a shared worktree payload -> still denies with exit 2 (ignores the env, not just survives its absence)", () => {
    const sharedDir = mkSharedWorktree();
    const result = runHook(
      { cwd: sharedDir, hook_event_name: "PreToolUse", tool_input: { command: "npm update" } },
      envWithBogus("/nonexistent-cam-690-bogus-path")
    );
    expect(result.status).toBe(2);
    expect(result.stdout).toContain('"permissionDecision":"deny"');
  });

  it("CLAUDE_PROJECT_DIR set to a BOGUS path + a main-tree (isolated) payload -> still yields with exit 0", () => {
    const isolatedDir = mkIsolatedTree();
    const result = runHook(
      { cwd: isolatedDir, hook_event_name: "PreToolUse", tool_input: { command: "npm update" } },
      envWithBogus("/nonexistent-cam-690-bogus-path")
    );
    expect(result.status).toBe(0);
    expect(result.stdout).toBe("");
  });

  it("a guarded verb behind a `cd <shared dir> &&` prefix still denies with the env unset (EC-2 x env-independence)", () => {
    const sharedDir = mkSharedWorktree();
    const result = runHook(
      { cwd: "/some/other/cwd", hook_event_name: "PreToolUse", tool_input: { command: `cd ${sharedDir} && npm update` } },
      envWithout("CLAUDE_PROJECT_DIR")
    );
    expect(result.status).toBe(2);
  });

  it("a non-guarded verb (npm run) yields silently with the env unset", () => {
    const sharedDir = mkSharedWorktree();
    const result = runHook(
      { cwd: sharedDir, hook_event_name: "PreToolUse", tool_input: { command: "npm run build" } },
      envWithout("CLAUDE_PROJECT_DIR")
    );
    expect(result.status).toBe(0);
    expect(result.stdout).toBe("");
  });
});

describe("CAM-690 follow-up: wrapper failure mode is fail-closed (exit 2), never an uncontrolled non-2 exit", () => {
  it("an unresolvable repo root (hook copied somewhere with no sibling scripts/) denies with exit 2, not a bare shell error", () => {
    // Simulate the wrapper being invoked from a location where
    // scripts/guard-shared-node-modules.mjs cannot be found two directories
    // up — copy just the hook file into an orphan directory structure.
    const orphanRoot = mkTmp("cam690-orphan-");
    const orphanHookDir = path.join(orphanRoot, ".claude", "hooks");
    fs.mkdirSync(orphanHookDir, { recursive: true });
    const orphanHookPath = path.join(orphanHookDir, "npm-shared-node-modules-guard.sh");
    fs.copyFileSync(HOOK_PATH, orphanHookPath);
    fs.chmodSync(orphanHookPath, 0o755);

    let status: number | null = -999;
    let stderr = "";
    try {
      execFileSync(orphanHookPath, [], {
        input: JSON.stringify({ cwd: orphanRoot, hook_event_name: "PreToolUse", tool_input: { command: "npm update" } }),
        encoding: "utf8",
        env: envWithout("CLAUDE_PROJECT_DIR"),
      });
      status = 0;
    } catch (err) {
      const e = err as { status?: number | null; stderr?: string };
      status = e.status ?? -1;
      stderr = e.stderr ?? "";
    }
    expect(status).toBe(2);
    expect(stderr).toContain("denying by default");
  });
});
