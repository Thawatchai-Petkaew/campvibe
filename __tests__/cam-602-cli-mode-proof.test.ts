/**
 * CAM-602 — real behavioral proof (not source-inspection): spawn the actual
 * `node scripts/ticket-sync.mjs gates` process against a throwaway local HTTP server that
 * simulates a server shape, and confirm the CLI refuses to report a fabricated count when the
 * response carries no proof the server applied `mode=gate` — and reports normally when it
 * does. This is exactly the dispatch's required check: "point the CLI at a server that
 * predates the parameter (or simulate one) and confirm it says it cannot tell rather than
 * printing a count."
 *
 * A real child process (real argv / real exit code / real stdout+stderr) — never an import
 * of ticket-sync.mjs itself (which does top-level env/token work and would exit the test
 * runner's own process on a missing token; see ticket-sync-audit.test.ts's header comment for
 * why the CLI's pure logic is extracted to scripts/lib/* for direct unit testing instead).
 *
 * Uses the ASYNC `child_process.spawn` (not `spawnSync`) deliberately: the fake HTTP server
 * lives in this SAME test process, so a synchronous/blocking spawn would freeze this
 * process's event loop while waiting for the child — and the child's request could then never
 * be accepted (a real deadlock reproduced while writing this test, not a hypothetical).
 */
import { describe, it, expect, afterEach } from "vitest";
import { createServer, type Server, type IncomingMessage } from "node:http";
import { spawn } from "node:child_process";
import path from "node:path";

const SCRIPT = path.resolve(__dirname, "../scripts/ticket-sync.mjs");

let server: Server | null = null;

afterEach(async () => {
  if (!server) return;
  await new Promise<void>((resolve) => server!.close(() => resolve()));
  server = null;
});

function startFakeServer(bodyFor: (req: IncomingMessage) => unknown): Promise<string> {
  return new Promise((resolve) => {
    server = createServer((req, res) => {
      res.writeHead(200, { "content-type": "application/json" });
      res.end(JSON.stringify(bodyFor(req)));
    });
    server.listen(0, "127.0.0.1", () => {
      const addr = server!.address();
      const port = typeof addr === "object" && addr ? addr.port : 0;
      resolve(`http://127.0.0.1:${port}`);
    });
  });
}

function runGates(baseUrl: string): Promise<{ status: number | null; stdout: string; stderr: string }> {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [SCRIPT, "gates"], {
      env: { ...process.env, APP_BASE_URL: baseUrl, STATUS_TOKEN: "test-token" },
    });
    let stdout = "";
    let stderr = "";
    child.stdout.on("data", (d) => (stdout += d));
    child.stderr.on("data", (d) => (stderr += d));
    child.on("error", reject);
    const timer = setTimeout(() => {
      child.kill();
      reject(new Error(`ticket-sync.mjs gates timed out\nstdout:${stdout}\nstderr:${stderr}`));
    }, 15_000);
    child.on("close", (status) => {
      clearTimeout(timer);
      resolve({ status, stdout, stderr });
    });
  });
}

describe("ticket-sync.mjs gates — CAM-602 real-spawn behavioral proof", () => {
  it("[error/validation] refuses to interpret and exits 13 when the response has no appliedMode at all (simulated pre-CAM-595 server: mode=gate silently ignored, general list returned)", async () => {
    const baseUrl = await startFakeServer(() => ({
      // Exactly the shape an older server produces: mode=gate was never read off the URL,
      // so the general (unfiltered) list comes back with a plain 200 — no appliedMode key.
      tickets: [
        { identifier: "CAM-1", state: "DONE" },
        { identifier: "CAM-2", state: "DONE" },
      ],
    }));

    const result = await runGates(baseUrl);

    expect(result.status).toBe(13);
    expect(result.stderr).toMatch(/CANNOT TELL/);
    expect(result.stderr).toMatch(/mode=gate/);
    // teeth: never a fabricated count, in either stream
    expect(result.stdout).not.toMatch(/waiting on you/);
    expect(result.stderr).not.toMatch(/waiting on you/);
  });

  it("[error/validation] refuses and exits 13 when appliedMode is present but names the wrong mode (defense in depth, not just 'missing')", async () => {
    const baseUrl = await startFakeServer(() => ({
      tickets: [{ identifier: "CAM-1", state: "AWAITING_GATE" }],
      total: 1,
      truncated: false,
      appliedMode: "audit", // wrong mode for a `gates` (mode=gate) request
    }));

    const result = await runGates(baseUrl);

    expect(result.status).toBe(13);
    expect(result.stderr).toMatch(/CANNOT TELL/);
  });

  it("[normal] interprets normally and reports the real count when appliedMode proves mode=gate was applied", async () => {
    const baseUrl = await startFakeServer(() => ({
      tickets: [{ identifier: "CAM-1", state: "AWAITING_GATE", currentRole: null, title: "A gate" }],
      total: 1,
      truncated: false,
      appliedMode: "gate",
    }));

    const result = await runGates(baseUrl);

    expect(result.status).not.toBe(13);
    expect(result.stdout).toMatch(/1 waiting on you/);
    expect(result.stderr).not.toMatch(/CANNOT TELL/);
  });

  it("[null/empty] an empty gate set with appliedMode proven still reports normally (no false refusal)", async () => {
    const baseUrl = await startFakeServer(() => ({
      tickets: [],
      total: 0,
      truncated: false,
      appliedMode: "gate",
    }));

    const result = await runGates(baseUrl);

    expect(result.status).not.toBe(13);
    expect(result.stdout).toMatch(/no gates open/);
  });
});
